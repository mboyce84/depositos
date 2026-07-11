"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Deposit = {
  id: string;
  label: string;
  detail: string;
  pillar: "Body" | "Faith" | "Family" | "Business" | "Self";
  unit?: string;
  target?: number;
  value?: number;
  done: boolean;
};

type Reflection = {
  id: number;
  createdAt: string;
  pressure: string;
  oldLoop: string;
  reward: string;
  cost: string;
  replacement: string;
  friction: string;
  commitment: string;
};

const seedDeposits: Deposit[] = [
  { id: "walk", label: "Fasted walk", detail: "30 minutes before the noise", pillar: "Body", done: true },
  { id: "protein", label: "Protein target", detail: "Build every meal around it", pillar: "Body", unit: "g", target: 190, value: 142, done: false },
  { id: "calories", label: "Calories & macros", detail: "Fuel the mission with intention", pillar: "Body", unit: " kcal", target: 2400, value: 1840, done: false },
  { id: "water", label: "Water", detail: "Steady energy, clearer decisions", pillar: "Body", unit: "oz", target: 120, value: 88, done: false },
  { id: "workout", label: "Strength session", detail: "Upper body · 45 min", pillar: "Body", done: true },
  { id: "blood-pressure", label: "Blood pressure", detail: "124 / 78 · steady", pillar: "Body", done: true },
  { id: "weight", label: "Weight check-in", detail: "286.4 lb · down 1.8 this week", pillar: "Body", done: true },
  { id: "alcohol", label: "Alcohol-free", detail: "Protect tomorrow morning", pillar: "Self", done: true },
  { id: "prayer", label: "Prayer", detail: "10 quiet minutes", pillar: "Faith", done: true },
  { id: "family", label: "Family deposit", detail: "Phones down at dinner", pillar: "Family", done: false },
  { id: "walk2", label: "Post-dinner walk", detail: "Invite the family", pillar: "Family", done: false },
  { id: "writing", label: "Writing block", detail: "Ship 500 honest words", pillar: "Business", done: true },
  { id: "reflection", label: "Daily reflection", detail: "Turn today’s data into wisdom", pillar: "Self", done: false },
  { id: "sleep", label: "Sleep window", detail: "In bed by 10:30 PM", pillar: "Self", done: false },
];

const nav = [
  ["today", "Today"],
  ["insights", "Patterns"],
  ["cope", "Cope differently"],
  ["review", "Sunday reset"],
] as const;

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = { today: "◆", insights: "⌁", cope: "↻", review: "✓" };
  return <span aria-hidden="true">{icons[name]}</span>;
}

export default function Home() {
  const [active, setActive] = useState<(typeof nav)[number][0]>("today");
  const [deposits, setDeposits] = useState<Deposit[]>(seedDeposits);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const storedDeposits = localStorage.getItem("depositos-deposits");
    const storedReflections = localStorage.getItem("depositos-reflections");
    if (storedDeposits) setDeposits(JSON.parse(storedDeposits));
    if (storedReflections) setReflections(JSON.parse(storedReflections));
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem("depositos-deposits", JSON.stringify(deposits));
    localStorage.setItem("depositos-reflections", JSON.stringify(reflections));
  }, [deposits, reflections, loaded]);

  const score = Math.round((deposits.filter((d) => d.done).length / deposits.length) * 100);
  const completed = deposits.filter((d) => d.done).length;
  const mostImportant = deposits.find((d) => !d.done)?.label ?? "Protect the streak";

  const toggle = (id: string) => {
    setDeposits((current) => current.map((d) => (d.id === id ? { ...d, done: !d.done } : d)));
  };

  const changeValue = (id: string, value: number) => {
    setDeposits((current) =>
      current.map((d) => (d.id === id ? { ...d, value, done: Boolean(d.target && value >= d.target) } : d)),
    );
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="DepositOS home">
          <span className="brand-mark"><span /></span>
          <span>Deposit<span>OS</span></span>
        </a>
        <div className="identity-card">
          <div className="avatar">MB</div>
          <div><strong>Marquiste</strong><span>Building the man behind the mission</span></div>
        </div>
        <nav aria-label="Primary navigation">
          <p className="eyebrow">Your operating system</p>
          {nav.map(([id, label]) => (
            <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
              <Icon name={id} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <p>Current identity</p>
          <blockquote>“I am a present, disciplined builder who keeps promises to himself.”</blockquote>
          <button onClick={() => setActive("review")}>Refine identity <span>→</span></button>
        </div>
      </aside>

      <section className="workspace" id="top">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setActive("today")}><span className="brand-mark"><span /></span> DepositOS</button>
          <div className="date-lockup"><span>Friday</span><strong>July 10</strong></div>
          <div className="top-actions">
            <span className="streak">↗ <strong>18</strong> day rebuild</span>
            <button className="avatar small" aria-label="Open profile">MB</button>
          </div>
        </header>

        {active === "today" && (
          <TodayView
            deposits={deposits}
            score={score}
            completed={completed}
            mostImportant={mostImportant}
            toggle={toggle}
            changeValue={changeValue}
            openCope={() => setActive("cope")}
            openReview={() => setActive("review")}
          />
        )}
        {active === "insights" && <InsightsView score={score} reflections={reflections} />}
        {active === "cope" && (
          <CopeView
            reflections={reflections}
            onSave={(reflection) => {
              setReflections((r) => [reflection, ...r]);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 2400);
            }}
            saved={saved}
          />
        )}
        {active === "review" && <ReviewView deposits={deposits} score={score} />}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {nav.map(([id, label]) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => setActive(id)}>
            <Icon name={id} /><span>{label.split(" ")[0]}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}

function TodayView({ deposits, score, completed, mostImportant, toggle, changeValue, openCope, openReview }: {
  deposits: Deposit[]; score: number; completed: number; mostImportant: string;
  toggle: (id: string) => void; changeValue: (id: string, value: number) => void;
  openCope: () => void; openReview: () => void;
}) {
  return (
    <div className="page-content">
      <section className="hero-row">
        <div>
          <p className="eyebrow brass">Today’s rebuild</p>
          <h1>Good evening, Marquiste.</h1>
          <p>You don’t need a perfect day. You need the next meaningful deposit.</p>
        </div>
        <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}>
          <div><strong>{score}</strong><span>daily score</span></div>
        </div>
      </section>

      <section className="signal-grid">
        <article className="signal-card featured">
          <div><p className="eyebrow">The deposit that matters most</p><h2>{mostImportant}</h2><p>Close the loop before the day closes.</p></div>
          <button onClick={() => toggle(deposits.find((d) => d.label === mostImportant)?.id ?? "family")}>Make this deposit <span>→</span></button>
        </article>
        <article className="signal-card"><span className="signal-icon">◒</span><div><p>Recovery</p><strong>7h 18m</strong><span>Sleep · +32m this week</span></div></article>
        <article className="signal-card"><span className="signal-icon">♥</span><div><p>Health signal</p><strong>124 / 78</strong><span>Blood pressure · steady</span></div></article>
      </section>

      <div className="section-heading">
        <div><p className="eyebrow">Daily deposits</p><h2>Votes for the man you’re becoming</h2></div>
        <span>{completed} of {deposits.length} made</span>
      </div>
      <section className="deposit-list">
        {deposits.map((deposit) => (
          <article key={deposit.id} className={`deposit-row ${deposit.done ? "done" : ""}`}>
            <button className="check" onClick={() => toggle(deposit.id)} aria-label={`${deposit.done ? "Undo" : "Complete"} ${deposit.label}`}>
              {deposit.done ? "✓" : ""}
            </button>
            <div className="deposit-copy"><div><span className={`pillar ${deposit.pillar.toLowerCase()}`}>{deposit.pillar}</span><h3>{deposit.label}</h3></div><p>{deposit.detail}</p></div>
            {deposit.target ? (
              <div className="metric-control">
                <label><input type="number" min="0" max={deposit.target * 2} value={deposit.value} onChange={(e) => changeValue(deposit.id, Number(e.target.value))} aria-label={`${deposit.label} amount`} /> <span>/ {deposit.target}{deposit.unit}</span></label>
                <div><span style={{ width: `${Math.min(100, ((deposit.value ?? 0) / deposit.target) * 100)}%` }} /></div>
              </div>
            ) : <button className="text-action" onClick={() => toggle(deposit.id)}>{deposit.done ? "Deposited" : "Mark done"}</button>}
          </article>
        ))}
      </section>

      <section className="evening-grid">
        <article className="evening-card cope-card"><p className="eyebrow">When pressure rises</p><h2>Pause the old loop.</h2><p>Name what you’re carrying and choose a replacement deposit before escape takes over.</p><button onClick={openCope}>Cope differently <span>→</span></button></article>
        <article className="evening-card"><p className="eyebrow">Close the day</p><h2>What made tomorrow better?</h2><p>A two-minute reflection turns today’s data into tomorrow’s wisdom.</p><button onClick={openReview}>Start evening review <span>→</span></button></article>
      </section>
    </div>
  );
}

function InsightsView({ score, reflections }: { score: number; reflections: Reflection[] }) {
  const bars = [62, 71, 54, 78, score, 84, 76];
  return (
    <div className="page-content inner-page">
      <p className="eyebrow brass">Pattern intelligence</p><h1>Data becomes wisdom.</h1><p className="page-lede">See what is helping you become more consistent—without turning your life into a spreadsheet.</p>
      <section className="insight-hero">
        <div><p className="eyebrow">This week’s pattern</p><h2>Your strongest days begin the night before.</h2><p>On days you hit your sleep window, you complete 31% more deposits and your fasted walk happens before 7:30 AM.</p></div>
        <span className="ai-badge">AI pattern</span>
      </section>
      <section className="chart-card">
        <div className="section-heading compact"><div><p className="eyebrow">Consistency</p><h2>Last 7 days</h2></div><strong>+12% <span>vs. last week</span></strong></div>
        <div className="bar-chart">{bars.map((bar, i) => <div key={i}><span style={{ height: `${bar}%` }} /><small>{["S","M","T","W","T","F","S"][i]}</small></div>)}</div>
      </section>
      <section className="pattern-grid">
        <article><span>01</span><p>Best-performing deposit</p><h3>Fasted walk</h3><strong>6 of 7 days</strong></article>
        <article><span>02</span><p>Most protected pillar</p><h3>Body</h3><strong>82% consistency</strong></article>
        <article><span>03</span><p>Opportunity</p><h3>Family presence</h3><strong>Schedule it earlier</strong></article>
      </section>
      <section className="history-card"><div><p className="eyebrow">Cope differently</p><h2>{reflections.length ? `${reflections.length} saved reflection${reflections.length > 1 ? "s" : ""}` : "Your patterns will appear here"}</h2></div><p>{reflections[0]?.commitment || "Save a reflection to begin identifying pressure triggers and replacement deposits."}</p></section>
    </div>
  );
}

function CopeView({ reflections, onSave, saved }: { reflections: Reflection[]; onSave: (r: Reflection) => void; saved: boolean }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ pressure: "", oldLoop: "", reward: "", cost: "", replacement: "", friction: "", commitment: "" });
  const canContinue = Boolean(step === 1 ? form.pressure && form.oldLoop : form.replacement && form.commitment);
  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({ ...form, id: Date.now(), createdAt: new Date().toISOString() });
    setStep(3);
  };
  return (
    <div className="page-content inner-page cope-page">
      <p className="eyebrow brass">Cope differently</p><h1>Pressure doesn’t get the last word.</h1><p className="page-lede">Move from pressure → escape → regret to pressure → pause → better deposit → better tomorrow.</p>
      <div className="stepper"><span className={step >= 1 ? "active" : ""}>1 <em>Notice the loop</em></span><i /><span className={step >= 2 ? "active" : ""}>2 <em>Name the deposit</em></span><i /><span className={step >= 3 ? "active" : ""}>3 <em>Commit</em></span></div>
      {step < 3 ? (
        <form className="reflection-form" onSubmit={submit}>
          <div className="form-intro"><span>{step === 1 ? "The old loop" : "The rebuild response"}</span><h2>{step === 1 ? "Name it without judging it." : "Make the better choice easier."}</h2><p>{step === 1 ? "Honesty gives you something concrete to rebuild." : "Choose a small action that protects the man you want to be tomorrow."}</p></div>
          {step === 1 ? <>
            <Field label="What pressure usually sends you into the old loop?" value={form.pressure} onChange={(v) => update("pressure", v)} placeholder="e.g. Feeling behind after a chaotic workday" />
            <Field label="What do you usually do when that pressure shows up?" value={form.oldLoop} onChange={(v) => update("oldLoop", v)} placeholder="e.g. Pour a drink and disappear into my phone" />
            <div className="field-pair"><Field label="What temporary reward does it give you?" value={form.reward} onChange={(v) => update("reward", v)} placeholder="A few minutes of quiet" /><Field label="How does it make tomorrow harder?" value={form.cost} onChange={(v) => update("cost", v)} placeholder="Poor sleep, low energy" /></div>
          </> : <>
            <Field label="What healthier deposit can you make instead?" value={form.replacement} onChange={(v) => update("replacement", v)} placeholder="e.g. Take a 10-minute walk, then make tea" />
            <Field label="How can you reduce the friction before stress shows up?" value={form.friction} onChange={(v) => update("friction", v)} placeholder="e.g. Leave walking shoes by the back door" />
            <Field label="Complete your commitment statement" value={form.commitment} onChange={(v) => update("commitment", v)} placeholder="When I feel behind, instead of checking out, I will walk because tomorrow deserves my best." />
          </>}
          <div className="form-actions">{step === 2 && <button type="button" className="secondary" onClick={() => setStep(1)}>Back</button>}<button disabled={!canContinue} type={step === 1 ? "button" : "submit"} onClick={() => step === 1 && setStep(2)}>{step === 1 ? "Build replacement plan" : "Save my commitment"} <span>→</span></button></div>
        </form>
      ) : (
        <section className="commitment-card"><span className="seal">D</span><p className="eyebrow">Your rebuild response</p><blockquote>“{form.commitment}”</blockquote><p>The next time pressure rises, the plan is already made.</p><div><button onClick={() => { setStep(1); setForm({ pressure: "", oldLoop: "", reward: "", cost: "", replacement: "", friction: "", commitment: "" }); }}>Create another</button><span>{saved ? "✓ Saved privately on this device" : "Saved"}</span></div></section>
      )}
      {reflections.length > 0 && <section className="reflection-history"><div className="section-heading compact"><div><p className="eyebrow">History</p><h2>Saved rebuild responses</h2></div></div>{reflections.slice(0,3).map((r) => <article key={r.id}><time>{new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time><div><strong>{r.pressure}</strong><p>{r.commitment}</p></div><span>→</span></article>)}</section>}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <label className="field"><span>{label}</span><textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}

function ReviewView({ deposits, score }: { deposits: Deposit[]; score: number }) {
  const [complete, setComplete] = useState(false);
  const [answers, setAnswers] = useState({ win: "", lesson: "", next: "" });
  const prompt = useMemo(() => {
    const top = deposits.filter((d) => d.done).slice(0, 2).map((d) => d.label.toLowerCase()).join(" and ");
    return `You protected ${top || "your identity"} this week. Your next leverage point is consistency after dinner—decide the family deposit before the workday ends.`;
  }, [deposits]);
  return (
    <div className="page-content inner-page review-page">
      <p className="eyebrow brass">Sunday reset</p><h1>Review. Rebuild. Begin again.</h1><p className="page-lede">A calm weekly ritual for turning the truth into a better system.</p>
      <section className="week-score"><div className="score-ring large" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><div><strong>{score}</strong><span>week score</span></div></div><div><p className="eyebrow">Your week at a glance</p><h2>Consistency is becoming your baseline.</h2><p>You made {deposits.filter((d) => d.done).length} of {deposits.length} core deposits today. Body and faith led the week; presence is the next place to protect.</p></div></section>
      <section className="weekly-numbers"><article><strong>6</strong><span>alcohol-free days</span></article><article><strong>5</strong><span>fasted walks</span></article><article><strong>3</strong><span>gym sessions</span></article><article><strong>7.1h</strong><span>average sleep</span></article></section>
      <section className="review-form">
        <div><p className="eyebrow">Make meaning</p><h2>Three honest answers.</h2></div>
        <Field label="What are you proud of this week?" value={answers.win} onChange={(v) => setAnswers({ ...answers, win: v })} placeholder="Name the promise you kept..." />
        <Field label="What did the week teach you?" value={answers.lesson} onChange={(v) => setAnswers({ ...answers, lesson: v })} placeholder="Name the pattern, without shame..." />
        <Field label="What one deposit will make next week better?" value={answers.next} onChange={(v) => setAnswers({ ...answers, next: v })} placeholder="Keep it small and specific..." />
        <button disabled={!answers.win || !answers.next} onClick={() => setComplete(true)}>{complete ? "✓ Weekly reset saved" : "Complete Sunday reset"}</button>
      </section>
      <section className="coach-note"><span className="ai-badge">AI reflection</span><p>{prompt}</p><strong>One deposit at a time.</strong></section>
    </div>
  );
}
