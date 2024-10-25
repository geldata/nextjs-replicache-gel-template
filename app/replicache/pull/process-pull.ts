import { build_CVR, DEFAULT_CVR, diff_CVR, is_empty_CVR_diff } from "@/lib/cvr";
import { client } from "@/lib/edgedb";
import {
  create_client_group_mutation,
  update_client_group_mutation,
} from "@/lib/edgedb.mutations";
import { pull_metadata_query, pull_objects_query } from "@/lib/edgedb.queries";
import {
  ClientViewRecord,
  type CustomPullRequest,
  type ReplicacheCookie,
} from "@/lib/replicache.types";
import type { PatchOperation, PullResponseV1 } from "replicache";
import { z } from "zod";

export async function process_pull({
  clientGroupID: client_group_id,
  cookie,
}: z.infer<typeof CustomPullRequest>): Promise<PullResponseV1> {
  const clientWithGlobals = client.withGlobals({
    current_group_id: client_group_id,
  });

  const txResult = await clientWithGlobals.transaction(async (tx) => {
    // #1: Get the client group and the data that changed since the last pull
    const { client_group, replicache_objects_metadata } =
      await pull_metadata_query.run(tx, { client_group_id });

    console.debug("[process-pull] metadata:", {
      client_group,
      replicache_objects_metadata,
    });

    const base_CVR_version = cookie?.order ?? 0;
    const next_CVR_version =
      Math.max(base_CVR_version, client_group.cvr_version) + 1;

    // #2 Create groups that aren't yet in the database
    if (!client_group.in_db) {
      await create_client_group_mutation.run(tx, {
        client_group_id: client_group.client_group_id,
      });
    }

    // #3 calculate what data needs to changed based on CVRs
    const stored_CVR_parsed = ClientViewRecord.safeParse(
      client_group.client_view_record,
    );
    const prev_CVR = stored_CVR_parsed?.data || DEFAULT_CVR;
    const next_CVR = build_CVR(replicache_objects_metadata);

    const diff = diff_CVR(prev_CVR, next_CVR);

    // #3.1 If diff is empty, return no-op PR
    if (prev_CVR && is_empty_CVR_diff(diff)) {
      return null;
    }

    // #4 Pull the full object data for those that have changed
    const objects_to_put =
      diff.puts.length > 0
        ? await pull_objects_query.run(tx, {
            replicache_ids: diff.puts,
          })
        : [];

    // #5 Construct the patch operations
    const patch: PatchOperation[] = [
      ...diff.dels.map((replicache_id) => ({
        op: "del" as const,
        key: replicache_id,
      })),
      ...Object.values(objects_to_put)
        .flat()
        .map((object) => ({
          op: "put" as const,
          key: object.replicache_id,
          value: JSON.parse(JSON.stringify(object)),
        })),
    ];

    const clients_last_mutation_id: Record<string, number> = Object.fromEntries(
      client_group.clients.map((client) => [
        client.client_id,
        client.last_mutation_id,
      ]),
    );

    // #6 Update the client group's CVR and version
    await update_client_group_mutation.run(tx, {
      client_group_id: client_group.client_group_id,
      cvr_version: next_CVR_version,
      client_view_record: next_CVR,
    });

    return {
      patch,
      clients_last_mutation_id,
      next_CVR_version,
    };
  });

  // #7 If diff is empty, return no-op PR
  if (txResult === null) {
    return {
      cookie,
      lastMutationIDChanges: {},
      patch: [],
    };
  }

  return {
    patch: txResult.patch,
    lastMutationIDChanges: txResult.clients_last_mutation_id,
    cookie: {
      order: txResult.next_CVR_version,
    } satisfies ReplicacheCookie,
  };
}
