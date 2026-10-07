"use strict";
/* ---------- storage ---------- */
const S = {
  get(k, d) { try { const v = localStorage.getItem("ft." + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem("ft." + k, JSON.stringify(v)); } catch (e) {} },
  all() { const o = {}; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("ft.")) o[k] = localStorage.getItem(k); } } catch (e) {} return o; }
};
const $ = s => document.querySelector(s);

/* ---------- dates ---------- */
const pad = n => String(n).padStart(2, "0");
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const pdate = k => new Date(k + "T12:00:00");
const addD = (k, n) => { const d = pdate(k); d.setDate(d.getDate() + n); return dkey(d); };
const dow = k => (pdate(k).getDay() + 6) % 7; // 0 = Mon
const weekStart = k => addD(k, -dow(k));
let TODAY = dkey(new Date());

/* ---------- settings ---------- */
const WORKOUTS = PROGRAM.split.filter(d => d.type === "train"); // 5-workout rotation
function cfg() {
  const c = S.get("simple", null); if (c) return c;
  const p = S.get("profile", null);
  return { proteinGoal: p && p.weight ? Math.round(p.weight) : 150, smoothieP: 25, next: 0, setup: !!p };
}
const saveCfg = c => S.set("simple", c);

/* ---------- day data ---------- */
const day = k => S.get("habits." + k, {});
const saveDay = (k, d) => S.set("habits." + k, d);
function proteinOf(k) {
  const d = day(k); if (typeof d.protein === "number") return d.protein;
  return S.get("nutrition." + k, []).reduce((a, e) => a + (e.p || 0), 0); // older app data
}
const gymOn = k => !!day(k).workout;

/* ---------- streaks ---------- */
function proteinStreak() {
  const g = cfg().proteinGoal; let k = proteinOf(TODAY) >= g ? TODAY : addD(TODAY, -1), n = 0;
  while (proteinOf(k) >= g && n < 3650) { n++; k = addD(k, -1); }
  return n;
}
function gymCount(ws) { let n = 0; for (let i = 0; i < 7; i++) if (gymOn(addD(ws, i))) n++; return n; }
function gymStreak() {
  const ws = weekStart(TODAY); let n = gymCount(ws) >= 5 ? 1 : 0, w = addD(ws, -7);
  while (gymCount(w) >= 5 && n < 520) { n++; w = addD(w, -7); }
  return n;
}

/* ---------- icons ---------- */
const IC = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  bar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M3 12h18M6 8v8M9 7v10M15 7v10M18 8v8"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>'
};

/* ---------- toast ---------- */
let tTimer = null, undoFn = null;
function toast(msg, undo) {
  const t = $("#toast"); undoFn = undo || null;
  t.innerHTML = `<span>${msg}</span>${undo ? '<button data-a="undo">UNDO</button>' : ""}`;
  t.hidden = false; clearTimeout(tTimer); tTimer = setTimeout(() => { t.hidden = true; undoFn = null; }, 3500);
}

/* ---------- main screen ---------- */
function render() {
  const c = cfg();
  if (!c.setup) return renderSetup();
  const d = day(TODAY), ws = weekStart(TODAY), gc = gymCount(ws), p = proteinOf(TODAY), sm = d.smoothies || 0, water = d.water || 0;
  const w = WORKOUTS[c.next % WORKOUTS.length], doneToday = gymOn(TODAY);
  const left = 5 - gc, daysLeft = 7 - dow(TODAY);
  const weekMsg = gc >= 5 ? "Week goal hit. Rest or go again, your call." : left > daysLeft ? `${left} to go, only ${daysLeft} days left.` : `${left} to go. Rest any day you like.`;
  const date = pdate(TODAY).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const habit = (id, label, on) => `<button class="tbtn ${on ? "don" : ""}" data-h="${id}">${on ? IC.check : ""}${label}</button>`;

  $("#app").innerHTML = `
  <header><div><div class="date">${date}</div><h1>Today</h1></div>
    <div class="streaks"><span class="streak g">${IC.bar}<b>${gymStreak()}</b>wk</span><span class="streak p">${IC.drop}<b>${proteinStreak()}</b>day</span></div></header>

  <section class="card">
    <div class="row"><span class="title">Gym this week</span><span class="num big">${gc}<small>/5</small></span></div>
    <div class="week">${[..."MTWTFSS"].map((l, i) => { const k = addD(ws, i); return `<button class="day ${gymOn(k) ? "on" : ""} ${k === TODAY ? "today" : ""} ${k > TODAY ? "future" : ""}" data-gym="${k}" ${k > TODAY ? "disabled" : ""} aria-label="${k}">${l}<span class="box">${IC.check}</span></button>`; }).join("")}</div>
    <div class="sub">${weekMsg}</div>
    <button class="btn ghost" style="font-size:17px;height:46px" data-a="logworkout">+ Log a workout</button>
  </section>

  <section class="card next">
    ${doneToday
      ? `<div class="donebar">${IC.check}<span>Gym done today</span></div><div class="sub">Next up: ${w.name} · ${w.sub}</div>`
      : `<div><div class="lbl">Next workout · ${(c.next % 5) + 1} of 5</div><div class="nm" style="margin-top:4px">${w.name}</div><div class="sub">${w.sub} · ${w.exercises.length} exercises · ~60 min</div></div>
         <button class="btn" data-a="start">Start workout</button>`}
  </section>

  <section class="card">
    <div class="row"><span class="title">Protein</span><button class="num big" data-a="editprotein" aria-label="Edit protein">${p}<small>/${c.proteinGoal}g</small></button></div>
    <div class="bar"><i style="width:${Math.min(100, p / c.proteinGoal * 100)}%"></i></div>
    <div class="grid2">${[1, 2].map(i => `<button class="tbtn ${sm >= i ? "pon" : ""}" data-sm="${i}">${sm >= i ? IC.check : ""}Smoothie ${i}</button>`).join("")}</div>
    <div class="grid3">${[10, 20, 30].map(g => `<button class="tbtn chip" data-p="${g}">+${g}g</button>`).join("")}</div>
    ${p >= c.proteinGoal ? '<div class="sub" style="color:var(--pro)">Protein goal hit. Streak safe.</div>' : `<div class="sub">${c.proteinGoal - p}g to go</div>`}
  </section>

  ${watchCard(d)}

  <section class="card">
    <span class="title">Daily habits</span>
    <div class="row"><span class="sub">Water</span><span class="sub"><b style="color:var(--text)">${water}</b>/8 glasses</span></div>
    <div class="pips">${Array.from({ length: 8 }, (_, i) => `<button class="pip ${i < water ? "on" : ""}" data-w="${i + 1}" aria-label="Glass ${i + 1}">${i + 1}</button>`).join("")}</div>
    <div class="grid2">${habit("noSugar", "No sugar", d.noSugar)}${habit("cardio", "Cardio", d.cardio)}${habit("crunches", "50 crunches", (d.crunches || 0) >= 50)}${habit("legRaises", "30 leg raises", (d.legRaises || 0) >= 30)}</div>
  </section>

  <div class="foot"><button data-a="settings">Settings</button><button data-a="export">Back up</button></div>`;
}

/* ---------- Apple Watch sync (via the "Forge Sync" Shortcut) ---------- */
const SHORTCUT = "Forge Sync";
function watchCard(d) {
  const w = d.watch;
  const tile = (v, l) => `<div style="background:var(--card2);border-radius:12px;padding:10px;text-align:center"><div class="num" style="font-size:24px">${v}</div><div class="sub" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">${l}</div></div>`;
  return `<section class="card">
    <div class="row"><span class="title">Apple Watch</span><span class="sub">${w ? "Synced " + new Date(w.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "Not synced today"}</span></div>
    ${w ? `<div class="grid3">${tile(w.steps != null ? (w.steps >= 1000 ? (w.steps / 1000).toFixed(1) + "k" : w.steps) : "—", "Steps")}${tile(w.kcal != null ? w.kcal : "—", "Active kcal")}${tile(w.sleep != null ? w.sleep.toFixed(1) + "h" : "—", "Sleep")}</div>` : ""}
    <div class="grid2"><button class="btn ghost" style="font-size:17px" data-a="runsync">Sync Watch</button><button class="btn ghost" style="font-size:17px" data-a="paste">Paste data</button></div>
    <div class="sub" style="font-size:12px">Sync runs your Shortcut. Come back and tap Paste data.</div>
  </section>`;
}
// Parses "45 min", "1 hr 5 min", "3,900 s", "7.5" (number + optional unit) into minutes/hours
function toMinutes(s) {
  if (s == null || s === "") return null; s = String(s).replace(/,/g, "").toLowerCase();
  let m = 0, hit = false; const re = /([\d.]+)\s*(h|hr|hrs|hour|hours|m|min|mins|minute|minutes|s|sec|secs|second|seconds)?/g; let x;
  while ((x = re.exec(s))) { if (!x[1] || x[1] === ".") continue; hit = true; const v = parseFloat(x[1]), u = x[2] || "min";
    m += u[0] === "h" ? v * 60 : u[0] === "s" ? v / 60 : v; }
  return hit ? m : null;
}
const toNum = s => { if (s == null || s === "") return null; const v = parseFloat(String(s).replace(/,/g, "")); return isNaN(v) ? null : v; };
function parseSync(text) {
  if (!text || !/FORGE/i.test(text)) return null;
  const o = {}; String(text).split(/[;&\n|]/).forEach(p => { const i = p.indexOf("="); if (i > 0) o[p.slice(0, i).trim().toLowerCase()] = p.slice(i + 1).trim(); });
  return o;
}
function applySync(o) {
  const k = /^\d{4}-\d{2}-\d{2}$/.test(o.d || "") ? o.d : TODAY;
  const gym = toMinutes(o.gym), cardio = toMinutes(o.cardio), sleepMin = toMinutes(o.sleep && /[a-z]/i.test(o.sleep) ? o.sleep : o.sleep ? o.sleep + " h" : null);
  const d = day(k), c = cfg(); let msg = [];
  d.watch = { steps: o.steps != null ? Math.round(toNum(o.steps)) : null, kcal: o.kcal != null ? Math.round(toNum(o.kcal)) : null, sleep: sleepMin != null ? sleepMin / 60 : null, gym, cardio, at: Date.now() };
  if (gym >= 30 && !d.workout) { d.workout = true; msg.push(`Gym day ✓ (${Math.round(gym)} min)`); if (k === TODAY && !d.rotated) { c.next = (c.next + 1) % WORKOUTS.length; d.rotated = true; saveCfg(c); } }
  if (cardio >= 15 && !d.cardio) { d.cardio = true; msg.push(`Cardio ✓ (${Math.round(cardio)} min)`); }
  saveDay(k, d); render(); toast(msg.length ? msg.join(" · ") : "Watch data synced");
}
async function pasteSync() {
  try { const t = await navigator.clipboard.readText(); const o = parseSync(t); if (o) return applySync(o); } catch (e) {}
  sheet(`<div class="title">Paste Watch data</div><div class="sub">Long-press the box and tap Paste.</div>
    <textarea id="pasteBox" rows="3" style="width:100%;border-radius:12px;background:var(--card2);border:1px solid var(--line);color:var(--text);padding:12px;font:inherit"></textarea>
    <button class="btn" data-a="pastesave">Sync</button>`);
}

/* ---------- first run ---------- */
function renderSetup() {
  $("#app").innerHTML = `
  <div style="margin-top:24px"><div class="date" style="color:var(--gym)">FORGE</div><h1 style="font-size:46px;margin-top:6px">Two goals.<br>Every week.</h1></div>
  <div class="card"><div class="row"><span class="title">Gym 5 days a week</span><span class="streak g">${IC.bar}</span></div><div class="sub">Any 5 days. Workouts rotate, so rest whenever you need.</div></div>
  <div class="card"><div class="row"><span class="title">Protein every day</span><span class="streak p">${IC.drop}</span></div><div class="sub">Rule of thumb: 1 g per lb of body weight.</div>
    <label class="field"><span>Your body weight (lb)</span><input id="bw" type="number" inputmode="decimal" placeholder="180"></label></div>
  <button class="btn" data-a="setup">Let's go</button>`;
}

/* ---------- workout ---------- */
function openWorkout() {
  const c = cfg(), w = WORKOUTS[c.next % WORKOUTS.length], d = day(TODAY), done = d.exDone || [];
  $("#ov").innerHTML = `<div class="ov-in">
    <div class="row"><button class="back" data-a="close" aria-label="Back">${IC.back}</button><div style="text-align:center"><div class="num" style="font-size:26px;text-transform:uppercase">${w.name}</div><div class="sub">${done.length}/${w.exercises.length} done</div></div><span style="width:44px"></span></div>
    ${w.exercises.map((e, i) => `<button class="ex ${done.includes(i) ? "on" : ""}" data-ex="${i}"><span class="ck">${IC.check}</span><span style="min-width:0"><div class="en">${e.name}</div><div class="cue">${e.cue}</div></span><span class="sr">${e.sets}×${e.reps}</span></button>`).join("")}
    <div class="sub" style="padding:4px 2px">Then cardio: ${w.cardio.type}, ${w.cardio.min} min</div>
    <button class="btn" data-a="finish">Finish workout</button>
  </div>`;
  $("#ov").hidden = false; document.body.style.overflow = "hidden";
}
function closeWorkout() { $("#ov").hidden = true; document.body.style.overflow = ""; render(); }

/* ---------- sheets ---------- */
function sheet(html) { const s = $("#sheet"); s.innerHTML = `<div class="sc">${html}</div>`; s.hidden = false; }
const closeSheet = () => { $("#sheet").hidden = true; };

/* ---------- actions ---------- */
function setDay(k, fn, msg) {
  const prev = day(k), next = { ...prev }; fn(next); saveDay(k, next); render();
  if (msg) toast(msg, () => { saveDay(k, prev); render(); });
}
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) { if (e.target.id === "sheet") closeSheet(); return; }
  const ds = b.dataset, c = cfg();
  if (ds.gym) return setDay(ds.gym, d => { d.workout = !d.workout; }, gymOn(ds.gym) ? "Gym day removed" : "Gym day added");
  if (ds.sm) { const i = +ds.sm; return setDay(TODAY, d => { const cur = d.smoothies || 0, p = proteinOf(TODAY);
      if (i <= cur) { d.smoothies = i - 1; d.protein = Math.max(0, p - c.smoothieP); } else { d.smoothies = cur + 1; d.protein = p + c.smoothieP; } }); }
  if (ds.p) return setDay(TODAY, d => { d.protein = proteinOf(TODAY) + +ds.p; }, `+${ds.p}g protein`);
  if (ds.w) { const n = +ds.w; return setDay(TODAY, d => { d.water = (d.water || 0) >= n ? n - 1 : n; }); }
  if (ds.h) { const id = ds.h; return setDay(TODAY, d => {
      if (id === "crunches") d.crunches = (d.crunches || 0) >= 50 ? 0 : 50;
      else if (id === "legRaises") d.legRaises = (d.legRaises || 0) >= 30 ? 0 : 30;
      else d[id] = !d[id]; }); }
  if (ds.ex) { const i = +ds.ex, d = day(TODAY), x = new Set(d.exDone || []); x.has(i) ? x.delete(i) : x.add(i); d.exDone = [...x]; saveDay(TODAY, d); return openWorkout(); }
  ({
    undo() { if (undoFn) { const f = undoFn; undoFn = null; $("#toast").hidden = true; f(); } },
    start() { openWorkout(); },
    close() { closeWorkout(); },
    finish() {
      const prevD = day(TODAY), prevC = { ...c };
      const d = { ...prevD, workout: true, exDone: [], rotated: true }; saveDay(TODAY, d);
      if (!prevD.rotated) c.next = (c.next + 1) % WORKOUTS.length; saveCfg(c); closeWorkout();
      toast(gymCount(weekStart(TODAY)) >= 5 ? "5/5 this week. Goal hit 🔥" : "Workout done 💪", () => { saveDay(TODAY, prevD); saveCfg(prevC); render(); });
    },
    setup() {
      const bw = parseFloat($("#bw").value);
      if (!bw || bw < 70 || bw > 500) { toast("Enter your weight in lb"); return; }
      saveCfg({ proteinGoal: Math.round(bw), smoothieP: 25, next: 0, setup: true }); render();
    },
    editprotein() {
      sheet(`<div class="title">Protein today</div>
        <label class="field"><span>Eaten today (g)</span><input id="pt" type="number" inputmode="numeric" value="${proteinOf(TODAY)}"></label>
        <button class="btn pro" data-a="savep">Save</button>`);
    },
    savep() { const v = parseFloat($("#pt").value); closeSheet(); if (!isNaN(v)) setDay(TODAY, d => { d.protein = Math.max(0, Math.round(v)); }); },
    settings() {
      sheet(`<div class="title">Settings</div>
        <div class="grid2"><label class="field"><span>Protein goal (g)</span><input id="sg" type="number" inputmode="numeric" value="${c.proteinGoal}"></label>
        <label class="field"><span>Protein per smoothie</span><input id="ss" type="number" inputmode="numeric" value="${c.smoothieP}"></label></div>
        <label class="field"><span>Next workout</span></label>
        <div class="grid3" style="grid-template-columns:repeat(5,1fr)">${WORKOUTS.map((w, i) => `<button class="tbtn ${i === c.next % 5 ? "pon" : ""}" data-a="setnext" data-i="${i}" style="font-size:12px">${w.name}</button>`).join("")}</div>
        <button class="btn" data-a="savesettings">Save</button>
        <div class="grid2"><button class="btn ghost" style="font-size:17px" data-a="export">Back up</button><button class="btn ghost" style="font-size:17px" data-a="import">Restore</button></div>`);
    },
    setnext() { document.querySelectorAll("[data-a=setnext]").forEach(x => x.classList.toggle("pon", x === b)); },
    savesettings() {
      const sel = document.querySelector("[data-a=setnext].pon");
      c.proteinGoal = parseInt($("#sg").value) || c.proteinGoal; c.smoothieP = parseInt($("#ss").value) || c.smoothieP;
      if (sel) c.next = +sel.dataset.i; saveCfg(c); closeSheet(); render(); toast("Saved");
    },
    export() {
      const blob = new Blob([JSON.stringify({ app: "ft", schema: 2, exportedAt: new Date().toISOString(), data: S.all() })], { type: "application/json" });
      const name = `forge-backup-${TODAY}.json`;
      try { const f = new File([blob], name, { type: "application/json" }); if (navigator.canShare && navigator.canShare({ files: [f] })) { navigator.share({ files: [f] }).catch(() => {}); return; } } catch (err) {}
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
    },
    import() { $("#importFile").click(); },
    logworkout() {
      const days = [0, 1, 2, 3, 4, 5, 6].map(i => addD(TODAY, -i)).filter(k => k >= weekStart(TODAY) || k === addD(TODAY, -1));
      sheet(`<div class="title">Log a workout</div>
        <label class="field"><span>Type</span></label>
        <div class="grid2"><button class="tbtn pon" data-a="pick" data-g="type" data-v="gym">Gym / strength</button><button class="tbtn" data-a="pick" data-g="type" data-v="cardio">Cardio</button></div>
        <label class="field"><span>Day</span></label>
        <div class="grid3">${days.slice(0, 6).map((k, i) => `<button class="tbtn ${i === 0 ? "pon" : ""}" data-a="pick" data-g="day" data-v="${k}" style="font-size:13px">${i === 0 ? "Today" : i === 1 ? "Yesterday" : pdate(k).toLocaleDateString(undefined, { weekday: "short" })}</button>`).join("")}</div>
        <label class="field"><span>Minutes (optional)</span><input id="lwMin" type="number" inputmode="numeric" placeholder="60"></label>
        <button class="btn" data-a="savelog">Save workout</button>`);
    },
    pick() { document.querySelectorAll(`[data-g=${b.dataset.g}]`).forEach(x => x.classList.toggle("pon", x === b)); },
    savelog() {
      const type = document.querySelector("[data-g=type].pon").dataset.v, k = document.querySelector("[data-g=day].pon").dataset.v, min = parseFloat($("#lwMin").value) || null;
      const prevD = day(k), prevC = { ...c }, d = { ...prevD };
      if (type === "gym") { d.workout = true; d.manual = { ...(d.manual || {}), gym: min }; if (k === TODAY && !d.rotated) { d.rotated = true; c.next = (c.next + 1) % WORKOUTS.length; saveCfg(c); } }
      else { d.cardio = true; d.manual = { ...(d.manual || {}), cardio: min }; }
      saveDay(k, d); closeSheet(); render();
      toast(`${type === "gym" ? "Gym day" : "Cardio"} logged${k === TODAY ? "" : " for " + pdate(k).toLocaleDateString(undefined, { weekday: "short" })}`, () => { saveDay(k, prevD); saveCfg(prevC); render(); });
    },
    runsync() { location.href = "shortcuts://run-shortcut?name=" + encodeURIComponent(SHORTCUT); },
    paste() { pasteSync(); },
    pastesave() { const o = parseSync($("#pasteBox").value); closeSheet(); if (o) applySync(o); else toast("That doesn't look like Forge Sync data"); }
  })[ds.a]?.();
});
document.addEventListener("change", e => {
  if (e.target.id !== "importFile" || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => { try { const j = JSON.parse(r.result); if (j.app !== "ft") throw 0;
      Object.keys(S.all()).forEach(k => localStorage.removeItem(k)); Object.entries(j.data).forEach(([k, v]) => localStorage.setItem(k, v));
      closeSheet(); render(); toast("Backup restored"); } catch (err) { toast("That file isn't a Forge backup"); } };
  r.readAsText(e.target.files[0]); e.target.value = "";
});

/* ---------- day rollover ---------- */
function checkDay() { const k = dkey(new Date()); if (k !== TODAY) { TODAY = k; if ($("#ov").hidden) render(); } }
document.addEventListener("visibilitychange", () => { if (!document.hidden) checkDay(); });
setInterval(checkDay, 60000);

render();
// Sync via URL too (when the Shortcut opens the app link directly): ?forge=1&gym=45&steps=9000...
(function () { const q = new URLSearchParams(location.search); if (q.has("forge") && cfg().setup) { const o = {}; q.forEach((v, k) => o[k.toLowerCase()] = v); applySync(o); history.replaceState(null, "", location.pathname); } })();
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
