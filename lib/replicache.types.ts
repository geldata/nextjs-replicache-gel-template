import type { MutationV1 } from "replicache";
import { z } from "zod";

export type ClientPushInfo = {
  client_id: MutationV1["clientID"];
  last_mutation_id_in_db: MutationV1["id"];
  last_mutation_id_in_request: MutationV1["id"];
};

const ReplicacheCookie = z.object({
  /**
   * The version of the CVR that was used to generate the patch
   */
  order: z.number(),
});

export type ReplicacheCookie = z.infer<typeof ReplicacheCookie>;

export const CustomPullRequest = z.object({
  cookie: z.nullable(ReplicacheCookie),
  profileID: z.string(),
  clientGroupID: z.string(),
  pullVersion: z.literal(1),
  schemaVersion: z.string(),
});

export type ReplicacheClientGroup = {
  client_group_id: string;
};

export const BaseReplicacheMutation = z.object({
  clientID: z.string(),
  timestamp: z.number(),
  id: z.number(),
});
export type BaseReplicacheMutation = z.infer<typeof BaseReplicacheMutation>;

export const CustomPushRequest = z.object({
  profileID: z.string(),
  clientGroupID: z.string(),
  pushVersion: z.literal(1),
  schemaVersion: z.string(),
  /**
   * un-filtered mutations - they get validated on a per-mutation basis via the `Mutation` type below
   */
  mutations: z.array(BaseReplicacheMutation.passthrough()),
});

/**
 * Processes the `X-Replicache-RequestID` header to extract the clientID, sessionID, and request count.
 *
 * `<clientid>-<sessionid>-<request count>`
 * @docs https://doc.replicache.dev/reference/server-pull#x-replicache-requestid
 */
export function processRequestId(request: Request) {
  const requestID = request.headers.get("X-Replicache-RequestID");
  const [clientID, sessionID, requestCount] = requestID?.split("-") ?? [];

  return { clientID, sessionID, requestCount };
}

export const ReplicacheRowVersion = z.number().brand("ReplicacheRowVersion");
export type ReplicacheRowVersion = z.infer<typeof ReplicacheRowVersion>;

export const ReplicacheId = z.string().brand("ReplicacheId");
export type ReplicacheId = z.infer<typeof ReplicacheId>;

/**
 * "A Client View Record (CVR) is a minimal representation of a Client View snapshot.
 * In other words, it captures what data a Client Group had at a particular moment in time."
 * @docs https://doc.replicache.dev/strategies/row-version#client-view-records */
export const ClientViewRecord = z.record(ReplicacheId, ReplicacheRowVersion);
export type ClientViewRecord = z.infer<typeof ClientViewRecord>;

export const DEFAULT_LAST_MUTATION_ID = 0;

export type WithReplicacheProps<
  T extends {
    replicache_id: string | ReplicacheId;
    replicache_version: number | ReplicacheRowVersion;
  },
> = Omit<T, "replicache_id" | "replicache_version"> & {
  replicache_id: ReplicacheId;
  replicache_version: ReplicacheRowVersion;
};
