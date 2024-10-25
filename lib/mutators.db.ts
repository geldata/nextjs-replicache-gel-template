import { client as edgedb_client } from "@/lib/edgedb";
import {
  create_todo_mutation,
  delete_object_mutation,
  update_todo_mutation,
} from "@/lib/edgedb.mutations";
import { type fetch_client_and_group_query } from "@/lib/edgedb.queries";
import { z } from "zod";
import type { Mutation } from "./mutation.types";

/**
 * Mutators that are executed on the server to modify state in the database.
 * If an update mutation needs to do any conflict resolution, it should be handled in the handler.
 *
 * A simple conflict resolution strategy is that of property-based last-writer-wins: in the `updateTodo` example above,
 * arguments are optional and the `update_todo_mutation` will only update the fields provided in the mutation.
 *
 * These mutators produce **canonical** mutations, which get sent to front-end clients and replace any speculative mutations they may have.
 *
 * See Replicache docs for more information: https://doc.replicache.dev/byob/remote-mutations
 */
export const MUTATORS_DB: {
  [MutationName in z.infer<typeof Mutation>["name"]]: (
    args: {
      mutation: Extract<z.infer<typeof Mutation>, { name: MutationName }>;
      tx: Parameters<Parameters<typeof edgedb_client.transaction>[0]>[0];
    } & Awaited<ReturnType<typeof fetch_client_and_group_query.run>>,
  ) => Promise<unknown>; // result of the mutation is discarded
} = {
  create_todo: ({ tx, client_group, mutation }) =>
    create_todo_mutation.run(tx, {
      client_group_id: client_group.client_group_id,
      complete: mutation.args.complete,
      content: mutation.args.content,
      replicache_id: mutation.args.replicache_id,
      created_at: mutation.args.created_at,
    }),

  delete_object: ({ tx, mutation }) =>
    delete_object_mutation.run(tx, {
      replicache_id: mutation.args.replicache_id,
    }),

  update_todo: ({ tx, mutation }) =>
    update_todo_mutation.run(tx, {
      replicache_id: mutation.args.replicache_id,
      complete: mutation.args.complete,
      content: mutation.args.content,
    }),
};
