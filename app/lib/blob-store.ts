
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { DEFAULT_DEPOSITS } from "./model";
import type { DailyEntry, DepositDefinition, Reflection, WeeklyReview } from "./model";

export type DepositOSState = {
  definitions: DepositDefinition[];
  entries: DailyEntry[];
  reflections: Reflection[];
  reviews: WeeklyReview[];
  revision: number;
};

type LoadedState = { state: DepositOSState; pathname: string; etag: string | null };

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
  return `depositos/users/${hash}.json`;
}

export async function readBlobState(userId: string): Promise<LoadedState> {
  const pathname = await userPath(userId);
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: defaultState(), pathname, etag: null };
  const state = await new Response(result.stream).json() as DepositOSState;
  return { state, pathname, etag: result.blob.etag };
}

export async function mutateBlobState<T>(
  userId: string,
  mutation: (state: DepositOSState) => { state: DepositOSState; result: T },
): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const loaded = await readBlobState(userId);
    const draft = structuredClone(loaded.state);
    const { state, result } = mutation(draft);
    state.revision = loaded.state.revision + 1;
    try {
      await put(loaded.pathname, JSON.stringify(state), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        ...(loaded.etag ? { ifMatch: loaded.etag } : {}),
      });
      return result;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError && attempt < 4) continue;
      throw error;
    }
  }
  throw new Error("Could not save after several attempts. Please try again.");
}

