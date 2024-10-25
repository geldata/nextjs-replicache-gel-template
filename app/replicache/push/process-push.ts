import { client as edgedb_client } from "@/lib/edgedb";
import {
  create_client_group_mutation,
  create_client_mutation,
  update_client_last_mutation,
} from "@/lib/edgedb.mutations";
import { fetch_client_and_group_query } from "@/lib/edgedb.queries";
import { Mutation } from "@/lib/mutation.types";
import { MUTATORS_DB } from "@/lib/mutators.db";
import {
  type BaseReplicacheMutation,
  type CustomPushRequest,
} from "@/lib/replicache.types";
import type { Client } from "edgedb";
import type { PushResponse } from "replicache";
import { z } from "zod";

export async function process_push({
  clientGroupID: client_group_id,
  mutations,
}: z.infer<typeof CustomPushRequest>): Promise<
  PushResponse | { success: true }
> {
  const clientWithGlobals = edgedb_client.withGlobals({
    current_group_id: client_group_id,
  });

  for (const rawMutation of mutations) {
    await perform_mutation({
      edgedb_client: clientWithGlobals,
      client_group_id,
      rawMutation,
    });
  }

  return {
    success: true,
  };
}

async function perform_mutation({
  edgedb_client,
  client_group_id,
  rawMutation,
}: {
  edgedb_client: Client;
  client_group_id: string;
  rawMutation: BaseReplicacheMutation;
}) {
  await edgedb_client.transaction(async (tx) => {
    /** #1 fetch the client group & client */
    const { client, client_group } = await fetch_client_and_group_query.run(
      tx,
      {
        client_group_id,
        client_id: rawMutation.clientID,
      },
    );

    /** #2 create the group in the DB if it doesn't yet exist */
    if (!client_group.in_db) {
      console.debug("[process-push] creating client group", {
        client_group_id: client_group.client_group_id,
      });
      await create_client_group_mutation.run(tx, {
        client_group_id: client_group.client_group_id,
      });
    }

    /** #3 create the client in the DB if it doesn't yet exist */
    if (!client.in_db) {
      console.debug("[process-push] creating client", {
        client_id: client.client_id,
        client_group_id: client_group.client_group_id,
      });
      await create_client_mutation.run(tx, {
        client_id: client.client_id,
        client_group_id: client_group.client_group_id,
      });
    }

    const parsedMutation = Mutation.safeParse(rawMutation);

    /** #4.1 Skip invalid mutations
     * Even if the mutation is invalid, we treat it as completed
     * to avoid the client from retrying it indefinitely.
     * See: https://doc.replicache.dev/reference/server-push#error-handling
     */
    if (!parsedMutation.success) {
      console.debug(
        `[process-push] mutation ${rawMutation.id} has incorrect schema`,
        {
          rawMutation,
          error: JSON.stringify(parsedMutation.error.issues, null, 2),
        },
      );
      return;
    }

    const mutation = parsedMutation.data;
    const next_mutation_id = client.last_mutation_id + 1;

    /** #4.2 Skip already processed mutations */
    if (mutation.id < next_mutation_id) {
      console.debug(
        `[process-push] mutation ${mutation.id} has already been processed - skipping`,
        {
          mutation,
          client,
        },
      );
      return;
    }

    /** #4.3 Rollback and error if from future */
    if (mutation.id > next_mutation_id) {
      throw new Error(
        `[process-push] mutation ${mutation.id} is from the future - aborting. Next mutation id is ${next_mutation_id}`,
      );
    }

    const handler = MUTATORS_DB[mutation.name];
    /** #4.4 If no handler for the mutation, rollback and error
     * It's an implementation error: a known schema (it's passed the zod parsing), but the handler is missing.
     * Better to crash and have the developer fix it, than to silently skip the mutation.
     */
    if (!handler) {
      throw new Error(
        `[process-push] skipping unknown mutation "${mutation.name}". Add a handler for it in MUTATION_HANDLERS if you want to process it.`,
      );
    }

    /** #5 perform the actual mutation */
    console.debug(
      `[process-push] performing "${mutation.name}" mutation`,
      mutation,
    );
    await handler({
      tx,
      client_group,
      client,
      // @ts-expect-error Too complex to typecheck - zod's already done the runtime work
      mutation,
    });

    /** #6 update the client's `last_mutation_id` in the db
     * @TODO: in the canonical Replicache todo-row-versioning example, they update the client_group with the same CVR version as it started with.
     * I'm assuming that's unneeded, but need to verify.
     */
    await update_client_last_mutation.run(tx, {
      client_group_id,
      client_id: client.client_id,
      last_mutation_id: next_mutation_id,
    });
  });
}
