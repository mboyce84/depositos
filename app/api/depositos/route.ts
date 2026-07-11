Exit code: 0
Wall time: 2.1 seconds
Output:
import { mutateBlobState, readBlobState } from "../../lib/blob-store";
import { PILLARS } from "../../lib/model";
import type { DepositDefinition, Reflection, WeeklyReview } from "../../lib/model";

function userId(request: Request) {
  return (request.headers.get("oai-authenticated-user-email") || "marquiste").trim().toLowerCase();
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function errorResponse(error: unknown) {
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const uid = userId(request);
    const url = new URL(request.url);
    const { state } = await readBlobState(uid);
    return Response.json({
      selectedDate: validDate(url.searchParams.get("date")) ? url.searchParams.get("date") : new Date().toISOString().slice(0, 10),
      definitions: state.definitions,
      entries: state.entries,
      reflections: state.reflections,
      reviews: state.reviews,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const uid = userId(request);
    const payload = await request.json() as Record<string, unknown>;
    const action = String(payload.action || "");
    const now = new Date().toISOString();

    if (action === "saveEntry") {
      const depositId = String(payload.depositId || "");
      const entryDate = String(payload.entryDate || "");
      if (!depositId || !validDate(entryDate)) return Response.json({ error: "A deposit and valid date are required." }, { status: 400 });
      const entry = await mutateBlobState(uid, (state) => {
        if (!state.definitions.some((deposit) => deposit.id === depositId)) throw new Error("Deposit not found.");
        const saved = {
          depositId,
          entryDate,
          completed: Boolean(payload.completed),
          value: payload.value === null || payload.value === "" || payload.value === undefined ? null : Number(payload.value),
          note: String(payload.note || "").slice(0, 500),
          updatedAt: now,
        };
        state.entries = [saved, ...state.entries.filter((item) => !(item.entryDate === entryDate && item.depositId === depositId))];
        return { state, result: saved };
      });
      return Response.json({ entry });
    }

    if (action === "saveDeposit") {
      const draft = (payload.deposit || {}) as Partial<DepositDefinition>;
      const name = String(draft.name || "").trim().slice(0, 80);
      const pillar = String(draft.pillar || "Self");
      const measurementType = draft.measurementType === "number" ? "number" : "check";
      const scheduleDays = Array.isArray(draft.scheduleDays) ? [...new Set(draft.scheduleDays.map(Number).filter((day) => day >= 0 && day <= 6))].sort() : [];
      if (!name || !PILLARS.includes(pillar as never) || !scheduleDays.length) return Response.json({ error: "Name, pillar, and at least one day are required." }, { status: 400 });
      const saved = await mutateBlobState(uid, (state) => {
        const existing = draft.id ? state.definitions.find((deposit) => deposit.id === draft.id) : null;
        const deposit: DepositDefinition = {
          id: existing?.id || crypto.randomUUID(),
          name,
          description: String(draft.description || "").trim().slice(0, 180),
          pillar: pillar as DepositDefinition["pillar"],
          measurementType,
          unit: measurementType === "number" ? String(draft.unit || "").trim().slice(0, 16) : "",
          target: measurementType === "number" && draft.target !== null && draft.target !== undefined && draft.target !== ("" as never) ? Number(draft.target) : null,
          scheduleDays,
          position: existing?.position ?? state.definitions.reduce((max, deposit) => Math.max(max, deposit.position), -1) + 1,
          active: existing?.active ?? true,
          activeFrom: existing?.activeFrom || now.slice(0, 10),
          archivedAt: existing?.archivedAt || null,
        };
        state.definitions = [...state.definitions.filter((item) => item.id !== deposit.id), deposit].sort((a, b) => a.position - b.position);
        return { state, result: deposit };
      });
      return Response.json({ deposit: saved });
    }

    if (action === "setDepositActive") {
      const id = String(payload.id || "");
      const active = Boolean(payload.active);
      await mutateBlobState(uid, (state) => {
        state.definitions = state.definitions.map((deposit) => deposit.id === id ? { ...deposit, active, archivedAt: active ? null : now.slice(0, 10) } : deposit);
        return { state, result: true };
      });
      return Response.json({ id, active });
    }

    if (action === "saveReflection") {
      const draft = (payload.reflection || {}) as Partial<Reflection>;
      if (!draft.pressure || !draft.oldLoop || !draft.replacement || !draft.commitment) return Response.json({ error: "Complete the required reflection fields." }, { status: 400 });
      const reflection = await mutateBlobState(uid, (state) => {
        const saved: Reflection = { id: crypto.randomUUID(), createdAt: now, pressure: draft.pressure!, oldLoop: draft.oldLoop!, reward: draft.reward || "", cost: draft.cost || "", replacement: draft.replacement!, friction: draft.friction || "", commitment: draft.commitment! };
        state.reflections = [saved, ...state.reflections].slice(0, 100);
        return { state, result: saved };
      });
      return Response.json({ reflection });
    }

    if (action === "saveReview") {
      const draft = (payload.review || {}) as Partial<WeeklyReview>;
      const start = String(draft.weekStart || "");
      if (!validDate(start) || !draft.win || !draft.nextDeposit) return Response.json({ error: "Week, win, and next deposit are required." }, { status: 400 });
      const review = await mutateBlobState(uid, (state) => {
        const saved: WeeklyReview = { id: `${uid}:${start}`, weekStart: start, win: draft.win!, lesson: draft.lesson || "", nextDeposit: draft.nextDeposit!, updatedAt: now };
        state.reviews = [saved, ...state.reviews.filter((item) => item.weekStart !== start)].slice(0, 52);
        return { state, result: saved };
      });
      return Response.json({ review });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

