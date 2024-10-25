import e from "@/dbschema/edgeql";
import type { $expr_Select } from "@/dbschema/edgeql/select";
import { DEFAULT_CVR_VERSION } from "./cvr";
import { REPLICACHE_ID_PREFIXES } from "./ids";
import { DEFAULT_LAST_MUTATION_ID } from "./replicache.types";
import type { $str } from "@/dbschema/edgeql/modules/std";
import type { $expr_Param } from "@/dbschema/edgeql/params";
import type {
  ArrayType,
  scalarTypeWithConstructor,
} from "@/dbschema/edgeql/reflection";

export const fetch_client_and_group_query = e.params(
  {
    client_group_id: e.str,
    client_id: e.str,
  },
  (params) => {
    const stored_client_group = e.select(e.ReplicacheClientGroup, (rg) => ({
      filter_single: e.op(rg.client_group_id, "=", params.client_group_id),

      client_group_id: true,
      cvr_version: true,
      in_db: e.bool(true),
    }));

    // In case the client group doesn't exist, return a default
    const client_group = e.select({
      client_group_id: e.op(
        stored_client_group.client_group_id,
        "??",
        params.client_group_id,
      ),
      cvr_version: e.op(
        stored_client_group.cvr_version,
        "??",
        e.int64(DEFAULT_CVR_VERSION),
      ),
      in_db: e.op(stored_client_group.in_db, "??", e.bool(false)),
    });

    const stored_client = e.select(e.ReplicacheClient, (c) => ({
      filter_single: e.op(
        e.op(c.client_group, "=", stored_client_group),
        "and",
        e.op(c.client_id, "=", params.client_id),
      ),

      client_id: true,
      last_mutation_id: true,
      in_db: e.bool(true),
    }));

    // In case the client doesn't exist, return a default
    const client = e.select({
      client_id: e.op(stored_client.client_id, "??", params.client_id),
      last_mutation_id: e.op(
        stored_client.last_mutation_id,
        "??",
        e.int64(DEFAULT_LAST_MUTATION_ID),
      ),
      in_db: e.op(stored_client.in_db, "??", e.bool(false)),
    });

    return e.select({
      client_group,
      client,
    });
  },
);

export const pull_metadata_query = e.params(
  {
    client_group_id: e.str,
  },
  (params) => {
    const stored_client_group = e.select(e.ReplicacheClientGroup, (rg) => ({
      filter_single: e.op(rg.client_group_id, "=", params.client_group_id),

      client_group_id: true,
      client_view_record: true,
      cvr_version: true,
      in_db: e.bool(true),
    }));

    // In case the client group doesn't exist, return a default
    const client_group = e.select({
      client_group_id: e.op(
        stored_client_group.client_group_id,
        "??",
        params.client_group_id,
      ),
      cvr_version: e.op(stored_client_group.cvr_version, "??", e.int64(0)),
      clients: e.select(e.ReplicacheClient, (c) => ({
        filter: e.op(c.client_group, "=", stored_client_group),

        client_id: true,
        last_mutation_id: true,
      })),
      in_db: e.op(stored_client_group.in_db, "??", e.bool(false)),
      client_view_record: e.op(
        stored_client_group.client_view_record,
        "??",
        e.json({}),
      ),
    });

    // Due to access policies in EdgeDB, only those objects that are visible to the current user are returned
    const replicache_objects_metadata = e.select(e.ReplicacheObject, () => ({
      replicache_id: true,
      replicache_version: true,
    }));

    return e.select({
      client_group,
      replicache_objects_metadata,
    });
  },
);

type PullObjectsQueryParams = {
  replicache_ids: $expr_Param<
    "replicache_ids",
    ArrayType<scalarTypeWithConstructor<$str, never>, "array<std::str>">,
    false
  >;
};

const QUERIES_PER_TYPE = (params: PullObjectsQueryParams) =>
  ({
    [REPLICACHE_ID_PREFIXES.todo]: e.select(e.Todo, (t) => ({
      filter: e.op(
        t.replicache_id,
        "in",
        e.array_unpack(params.replicache_ids),
      ),

      ...e.Todo["*"],
    })),
  }) as const satisfies Record<
    (typeof REPLICACHE_ID_PREFIXES)[keyof typeof REPLICACHE_ID_PREFIXES],
    $expr_Select
  >;

export const pull_objects_query = e.params(
  {
    replicache_ids: e.array(e.str),
  },
  (params) => {
    return e.select(QUERIES_PER_TYPE(params));
  },
);
