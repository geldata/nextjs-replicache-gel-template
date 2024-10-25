import e from "@/dbschema/edgeql";
import { DEFAULT_LAST_MUTATION_ID } from "./replicache.types";

export const update_client_last_mutation = e.params(
  {
    client_group_id: e.str,
    client_id: e.str,
    last_mutation_id: e.int64,
  },
  (params) =>
    e.update(e.ReplicacheClient, (c) => ({
      filter_single: e.op(
        e.op(c.client_id, "=", params.client_id),
        "and",
        e.op(c.client_group.client_group_id, "=", params.client_group_id),
      ),
      set: {
        last_mutation_id: params.last_mutation_id,
      },
    })),
);

export const modify_clients_mutation = e.params(
  {
    client_group_id: e.str,
    new: e.array(
      e.tuple({
        client_id: e.str,
        last_mutation_id_in_request: e.int64,
        last_mutation_id_in_db: e.int64,
      }),
    ),
    in_db: e.array(
      e.tuple({
        client_id: e.str,
        last_mutation_id_in_request: e.int64,
        last_mutation_id_in_db: e.int64,
      }),
    ),
  },
  (params) => {
    const client_group = e.select(e.ReplicacheClientGroup, (rg) => ({
      filter_single: e.op(rg.client_group_id, "=", params.client_group_id),
    }));

    return e.select({
      new: e.for(e.array_unpack(params.new), (client) =>
        e.insert(e.ReplicacheClient, {
          client_group,
          client_id: client.client_id,
          last_mutation_id: client.last_mutation_id_in_request,
        }),
      ),
      in_server: e.assert_distinct(
        e.for(e.array_unpack(params.in_db), (client) =>
          e.update(e.ReplicacheClient, (c) => ({
            filter_single: e.op(c.client_id, "=", client.client_id),
            set: {
              last_mutation_id: client.last_mutation_id_in_request,
            },
          })),
        ),
      ),
    });
  },
);

export const delete_object_mutation = e.params(
  {
    replicache_id: e.str,
  },
  (params) => {
    return e.delete(e.ReplicacheObject, (t) => ({
      filter_single: e.op(t.replicache_id, "=", params.replicache_id),
    }));
  },
);

export const create_todo_mutation = e.params(
  {
    complete: e.bool,
    content: e.str,
    replicache_id: e.str,
    client_group_id: e.str,
    created_at: e.datetime,
  },
  (params) => {
    return e.insert(e.Todo, {
      complete: params.complete,
      content: params.content,
      replicache_id: params.replicache_id,
      created_at: params.created_at,
      client_group: e.select(e.ReplicacheClientGroup, (rg) => ({
        filter_single: e.op(rg.client_group_id, "=", params.client_group_id),
      })),
    });
  },
);

export const update_todo_mutation = e.params(
  {
    replicache_id: e.str,
    complete: e.optional(e.bool),
    content: e.optional(e.str),
  },
  (params) => {
    return e.update(e.Todo, (t) => ({
      filter_single: e.op(t.replicache_id, "=", params.replicache_id),
      set: {
        complete: e.op(params.complete, "??", t.complete),
        content: e.op(params.content, "??", t.content),
      },
    }));
  },
);

export const create_client_group_mutation = e.params(
  {
    client_group_id: e.str,
  },
  (params) =>
    e.insert(e.ReplicacheClientGroup, {
      client_group_id: params.client_group_id,
    }),
);

export const create_client_mutation = e.params(
  {
    client_id: e.str,
    client_group_id: e.str,
  },
  (params) =>
    e.insert(e.ReplicacheClient, {
      client_id: params.client_id,
      client_group: e.select(e.ReplicacheClientGroup, (rg) => ({
        filter_single: e.op(rg.client_group_id, "=", params.client_group_id),
      })),
      last_mutation_id: e.int64(DEFAULT_LAST_MUTATION_ID),
    }),
);

export const update_client_group_mutation = e.params(
  {
    client_group_id: e.str,
    cvr_version: e.int64,
    client_view_record: e.json,
  },
  (params) =>
    e.update(e.ReplicacheClientGroup, (group) => ({
      filter_single: e.op(group.client_group_id, "=", params.client_group_id),

      set: {
        client_view_record: params.client_view_record,
        cvr_version: params.cvr_version,
      },
    })),
);
