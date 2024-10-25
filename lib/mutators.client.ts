import type { Todo } from "@/dbschema/interfaces";
import type {
  MutatorDefs,
  ReadonlyJSONObject,
  WriteTransaction,
} from "replicache";
import type { z } from "zod";
import type { Mutation, MutationName } from "./mutation.types";

export type ReplicacheMutators = Record<MutationName, MutatorDefs[string]>;

/**
 * Mutators that are executed on the client to modify state in the front-end cache.
 *
 * Mutations will be sent to the server via the push endpoint, and may be processed differently from the client.
 * The result of these client mutators are **_speculative_**, and will be discarded in favor of the server's **_canonical_** mutations.
 *
 * See Replicache docs for more information: https://doc.replicache.dev/byob/local-mutations
 */
export const MUTATORS_CLIENT: {
  [M in MutationName]: (
    tx: WriteTransaction,
    mutation: Extract<z.infer<typeof Mutation>, { name: M }>["args"],
  ) => Promise<unknown>; // result of the mutation is discarded
} = {
  delete_object: async (tx, { replicache_id }) => {
    await tx.del(replicache_id);
  },

  create_todo: async (tx, todo) => {
    await tx.set(todo.replicache_id, {
      ...todo,
      created_at: new Date(todo.created_at).toISOString(),
    });
  },

  update_todo: async (tx, update) => {
    const prev = (await tx.get(update.replicache_id)) as unknown as Todo;
    const next = {
      ...prev,
      ...update,
      complete: update.complete ?? prev.complete,
      content: update.content ?? prev.content,
    } satisfies Todo;
    await tx.set(next.replicache_id, next as unknown as ReadonlyJSONObject);
  },
};
