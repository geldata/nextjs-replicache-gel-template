import { z } from "zod";
import { BaseReplicacheMutation, ReplicacheId } from "./replicache.types";

const datelike = z.union([z.string(), z.date()]);

const DeleteObjectMutation = BaseReplicacheMutation.extend({
  name: z.literal("delete_object"),
  args: z.object({
    replicache_id: ReplicacheId,
  }),
});

const CreateTodoMutation = BaseReplicacheMutation.extend({
  name: z.literal("create_todo"),
  args: z.object({
    replicache_id: ReplicacheId,
    created_at: datelike.pipe(z.coerce.date()),
    complete: z.boolean(),
    content: z.string(),
  }),
});

const UpdateTodoMutation = BaseReplicacheMutation.extend({
  name: z.literal("update_todo"),
  args: z.object({
    replicache_id: ReplicacheId,
    complete: z.boolean().optional(),
    content: z.string().optional(),
  }),
});

export const Mutation = z.discriminatedUnion("name", [
  DeleteObjectMutation,
  CreateTodoMutation,
  UpdateTodoMutation,
]);

export type Mutation = z.infer<typeof Mutation>;

export type MutationName = Mutation["name"];
