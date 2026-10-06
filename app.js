"use strict";
/* ============ storage ============ */
const S = {
  get(k, d) { try { const v = localStorage.getItem("ft." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ft." + k, JSON.stringify(v)); } catch (e) { toast("Storage full — export a backup"); } },
  del(k) { try { localStorage.removeItem("ft." + k); } catch (e) {} },
  all() { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("ft.")) o[k] = localStorage.getItem(k); } } catch (e) {} return o; }
};
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/* ============ dates ============ */
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pdate = k => new Date(k + "T12:00:00");
const addD = (k, n) => { const d = pdate(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayK = () => dkey(new Date());
const dow = k => (pdate(k).getDay() + 6) % 7; // 0 = Mon
const daysBetween = (a, b) => Math.round((pdate(b) - pdate(a)) / 864e5);
const weekStart = k => addD(k, -dow(k));
let TODAY = todayK();

/* ============ profile & targets ============ */
const profile = () => S.get("profile", null);
function latestWeight() {
  const b = S.get("body", []); for (let i = b.length - 1; i >= 0; i--) if (b[i].weight) return b[i].weight;
  const p = profile(); return p ? p.weight : 180;
}
function targets() {
  const p = profile() || {}; const N = PROGRAM.nutrition;
  const lb = latestWeight(), kg = lb * 0.4536, cm = (p.heightIn || 70) * 2.54, age = p.age || 30;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + 5;
  const tdee = bmr * (N.multipliers[p.activity] || 1.55);
  let kcal = Math.round(tdee * (1 - N.deficit) / 50) * 50;
  kcal = Math.max(kcal, Math.ceil(Math.max(bmr, 1500) / 50) * 50) + (p.kcalAdj || 0);
  const protein = Math.round(p.proteinOverride || (p.goalWeight || lb) * N.proteinPerLb);
  const fat = Math.round(lb * N.fatPerLb);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein, fat, carbs, bmr: Math.round(bmr), tdee: Math.round(tdee) };
}
function programWeek(k = TODAY) { const p = profile(); if (!p) return 1; return Math.max(1, Math.floor(daysBetween(p.startDate, k) / 7) + 1); }
const isDeload = k => { const w = programWeek(k); return ((w - 1) % PROGRAM.phase.weeks) + 1 === PROGRAM.phase.deloadWeek; };
const dayPlan = k => PROGRAM.split[dow(k)];

/* ============ habits ============ */
const HABITS = [
  { id: "workout", label: "Workout", type: "bool", c: "--h-train", ic: "barbell", train: true },
  { id: "cardio", label: "Cardio", type: "bool", c: "--h-train", ic: "pulse" },
  { id: "noSugar", label: "No sugar", type: "bool", c: "--h-disc", ic: "ban" },
  { id: "crunches", label: "50 Crunch", type: "count", target: 50, c: "--h-core", ic: "core" },
  { id: "legRaises", label: "30 Leg raise", type: "count", target: 30, c: "--h-core", ic: "leg" },
  { id: "sleep", label: "Sleep", type: "num", target: 7.5, unit: "h", c: "--h-rec", ic: "moon", bonus: true },
  { id: "steps", label: "Steps", type: "num", target: 9000, unit: "", c: "--h-rec", ic: "steps", bonus: true },
  { id: "weighIn", label: "Weigh-in", type: "auto", c: "--h-rec", ic: "scale", bonus: true }
];
const hlog = k => S.get("habits." + k, {});
const setH = (k, o) => S.set("habits." + k, o);
const nlog = k => S.get("nutrition." + k, []);
const ntotals = k => nlog(k).reduce((a, e) => ({ p: a.p + (e.p || 0), kcal: a.kcal + (e.kcal || 0) }), { p: 0, kcal: 0 });
const weighedOn = k => S.get("body", []).some(e => e.date === k && e.weight);

function habitDone(h, k, H) {
  H = H || hlog(k);
  if (h.id === "weighIn") return weighedOn(k);
  if (h.type === "bool") return !!H[h.id];
  if (h.type === "count") return (H[h.id] || 0) >= h.target;
  if (h.type === "num") return (H[h.id] || 0) >= h.target;
}
function dayScore(k) {
  const H = hlog(k), T = targets(), n = ntotals(k), plan = dayPlan(k);
  const req = [];
  if (plan.type === "train") req.push(!!H.workout);
  req.push(!!H.cardio, !!H.noSugar, (H.crunches || 0) >= 50, (H.legRaises || 0) >= 30, (H.water || 0) >= 8, (H.smoothies || 0) >= 2, n.p >= T.protein);
  const done = req.filter(Boolean).length;
  const bonus = ["sleep", "steps", "weighIn"].filter(id => habitDone(HABITS.find(h => h.id === id), k, H)).length;
  return { done, total: req.length, pct: done / req.length, perfect: done === req.length, bonus, any: done > 0 || bonus > 0 };
}
/* streak: day counts at >=80% of required habits; one freeze earned per 7-day run (max 2), auto-spent on a miss */
function streakInfo() {
  const p = profile(); if (!p) return { cur: 0, best: 0, perfect: 0, days: {} };
  let start = p.startDate; const keys = Object.keys(S.all()).filter(k => k.startsWith("ft.habits.")).map(k => k.slice(10)).sort();
  if (keys[0] && keys[0] < start) start = keys[0];
  let cur = 0, best = 0, freezes = 0, run = 0, perfect = 0; const days = {};
  for (let k = start; k <= TODAY; k = addD(k, 1)) {
    const s = dayScore(k); const counts = s.pct >= 0.8;
    if (s.perfect) perfect++;
    if (counts) { cur++; run++; days[k] = s.perfect ? "perfect" : "full"; if (run % 7 === 0 && freezes < 2) freezes++; }
    else if (k === TODAY) { days[k] = s.any ? "part" : "none"; }
    else if (freezes > 0) { freezes--; days[k] = "freeze"; }
    else { cur = 0; run = 0; days[k] = s.any ? "part" : "none"; }
    best = Math.max(best, cur);
  }
  return { cur, best, perfect, freezes, days };
}

/* ============ workouts ============ */
const wlog = k => S.get("workouts." + k, null);
const history = id => S.get("history." + id, []);
function parseReps(r) { const m = String(r).match(/(\d+)(?:\s*-\s*(\d+))?/); const a = +m[1], b = m[2] ? +m[2] : a; return { min: a, max: b }; }
const e1rm = (w, r) => w > 0 && r > 0 ? w * (1 + r / 30) : 0;
const fmtW = w => (Math.round(w * 10) / 10).toString();
function incFor(ex) { return ex.tag === "isolation" || ex.tag === "core" ? 2.5 : (ex.muscle === "legs" ? 10 : 5); }
function plannedSets(ex, k) { return isDeload(k) ? Math.max(2, Math.round(ex.sets * 0.6)) : ex.sets; }

function buildSession(k) {
  const plan = dayPlan(k);
  return {
    dayIdx: dow(k), name: plan.name, week: programWeek(k), startedAt: Date.now(), finishedAt: null,
    entries: plan.exercises.map(ex => {
      const h = history(ex.id), last = h[h.length - 1], rr = parseReps(ex.reps), n = plannedSets(ex, k);
      let up = false, sets = [];
      if (last && last.sets && last.sets.length) {
        up = last.sets.length >= ex.sets && last.sets.every(s => s.r >= rr.max);
        for (let i = 0; i < n; i++) { const ls = last.sets[Math.min(i, last.sets.length - 1)]; sets.push({ w: up ? ls.w + incFor(ex) : ls.w, r: up ? rr.min : ls.r, done: false }); }
      } else for (let i = 0; i < n; i++) sets.push({ w: 0, r: rr.min, done: false });
      return { id: ex.id, up, sets };
    })
  };
}
function sessionKey() { return S.get("meta", {}).activeSession || null; }

/* ============ body ============ */
const body = () => S.get("body", []);
function upsertBody(k, patch) {
  const b = body(); let e = b.find(x => x.date === k);
  if (!e) { e = { date: k }; b.push(e); b.sort((a, c) => a.date < c.date ? -1 : 1); }
  Object.assign(e, patch); S.set("body", b);
}
function latestMeasure(id) { const b = body(); for (let i = b.length - 1; i >= 0; i--) if (b[i][id]) return { v: b[i][id], date: b[i].date }; return null; }
function ratio() { const s = latestMeasure("shoulders"), w = latestMeasure("waist"); return s && w ? s.v / w.v : null; }
function movingAvg(k) {
  const b = body().filter(e => e.weight && e.date <= k && daysBetween(e.date, k) < 7);
  return b.length ? b.reduce((a, e) => a + e.weight, 0) / b.length : null;
}

/* ============ icons ============ */
const IC = {
  today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3a9 9 0 1 1-9 9"/><path d="M12 7a5 5 0 1 1-5 5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
  train: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12h20M5 8v8M8 6v12M16 6v12M19 8v8"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/><path d="M12 11v6M9 14h6"/></svg>',
  body: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M4 4h16l-6 11h-4z"/><path d="M12 15v6"/></svg>',
  stats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 20v-6M12 20V9M19 20V4"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5 .1 2 1 3 2 3.3C11 8.5 12 5 12 2z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  barbell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M3 12h18M6 8v8M9 7v10M15 7v10M18 8v8"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="8"/><path d="M6.5 6.5l11 11"/></svg>',
  core: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="7" y="4" width="10" height="16" rx="3"/><path d="M7 9.5h10M7 14.5h10M12 4v16"/></svg>',
  leg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 18h9l7-12"/><path d="M4 14h7"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z"/></svg>',
  steps: '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="8" cy="8" rx="2.6" ry="4"/><ellipse cx="16" cy="13" rx="2.6" ry="4"/><circle cx="8" cy="14.5" r="1.6"/><circle cx="16" cy="19.5" r="1.6"/></svg>',
  scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0M12 9.5l1.5-1.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>'
};

/* ============ ui helpers ============ */
let TAB = "today", toastTimer = null, undoFn = null;
function toast(msg, undo) {
  const t = $("#toast"); undoFn = undo || null;
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">UNDO</button>' : ""}`;
  t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; undoFn = null; }, 4000);
}
function sheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="sc"><div class="grab"></div>${html}</div>`; s.hidden = false; const i = s.querySelector("input"); if (i && i.dataset.focus !== "no") setTimeout(() => i.focus(), 60); }
function closeSheet() { $("#sheet").hidden = true; $("#sheet").innerHTML = ""; }
function ringArc(r, pct, color, w) { const c = 2 * Math.PI * r; return `<circle cx="115" cy="115" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${w}"/><circle class="ring-arc" cx="115" cy="115" r="${r}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}"/>`; }
function miniArc(pct, color) { const r = 44, c = 2 * Math.PI * r; return `<svg class="arc" viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="5"/><circle cx="50" cy="50" r="${r}" fill="none" stroke="var(${color})" stroke-width="5" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - Math.min(1, pct))}"/></svg>`; }
function spark(vals, color = "var(--accent)", w = 120, h = 28) {
  if (vals.length < 2) return `<svg viewBox="0 0 ${w} ${h}"><line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" stroke="var(--line)" stroke-dasharray="3 3"/></svg>`;
  const mn = Math.min(...vals), mx = Math.max(...vals), rg = mx - mn || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - mn) / rg * (h - 6)).toFixed(1)}`);
  const last = pts[pts.length - 1].split(",");
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5" fill="${color}"/></svg>`;
}

/* ============ render: tabs ============ */
const TABS = [["today", "Today"], ["train", "Train"], ["fuel", "Fuel"], ["body", "Body"], ["stats", "Stats"]];
function renderTabs() { $("#tabs").innerHTML = TABS.map(([id, l]) => `<button class="${TAB === id ? "on" : ""}" data-tab="${id}" aria-label="${l}">${IC[id]}<span>${l}</span></button>`).join(""); }
function render() {
  if (!profile()) { renderOnboarding(); return; }
  $("#tabs").hidden = false; renderTabs();
  $("#fab").hidden = TAB !== "today";
  const v = $("#view");
  v.innerHTML = ({ today: viewToday, train: viewTrain, fuel: viewFuel, body: viewBody, stats: viewStats })[TAB]();
  window.scrollTo(0, 0);
}

/* ============ TODAY ============ */
function viewToday() {
  const k = TODAY, H = hlog(k), T = targets(), n = ntotals(k), plan = dayPlan(k), st = streakInfo(), sc = dayScore(k);
  const d = pdate(k), wk = programWeek(k);
  const sess = wlog(k), active = sessionKey();
  let sessCard;
  if (plan.type === "rest") {
    sessCard = `<div class="card session rest"><div class="row between"><div><div class="label">Rest day</div><div class="h1" style="margin-top:4px">${plan.name}</div><div class="muted" style="margin-top:4px">${plan.cardio.type} · ${plan.cardio.min} min</div></div></div></div>`;
  } else if (sess && sess.finishedAt) {
    const vol = sess.entries.reduce((a, e) => a + e.sets.filter(s => s.done).reduce((b, s) => b + s.w * s.r, 0), 0);
    sessCard = `<div class="card session done"><div class="row between"><div><div class="label">Session complete</div><div class="h1" style="margin-top:4px">${plan.name} <span style="color:var(--accent)">✓</span></div><div class="muted" style="margin-top:4px"><span class="num" style="font-size:18px;color:var(--text)">${Math.round(vol).toLocaleString()}</span> lb volume · then ${plan.cardio.type.toLowerCase()} ${plan.cardio.min} min</div></div></div></div>`;
  } else {
    const nEx = plan.exercises.length, nSets = plan.exercises.reduce((a, e) => a + plannedSets(e, k), 0);
    sessCard = `<div class="card session"><div><div class="row between"><span class="label">${plan.day} · Week ${wk}</span>${isDeload(k) ? '<span class="pill gold">DELOAD</span>' : ""}</div>
      <div class="h1" style="margin-top:6px;font-size:40px">${plan.name}</div><div class="muted" style="font-weight:600">${plan.sub} · ${nEx} exercises · ${nSets} sets · ~60 min</div></div>
      <button class="btn press" data-act="start">${active === k ? "Continue session" : "Start session"}</button></div>`;
  }
  const tiles = HABITS.filter(h => !(h.train && plan.type === "rest")).map(h => {
    const on = habitDone(h, k, H);
    let pct = on ? 1 : 0, val = "";
    if (h.type === "num") { const x = H[h.id] || 0; pct = x / h.target; val = x ? (h.id === "steps" ? (x / 1000).toFixed(1) + "k" : x + h.unit) : ""; }
    if (h.id === "cardio") val = plan.cardio.min + "m";
    return `<button class="tile press ${on ? "on" : ""}" style="--c:var(${h.c})" data-habit="${h.id}">${miniArc(pct, h.c)}<span class="ic">${IC[h.ic]}</span><span class="tl">${val ? `<span class="num" style="font-size:14px;color:var(--text)">${val}</span><br>` : ""}${h.label}</span></button>`;
  }).join("");
  const water = H.water || 0, sm = H.smoothies || 0;
  const tip = PROGRAM.tips[daysBetween("2026-01-01", k) % PROGRAM.tips.length];
  return `
  <div class="head"><div class="row"><span class="date">${d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()} ${pad(d.getDate())}</span><span class="pill">W${wk}</span></div>
    <div class="flame" aria-label="Streak">${IC.flame}${st.cur}</div></div>
  <div class="ringwrap" role="img" aria-label="Today ${Math.round(sc.pct * 100)} percent">
    <svg width="230" height="230" viewBox="0 0 230 230">${ringArc(104, sc.pct, "var(--accent)", 16)}${ringArc(82, n.p / T.protein, "var(--h-fuel)", 16)}${ringArc(60, n.kcal / T.kcal, "var(--pr)", 16)}</svg>
    <div class="center"><div class="big">${Math.round(sc.pct * 100)}<span style="font-size:26px">%</span></div><div class="label">${sc.done}/${sc.total} today</div></div>
  </div>
  <div class="legend"><span><i style="background:var(--accent)"></i>Habits</span><span data-tab="fuel"><i style="background:var(--h-fuel)"></i>${n.p}/${T.protein}g P</span><span data-tab="fuel"><i style="background:var(--pr)"></i>${n.kcal}/${T.kcal} kcal</span></div>
  ${sessCard}
  <div class="grid4">${tiles}</div>
  <div class="card" style="--c:var(--h-fuel);display:flex;flex-direction:column;gap:10px">
    <div class="row between"><span class="label">Water</span><span class="num" style="font-size:18px">${water}/8</span></div>
    <div class="pips">${Array.from({ length: 8 }, (_, i) => `<button class="pip press ${i < water ? "on" : ""}" data-water="${i + 1}" aria-label="Glass ${i + 1}"><span>${i + 1}</span></button>`).join("")}</div>
    <div class="row between" style="margin-top:4px"><span class="label">Protein smoothies</span><span class="num" style="font-size:18px">${sm}/2</span></div>
    <div class="pips">${[1, 2].map(i => `<button class="pip press ${i <= sm ? "on" : ""}" data-smoothie="${i}" aria-label="Smoothie ${i}"><span>SMOOTHIE ${i}</span></button>`).join("")}</div>
  </div>
  <div class="card tip"><b>COACH</b><span>${tip}</span></div>
  ${backupNag()}`;
}
function backupNag() {
  const m = S.get("meta", {}), p = profile(); const since = m.lastExport ? Math.floor((Date.now() - m.lastExport) / 864e5) : daysBetween(p.startDate, TODAY);
  return since >= 7 ? `<button class="card row between press" data-act="settings" style="text-align:left"><span><span class="label">Back up your data</span><br><span class="muted" style="font-size:13px">Last backup: ${m.lastExport ? since + " days ago" : "never"}</span></span>${IC.gear}</button>` : "";
}
function toggleHabit(id) {
  const k = TODAY, H = hlog(k), prev = { ...H }, h = HABITS.find(x => x.id === id);
  if (h.type === "bool") H[id] = !H[id];
  else if (h.type === "count") H[id] = (H[id] || 0) >= h.target ? 0 : h.target;
  else if (h.type === "num") { askNumber(h.id === "sleep" ? "Hours slept" : "Steps today", H[id] || "", h.id === "sleep" ? 0.5 : 500, v => { const X = hlog(k); X[id] = v; setH(k, X); render(); }); return; }
  else if (h.type === "auto") { logWeightSheet(); return; }
  setH(k, H); render();
  const undo = () => { setH(k, prev); render(); };
  if (!celebrateDay(undo)) toast(`${h.label} ${habitDone(h, k, H) ? "✓" : "cleared"}`, undo);
}
function celebrateDay(undo) { const s = dayScore(TODAY); if (s.perfect) { toast("Perfect day 🔥 streak secured", undo); return true; } return false; }

/* ============ number sheet ============ */
function askNumber(title, val, step, cb, unit = "") {
  sheet(`<div class="h2">${esc(title)}</div>
    <div class="field"><input id="numIn" type="number" inputmode="decimal" step="${step}" value="${val}" placeholder="0"></div>
    <button class="btn press" id="numSave">Save</button>`);
  const go = () => { const v = parseFloat($("#numIn").value); closeSheet(); if (!isNaN(v)) cb(v); };
  $("#numSave").onclick = go; $("#numIn").onkeydown = e => { if (e.key === "Enter") go(); };
}

/* ============ TRAIN ============ */
function viewTrain() {
  const ws = weekStart(TODAY), wk = programWeek(TODAY);
  const days = PROGRAM.split.map((p, i) => { const k = addD(ws, i), w = wlog(k); return { p, k, done: w && w.finishedAt }; });
  const doneCount = days.filter(d => d.done).length;
  return `
  <div class="row between"><h1 class="h1">Train</h1><span class="pill">${PROGRAM.phase.name} · W${wk}/${PROGRAM.phase.weeks}</span></div>
  <div class="card"><div class="row between" style="margin-bottom:12px"><span class="label">This week</span><span class="num" style="font-size:20px">${doneCount}/5</span></div>
    <div class="week">${days.map(d => `<div class="d">${d.p.day[0]}<span class="dot ${d.done ? "done" : ""} ${d.p.type === "rest" ? "rest" : ""} ${d.k === TODAY ? "today" : ""}">${d.done ? "✓" : pdate(d.k).getDate()}</span></div>`).join("")}</div></div>
  ${isDeload(TODAY) ? `<div class="card tip"><b>DELOAD</b><span>${PROGRAM.deload}</span></div>` : ""}
  <div class="card"><div class="list">${days.map((d, i) => `
    <button class="sess press ${d.done ? "done" : ""}" data-preview="${i}" style="text-align:left;width:100%">
      <span class="tag">${d.done ? "✓" : d.p.day.slice(0, 2).toUpperCase()}</span>
      <span class="info"><span class="t">${d.p.name}${d.k === TODAY ? ' <span class="pill accent" style="font-size:11px;vertical-align:3px">TODAY</span>' : ""}</span><br><span class="muted" style="font-size:13px">${d.p.type === "rest" ? d.p.cardio.type + " · " + d.p.cardio.min + " min" : d.p.sub + " · " + d.p.exercises.length + " exercises"}</span></span>
    </button>`).join("")}</div></div>
  <div class="card tip"><b>RULE</b><span>${PROGRAM.progression}</span></div>`;
}
function previewDay(i) {
  const p = PROGRAM.split[i], k = addD(weekStart(TODAY), i);
  if (p.type === "rest") { sheet(`<div class="h2">${p.name}</div><div class="muted">${p.sub}</div><div class="card" style="background:var(--surface-2)"><b class="num" style="font-size:22px">${p.cardio.min} MIN</b> · ${p.cardio.type}</div><button class="btn ghost press" data-act="closesheet">Close</button>`); return; }
  sheet(`<div class="row between"><div class="h2">${p.name} · ${p.sub}</div></div>
    <div class="list">${p.exercises.map(ex => { const h = history(ex.id), l = h[h.length - 1]; return `<div class="li"><div style="min-width:0"><b>${ex.name}</b><br><span class="muted" style="font-size:13px">${plannedSets(ex, k)} × ${ex.reps} · rest ${ex.rest}s</span></div>${l ? `<span class="prev">${fmtW(l.topW)}×${l.topR}</span>` : ""}</div>`; }).join("")}</div>
    <div class="muted" style="font-size:13px">Cardio after: ${p.cardio.type} · ${p.cardio.min} min</div>
    ${k === TODAY ? '<button class="btn press" data-act="start">Start session</button>' : `<button class="btn ghost press" data-startday="${k}">Log this session today</button>`}`);
}

/* ============ SESSION LOGGER ============ */
let SES = null, SESK = null, sesTick = null;
function openSession(k, planIdx) {
  closeSheet();
  const active = sessionKey();
  if (active && active !== k && wlog(active) && !wlog(active).finishedAt) k = active;
  let w = wlog(k);
  if (!w || w.finishedAt) { w = buildSession(k); if (planIdx != null) { w = buildSessionFor(planIdx, k); } S.set("workouts." + k, w); }
  const m = S.get("meta", {}); m.activeSession = k; S.set("meta", m);
  SES = w; SESK = k; renderSession(); $("#overlay").hidden = false; document.body.style.overflow = "hidden";
  clearInterval(sesTick); sesTick = setInterval(() => { const e = $("#sesTime"); if (e) e.textContent = elapsed(); }, 1000);
}
function buildSessionFor(idx, k) { const realDow = dow; const fake = PROGRAM.split[idx]; const s = buildSession(k); if (fake !== dayPlan(k)) { // rebuild with chosen plan
    const save = PROGRAM.split[dow(k)]; PROGRAM.split[dow(k)] = fake; const r = buildSession(k); PROGRAM.split[dow(k)] = save; r.dayIdx = idx; return r; } return s; }
const elapsed = () => { const s = Math.floor((Date.now() - SES.startedAt) / 1000); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };
const sesPlan = () => PROGRAM.split[SES.dayIdx];
function saveSes() { S.set("workouts." + SESK, SES); }
function renderSession() {
  const plan = sesPlan(), anyDone = SES.entries.some(e => e.sets.some(s => s.done));
  $("#overlay").innerHTML = `
  <div class="ov-head"><div class="row between" style="max-width:520px;margin:0 auto">
    <button class="x press" data-act="minimize" aria-label="Back">${'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>'}</button>
    <div style="text-align:center"><div class="h2">${plan.name}</div><div class="num muted" id="sesTime" style="font-size:16px">${elapsed()}</div></div>
    <button class="pill ${anyDone ? "accent" : ""} press" style="height:40px;padding:0 14px;font-size:16px" data-act="finish">FINISH</button></div></div>
  <div class="ov-body">${SES.entries.map((e, ei) => {
    const ex = plan.exercises.find(x => x.id === e.id) || { name: e.id, reps: "", cue: "" }, h = history(e.id), last = h[h.length - 1];
    return `<div class="exc"><div class="top"><div style="min-width:0"><div class="nm">${ex.name}</div><div class="cue">${ex.sets} × ${ex.reps} · ${ex.cue}</div></div>${last ? `<span class="prev">PREV ${fmtW(last.topW)}×${last.topR}</span>` : '<span class="prev">NEW</span>'}</div>
    ${e.up ? `<div style="font-size:12.5px;margin-top:6px" class="up">▲ You hit the top of the range. Weight increased.</div>` : ""}
    ${e.sets.map((s, si) => `<div class="setrow ${s.done ? "done" : ""} ${s.pr ? "pr" : ""}">
      <span class="sn">${si + 1}</span>
      <div class="step"><button data-step="${ei},${si},w,-1" aria-label="Less weight">−</button><input inputmode="decimal" data-in="${ei},${si},w" value="${s.w ? fmtW(s.w) : ""}" placeholder="lb" aria-label="Weight"><button data-step="${ei},${si},w,1" aria-label="More weight">+</button></div>
      <div class="step"><button data-step="${ei},${si},r,-1" aria-label="Fewer reps">−</button><input inputmode="numeric" data-in="${ei},${si},r" value="${s.r || ""}" placeholder="reps" aria-label="Reps"><button data-step="${ei},${si},r,1" aria-label="More reps">+</button></div>
      <button class="check press" data-set="${ei},${si}" aria-label="Complete set">${IC.check}</button>
    </div>${s.pr ? `<div style="text-align:right;margin-top:4px"><span class="prbadge">PR · ${Math.round(e1rm(s.w, s.r))} e1RM</span></div>` : ""}`).join("")}
    <button class="addset" data-addset="${ei}">+ Set</button></div>`;
  }).join("")}
  <div class="card tip"><b>CARDIO</b><span>After lifting: ${plan.cardio.type}, ${plan.cardio.min} min</span></div>
  <button class="btn press" data-act="finish">Finish session</button></div>`;
}
function stepSet(ei, si, f, dir) {
  const s = SES.entries[ei].sets[si], ex = sesPlan().exercises.find(x => x.id === SES.entries[ei].id) || {};
  if (f === "w") s.w = Math.max(0, (s.w || 0) + dir * incFor(ex)); else s.r = Math.max(0, (s.r || 0) + dir);
  saveSes(); renderSessionKeepScroll();
}
function renderSessionKeepScroll() { const o = $("#overlay"), y = o.scrollTop; renderSession(); o.scrollTop = y; }
function completeSet(ei, si) {
  const e = SES.entries[ei], s = e.sets[si];
  s.done = !s.done; s.pr = false;
  if (s.done) {
    if (!s.r) { s.done = false; toast("Enter reps first"); return; }
    const prs = S.get("prs", {}), best = prs[e.id] ? prs[e.id].e1rm : 0, v = e1rm(s.w, s.r);
    // only a PR if beating a previously logged best
    if (v > 0 && best > 0 && v > best + 0.01 && !e.sets.some((o, i) => i !== si && o.pr && e1rm(o.w, o.r) >= v)) { s.pr = true; }
    e.sets.forEach((o, i) => { if (i > si && !o.done && !o.w) o.w = s.w; });
    const ex = sesPlan().exercises.find(x => x.id === e.id); startRest(ex ? ex.rest : 90);
  }
  saveSes(); renderSessionKeepScroll();
}
function finishSession() {
  const done = SES.entries.flatMap(e => e.sets.filter(s => s.done));
  if (!done.length) { sheet(`<div class="h2">No sets logged</div><div class="muted">Discard this session?</div><button class="btn press" data-act="discard">Discard</button><button class="btn ghost press" data-act="closesheet">Keep training</button>`); return; }
  SES.finishedAt = Date.now(); saveSes();
  const prs = S.get("prs", {}); let prCount = 0, vol = 0, prevVol = 0;
  SES.entries.forEach(e => {
    const ds = e.sets.filter(s => s.done); if (!ds.length) return;
    const h = history(e.id), last = h[h.length - 1]; if (last) prevVol += last.volume;
    const top = ds.reduce((a, s) => e1rm(s.w, s.r) > e1rm(a.w, a.r) ? s : a, ds[0]);
    const ev = e1rm(top.w, top.r), v = ds.reduce((a, s) => a + s.w * s.r, 0); vol += v;
    if (ds.some(s => s.pr)) prCount++;
    if (!prs[e.id] || ev > prs[e.id].e1rm) prs[e.id] = { e1rm: ev, w: top.w, r: top.r, date: SESK };
    h.push({ date: SESK, topW: top.w, topR: top.r, e1rm: ev, volume: v, sets: ds.map(s => ({ w: s.w, r: s.r })) });
    S.set("history." + e.id, h.slice(-60));
  });
  S.set("prs", prs);
  const H = hlog(SESK); H.workout = true; setH(SESK, H);
  const m = S.get("meta", {}); delete m.activeSession; m.sessions = (m.sessions || 0) + 1; if (prCount) m.prTotal = (m.prTotal || 0) + prCount; S.set("meta", m);
  const mins = Math.round((SES.finishedAt - SES.startedAt) / 60000), delta = prevVol ? Math.round((vol - prevVol) / prevVol * 100) : null;
  stopRest(); closeSession();
  sheet(`<div class="label" style="text-align:center">Session complete</div><div class="h1" style="text-align:center;font-size:44px">${sesPlanName()} ✓</div>
    <div class="grid2"><div class="mtile"><span class="label">Volume</span><span class="v">${Math.round(vol).toLocaleString()}</span><span class="${delta == null ? "muted" : delta >= 0 ? "up" : ""}" style="font-size:13px;${delta < 0 ? "color:var(--bad)" : ""}">${delta == null ? "First log" : (delta >= 0 ? "▲ " : "▼ ") + Math.abs(delta) + "% vs last"}</span></div>
    <div class="mtile"><span class="label">PRs</span><span class="v" style="color:var(--pr)">${prCount}</span><span class="muted" style="font-size:13px">${mins} min</span></div></div>
    <div class="card tip" style="background:var(--surface-2)"><b>NEXT</b><span>Cardio: ${PROGRAM.split[SES.dayIdx].cardio.type}, ${PROGRAM.split[SES.dayIdx].cardio.min} min. Then hit protein.</span></div>
    <button class="btn press" data-act="closesheet">Done</button>`);
  render();
}
const sesPlanName = () => PROGRAM.split[SES.dayIdx].name;
function closeSession() { $("#overlay").hidden = true; document.body.style.overflow = ""; clearInterval(sesTick); render(); }

/* rest timer */
let REST = null;
function startRest(sec) { REST = { end: Date.now() + sec * 1000 }; tickRest(); clearInterval(REST.iv); REST.iv = setInterval(tickRest, 250); }
function tickRest() {
  const r = $("#rest"); if (!REST) { r.hidden = true; return; }
  const left = Math.max(0, Math.ceil((REST.end - Date.now()) / 1000));
  r.hidden = false; r.innerHTML = `<span class="label" style="writing-mode:vertical-rl;transform:rotate(180deg)">REST</span><span class="t">${Math.floor(left / 60)}:${pad(left % 60)}</span><button data-rest="-15">−15</button><button data-rest="15">+15</button><button data-rest="skip">SKIP</button>`;
  if (left === 0) { r.classList.add("flash"); document.title = "⏱ GO — Forge"; clearInterval(REST.iv); setTimeout(() => { stopRest(); }, 1300); }
}
function stopRest() { if (REST) clearInterval(REST.iv); REST = null; const r = $("#rest"); r.hidden = true; r.classList.remove("flash"); document.title = "Forge — V-Taper Tracker"; }

/* ============ FUEL ============ */
function viewFuel() {
  const k = TODAY, T = targets(), n = ntotals(k), log = nlog(k), sm = S.get("smoothie", { p: 40, kcal: 300 });
  const bar = (v, t, c, unit, lbl) => { const pct = Math.min(1.25, v / t); return `<div><div class="row between" style="margin-bottom:8px"><span class="label">${lbl}</span><span><span class="num" style="font-size:30px;font-weight:800">${Math.max(0, t - v)}</span><span class="muted" style="font-size:13px"> ${unit} left</span></span></div>
    <div class="bar" style="--c:${c}"><i style="width:${Math.min(100, pct / 1.25 * 100)}%"></i><span class="notch" style="left:${100 / 1.25}%"></span></div>
    <div class="row between muted" style="font-size:12px;margin-top:6px"><span class="num" style="font-size:15px;color:var(--text)">${v} ${unit}</span><span>Target ${t}</span></div></div>`; };
  return `
  <div class="row between"><h1 class="h1">Fuel</h1><span class="pill">${T.kcal} kcal · ${T.protein}g P</span></div>
  <div class="card" style="display:flex;flex-direction:column;gap:18px">${bar(n.p, T.protein, "var(--h-fuel)", "g", "Protein")}${bar(n.kcal, T.kcal, "var(--pr)", "kcal", "Calories")}
    <div class="row muted" style="font-size:12px;gap:16px"><span>Fat ~${T.fat}g</span><span>Carbs ~${T.carbs}g</span><span>Fiber ${PROGRAM.nutrition.fiber}g</span></div></div>
  <button class="card row between press" data-act="smoothie" style="text-align:left;background:linear-gradient(135deg,#0f2733,var(--surface) 70%);border:1px solid #17394a">
    <span><span class="label" style="color:var(--h-fuel)">One tap</span><br><span class="h2" style="font-size:24px">Protein smoothie</span><br><span class="muted" style="font-size:13px">${sm.p}g protein · ${sm.kcal} kcal · ${hlog(k).smoothies || 0}/2 today</span></span>
    <span style="width:52px;height:52px;border-radius:50%;background:var(--h-fuel);color:#06222e;display:grid;place-items:center">${IC.plus}</span></button>
  <div class="card"><div class="label" style="margin-bottom:10px">Quick add</div>
    <div class="chips">${[[10, 0], [20, 0], [30, 0], [0, 100], [0, 250], [0, 500]].map(([p, c]) => `<button class="chip press" data-add="${p},${c}">+${p || c}<small>${p ? "g P" : "kcal"}</small></button>`).join("")}</div>
    <div class="label" style="margin:16px 0 10px">Protein foods</div>
    <div class="chips">${PROGRAM.proteinIdeas.slice(0, 6).map(([nm, g]) => `<button class="chip press" style="font-size:14px;line-height:1.1;padding:0 6px" data-add="${g},${Math.round(g * 5.5)},${esc(nm)}">${nm}<br><small style="margin:0">${g}g</small></button>`).join("")}</div>
    <div class="row" style="margin-top:16px;align-items:flex-end"><div class="field"><span class="label">Protein g</span><input id="cp" type="number" inputmode="numeric" placeholder="0"></div><div class="field"><span class="label">kcal</span><input id="ck" type="number" inputmode="numeric" placeholder="0"></div><button class="btn sm press" style="width:72px;height:48px" data-act="custom">Add</button></div></div>
  <div class="card"><div class="label" style="margin-bottom:6px">Today's log</div>
    ${log.length ? `<div class="list">${log.slice().reverse().map(e => `<div class="li"><span><b class="num" style="font-size:19px">${e.p}g</b> <span class="muted">· ${e.kcal} kcal</span><br><span class="muted" style="font-size:12px">${esc(e.name || e.src)} · ${new Date(e.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></span><button class="x press" data-delfood="${e.id}" aria-label="Delete">${IC.x}</button></div>`).join("")}</div>` : `<div class="muted" style="padding:10px 0">Nothing logged yet. Tap a chip above.</div>`}</div>`;
}
function addFood(p, kcal, src, name) {
  const k = TODAY, log = nlog(k), id = Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  log.push({ id, t: Date.now(), p, kcal, src, name }); S.set("nutrition." + k, log); render();
  toast(`Logged ${p ? "+" + p + "g P" : ""}${p && kcal ? " · " : ""}${kcal ? kcal + " kcal" : ""}`, () => { S.set("nutrition." + k, nlog(k).filter(e => e.id !== id)); render(); });
}
function logSmoothie(n) {
  const k = TODAY, H = hlog(k), sm = S.get("smoothie", { p: 40, kcal: 300 }), cur = H.smoothies || 0;
  if (n != null && n <= cur) { // untap: remove last smoothie entry
    H.smoothies = n - 1; setH(k, H); const log = nlog(k); const i = log.map(e => e.src).lastIndexOf("smoothie"); if (i > -1) { log.splice(i, 1); S.set("nutrition." + k, log); } render(); return; }
  if (cur >= 2 && n == null) { toast("Both smoothies done ✓"); return; }
  H.smoothies = cur + 1; setH(k, H); addFood(sm.p, sm.kcal, "smoothie", "Protein smoothie"); celebrateDay();
}

/* ============ BODY ============ */
let RANGE = 28;
function viewBody() {
  const b = body(), ws = b.filter(e => e.weight), now = movingAvg(TODAY), wkAgo = movingAvg(addD(TODAY, -7));
  const rate = now && wkAgo ? (now - wkAgo) / wkAgo * 100 : null;
  const rateCls = rate == null ? "muted" : rate <= -0.5 && rate >= -1.0 ? "good" : rate < -1.0 ? "warn" : "warn";
  const rateMsg = rate == null ? "Log daily for a weekly rate" : rate <= -0.5 && rate >= -1.0 ? "On target (−0.5 to −1%/wk)" : rate < -1.0 ? "Too fast: add ~100 kcal if this holds 2 wks" : "Slow: cut ~150 kcal if this holds 2 wks";
  const r = ratio();
  const M = [["shoulders", "Shoulders"], ["chest", "Chest"], ["waist", "Waist"], ["arms", "Arms"], ["thighs", "Thighs"], ["neck", "Neck"]];
  return `
  <div class="row between"><h1 class="h1">Body</h1><button class="pill press" data-act="logweight" style="height:36px;padding:0 14px">+ WEIGHT</button></div>
  <div class="card"><div class="label">7-day average</div>
    <div class="row" style="align-items:flex-end;gap:10px;margin-top:4px"><span class="bignum">${now ? now.toFixed(1) : "—"}</span><span class="muted" style="margin-bottom:8px">lb</span></div>
    <div style="font-size:13px;font-weight:700;margin-top:6px;color:var(--${rateCls === "muted" ? "muted" : rateCls})">${rate == null ? "" : (rate > 0 ? "+" : "") + rate.toFixed(2) + "%/wk · "}${rateMsg}</div>
    <div class="row between" style="margin:14px 0 8px"><span class="label">Trend</span><div class="seg">${[[28, "4W"], [84, "12W"], [3650, "ALL"]].map(([d, l]) => `<button class="${RANGE === d ? "on" : ""}" data-range="${d}">${l}</button>`).join("")}</div></div>
    <div class="chart">${weightChart(ws)}</div>
    <button class="btn press" style="margin-top:12px" data-act="logweight">Log weight</button></div>
  <div class="card"><div class="row between"><span class="label">V-Taper ratio</span><span class="muted" style="font-size:12px">shoulders ÷ waist</span></div>${gauge(r)}
    <div class="muted" style="font-size:13px;text-align:center">${r ? (r >= 1.6 ? "Golden ratio reached. Elite V-taper." : `${(1.6 - r).toFixed(2)} to the 1.6 golden ratio. Delts + lats up, waist down.`) : "Log shoulders and waist to see your ratio."}</div></div>
  <div class="row between"><span class="label">Measurements · inches</span><button class="pill press" data-act="measure">MEASURE ALL</button></div>
  <div class="grid2">${M.map(([id, l]) => {
    const vals = b.filter(e => e[id]).map(e => e[id]), last = vals[vals.length - 1];
    const m30 = b.filter(e => e[id] && daysBetween(e.date, TODAY) >= 28).pop(), d = last && m30 ? last - m30[id] : null;
    const good = id === "waist" ? d < 0 : d > 0;
    return `<button class="mtile press" data-measure="${id}"><span class="label">${l}</span><span class="v">${last ? fmtW(last) : "—"}</span>${spark(vals.slice(-12), id === "waist" ? "var(--h-fuel)" : "var(--accent)")}<span style="font-size:12px;font-weight:700;color:${d == null ? "var(--muted)" : good ? "var(--good)" : "var(--warn)"}">${d == null ? "Tap to log" : (d > 0 ? "+" : "") + d.toFixed(1) + " in · 30d"}</span></button>`;
  }).join("")}</div>
  ${dow(TODAY) === 6 ? '<div class="card tip"><b>SUNDAY</b><span>Weekly check-in: measure everything, same time, relaxed.</span></div>' : ""}`;
}
function weightChart(ws) {
  const W = 340, H = 170, P = { l: 34, r: 8, t: 10, b: 20 };
  const from = addD(TODAY, -RANGE + 1); const pts = ws.filter(e => e.date >= from);
  if (pts.length < 1) return `<svg viewBox="0 0 ${W} ${H}"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="12" fill="none" stroke="var(--line)" stroke-dasharray="6 6"/><text x="${W / 2}" y="${H / 2 + 5}" text-anchor="middle" fill="var(--muted)" font-size="14" font-family="Manrope">Log your first weigh-in</text></svg>`;
  const first = RANGE > 1000 ? pts[0].date : from, span = Math.max(1, daysBetween(first, TODAY));
  const ma = pts.map(e => ({ date: e.date, v: movingAvg(e.date) }));
  const all = pts.map(e => e.weight).concat(ma.map(m => m.v)); let mn = Math.floor(Math.min(...all) - 1), mx = Math.ceil(Math.max(...all) + 1);
  const x = d => P.l + daysBetween(first, d) / span * (W - P.l - P.r), y = v => P.t + (mx - v) / (mx - mn) * (H - P.t - P.b);
  const ticks = [mn, (mn + mx) / 2, mx];
  return `<svg viewBox="0 0 ${W} ${H}">${ticks.map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)" stroke-width="1"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">${Math.round(t)}</text>`).join("")}
    ${pts.map(e => `<circle cx="${x(e.date)}" cy="${y(e.weight)}" r="3" fill="var(--muted)" opacity=".7"/>`).join("")}
    ${ma.length > 1 ? `<polyline points="${ma.map(m => `${x(m.date)},${y(m.v)}`).join(" ")}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>` : ""}
    <circle cx="${x(ma[ma.length - 1].date)}" cy="${y(ma[ma.length - 1].v)}" r="5" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>
    <text x="${P.l}" y="${H - 4}" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">${pdate(first).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text><text x="${W - P.r}" y="${H - 4}" text-anchor="end" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">TODAY</text></svg>`;
}
function gauge(r) {
  const lo = 1.3, hi = 1.8, cx = 150, cy = 140, R = 110;
  const pt = v => { const a = Math.PI * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)); return [cx + R * Math.cos(a), cy - R * Math.sin(a)]; };
  const arc = (a, b, col, w) => { const [x1, y1] = pt(a), [x2, y2] = pt(b); return `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round"/>`; };
  const [tx, ty] = pt(1.6), n = r ? pt(r) : null;
  return `<svg viewBox="0 0 300 160" style="width:100%;max-width:340px;display:block;margin:8px auto 0">
    ${arc(lo, hi, "var(--surface-2)", 18)}${arc(lo, 1.45, "var(--warn)", 18)}${arc(1.45, 1.6, "color-mix(in srgb,var(--accent) 60%,var(--warn))", 18)}${arc(1.6, hi, "var(--accent)", 18)}
    <line x1="${tx}" y1="${ty - 16}" x2="${tx}" y2="${ty + 16}" stroke="var(--pr)" stroke-width="3" transform="rotate(${(1.6 - lo) / (hi - lo) * 180 - 90} ${tx} ${ty})"/>
    <text x="${tx}" y="${ty - 20}" text-anchor="middle" fill="var(--pr)" font-size="12" font-family="Barlow Condensed" font-weight="700">1.6</text>
    ${n ? `<line x1="${cx}" y1="${cy}" x2="${n[0]}" y2="${n[1]}" stroke="var(--text)" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="7" fill="var(--text)"/>` : ""}
    <text x="${cx}" y="${cy - 34}" text-anchor="middle" fill="var(--text)" font-size="42" font-family="Barlow Condensed" font-weight="800">${r ? r.toFixed(2) : "—"}</text>
    <text x="${pt(lo)[0]}" y="${cy + 18}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">1.3</text><text x="${pt(hi)[0]}" y="${cy + 18}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">1.8</text></svg>`;
}
function logWeightSheet() {
  askNumber("Morning weight (lb)", latestWeight() || "", 0.1, v => { upsertBody(TODAY, { weight: v }); render(); toast(`Weight ${v} lb logged`); celebrateDay(); });
}
function measureSheet(only) {
  const M = only ? [only] : ["shoulders", "chest", "waist", "arms", "thighs", "neck"];
  const lab = { shoulders: "Shoulders", chest: "Chest", waist: "Waist (navel)", arms: "Arms (flexed)", thighs: "Thighs", neck: "Neck" };
  sheet(`<div class="h2">${only ? lab[only] : "Weekly measurements"} · in</div>
    <div class="grid2">${M.map(id => { const l = latestMeasure(id); return `<div class="field"><span class="label">${lab[id]}</span><input type="number" inputmode="decimal" step="0.1" data-m="${id}" placeholder="${l ? fmtW(l.v) : "0"}"></div>`; }).join("")}</div>
    <button class="btn press" data-act="savemeasure">Save</button>`);
}

/* ============ STATS ============ */
function viewStats() {
  const st = streakInfo(), m = S.get("meta", {});
  // heatmap: 26 weeks, Mon-start columns
  const endWs = weekStart(TODAY), startWs = addD(endWs, -25 * 7), cell = 11, gap = 2;
  const col = { perfect: "var(--pr)", full: "var(--accent)", part: "var(--accent-dim)", freeze: "var(--freeze)", none: "var(--surface-2)" };
  let cells = "", months = "";
  for (let w = 0; w < 26; w++) {
    const ws = addD(startWs, w * 7); const d = pdate(ws);
    if (d.getDate() <= 7) months += `<text x="${22 + w * (cell + gap)}" y="9" fill="var(--muted)" font-size="9" font-family="Manrope" font-weight="700">${d.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</text>`;
    for (let i = 0; i < 7; i++) { const k = addD(ws, i); if (k > TODAY) continue; const s = st.days[k] || "none"; cells += `<rect x="${22 + w * (cell + gap)}" y="${14 + i * (cell + gap)}" width="${cell}" height="${cell}" rx="2.5" fill="${col[s]}"${k === TODAY ? ' stroke="var(--text)" stroke-width="1.5"' : ""}><title>${k}</title></rect>`; }
  }
  const hw = 22 + 26 * (cell + gap), hh = 14 + 7 * (cell + gap);
  const dl = ["M", "", "W", "", "F", "", "S"].map((l, i) => `<text x="0" y="${14 + i * (cell + gap) + 9}" fill="var(--muted)" font-size="9" font-family="Manrope" font-weight="700">${l}</text>`).join("");
  // weekly volume, 12 weeks
  const vols = []; for (let w = 11; w >= 0; w--) { const ws = addD(endWs, -w * 7); let v = 0; for (let i = 0; i < 7; i++) { const x = wlog(addD(ws, i)); if (x && x.finishedAt) v += x.entries.reduce((a, e) => a + e.sets.filter(s => s.done).reduce((b, s) => b + s.w * s.r, 0), 0); } vols.push({ ws, v }); }
  const vmax = Math.max(1, ...vols.map(x => x.v));
  const volSvg = `<svg viewBox="0 0 340 130" style="width:100%">${vols.map((x, i) => { const h = x.v / vmax * 82; return `<rect x="${6 + i * 28}" y="${104 - h}" width="20" height="${Math.max(2, h)}" rx="4" fill="${i === 11 ? "var(--accent)" : "color-mix(in srgb,var(--accent) 45%,var(--surface-2))"}"/>${i === 11 && x.v ? `<text x="${16 + i * 28}" y="${98 - h}" text-anchor="end" fill="var(--text)" font-size="12" font-family="Barlow Condensed" font-weight="700">${(x.v / 1000).toFixed(1)}k</text>` : ""}`; }).join("")}<text x="6" y="122" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">12 WKS AGO</text><text x="334" y="122" text-anchor="end" fill="var(--muted)" font-size="11" font-family="Barlow Condensed">THIS WEEK</text></svg>`;
  const LIFTS = [["barbell-bench-press", "Bench"], ["back-squat", "Squat"], ["standing-ohp", "OHP"], ["trap-bar-deadlift", "Deadlift"], ["weighted-pull-up", "Pull-up"], ["barbell-row", "Row"]];
  return `
  <div class="row between"><h1 class="h1">Stats</h1><button class="x press" data-act="settings" aria-label="Settings">${IC.gear}</button></div>
  <div class="grid2"><div class="mtile"><span class="label">Current streak</span><span class="v" style="font-size:48px;color:var(--accent)">${st.cur}<span style="font-size:18px"> days</span></span><span class="muted" style="font-size:12px">${st.freezes ? "❄ " + st.freezes + " freeze banked" : "7 in a row earns a freeze"}</span></div>
    <div class="mtile"><span class="label">Best · Perfect days</span><span class="v" style="font-size:48px">${st.best}<span class="muted" style="font-size:26px"> · ${st.perfect}</span></span><span class="muted" style="font-size:12px">${m.sessions || 0} sessions logged</span></div></div>
  <div class="card"><div class="label" style="margin-bottom:10px">Consistency · 26 weeks</div><div class="heat"><svg style="width:100%;height:auto;min-width:300px" viewBox="0 0 ${hw} ${hh}">${months}${dl}${cells}</svg></div>
    <div class="row muted" style="font-size:11px;gap:12px;margin-top:10px;flex-wrap:wrap">${[["Perfect", "pr"], ["80%+", "accent"], ["Partial", "accent-dim"], ["Freeze", "freeze"]].map(([l, c]) => `<span class="row" style="gap:5px"><i style="width:10px;height:10px;border-radius:2px;background:var(--${c})"></i>${l}</span>`).join("")}</div></div>
  <div class="card"><div class="label" style="margin-bottom:6px">Weekly volume · lb</div>${volSvg}</div>
  <div class="card"><div class="label" style="margin-bottom:6px">Strength · est. 1RM</div><div class="list">${LIFTS.map(([id, l]) => { const h = history(id), last = h[h.length - 1], first = h[0]; const d = last && first && h.length > 1 ? last.e1rm - first.e1rm : null;
    return `<div class="li"><span style="width:76px;font-weight:700">${l}</span><span style="flex:1;min-width:0">${spark(h.slice(-16).map(x => x.e1rm))}</span><span style="width:70px;text-align:right"><b class="num" style="font-size:20px">${last ? Math.round(last.e1rm) : "—"}</b>${d != null ? `<br><span style="font-size:11px;font-weight:700;color:${d >= 0 ? "var(--good)" : "var(--warn)"}">${d >= 0 ? "+" : ""}${Math.round(d)}</span>` : ""}</span></div>`; }).join("")}</div></div>
  <div class="card"><div class="label" style="margin-bottom:12px">Milestones</div><div class="badges">${badges(st).map(b => `<div class="badge ${b.on ? "on" : ""}"><svg viewBox="0 0 52 56"><path d="M26 2l22 12v28L26 54 4 42V14z" fill="${b.on ? b.c : "none"}" stroke="${b.on ? b.c : "var(--line)"}" stroke-width="2.5"/><text x="26" y="34" text-anchor="middle" font-family="Barlow Condensed" font-weight="800" font-size="${b.t.length > 3 ? 13 : 17}" fill="${b.on ? "#111" : "var(--muted)"}">${b.t}</text></svg>${b.l}</div>`).join("")}</div></div>`;
}
function badges(st) {
  const m = S.get("meta", {}), p = profile(), b = body(), r = ratio();
  const w0 = (b.find(e => e.weight) || {}).weight || p.weight, wN = latestWeight();
  const waist = b.filter(e => e.waist), wd = waist.length > 1 ? waist[0].waist - waist[waist.length - 1].waist : 0;
  const ws = weekStart(TODAY); let wkDone = 0; for (let i = 0; i < 7; i++) { const x = wlog(addD(ws, i)); if (x && x.finishedAt) wkDone++; }
  const prs = S.get("prs", {}), ohp = prs["standing-ohp"], pu = history("weighted-pull-up").some(h => h.sets.some(s => s.r >= 10 || s.w > 0));
  return [
    { t: "1", l: "First session", on: (m.sessions || 0) >= 1, c: "var(--accent)" },
    { t: "5/5", l: "Full week", on: wkDone >= 5, c: "var(--accent)" },
    { t: "PR", l: "First PR", on: (m.prTotal || 0) >= 1, c: "var(--pr)" },
    { t: "7", l: "7-day streak", on: st.best >= 7, c: "var(--accent)" },
    { t: "28", l: "4-week streak", on: st.best >= 28, c: "var(--pr)" },
    { t: "-5%", l: "Weight −5%", on: w0 && wN <= w0 * 0.95, c: "var(--good)" },
    { t: "-2\"", l: "Waist −2 in", on: wd >= 2, c: "var(--good)" },
    { t: "1.45", l: "Ratio 1.45", on: r >= 1.45, c: "var(--h-core)" },
    { t: "1.5", l: "Ratio 1.5", on: r >= 1.5, c: "var(--h-core)" },
    { t: "1.6", l: "Golden ratio", on: r >= 1.6, c: "var(--pr)" },
    { t: "10", l: "10 pull-ups", on: pu, c: "var(--h-fuel)" },
    { t: "OHP", l: "OHP .75×BW", on: ohp && ohp.w >= wN * 0.75 && ohp.r >= 5, c: "var(--h-fuel)" }
  ];
}

/* ============ SETTINGS ============ */
function settingsSheet() {
  const p = profile(), T = targets(), sm = S.get("smoothie", { p: 40, kcal: 300 });
  sheet(`<div class="h2">Settings</div>
    <div class="card" style="background:var(--surface-2)"><div class="label">Your targets</div><div class="row" style="gap:18px;margin-top:6px"><span><b class="num" style="font-size:24px">${T.kcal}</b> kcal</span><span><b class="num" style="font-size:24px">${T.protein}</b>g protein</span></div><div class="muted" style="font-size:12px;margin-top:4px">BMR ${T.bmr} · TDEE ${T.tdee} · 20% deficit</div></div>
    <div class="grid2">
      <div class="field"><span class="label">Age</span><input id="sAge" type="number" inputmode="numeric" value="${p.age}" data-focus="no"></div>
      <div class="field"><span class="label">Height (in)</span><input id="sH" type="number" inputmode="decimal" value="${p.heightIn}"></div>
      <div class="field"><span class="label">Goal weight (lb)</span><input id="sGW" type="number" inputmode="decimal" value="${p.goalWeight || ""}" placeholder="optional"></div>
      <div class="field"><span class="label">Calorie adjust</span><input id="sAdj" type="number" inputmode="numeric" step="50" value="${p.kcalAdj || 0}"></div>
      <div class="field"><span class="label">Smoothie protein g</span><input id="sSP" type="number" inputmode="numeric" value="${sm.p}"></div>
      <div class="field"><span class="label">Smoothie kcal</span><input id="sSK" type="number" inputmode="numeric" value="${sm.kcal}"></div>
    </div>
    <div class="field"><span class="label">Activity</span><select id="sAct">${Object.keys(PROGRAM.nutrition.multipliers).map(a => `<option ${p.activity === a ? "selected" : ""}>${a}</option>`).join("")}</select></div>
    <div class="field"><span class="label">Program start date</span><input id="sStart" type="date" value="${p.startDate}" style="font-family:var(--ui);font-size:16px"></div>
    <button class="btn press" data-act="savesettings">Save</button>
    <div class="label" style="margin-top:8px">Backup · data lives on this phone</div>
    <div class="grid2"><button class="btn ghost sm press" data-act="export">Export</button><button class="btn ghost sm press" data-act="import">Import</button></div>
    <button class="btn ghost sm press" style="color:var(--bad)" data-act="reset">Reset all data</button>`);
}
function exportData() {
  const payload = JSON.stringify({ app: "ft", schema: 1, exportedAt: new Date().toISOString(), data: S.all() });
  const name = `forge-backup-${TODAY}.json`, blob = new Blob([payload], { type: "application/json" });
  const done = () => { const m = S.get("meta", {}); m.lastExport = Date.now(); S.set("meta", m); toast("Backup saved"); render(); };
  try { const f = new File([blob], name, { type: "application/json" }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f], title: "Forge backup" }).then(done).catch(() => {}); return; } } catch (e) {}
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); done();
}
function importData(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let j; try { j = JSON.parse(rd.result); } catch (e) { toast("That file isn't a Forge backup"); return; }
    if (!j || j.app !== "ft" || !j.data) { toast("That file isn't a Forge backup"); return; }
    const n = Object.keys(j.data).filter(k => k.startsWith("ft.workouts.")).length;
    sheet(`<div class="h2">Replace all data?</div><div class="muted">Backup from ${esc(String(j.exportedAt).slice(0, 10))} · ${n} workouts. Your current data on this phone will be replaced.</div>
      <button class="btn press" id="doImport">Replace all</button><button class="btn ghost press" data-act="closesheet">Cancel</button>`);
    $("#doImport").onclick = () => { Object.keys(S.all()).forEach(k => localStorage.removeItem(k)); Object.entries(j.data).forEach(([k, v]) => localStorage.setItem(k, v)); closeSheet(); render(); toast("Backup restored"); };
  };
  rd.readAsText(file);
}

/* ============ ONBOARDING ============ */
let OB = { step: 0, d: { activity: "moderate", startDate: null } };
function renderOnboarding() {
  $("#tabs").hidden = true; $("#fab").hidden = true;
  const d = OB.d, s = OB.step;
  const dots = `<div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i <= s ? "on" : ""}"></i>`).join("")}</div>`;
  let body = "";
  if (s === 0) body = `<div style="margin-top:20px"><div class="label" style="color:var(--accent)">Forge</div><h1 class="h1" style="font-size:52px;margin-top:8px">Build the<br>V-taper.</h1><p class="muted" style="font-size:16px;line-height:1.5;max-width:30ch">8-week cut & build. 5 lifting days, daily habits, protein targets and streaks, all on your phone.</p></div>
    <div class="card" style="display:flex;flex-direction:column;gap:12px">${[["Train", "Coach program, log every set, auto progression"], ["Fuel", "Calorie + protein targets, one-tap smoothies"], ["Body", "Weight trend, measurements, V-taper ratio"], ["Streak", "Daily habits, heatmap, milestones"]].map(([a, b]) => `<div class="row"><span class="pill accent" style="width:70px;text-align:center">${a.toUpperCase()}</span><span class="muted" style="font-size:14px">${b}</span></div>`).join("")}</div>
    <div style="flex:1"></div><button class="btn press" data-ob="next">Get started</button>`;
  if (s === 1) body = `<h1 class="h1">Your stats</h1><p class="muted" style="margin:0">Used to calculate your calories and protein.</p>
    <div class="grid2"><div class="field"><span class="label">Age</span><input id="oAge" type="number" inputmode="numeric" value="${d.age || ""}" placeholder="30"></div>
    <div class="field"><span class="label">Weight (lb)</span><input id="oW" type="number" inputmode="decimal" value="${d.weight || ""}" placeholder="185"></div>
    <div class="field"><span class="label">Height (ft)</span><input id="oFt" type="number" inputmode="numeric" value="${d.ft || ""}" placeholder="5"></div>
    <div class="field"><span class="label">Height (in)</span><input id="oIn" type="number" inputmode="numeric" value="${d.inch ?? ""}" placeholder="10"></div></div>
    <div class="label">Activity outside the gym</div>
    <div class="opt">${[["sedentary", "Desk job", "Mostly sitting"], ["light", "Light", "Some walking"], ["moderate", "Moderate", "On your feet a lot, or 8k+ steps"], ["high", "High", "Physical job"]].map(([v, a, b]) => `<button class="${d.activity === v ? "on" : ""}" data-act-lvl="${v}"><b>${a}</b><small>${b}</small></button>`).join("")}</div>
    <div style="flex:1"></div><button class="btn press" data-ob="next">Next</button>`;
  if (s === 2) body = `<h1 class="h1">V-taper baseline</h1><p class="muted" style="margin:0">Optional. Measure with a tape, relaxed. Shoulders around the widest point, waist at the navel.</p>
    <div class="grid2"><div class="field"><span class="label">Shoulders (in)</span><input id="oSh" type="number" inputmode="decimal" value="${d.shoulders || ""}" placeholder="48"></div>
    <div class="field"><span class="label">Waist (in)</span><input id="oWa" type="number" inputmode="decimal" value="${d.waist || ""}" placeholder="34"></div></div>
    <div style="flex:1"></div><button class="btn press" data-ob="next">Next</button><button class="btn ghost press" data-ob="next">Skip</button>`;
  if (s === 3) { const t = previewTargets(); body = `<h1 class="h1">Your plan</h1>
    <div class="grid2"><div class="mtile" style="background:var(--surface)"><span class="label">Calories</span><span class="v" style="font-size:40px">${t.kcal}</span><span class="muted" style="font-size:12px">20% deficit</span></div><div class="mtile"><span class="label">Protein</span><span class="v" style="font-size:40px;color:var(--h-fuel)">${t.protein}g</span><span class="muted" style="font-size:12px">1 g per lb</span></div></div>
    <div class="card"><div class="label" style="margin-bottom:10px">Weekly split</div><div class="week">${PROGRAM.split.map(p => `<div class="d">${p.day[0]}<span class="dot ${p.type === "rest" ? "rest" : "done"}" style="width:38px;height:38px;font-size:11px">${p.type === "rest" ? "REST" : p.name.split(" ")[0].slice(0, 4).toUpperCase()}</span></div>`).join("")}</div></div>
    <div class="field"><span class="label">Start date</span><input id="oStart" type="date" value="${d.startDate || TODAY}" style="font-family:var(--ui);font-size:16px"></div>
    <div style="flex:1"></div><button class="btn press" data-ob="finish">Let's go</button>`; }
  $("#view").innerHTML = `<div class="ob">${s ? `<div class="row" style="gap:12px"><button class="x press" data-ob="back" aria-label="Back"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button><div style="flex:1">${dots}</div></div>` : ""}${body}</div>`;
}
function previewTargets() { const save = S.get("profile", null); S.set("profile", { ...OB.d, startDate: TODAY }); const t = targets(); if (save) S.set("profile", save); else S.del("profile"); return t; }
function obCollect() {
  const d = OB.d, v = id => { const e = $("#" + id); return e && e.value !== "" ? parseFloat(e.value) : undefined; };
  if (OB.step === 1) { d.age = v("oAge"); d.weight = v("oW"); d.ft = v("oFt"); d.inch = v("oIn"); if (!d.age || !d.weight || !d.ft) { toast("Fill in age, weight and height"); return false; } d.heightIn = d.ft * 12 + (d.inch || 0); }
  if (OB.step === 2) { d.shoulders = v("oSh"); d.waist = v("oWa"); }
  if (OB.step === 3) { d.startDate = $("#oStart").value || TODAY; }
  return true;
}

/* ============ events ============ */
document.addEventListener("click", e => {
  const t = e.target.closest("button,[data-tab]"); if (!t) { if (e.target.id === "sheet") closeSheet(); return; }
  const ds = t.dataset;
  if (ds.tab) { TAB = ds.tab; render(); return; }
  if (ds.habit) return toggleHabit(ds.habit);
  if (ds.water) { const k = TODAY, H = hlog(k), prev = { ...H }, n = +ds.water; H.water = (H.water || 0) >= n ? n - 1 : n; setH(k, H); render(); if (H.water === 8) toast("8/8 water ✓", () => { setH(k, prev); render(); }); celebrateDay(); return; }
  if (ds.smoothie) return logSmoothie(+ds.smoothie);
  if (ds.preview) return previewDay(+ds.preview);
  if (ds.startday) { const k = TODAY, idx = dow(ds.startday); if (wlog(k) && wlog(k).finishedAt) { toast("Today's session is already logged"); return; } S.del("workouts." + k); return openSession(k, idx); }
  if (ds.step) { const [ei, si, f, dir] = ds.step.split(","); return stepSet(+ei, +si, f, +dir); }
  if (ds.set) { const [ei, si] = ds.set.split(","); return completeSet(+ei, +si); }
  if (ds.addset) { const e = SES.entries[+ds.addset], l = e.sets[e.sets.length - 1] || { w: 0, r: 8 }; e.sets.push({ w: l.w, r: l.r, done: false }); saveSes(); return renderSessionKeepScroll(); }
  if (ds.rest) { if (!REST) return; if (ds.rest === "skip") return stopRest(); REST.end += +ds.rest * 1000; return tickRest(); }
  if (ds.add) { const [p, c, nm] = ds.add.split(","); return addFood(+p, +c, nm ? "food" : "chip", nm || (+p ? "Protein" : "Calories")); }
  if (ds.delfood) { const k = TODAY, log = nlog(k), it = log.find(x => x.id === ds.delfood); S.set("nutrition." + k, log.filter(x => x.id !== ds.delfood)); render(); toast("Entry deleted", () => { const l = nlog(k); l.push(it); l.sort((a, b) => a.t - b.t); S.set("nutrition." + k, l); render(); }); return; }
  if (ds.range) { RANGE = +ds.range; return render(); }
  if (ds.measure) return measureSheet(ds.measure);
  if (ds.actLvl) { const d = OB.d, v = id => { const x = $("#" + id); return x && x.value !== "" ? parseFloat(x.value) : undefined; }; d.age = v("oAge"); d.weight = v("oW"); d.ft = v("oFt"); d.inch = v("oIn"); d.activity = ds.actLvl; return renderOnboarding(); }
  if (ds.ob) {
    if (ds.ob === "back") { OB.step--; return renderOnboarding(); }
    if (!obCollect()) return;
    if (ds.ob === "next") { OB.step++; return renderOnboarding(); }
    if (ds.ob === "finish") {
      const d = OB.d; S.set("profile", { v: 1, age: d.age, weight: d.weight, heightIn: d.heightIn, activity: d.activity, startDate: d.startDate, kcalAdj: 0 });
      upsertBody(TODAY, { weight: d.weight, ...(d.shoulders ? { shoulders: d.shoulders } : {}), ...(d.waist ? { waist: d.waist } : {}) });
      TAB = "today"; render(); toast("Plan ready. Let's work."); return;
    }
  }
  const a = ds.act; if (!a) return;
  ({
    undo() { if (undoFn) { const f = undoFn; undoFn = null; $("#toast").hidden = true; f(); } },
    start() { openSession(TODAY); },
    minimize() { closeSession(); },
    finish() { finishSession(); },
    discard() { closeSheet(); S.del("workouts." + SESK); const m = S.get("meta", {}); delete m.activeSession; S.set("meta", m); stopRest(); closeSession(); toast("Session discarded"); },
    closesheet() { closeSheet(); },
    quickfuel() { TAB = "fuel"; render(); },
    smoothie() { logSmoothie(); },
    custom() { const p = parseFloat($("#cp").value) || 0, c = parseFloat($("#ck").value) || 0; if (!p && !c) { toast("Enter protein or calories"); return; } addFood(p, c, "custom", "Custom"); },
    logweight() { logWeightSheet(); },
    measure() { measureSheet(); },
    savemeasure() { const patch = {}; document.querySelectorAll("[data-m]").forEach(i => { if (i.value) patch[i.dataset.m] = parseFloat(i.value); }); closeSheet(); if (Object.keys(patch).length) { upsertBody(TODAY, patch); toast("Measurements saved"); } render(); },
    settings() { settingsSheet(); },
    savesettings() {
      const p = profile(), v = id => parseFloat($("#" + id).value);
      Object.assign(p, { age: v("sAge") || p.age, heightIn: v("sH") || p.heightIn, goalWeight: v("sGW") || undefined, kcalAdj: v("sAdj") || 0, activity: $("#sAct").value, startDate: $("#sStart").value || p.startDate });
      S.set("profile", p); S.set("smoothie", { p: v("sSP") || 40, kcal: v("sSK") || 300 }); closeSheet(); render(); toast("Saved");
    },
    export() { exportData(); },
    import() { $("#importFile").click(); },
    reset() { sheet(`<div class="h2" style="color:var(--bad)">Delete everything?</div><div class="muted">All workouts, body data and streaks on this phone will be erased. Export a backup first.</div><button class="btn press" style="background:var(--bad)" data-act="doreset">Delete all data</button><button class="btn ghost press" data-act="closesheet">Cancel</button>`); },
    doreset() { Object.keys(S.all()).forEach(k => localStorage.removeItem(k)); closeSheet(); OB = { step: 0, d: { activity: "moderate" } }; render(); }
  })[a]?.();
});
document.addEventListener("change", e => {
  if (e.target.id === "importFile" && e.target.files[0]) { importData(e.target.files[0]); e.target.value = ""; return; }
  const d = e.target.dataset.in; if (d && SES) { const [ei, si, f] = d.split(","); const v = parseFloat(e.target.value); SES.entries[+ei].sets[+si][f] = isNaN(v) ? 0 : v; saveSes(); }
});
document.addEventListener("focusin", e => { if (e.target.dataset && e.target.dataset.in) e.target.select(); });

/* day rollover */
function checkDay() { const k = todayK(); if (k !== TODAY) { TODAY = k; if ($("#overlay").hidden) render(); } }
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
setInterval(checkDay, 60000);

/* boot */
(function boot() {
  // migrate the original checklist's data if present (fit-history)
  try { const old = JSON.parse(localStorage.getItem("fit-history") || "null"); if (old && !S.get("migrated", false)) {
    Object.entries(old).forEach(([k, v]) => { const c = v.checks || {}; const H = hlog(k);
      H.workout = H.workout || !!c["train-0"]; H.cardio = H.cardio || !!c["train-1"]; H.crunches = c["train-2"] ? 50 : (H.crunches || 0); H.legRaises = c["train-3"] ? 30 : (H.legRaises || 0); H.noSugar = H.noSugar || !!c["train-4"];
      H.water = Math.max(H.water || 0, Array.from({ length: 8 }, (_, i) => c["water-" + i]).filter(Boolean).length);
      H.smoothies = Math.max(H.smoothies || 0, [0, 1].filter(i => c["protein-" + i]).length); setH(k, H); });
    S.set("migrated", true); } } catch (e) {}
  const a = sessionKey(); render();
  if (a && wlog(a) && !wlog(a).finishedAt && a === TODAY) toast("Session in progress", null);
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
