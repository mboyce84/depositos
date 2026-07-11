
import { ensureDatabase, getD1 } from "../../../db";
import { DEFAULT_DEPOSITS, PILLARS } from "../../lib/model";
import { hasBlobStore, mutateBlobState, readBlobState } from "../../lib/blob-store";
import type { DepositDefinition, Reflection, WeeklyReview } from "../../lib/model";

export const runtime = "edge";

type Row = Record<string, string | number | null>;

function userId(request: Request) {
  return (request.headers.get("oai-authenticated-user-email") || "marquiste").trim().toLowerCase();
}

function validDate(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function seedDeposits(db: D1Database, uid: string) {
  const count = await db.prepare("SELECT COUNT(*) AS total FROM deposit_definitions WHERE user_id = ?").bind(uid).first<{ total: number }>();
  if (Number(count?.total || 0) > 0) return;
  const now = new Date().toISOString();
  await db.batch(DEFAULT_DEPOSITS.map((deposit, position) => db.prepare(`
    INSERT INTO deposit_definitions
    (id, user_id, name, description, pillar, measurement_type, unit, target, schedule_days, position, active, active_from, archived_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '2000-01-01', NULL, ?, ?)
  `).bind(deposit.id, uid, deposit.name, deposit.description, deposit.pillar, deposit.measurementType, deposit.unit, deposit.target, JSON.stringify(deposit.scheduleDays), position, now, now)));
}

function mapDeposit(row: Row) {
  return {
    id: String(row.id), name: String(row.name), description: String(row.description || ""),
    pillar: String(row.pillar), measurementType: String(row.measurement_type), unit: String(row.unit || ""),
    target: row.target === null ? null : Number(row.target),
    scheduleDays: JSON.parse(String(row.schedule_days || "[]")),
    position: Number(row.position), active: Boolean(row.active),
    activeFrom: String(row.active_from || "2000-01-01"), archivedAt: row.archived_at ? String(row.archived_at) : null,
  };
}

function mapEntry(row: Row) {
  return {
    depositId: String(row.deposit_id), entryDate: String(row.entry_date),
    completed: Boolean(row.completed), value: row.value === null ? null : Number(row.value),
    note: String(row.note || ""), updatedAt: String(row.updated_at),
  };
}

function errorResponse(error: unknown) {
  console.error(error);
  return Response.json({ error: error instanceof Error ? error.message : "Unexpected error" }, { status: 500 });
}

export async function GET(request: Request) {
  try {
    const uid = userId(request);
    if (hasBlobStore()) {
      const { state } = await readBlobState(uid);
      return Response.json({
        selectedDate: validDate(new URL(request.url).searchParams.get("date")) ? new URL(request.url).searchParams.get("date") : new Date().toISOString().slice(0, 10),
        definitions: state.definitions,
        entries: state.entries,
        reflections: state.reflections,
        reviews: state.reviews,
      });
    }
    await ensureDatabase();
    const db = await getD1();
    await seedDeposits(db, uid);
    const url = new URL(request.url);
    const selectedDate = validDate(url.searchParams.get("date")) ? String(url.searchParams.get("date")) : new Date().toISOString().slice(0, 10);
    const [definitions, entries, reflections, reviews] = await Promise.all([
      db.prepare("SELECT * FROM deposit_definitions WHERE user_id = ? ORDER BY position, created_at").bind(uid).all<Row>(),
      db.prepare("SELECT * FROM daily_entries WHERE user_id = ? ORDER BY entry_date DESC, updated_at DESC").bind(uid).all<Row>(),
      db.prepare("SELECT * FROM cope_reflections WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(uid).all<Row>(),
      db.prepare("SELECT * FROM weekly_reviews WHERE user_id = ? ORDER BY week_start DESC LIMIT 26").bind(uid).all<Row>(),
    ]);

    return Response.json({
      selectedDate,
      definitions: definitions.results.map(mapDeposit),
      entries: entries.results.map(mapEntry),
      reflections: reflections.results.map((r) => ({
        id: String(r.id), createdAt: String(r.created_at), pressure: String(r.pressure),
        oldLoop: String(r.old_loop), reward: String(r.reward || ""), cost: String(r.cost || ""),
        replacement: String(r.replacement), friction: String(r.friction || ""), commitment: String(r.commitment),
      })),
      reviews: reviews.results.map((r) => ({
        id: String(r.id), weekStart: String(r.week_start), win: String(r.win), lesson: String(r.lesson || ""),
        nextDeposit: String(r.next_deposit), updatedAt: String(r.updated_at),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const uid = userId(request);
    const payload = await request.json() as Record<string, unknown>;
    if (hasBlobStore()) return handleBlobPost(uid, payload);
    await ensureDatabase();
    const db = await getD1();
    await seedDeposits(db, uid);
    const action = String(payload.action || "");
    const now = new Date().toISOString();

    if (action === "saveEntry") {
      const depositId = String(payload.depositId || "");
      const entryDate = String(payload.entryDate || "");
      if (!depositId || !validDate(entryDate)) return Response.json({ error: "A deposit and valid date are required." }, { status: 400 });
      const definition = await db.prepare("SELECT id FROM deposit_definitions WHERE id = ? AND user_id = ?").bind(depositId, uid).first();
      if (!definition) return Response.json({ error: "Deposit not found." }, { status: 404 });
      const id = `${uid}:${entryDate}:${depositId}`;
      const completed = payload.completed ? 1 : 0;
      const value = payload.value === null || payload.value === "" || payload.value === undefined ? null : Number(payload.value);
      const note = String(payload.note || "").slice(0, 500);
      await db.prepare(`INSERT INTO daily_entries (id, user_id, entry_date, deposit_id, completed, value, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET completed = excluded.completed, value = excluded.value, note = excluded.note, updated_at = excluded.updated_at`
      ).bind(id, uid, entryDate, depositId, completed, value, note, now).run();
      return Response.json({ entry: { depositId, entryDate, completed: Boolean(completed), value, note, updatedAt: now } });
    }

    if (action === "saveDeposit") {
      const draft = (payload.deposit || {}) as Record<string, unknown>;
      const name = String(draft.name || "").trim().slice(0, 80);
      const pillar = String(draft.pillar || "Self");
      const measurementType = draft.measurementType === "number" ? "number" : "check";
      const scheduleDays = Array.isArray(draft.scheduleDays) ? draft.scheduleDays.map(Number).filter((d) => d >= 0 && d <= 6) : [];
      if (!name || !PILLARS.includes(pillar as never) || scheduleDays.length === 0) return Response.json({ error: "Name, pillar, and at least one day are required." }, { status: 400 });
      const existingId = String(draft.id || "");
      const id = existingId || crypto.randomUUID();
      const owned = existingId ? await db.prepare("SELECT id FROM deposit_definitions WHERE id = ? AND user_id = ?").bind(existingId, uid).first() : null;
      const max = await db.prepare("SELECT COALESCE(MAX(position), -1) AS position FROM deposit_definitions WHERE user_id = ?").bind(uid).first<{ position: number }>();
      const target = measurementType === "number" && draft.target !== null && draft.target !== "" && draft.target !== undefined ? Number(draft.target) : null;
      const values = [name, String(draft.description || "").trim().slice(0, 180), pillar, measurementType, measurementType === "number" ? String(draft.unit || "").trim().slice(0, 16) : "", target, JSON.stringify([...new Set(scheduleDays)].sort()), now];
      if (owned) {
        await db.prepare(`UPDATE deposit_definitions SET name=?, description=?, pillar=?, measurement_type=?, unit=?, target=?, schedule_days=?, updated_at=? WHERE id=? AND user_id=?`).bind(...values, id, uid).run();
      } else {
        await db.prepare(`INSERT INTO deposit_definitions (id,user_id,name,description,pillar,measurement_type,unit,target,schedule_days,position,active,active_from,archived_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?,NULL,?,?)`).bind(id, uid, ...values.slice(0, 7), Number(max?.position ?? -1) + 1, now.slice(0,10), now, now).run();
      }
      const saved = await db.prepare("SELECT * FROM deposit_definitions WHERE id = ? AND user_id = ?").bind(id, uid).first<Row>();
      return Response.json({ deposit: saved ? mapDeposit(saved) : null });
    }

    if (action === "setDepositActive") {
      const id = String(payload.id || "");
      await db.prepare("UPDATE deposit_definitions SET active = ?, archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(payload.active ? 1 : 0, payload.active ? null : now.slice(0,10), now, id, uid).run();
      return Response.json({ id, active: Boolean(payload.active) });
    }

    if (action === "saveReflection") {
      const reflection = (payload.reflection || {}) as Record<string, unknown>;
      if (!reflection.pressure || !reflection.oldLoop || !reflection.replacement || !reflection.commitment) return Response.json({ error: "Complete the required reflection fields." }, { status: 400 });
      const id = crypto.randomUUID();
      await db.prepare(`INSERT INTO cope_reflections (id,user_id,created_at,pressure,old_loop,reward,cost,replacement,friction,commitment) VALUES (?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, uid, now, reflection.pressure, reflection.oldLoop, reflection.reward || "", reflection.cost || "", reflection.replacement, reflection.friction || "", reflection.commitment).run();
      return Response.json({ reflection: { ...reflection, id, createdAt: now } });
    }

    if (action === "saveReview") {
      const review = (payload.review || {}) as Record<string, unknown>;
      const weekStart = String(review.weekStart || "");
      if (!validDate(weekStart) || !review.win || !review.nextDeposit) return Response.json({ error: "Week, win, and next deposit are required." }, { status: 400 });
      const id = `${uid}:${weekStart}`;
      await db.prepare(`INSERT INTO weekly_reviews (id,user_id,week_start,win,lesson,next_deposit,updated_at) VALUES (?,?,?,?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET win=excluded.win, lesson=excluded.lesson, next_deposit=excluded.next_deposit, updated_at=excluded.updated_at`
      ).bind(id, uid, weekStart, review.win, review.lesson || "", review.nextDeposit, now).run();
      return Response.json({ review: { id, weekStart, win: review.win, lesson: review.lesson || "", nextDeposit: review.nextDeposit, updatedAt: now } });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}

async function handleBlobPost(uid: string, payload: Record<string, unknown>) {
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
}

