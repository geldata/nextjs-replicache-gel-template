import { nanoid } from "nanoid";
import type { ReplicacheId } from "./replicache.types";

export const REPLICACHE_ID_PREFIXES = {
  todo: "todo",
} as const;

type EdgedbObjectType =
  (typeof REPLICACHE_ID_PREFIXES)[keyof typeof REPLICACHE_ID_PREFIXES];

export function generate_replicache_id(type: EdgedbObjectType) {
  return `${type}/${nanoid()}` as ReplicacheId;
}
