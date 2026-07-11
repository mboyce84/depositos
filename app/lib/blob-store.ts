import { get, list, put } from "@vercel/blob";
import { DEFAULT_DEPOSITS } from "./model";
import type { DailyEntry, DepositDefinition, Reflection, WeeklyReview } from "./model";

export type DepositOSState = {
  definitions: DepositDefinition[];
  entries: DailyEntry[];
  reflections: Reflection[];
  reviews: WeeklyReview[];
  revision: number;
};

type LoadedState = { state: DepositOSState; prefix: string };

export function hasBlobStore() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function defaultState(): DepositOSState {
  return {
    definitions: DEFAULT_DEPOSITS.map((deposit, position) => ({
      ...deposit,
      position,
      active: true,
      activeFrom: "2000-01-01",
      archivedAt: null,
    })),
    entries: [],
    reflections: [],
    reviews: [],
    revision: 0,
  };
}

async function userPath(userId: string) {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `depositos/users/${hash}/`;
}

export async function readBlobState(userId: string): Promise<LoadedState> {
  const prefix = await userPath(userId);
  const catalog = await list({ prefix, limit: 1000 });
  const latest = [...catalog.blobs].sort((a, b) => b.pathname.localeCompare(a.pathname))[0];
  if (!latest) return { state: defaultState(), prefix };
  const result = await get(latest.pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: defaultState(), prefix };
  const state = await new Response(result.stream).json() as DepositOSState;
  return { state, prefix };
}

export async function mutateBlobState<T>(
  userId: string,
  mutation: (state: DepositOSState) => { state: DepositOSState; result: T },
): Promise<T> {
  const loaded = await readBlobState(userId);
  const draft = structuredClone(loaded.state);
  const { state, result } = mutation(draft);
  state.revision = loaded.state.revision + 1;
  const version = `${String(Date.now()).padStart(13, "0")}-${crypto.randomUUID()}.json`;
  await put(`${loaded.prefix}${version}`, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
  return result;
}
