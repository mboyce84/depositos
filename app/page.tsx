
"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { DailyEntry, DepositDefinition, Pillar, Reflection, WeeklyReview } from "./lib/model";
import { PILLARS } from "./lib/model";

type Screen = "today" | "history" | "deposits" | "insights" | "cope" | "review";
type AppData = { definitions: DepositDefinition[]; entries: DailyEntry[]; reflections: Reflection[]; reviews: WeeklyReview[] };

const NAV: [Screen, string, string][] = [
  ["today", "Today", "◆"], ["history", "History", "▦"], ["deposits", "My deposits", "≡"],
  ["insights", "Patterns", "⌁"], ["cope", "Cope differently", "↻"], ["review", "Sunday reset", "✓"],
];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function localDate(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
function fromISO(value: string) { return new Date(`${value}T12:00:00`); }
function shiftDate(value: string, days: number) { const d = fromISO(value); d.setDate(d.getDate() + days); return localDate(d); }
function formatDate(value: string, options: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" }) { return fromISO(value).toLocaleDateString("en-US", options); }
function weekStart(value: string) { const d = fromISO(value); d.setDate(d.getDate() - d.getDay()); return localDate(d); }
function scheduledFor(definitions: DepositDefinition[], date: string) { return definitions.filter((d) => date >= d.activeFrom && (!d.archivedAt || date < d.archivedAt) && d.scheduleDays.includes(fromISO(date).getDay())); }
function entryFor(entries: DailyEntry[], date: string, depositId: string) { return entries.find((e) => e.entryDate === date && e.depositId === depositId); }
function summaryFor(definitions: DepositDefinition[], entries: DailyEntry[], date: string) {
  const scheduled = scheduledFor(definitions, date);
  const completed = scheduled.filter((d) => entryFor(entries, date, d.id)?.completed).length;
  return { completed, total: scheduled.length, score: scheduled.length ? Math.round(completed / scheduled.length * 100) : 0 };
}
async function send(payload: Record<string, unknown>) {
  const response = await fetch("/api/depositos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(String(body.error || "Could not save your changes."));
  return body;
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("today");
  const [selectedDate, setSelectedDate] = useState(localDate());
  const [data, setData] = useState<AppData>({ definitions: [], entries: [], reflections: [], reviews: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/depositos?date=${selectedDate}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load DepositOS.");
      setData({ definitions: body.definitions, entries: body.entries, reflections: body.reflections, reviews: body.reviews });
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load DepositOS."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const saveEntry = async (entry: Omit<DailyEntry, "updatedAt">) => {
    const previous = data.entries;
    const next = { ...entry, updatedAt: new Date().toISOString() };
    setData((d) => ({ ...d, entries: [next, ...d.entries.filter((e) => !(e.entryDate === entry.entryDate && e.depositId === entry.depositId))] }));
    setSaving(true); setError("");
    try { await send({ action: "saveEntry", ...entry }); }
    catch (e) { setData((d) => ({ ...d, entries: previous })); setError(e instanceof Error ? e.message : "Your change was not saved."); }
    finally { setSaving(false); }
  };
  const saveDeposit = async (deposit: Partial<DepositDefinition>) => {
    setSaving(true); setError("");
    try {
      const body = await send({ action: "saveDeposit", deposit });
      const saved = body.deposit as DepositDefinition;
      setData((d) => ({ ...d, definitions: [...d.definitions.filter((x) => x.id !== saved.id), saved].sort((a,b) => a.position-b.position) }));
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Deposit was not saved."); return false; }
    finally { setSaving(false); }
  };
  const setDepositActive = async (id: string, active: boolean) => {
    const before = data.definitions;
    setData((d) => ({ ...d, definitions: d.definitions.map((x) => x.id === id ? { ...x, active } : x) }));
    try { await send({ action: "setDepositActive", id, active }); }
    catch (e) { setData((d) => ({ ...d, definitions: before })); setError(e instanceof Error ? e.message : "Deposit was not updated."); }
  };
  const chooseDay = (date: string) => { setSelectedDate(date); setScreen("today"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={() => setScreen("today")}><span className="brand-mark"><span /></span><span>Deposit<span>OS</span></span></button>
      <div className="identity-card"><div className="avatar">MB</div><div><strong>Marquiste</strong><span>Building the man behind the mission</span></div></div>
      <nav aria-label="Primary navigation"><p className="eyebrow">Your operating system</p>{NAV.map(([id,label,icon]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="sidebar-bottom"><p>System status</p><strong>{data.definitions.filter((d) => d.active).length} active deposits</strong><span>{saving ? "Saving changes…" : "Everything saved"}</span><button onClick={() => setScreen("deposits")}>Edit your system →</button></div>
    </aside>

    <section className="workspace" id="top">
      <header className="topbar">
        <button className="mobile-brand" onClick={() => setScreen("today")}><span className="brand-mark"><span /></span>DepositOS</button>
        <DateNavigator date={selectedDate} onChange={chooseDay} />
        <div className="top-actions"><span className={`sync-state ${error ? "bad" : ""}`}>{saving ? "Saving…" : error ? "Needs attention" : "● Synced"}</span><button className="avatar small" aria-label="Open profile">MB</button></div>
      </header>
      {error && <div className="error-banner"><span>{error}</span><button onClick={load}>Try again</button></div>}
      {loading ? <LoadingState /> : <>
        {screen === "today" && <DayView date={selectedDate} definitions={data.definitions} entries={data.entries} onSave={saveEntry} onPrevious={() => chooseDay(shiftDate(selectedDate,-1))} onNext={() => chooseDay(shiftDate(selectedDate,1))} openHistory={() => setScreen("history")} />}
        {screen === "history" && <HistoryView selectedDate={selectedDate} definitions={data.definitions} entries={data.entries} onChoose={chooseDay} />}
        {screen === "deposits" && <DepositsView definitions={data.definitions} onSave={saveDeposit} onActive={setDepositActive} saving={saving} />}
        {screen === "insights" && <InsightsView definitions={data.definitions} entries={data.entries} reflections={data.reflections} onChoose={chooseDay} />}
        {screen === "cope" && <CopeView reflections={data.reflections} onSave={async (reflection) => { const body = await send({ action: "saveReflection", reflection }); setData((d) => ({ ...d, reflections: [body.reflection as Reflection, ...d.reflections] })); }} />}
        {screen === "review" && <ReviewView date={selectedDate} definitions={data.definitions} entries={data.entries} reviews={data.reviews} onSave={async (review) => { const body = await send({ action: "saveReview", review }); const saved = body.review as WeeklyReview; setData((d) => ({ ...d, reviews: [saved, ...d.reviews.filter((r) => r.id !== saved.id)] })); }} />}
      </>}
    </section>
    <nav className="mobile-nav" aria-label="Mobile navigation">{NAV.slice(0,5).map(([id,label,icon]) => <button key={id} className={screen === id ? "active" : ""} onClick={() => setScreen(id)}><span>{icon}</span><span>{label === "My deposits" ? "Deposits" : label.split(" ")[0]}</span></button>)}</nav>
  </main>;
}

function DateNavigator({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  return <div className="date-navigator">
    <button aria-label="Previous day" onClick={() => onChange(shiftDate(date,-1))}>←</button>
    <label><span>{date === localDate() ? "Today" : formatDate(date,{weekday:"short"})}</span><strong>{formatDate(date,{month:"short",day:"numeric",year: fromISO(date).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined})}</strong><input aria-label="Choose a date" type="date" value={date} onChange={(e) => e.target.value && onChange(e.target.value)} /></label>
    <button aria-label="Next day" onClick={() => onChange(shiftDate(date,1))}>→</button>
    {date !== localDate() && <button className="today-jump" onClick={() => onChange(localDate())}>Today</button>}
  </div>;
}

function LoadingState() { return <div className="loading-state"><span /><span /><span /><p>Loading your operating system…</p></div>; }

function DayView({ date, definitions, entries, onSave, onPrevious, onNext, openHistory }: { date: string; definitions: DepositDefinition[]; entries: DailyEntry[]; onSave: (entry: Omit<DailyEntry,"updatedAt">) => void; onPrevious:()=>void; onNext:()=>void; openHistory:()=>void }) {
  const deposits = scheduledFor(definitions,date);
  const summary = summaryFor(definitions,entries,date);
  const unfinished = deposits.find((d) => !entryFor(entries,date,d.id)?.completed);
  const isToday = date === localDate();
  const update = (deposit: DepositDefinition, changes: Partial<DailyEntry>) => {
    const current = entryFor(entries,date,deposit.id);
    onSave({ depositId: deposit.id, entryDate: date, completed: current?.completed || false, value: current?.value ?? null, note: current?.note || "", ...changes });
  };
  return <div className="page-content">
    <section className="hero-row"><div><p className="eyebrow brass">{isToday ? "Today’s rebuild" : "Daily record"}</p><h1>{isToday ? "Make the next deposit." : formatDate(date,{weekday:"long",month:"long",day:"numeric"})}</h1><p>{isToday ? "Build the day in front of you—one honest vote at a time." : "Review or correct this day. Every change is saved to your history."}</p></div><ScoreRing score={summary.score} label="daily score" /></section>
    <section className="day-command-bar"><button onClick={onPrevious}>← Previous day</button><div><strong>{summary.completed} of {summary.total}</strong><span> deposits completed</span></div><button onClick={openHistory}>Open calendar</button><button onClick={onNext}>Next day →</button></section>
    {unfinished && <section className="focus-card"><div><p className="eyebrow">Next meaningful deposit</p><h2>{unfinished.name}</h2><p>{unfinished.description}</p></div><button onClick={() => update(unfinished,{completed:true})}>Make this deposit →</button></section>}
    <div className="section-heading"><div><p className="eyebrow">Scheduled for this day</p><h2>Your deposits</h2></div><span>{summary.completed} of {summary.total} made</span></div>
    {deposits.length ? <section className="deposit-list">{deposits.map((deposit) => {
      const entry = entryFor(entries,date,deposit.id);
      return <article key={deposit.id} className={`deposit-row-v2 ${entry?.completed ? "done" : ""}`}>
        <button className="check" onClick={() => update(deposit,{completed:!entry?.completed})} aria-label={`${entry?.completed ? "Undo" : "Complete"} ${deposit.name}`}>{entry?.completed ? "✓" : ""}</button>
        <div className="deposit-main"><div><span className={`pillar ${deposit.pillar.toLowerCase()}`}>{deposit.pillar}</span><h3>{deposit.name}</h3></div><p>{deposit.description}</p><EntryNote value={entry?.note || ""} onSave={(note) => update(deposit,{note})} /></div>
        {deposit.measurementType === "number" ? <MetricInput deposit={deposit} value={entry?.value ?? null} onSave={(value) => update(deposit,{value,completed: deposit.target ? value >= deposit.target : entry?.completed || false})} /> : <button className="text-action" onClick={() => update(deposit,{completed:!entry?.completed})}>{entry?.completed ? "Deposited" : "Mark done"}</button>}
      </article>;
    })}</section> : <EmptyState title="No deposits scheduled" text="This day is clear. Add or schedule deposits in My deposits." />}
  </div>;
}

function ScoreRing({ score, label }: { score: number; label: string }) { return <div className="score-ring" style={{"--score":`${score*3.6}deg`} as React.CSSProperties}><div><strong>{score}</strong><span>{label}</span></div></div>; }
function MetricInput({ deposit, value, onSave }: { deposit: DepositDefinition; value: number|null; onSave:(value:number)=>void }) {
  const [draft,setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)),[value]);
  const commit = () => { if (draft !== "" && Number.isFinite(Number(draft))) onSave(Number(draft)); };
  const percent = deposit.target ? Math.min(100,((Number(draft)||0)/deposit.target)*100) : 0;
  return <div className="metric-control"><label><input type="number" min="0" value={draft} onChange={(e)=>setDraft(e.target.value)} onBlur={commit} onKeyDown={(e)=>e.key === "Enter" && e.currentTarget.blur()} aria-label={`${deposit.name} amount`} /><span>{deposit.target ? `/ ${deposit.target}` : ""} {deposit.unit}</span></label>{deposit.target && <div><span style={{width:`${percent}%`}} /></div>}</div>;
}
function EntryNote({ value, onSave }: { value:string; onSave:(value:string)=>void }) {
  const [open,setOpen] = useState(Boolean(value)); const [draft,setDraft]=useState(value);
  useEffect(()=>setDraft(value),[value]);
  if (!open) return <button className="note-toggle" onClick={()=>setOpen(true)}>+ Add note</button>;
  return <div className="entry-note"><input value={draft} maxLength={500} placeholder="What happened? Add context…" onChange={(e)=>setDraft(e.target.value)} onBlur={()=>draft !== value && onSave(draft)} /><button aria-label="Close note" onClick={()=>setOpen(false)}>×</button></div>;
}

function HistoryView({ selectedDate, definitions, entries, onChoose }: { selectedDate:string; definitions:DepositDefinition[]; entries:DailyEntry[]; onChoose:(date:string)=>void }) {
  const [month,setMonth] = useState(selectedDate.slice(0,7));
  const first = new Date(`${month}-01T12:00:00`); const calendarStart = new Date(first); calendarStart.setDate(1-first.getDay());
  const days = Array.from({length:42},(_,i)=>{ const d=new Date(calendarStart); d.setDate(d.getDate()+i); return localDate(d); });
  const moveMonth=(delta:number)=>{ const d=new Date(`${month}-01T12:00:00`); d.setMonth(d.getMonth()+delta); setMonth(localDate(d).slice(0,7)); };
  const recent = Array.from({length:21},(_,i)=>shiftDate(localDate(),-i));
  return <div className="page-content inner-page history-page"><p className="eyebrow brass">History</p><h1>See the whole rebuild.</h1><p className="page-lede">Open any day to review it, correct it, or add the context you forgot in the moment.</p>
    <section className="calendar-card"><header><button onClick={()=>moveMonth(-1)}>←</button><div><p className="eyebrow">Calendar</p><h2>{first.toLocaleDateString("en-US",{month:"long",year:"numeric"})}</h2></div><button onClick={()=>moveMonth(1)}>→</button></header>
      <div className="calendar-weekdays">{DAY_NAMES.map((d)=><span key={d}>{d}</span>)}</div><div className="calendar-grid">{days.map((day)=>{ const s=summaryFor(definitions,entries,day); const inMonth=day.startsWith(month); return <button key={day} className={`${inMonth?"":"outside"} ${day===localDate()?"today":""} ${day===selectedDate?"selected":""}`} onClick={()=>onChoose(day)}><span>{fromISO(day).getDate()}</span>{s.total>0?<><strong>{s.score}%</strong><i><em style={{width:`${s.score}%`}} /></i></>:<small>Rest</small>}</button>;})}</div>
    </section>
    <section className="history-list"><div className="section-heading"><div><p className="eyebrow">Recent days</p><h2>Your daily ledger</h2></div></div>{recent.map((day)=>{ const s=summaryFor(definitions,entries,day); return <button key={day} onClick={()=>onChoose(day)}><time>{formatDate(day,{weekday:"short",month:"short",day:"numeric"})}</time><div><i><em style={{width:`${s.score}%`}} /></i><span>{s.completed} of {s.total}</span></div><strong>{s.score}%</strong><b>→</b></button>;})}</section>
  </div>;
}

const emptyDeposit: Partial<DepositDefinition> = { name:"",description:"",pillar:"Self",measurementType:"check",unit:"",target:null,scheduleDays:[0,1,2,3,4,5,6],activeFrom:localDate(),archivedAt:null };
function DepositsView({ definitions,onSave,onActive,saving }: { definitions:DepositDefinition[]; onSave:(d:Partial<DepositDefinition>)=>Promise<boolean>; onActive:(id:string,active:boolean)=>void; saving:boolean }) {
  const [editing,setEditing] = useState<Partial<DepositDefinition>|null>(null);
  const active=definitions.filter((d)=>d.active), archived=definitions.filter((d)=>!d.active);
  return <div className="page-content inner-page deposits-page"><div className="page-title-action"><div><p className="eyebrow brass">My deposits</p><h1>Define the system.</h1><p className="page-lede">Choose exactly what counts, how it is measured, and which days it belongs on.</p></div><button className="primary-button" onClick={()=>setEditing({...emptyDeposit})}>+ New deposit</button></div>
    <section className="system-summary"><div><strong>{active.length}</strong><span>active deposits</span></div><div><strong>{active.filter((d)=>d.measurementType==="number").length}</strong><span>number targets</span></div><div><strong>{active.filter((d)=>d.scheduleDays.length===7).length}</strong><span>daily deposits</span></div><p>Changes here immediately update Today, History, Patterns, and Sunday Reset.</p></section>
    <section className="definition-list">{active.map((deposit)=><article key={deposit.id}><span className={`definition-icon ${deposit.pillar.toLowerCase()}`}>{deposit.name.charAt(0)}</span><div><div><span className={`pillar ${deposit.pillar.toLowerCase()}`}>{deposit.pillar}</span><h3>{deposit.name}</h3></div><p>{deposit.description || "No description"}</p><small>{deposit.scheduleDays.length===7?"Every day":deposit.scheduleDays.map((d)=>DAY_NAMES[d]).join(" · ")}{deposit.measurementType==="number"?` · ${deposit.target ? `Goal ${deposit.target}` : "Number"} ${deposit.unit}`:" · Check off"}</small></div><button onClick={()=>setEditing({...deposit,scheduleDays:[...deposit.scheduleDays]})}>Edit</button><button className="archive-button" onClick={()=>onActive(deposit.id,false)}>Archive</button></article>)}</section>
    {archived.length>0&&<details className="archived-list"><summary>{archived.length} archived deposit{archived.length===1?"":"s"}</summary>{archived.map((d)=><div key={d.id}><span>{d.name}</span><button onClick={()=>onActive(d.id,true)}>Restore</button></div>)}</details>}
    {editing&&<DepositEditor deposit={editing} saving={saving} onClose={()=>setEditing(null)} onSave={async(d)=>{ if(await onSave(d)) setEditing(null); }} />}
  </div>;
}
function DepositEditor({deposit,saving,onClose,onSave}:{deposit:Partial<DepositDefinition>;saving:boolean;onClose:()=>void;onSave:(d:Partial<DepositDefinition>)=>void}) {
  const [draft,setDraft]=useState(deposit); const set=<K extends keyof DepositDefinition>(key:K,value:DepositDefinition[K])=>setDraft((d)=>({...d,[key]:value}));
  const toggleDay=(day:number)=>set("scheduleDays",draft.scheduleDays?.includes(day)?draft.scheduleDays.filter((d)=>d!==day):[...(draft.scheduleDays||[]),day].sort());
  return <div className="editor-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><form className="deposit-editor" onSubmit={(e)=>{e.preventDefault();onSave(draft)}}><header><div><p className="eyebrow">{draft.id?"Edit deposit":"New deposit"}</p><h2>{draft.id?draft.name:"What will you track?"}</h2></div><button type="button" onClick={onClose}>×</button></header>
    <label className="input-field"><span>Name</span><input autoFocus required maxLength={80} value={draft.name||""} onChange={(e)=>set("name",e.target.value)} placeholder="e.g. Read with the kids" /></label>
    <label className="input-field"><span>Why it matters / instructions</span><textarea maxLength={180} rows={3} value={draft.description||""} onChange={(e)=>set("description",e.target.value)} placeholder="Make the action obvious and meaningful" /></label>
    <div className="editor-pair"><label className="input-field"><span>Pillar</span><select value={draft.pillar} onChange={(e)=>set("pillar",e.target.value as Pillar)}>{PILLARS.map((p)=><option key={p}>{p}</option>)}</select></label><label className="input-field"><span>How to track</span><select value={draft.measurementType} onChange={(e)=>set("measurementType",e.target.value as "check"|"number")}><option value="check">Simple check-off</option><option value="number">Number / amount</option></select></label></div>
    {draft.measurementType==="number"&&<div className="editor-pair"><label className="input-field"><span>Target (optional)</span><input type="number" min="0" value={draft.target??""} onChange={(e)=>set("target",e.target.value===""?null:Number(e.target.value))} placeholder="190" /></label><label className="input-field"><span>Unit</span><input maxLength={16} value={draft.unit||""} onChange={(e)=>set("unit",e.target.value)} placeholder="g, oz, minutes…" /></label></div>}
    <fieldset className="day-picker"><legend>Which days should it appear?</legend>{DAY_NAMES.map((name,day)=><button type="button" key={name} className={draft.scheduleDays?.includes(day)?"active":""} onClick={()=>toggleDay(day)}>{name.charAt(0)}<span>{name}</span></button>)}</fieldset>
    <footer><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" disabled={saving||!draft.name||!draft.scheduleDays?.length}>{saving?"Saving…":"Save deposit"}</button></footer>
  </form></div>;
}

function InsightsView({definitions,entries,reflections,onChoose}:{definitions:DepositDefinition[];entries:DailyEntry[];reflections:Reflection[];onChoose:(d:string)=>void}) {
  const days=Array.from({length:30},(_,i)=>shiftDate(localDate(),-(29-i))); const summaries=days.map((d)=>summaryFor(definitions,entries,d));
  const avg=Math.round(summaries.reduce((n,s)=>n+s.score,0)/summaries.length); const recorded=summaries.filter((s)=>s.completed>0).length;
  const performances=definitions.filter((d)=>d.active).map((d)=>{const eligible=days.filter((day)=>d.scheduleDays.includes(fromISO(day).getDay()));const done=eligible.filter((day)=>entryFor(entries,day,d.id)?.completed).length;return{d,done,total:eligible.length,rate:eligible.length?Math.round(done/eligible.length*100):0}}).sort((a,b)=>b.rate-a.rate);
  const best=performances.find((p)=>p.done>0), opportunity=[...performances].reverse().find((p)=>p.total>0);
  return <div className="page-content inner-page"><p className="eyebrow brass">Pattern intelligence</p><h1>Your data, not a demo.</h1><p className="page-lede">Every score and pattern below is calculated from the deposits you actually recorded.</p>
    <section className="insight-hero"><div><p className="eyebrow">Last 30 days</p><h2>{recorded?`${avg}% average consistency across ${recorded} active days.`:"Start recording deposits to reveal your patterns."}</h2><p>{best?`${best.d.name} is currently your strongest repeated vote at ${best.rate}%.`:"Your first completed day will begin the story."}</p></div><span className="ai-badge">Live data</span></section>
    <section className="chart-card"><div className="section-heading compact"><div><p className="eyebrow">Consistency</p><h2>Last 14 days</h2></div><strong>{avg}% <span>30-day average</span></strong></div><div className="bar-chart interactive">{days.slice(-14).map((day,i)=>{const s=summaries.slice(-14)[i];return <button key={day} onClick={()=>onChoose(day)} title={`${formatDate(day)}: ${s.score}%`}><span style={{height:`${Math.max(3,s.score)}%`}} /><small>{fromISO(day).toLocaleDateString("en-US",{weekday:"narrow"})}</small></button>})}</div></section>
    <section className="pattern-grid"><article><span>01</span><p>Strongest deposit</p><h3>{best?.d.name||"Not enough data"}</h3><strong>{best?`${best.done} of ${best.total} opportunities`:"Complete a deposit"}</strong></article><article><span>02</span><p>Recorded days</p><h3>{recorded} of 30</h3><strong>{recorded>=20?"A meaningful sample":"Keep building the record"}</strong></article><article><span>03</span><p>Next opportunity</p><h3>{opportunity?.d.name||"Define a deposit"}</h3><strong>{opportunity?`${opportunity.rate}% consistency`:"Build your system"}</strong></article></section>
    <section className="history-card"><div><p className="eyebrow">Cope differently</p><h2>{reflections.length?`${reflections.length} saved reflection${reflections.length===1?"":"s"}`:"No pressure patterns yet"}</h2></div><p>{reflections[0]?.commitment||"Save a reflection to connect pressure triggers with better replacement deposits."}</p></section>
  </div>;
}

function CopeView({reflections,onSave}:{reflections:Reflection[];onSave:(r:Omit<Reflection,"id"|"createdAt">)=>Promise<void>}) {
  const empty={pressure:"",oldLoop:"",reward:"",cost:"",replacement:"",friction:"",commitment:""}; const [step,setStep]=useState(1);const[form,setForm]=useState(empty);const[saving,setSaving]=useState(false);const[complete,setComplete]=useState(false);
  const update=(key:keyof typeof form,value:string)=>setForm((f)=>({...f,[key]:value})); const submit=async(e:FormEvent)=>{e.preventDefault();setSaving(true);await onSave(form);setSaving(false);setComplete(true);setStep(3)};
  return <div className="page-content inner-page cope-page"><p className="eyebrow brass">Cope differently</p><h1>Pressure doesn’t get the last word.</h1><p className="page-lede">Move from pressure → escape → regret to pressure → pause → better deposit → better tomorrow.</p><div className="stepper"><span className={step>=1?"active":""}>1 <em>Notice the loop</em></span><i/><span className={step>=2?"active":""}>2 <em>Name the deposit</em></span><i/><span className={step>=3?"active":""}>3 <em>Commit</em></span></div>
    {step<3?<form className="reflection-form" onSubmit={submit}><div className="form-intro"><span>{step===1?"The old loop":"The rebuild response"}</span><h2>{step===1?"Name it without judging it.":"Make the better choice easier."}</h2></div>{step===1?<><Field label="What pressure sends you into the old loop?" value={form.pressure} onChange={(v)=>update("pressure",v)} placeholder="Feeling behind after a chaotic day"/><Field label="What do you usually do?" value={form.oldLoop} onChange={(v)=>update("oldLoop",v)} placeholder="Check out, drink, scroll…"/><Field label="What temporary reward does it give you?" value={form.reward} onChange={(v)=>update("reward",v)} placeholder="A few minutes of quiet"/><Field label="How does it make tomorrow harder?" value={form.cost} onChange={(v)=>update("cost",v)} placeholder="Poor sleep, low energy"/></>:<><Field label="What healthier deposit can you make instead?" value={form.replacement} onChange={(v)=>update("replacement",v)} placeholder="Take a 10-minute walk"/><Field label="How can you reduce the friction?" value={form.friction} onChange={(v)=>update("friction",v)} placeholder="Leave shoes by the door"/><div className="field-wide"><Field label="Complete your commitment statement" value={form.commitment} onChange={(v)=>update("commitment",v)} placeholder="When I feel behind, I will…"/></div></>}<div className="form-actions">{step===2&&<button type="button" className="secondary" onClick={()=>setStep(1)}>Back</button>}<button disabled={step===1?!form.pressure||!form.oldLoop:!form.replacement||!form.commitment||saving} type={step===1?"button":"submit"} onClick={()=>step===1&&setStep(2)}>{step===1?"Build replacement plan":saving?"Saving…":"Save commitment"} →</button></div></form>:<section className="commitment-card"><span className="seal">D</span><p className="eyebrow">Saved to your history</p><blockquote>“{form.commitment}”</blockquote><p>The next time pressure rises, the plan is already made.</p><button onClick={()=>{setForm(empty);setStep(1);setComplete(false)}}>{complete?"Create another":"Start again"}</button></section>}
    {reflections.length>0&&<section className="reflection-history"><div className="section-heading compact"><div><p className="eyebrow">History</p><h2>Saved rebuild responses</h2></div></div>{reflections.map((r)=><article key={r.id}><time>{new Date(r.createdAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</time><div><strong>{r.pressure}</strong><p>{r.commitment}</p></div></article>)}</section>}
  </div>;
}
function Field({label,value,onChange,placeholder}:{label:string;value:string;onChange:(v:string)=>void;placeholder:string}) {return <label className="field"><span>{label}</span><textarea rows={2} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder}/></label>}

function ReviewView({date,definitions,entries,reviews,onSave}:{date:string;definitions:DepositDefinition[];entries:DailyEntry[];reviews:WeeklyReview[];onSave:(r:{weekStart:string;win:string;lesson:string;nextDeposit:string})=>Promise<void>}) {
  const start=weekStart(date); const days=Array.from({length:7},(_,i)=>shiftDate(start,i)); const summaries=days.map((d)=>summaryFor(definitions,entries,d)); const total=summaries.reduce((n,s)=>n+s.total,0);const done=summaries.reduce((n,s)=>n+s.completed,0);const score=total?Math.round(done/total*100):0;const existing=reviews.find((r)=>r.weekStart===start);const[answers,setAnswers]=useState({win:existing?.win||"",lesson:existing?.lesson||"",nextDeposit:existing?.nextDeposit||""});const[saved,setSaved]=useState(false);
  useEffect(()=>setAnswers({win:existing?.win||"",lesson:existing?.lesson||"",nextDeposit:existing?.nextDeposit||""}),[existing?.id,start]);
  return <div className="page-content inner-page review-page"><p className="eyebrow brass">Sunday reset · Week of {formatDate(start,{month:"short",day:"numeric"})}</p><h1>Review. Rebuild. Begin again.</h1><p className="page-lede">A weekly ritual built from your actual daily records.</p><section className="week-score"><ScoreRing score={score} label="week score"/><div><p className="eyebrow">Your week at a glance</p><h2>{done?`You made ${done} of ${total} scheduled deposits.`:"This week is waiting for its first deposit."}</h2><p>{days.map((d,i)=>`${DAY_NAMES[fromISO(d).getDay()]} ${summaries[i].score}%`).join(" · ")}</p></div></section>
    <section className="weekly-numbers"><article><strong>{done}</strong><span>deposits made</span></article><article><strong>{total-done}</strong><span>still open</span></article><article><strong>{summaries.filter((s)=>s.score===100).length}</strong><span>perfect days</span></article><article><strong>{score}%</strong><span>weekly score</span></article></section>
    <section className="review-form"><div><p className="eyebrow">Make meaning</p><h2>Three honest answers.</h2></div><Field label="What are you proud of this week?" value={answers.win} onChange={(v)=>setAnswers({...answers,win:v})} placeholder="Name the promise you kept…"/><Field label="What did the week teach you?" value={answers.lesson} onChange={(v)=>setAnswers({...answers,lesson:v})} placeholder="Name the pattern, without shame…"/><div className="field-wide"><Field label="What one deposit will make next week better?" value={answers.nextDeposit} onChange={(v)=>setAnswers({...answers,nextDeposit:v})} placeholder="Keep it small and specific…"/></div><button disabled={!answers.win||!answers.nextDeposit} onClick={async()=>{await onSave({weekStart:start,...answers});setSaved(true)}}>{saved||existing?"✓ Review saved":"Complete Sunday reset"}</button></section>
  </div>;
}
function EmptyState({title,text}:{title:string;text:string}) {return <section className="empty-state"><span>◇</span><h2>{title}</h2><p>{text}</p></section>}

