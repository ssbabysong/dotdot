(function () {
"use strict";

/* ---------- constants ---------- */
const STORE = "dotdot-v1";
const COLORS = [["zhu", "朱砂"], ["cha", "抹茶"], ["dian", "靛青"], ["zhi", "栀子"], ["ou", "藕荷"], ["qing", "青瓷"]];
const EMOJIS = ["💧", "🧘", "📖", "✍️", "🏃", "🍎", "🌙", "💰", "🛏️", "🧹", "🎧", "🎨", "🎹", "💊", "🦷", "☀️", "🌿", "📵", "🧠", "🗣️", "🐾", "💤", "🥗", "🚶"];
const SLOTS = [["morning", "早晨", "Morning"], ["day", "白天", "Daytime"], ["evening", "晚上", "Evening"], ["any", "随时", "Anytime"]];
const WK = ["日", "一", "二", "三", "四", "五", "六"];
const EVERY = [0, 1, 2, 3, 4, 5, 6], WORK = [1, 2, 3, 4, 5], WEEKEND = [0, 6];
const PACKS = [
  { title: "晨间 routine", note: "起床后的一小时", items: [
    ["起床喝一杯水", "💧", "qing", "morning", EVERY], ["拉伸 10 分钟", "🧘", "cha", "morning", EVERY], ["写三件今天要做的事", "✍️", "zhi", "morning", WORK]] },
  { title: "晚间 routine", note: "睡前慢慢收尾", items: [
    ["阅读 20 分钟", "📖", "dian", "evening", EVERY], ["记账", "💰", "zhi", "evening", EVERY], ["23:00 前放下手机", "📵", "ou", "evening", EVERY]] },
  { title: "照顾身体", note: "白天顺手做到", items: [
    ["运动 30 分钟", "🏃", "zhu", "day", [1, 3, 5]], ["吃一份水果", "🍎", "cha", "day", EVERY], ["散步 6000 步", "🚶", "qing", "any", EVERY]] }
];

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = n => String(n).padStart(2, "0");
const keyOf = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parseKey = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
const cvar = c => "var(--c-" + (COLORS.some(x => x[0] === c) ? c : "zhu") + ")";
const uid = () => "h" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
const first = s => [...String(s)][0] || "·";

function schedText(days) {
  const s = [...days].sort().join("");
  if (s === "0123456") return "每天";
  if (s === "12345") return "工作日";
  if (s === "06") return "周末";
  return "每周" + [1, 2, 3, 4, 5, 6, 0].filter(d => days.includes(d)).map(d => WK[d]).join("、");
}

/* ---------- state ---------- */
const blank = () => ({ v: 1, habits: [], log: {} });
function normalize(d) {
  const s = blank();
  if (d && Array.isArray(d.habits)) {
    s.habits = d.habits.filter(h => h && h.id && h.name).map(h => ({
      id: String(h.id), name: String(h.name).slice(0, 16), emoji: String(h.emoji || ""),
      color: COLORS.some(c => c[0] === h.color) ? h.color : "zhu",
      slot: SLOTS.some(x => x[0] === h.slot) ? h.slot : "any",
      days: Array.isArray(h.days) && h.days.length ? [...new Set(h.days.map(Number).filter(n => n >= 0 && n <= 6))] : EVERY.slice(),
      created: /^\d{4}-\d\d-\d\d$/.test(h.created) ? h.created : keyOf(today())
    }));
  }
  if (d && d.log && typeof d.log === "object") {
    for (const k in d.log) if (/^\d{4}-\d\d-\d\d$/.test(k) && Array.isArray(d.log[k])) s.log[k] = d.log[k].map(String);
  }
  return s;
}
let state = blank();
try { const raw = localStorage.getItem(STORE); if (raw) state = normalize(JSON.parse(raw)); } catch (e) { /* storage unavailable */ }
let storageOk = true;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(state)); storageOk = true; }
  catch (e) { if (storageOk) toast("没能保存：浏览器禁止了本地存储"); storageOk = false; }
}

/* ui state */
let route = "today", calMonth = null, confirmDel = false, pendingImport = null, justStamped = null;

/* ---------- habit maths ---------- */
const habit = id => state.habits.find(h => h.id === id);
const isDone = (h, k) => (state.log[k] || []).includes(h.id);
const isSched = (h, d) => h.days.includes(d.getDay());

function streak(h) {
  const start = parseKey(h.created);
  let d = today(), n = 0;
  if (!isDone(h, keyOf(d))) d = addDays(d, -1); // today is still open
  for (;;) {
    if (isDone(h, keyOf(d))) n++;
    else if (d < start || isSched(h, d)) break; // rest days don't break a streak
    d = addDays(d, -1);
  }
  return n;
}
function longest(h) {
  const keys = Object.keys(state.log).filter(k => isDone(h, k)).sort();
  if (!keys.length) return 0;
  const t = today();
  let best = 0, run = 0;
  for (let d = parseKey(keys[0]); d <= t; d = addDays(d, 1)) {
    const k = keyOf(d);
    if (isDone(h, k)) { run++; best = Math.max(best, run); }
    else if (isSched(h, d) && d < t) run = 0;
  }
  return best;
}
function rate30(h) {
  const t = today(), start = parseKey(h.created);
  let s = 0, n = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(t, -i);
    if (d < start) break;
    const k = keyOf(d), done = isDone(h, k);
    if (i === 0 && !done) continue; // today still open
    if (isSched(h, d)) { s++; if (done) n++; }
  }
  return s ? Math.round(n / s * 100) : 0;
}
const total = h => Object.keys(state.log).filter(k => isDone(h, k)).length;

/* ---------- mutations ---------- */
function setDone(h, k, on) {
  const arr = (state.log[k] || []).filter(x => x !== h.id);
  if (on) { arr.push(h.id); justStamped = h.id + "|" + k; if (k < h.created) h.created = k; }
  if (arr.length) state.log[k] = arr; else delete state.log[k];
  save(); render();
}
function addHabit(o) {
  if (state.habits.length >= 30) { toast("最多 30 个习惯，先整理一下吧"); return null; }
  const h = { id: uid(), name: o.name, emoji: o.emoji, color: o.color, slot: o.slot, days: o.days.slice(), created: keyOf(today()) };
  state.habits.push(h);
  return h;
}
function deleteHabit(id) {
  state.habits = state.habits.filter(h => h.id !== id);
  for (const k in state.log) { state.log[k] = state.log[k].filter(x => x !== id); if (!state.log[k].length) delete state.log[k]; }
  save();
}

/* ---------- small UI bits ---------- */
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 2600); }

function weekStrip(h) {
  const t = today(); let out = "";
  for (let i = 6; i >= 0; i--) {
    const d = addDays(t, -i), k = keyOf(d);
    const cls = isDone(h, k) ? "on" : (!isSched(h, d) || k < h.created) ? "rest" : "";
    out += `<span class="wd ${cls}" title="${d.getMonth() + 1}/${d.getDate()}"></span>`;
  }
  return `<span class="week" style="--hc:${cvar(h.color)}" aria-hidden="true">${out}</span>`;
}

function heatmap(h, weeks, big) {
  const t = today(), dow = (t.getDay() + 6) % 7, start = addDays(t, -dow - (weeks - 1) * 7), tk = keyOf(t);
  let cells = "", months = "", lastM = -1;
  for (let w = 0; w < weeks; w++) {
    const ws = addDays(start, w * 7);
    let lbl = "";
    for (let i = 0; i < 7; i++) { const x = addDays(ws, i); if (x.getDate() === 1 && x <= t && x.getMonth() !== lastM) { lbl = (x.getMonth() + 1) + "月"; lastM = x.getMonth(); } }
    months += `<span>${lbl}</span>`;
    for (let i = 0; i < 7; i++) {
      const x = addDays(ws, i), k = keyOf(x);
      let cls = "";
      if (x > t) cls = "fut";
      else if (isDone(h, k)) cls = "on";
      else if (k < h.created) cls = "pre";
      else if (!isSched(h, x)) cls = "rest";
      if (k === tk) cls += " today";
      const st = cls.includes("on") ? "完成" : cls.includes("rest") ? "休息日" : cls.includes("pre") ? "还没开始" : "未完成";
      cells += x > t ? `<span class="d fut"></span>` : `<span class="d ${cls}" title="${x.getMonth() + 1}月${x.getDate()}日 · ${st}"></span>`;
    }
  }
  const doneDays = Object.keys(state.log).filter(k => isDone(h, k) && parseKey(k) >= start).length;
  return `<div class="hm${big ? " big" : ""}" style="--hc:${cvar(h.color)}" role="img" aria-label="最近 ${weeks} 周完成了 ${doneDays} 天">
    <div class="hm-days" aria-hidden="true"><span>一</span><span></span><span>三</span><span></span><span>五</span><span></span><span>日</span></div>
    <div class="hm-scroll"><div class="hm-months" aria-hidden="true">${months}</div><div class="grid">${cells}</div></div></div>`;
}

const legend = h => `<div class="legend" style="--hc:${cvar(h.color)}" aria-hidden="true"><span class="d on"></span>完成 <span class="d"></span>没做 <span class="d rest"></span>休息日</div>`;

function statsBlock(h) {
  return `<div class="stats">${[[streak(h), "天", "当前连续"], [longest(h), "天", "最长连续"], [rate30(h), "%", "近 30 天完成率"], [total(h), "次", "累计"]]
    .map(([v, u, k]) => `<div class="stat"><span class="v">${v}<small> ${u}</small></span><span class="k">${k}</span></div>`).join("")}</div>`;
}

function starter() {
  return `<section class="slip t3 starter">
    <div class="slip-head"><h2>从一套小 routine 开始</h2></div>
    <p class="muted">挑一套贴上，或者点下面的 ＋ 写你自己的习惯。之后都可以改。</p>
    <div class="packs">${PACKS.map((p, i) => `<div class="pack"><h3>${p.title} <span class="muted" style="font-weight:400;font-size:13px">· ${p.note}</span></h3>
      <ul>${p.items.map(it => `<li>${it[1]} ${esc(it[0])}<span class="muted"> · ${schedText(it[4])}</span></li>`).join("")}</ul>
      <div><button type="button" class="chip" data-act="pack" data-i="${i}">全部贴上</button></div></div>`).join("")}</div></section>`;
}

/* ---------- views ---------- */
function viewToday() {
  const t = today(), tk = keyOf(t), hr = new Date().getHours();
  const greet = hr < 5 ? "夜深了" : hr < 11 ? "早上好" : hr < 14 ? "中午好" : hr < 18 ? "下午好" : "晚上好";
  const todays = state.habits.filter(h => isSched(h, t));
  const rest = state.habits.filter(h => !isSched(h, t));
  const done = todays.filter(h => isDone(h, tk)).length;

  let html = `<section class="hello"><h1>${greet}</h1>`;
  if (todays.length) {
    html += `<div class="progress"><div class="pdots">${todays.map(h => `<span class="pdot${isDone(h, tk) ? " on" : ""}" style="--hc:${cvar(h.color)}"></span>`).join("")}</div>
      <span class="pcount">${done} / ${todays.length}</span></div>
      <p class="muted" style="margin:0">${done === todays.length ? "今天的点点全点满了，好好休息。" : "今天还有 " + (todays.length - done) + " 个点点等你。"}</p>`;
  } else if (state.habits.length) {
    html += `<p class="muted" style="margin:0">今天没有安排的习惯，放个假吧。</p>`;
  } else {
    html += `<p class="muted" style="margin:0">DotDot 帮你一个一个地养成好习惯：每做到一次，就在它自己的格子里点一个点。</p>`;
  }
  html += `</section>`;

  if (!state.habits.length) return html + starter();

  const tapes = ["", " t2", " t3", ""];
  SLOTS.forEach(([slot, zh, en], i) => {
    const list = todays.filter(h => h.slot === slot);
    if (!list.length) return;
    html += `<section class="slip${tapes[i]}"><div class="slip-head slot-title"><h2>${zh}</h2><span class="hand">${en}</span></div>
      <ul class="rows">${list.map(h => row(h, tk)).join("")}</ul></section>`;
  });
  if (rest.length) {
    html += `<section class="slip t2"><div class="slip-head slot-title"><h2>今天休息</h2><span class="hand">Day off</span></div>
      <ul class="rows">${rest.map(h => row(h, tk, true)).join("")}</ul></section>`;
  }
  return html;
}

function row(h, tk, off) {
  const on = isDone(h, tk), s = streak(h), pop = justStamped === h.id + "|" + tk;
  return `<li class="row${off && !on ? " off" : ""}">
    <button type="button" class="check${on ? " on" : ""}${pop ? " pop" : ""}" style="--hc:${cvar(h.color)}" data-act="toggle" data-id="${h.id}" data-k="${tk}" aria-pressed="${on}" aria-label="${esc(h.name)}：${on ? "今天已完成，点一下取消" : "点一下打卡"}"><span class="em">${esc(h.emoji || first(h.name))}</span></button>
    <a class="meta" href="#h-${h.id}"><span class="name">${esc(h.name)}</span><span class="sub">${s ? `连续 <b>${s}</b> 天` : "今天开始也不晚"} · ${schedText(h.days)}</span></a>
    ${weekStrip(h)}</li>`;
}

function viewHabits() {
  let html = `<section class="hello"><h1>我的习惯</h1><p class="muted" style="margin:0">${state.habits.length ? `一共 ${state.habits.length} 个。每个习惯都有自己的点点图，点卡片看全年、补打卡。` : "还没有习惯。"}</p></section>`;
  if (!state.habits.length) return html + starter() + backupBlock();
  const tapes = ["", " t2", " t3"];
  html += `<div class="cards">${state.habits.map((h, i) => `<section class="slip${tapes[i % 3]}">
      <a class="card-head" href="#h-${h.id}"><span class="em" aria-hidden="true">${esc(h.emoji || first(h.name))}</span>
        <span class="t"><span class="name" style="display:block">${esc(h.name)}</span><span class="sched">${SLOTS.find(s => s[0] === h.slot)[1]} · ${schedText(h.days)}</span></span>
        <span class="arrow" aria-hidden="true">›</span></a>
      ${heatmap(h, 22, false)}
      ${statsBlock(h)}</section>`).join("")}</div>`;
  return html + backupBlock();
}

function backupBlock() {
  const confirmRow = pendingImport ? `<div class="actions"><span>导入会替换现在的全部记录（${pendingImport.habits.length} 个习惯）。</span>
      <button type="button" class="ghost danger sure" data-act="importyes">替换</button><button type="button" class="linkbtn" data-act="importno">算了</button></div>` : "";
  return `<section class="slip t3 backup"><div class="slip-head"><h2>备份</h2></div>
    <p class="muted" style="margin:0">记录只保存在这台设备的浏览器里。换手机或清理浏览器之前，先导出一份备份。</p>
    <div class="actions"><button type="button" class="ghost" data-act="export">导出备份</button>
      <label class="ghost" for="importFile" style="cursor:pointer">导入备份</label><input type="file" id="importFile" accept="application/json,.json"></div>
    ${confirmRow}</section><p class="foot">DotDot · 一个点，一个点。</p>`;
}

function viewDetail(h) {
  const t = today();
  if (!calMonth) calMonth = new Date(t.getFullYear(), t.getMonth(), 1);
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  let cal = ["一", "二", "三", "四", "五", "六", "日"].map(w => `<span class="wk">${w}</span>`).join("");
  for (let i = 0; i < lead; i++) cal += `<span class="cd blank"></span>`;
  for (let d = 1; d <= dim; d++) {
    const x = new Date(y, m, d), k = keyOf(x), on = isDone(h, k), fut = x > t;
    const cls = (on ? " on" : !isSched(h, x) ? " rest" : "") + (k === keyOf(t) ? " today" : "");
    cal += `<button type="button" class="cd${cls}" data-act="cal" data-k="${k}" ${fut ? "disabled" : ""} aria-pressed="${on}" aria-label="${m + 1}月${d}日${on ? "，已完成" : ""}">${d}</button>`;
  }
  const atNow = y === t.getFullYear() && m === t.getMonth();
  const slot = SLOTS.find(s => s[0] === h.slot);

  return `<a class="back" href="#habits">‹ 我的习惯</a>
    <section class="hello"><div class="detail-head"><span class="em" aria-hidden="true">${esc(h.emoji || first(h.name))}</span>
      <div><h1>${esc(h.name)}</h1><p class="muted" style="margin:0">${slot[1]} · ${schedText(h.days)} · 从 ${h.created.replace(/-/g, ".")} 开始</p></div></div></section>
    <section class="slip">
      <div class="slip-head"><h2>这一年</h2><span class="hand muted" style="font-size:18px">${streak(h) ? "连续 " + streak(h) + " 天" : ""}</span></div>
      ${heatmap(h, 53, true)}${legend(h)}${statsBlock(h)}</section>
    <section class="slip t2" style="--hc:${cvar(h.color)}">
      <div class="cal-head"><button type="button" class="cal-nav" data-act="calprev" aria-label="上个月">‹</button>
        <span class="hand">${y}.${pad(m + 1)}</span>
        <button type="button" class="cal-nav" data-act="calnext" aria-label="下个月" ${atNow ? "disabled" : ""}>›</button></div>
      <div class="cal">${cal}</div>
      <p class="muted" style="font-size:12px;margin:12px 0 0">忘了打卡？点日期补上，再点一次取消。</p></section>
    <div class="actions"><button type="button" class="ghost" data-act="edit" data-id="${h.id}">编辑</button>
      <button type="button" class="ghost danger${confirmDel ? " sure" : ""}" data-act="del" data-id="${h.id}">${confirmDel ? "确定删除？所有记录都会清空" : "删除这个习惯"}</button></div>`;
}

/* ---------- router + render ---------- */
function readRoute() {
  const h = location.hash.replace(/^#/, "");
  if (h.startsWith("h-") && habit(h.slice(2))) return h;
  return h === "habits" ? "habits" : "today";
}
let lastRoute = null;
function render() {
  const t = new Date();
  $("barDate").textContent = t.getFullYear() + "." + pad(t.getMonth() + 1) + "." + pad(t.getDate()) + " 周" + WK[t.getDay()];
  route = readRoute();
  const changed = route !== lastRoute;
  if (changed) { confirmDel = false; calMonth = null; }
  let html;
  if (route.startsWith("h-")) html = viewDetail(habit(route.slice(2)));
  else if (route === "habits") html = viewHabits();
  else html = viewToday();
  $("view").innerHTML = html;
  document.querySelectorAll(".tabs a").forEach(a => {
    const on = a.dataset.tab === (route.startsWith("h-") ? "habits" : route);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  });
  document.querySelectorAll(".hm-scroll").forEach(s => { s.scrollLeft = s.scrollWidth; });
  if (changed) { window.scrollTo(0, 0); lastRoute = route; }
  justStamped = null;
}
window.addEventListener("hashchange", render);

/* ---------- sheet (add / edit) ---------- */
const sheet = $("sheet");
let form = null;
function openSheet(h) {
  form = h ? { id: h.id, name: h.name, emoji: h.emoji, color: h.color, slot: h.slot, days: h.days.slice() }
           : { id: null, name: "", emoji: EMOJIS[0], color: COLORS[state.habits.length % COLORS.length][0], slot: "morning", days: EVERY.slice() };
  $("sheetTitle").textContent = h ? "编辑习惯" : "新习惯";
  $("fSubmit").textContent = h ? "保存" : "贴到本子上";
  $("fName").value = form.name;
  drawSheet();
  if (typeof sheet.showModal === "function") sheet.showModal(); else sheet.setAttribute("open", "");
  setTimeout(() => $("fName").focus(), 30);
}
function closeSheet() { if (sheet.open) sheet.close(); }
function drawSheet() {
  $("fEmoji").innerHTML = EMOJIS.map(e => `<button type="button" role="radio" aria-checked="${e === form.emoji}" data-act="femoji" data-v="${e}">${e}</button>`).join("");
  $("fColor").innerHTML = COLORS.map(([c, l]) => `<button type="button" class="sw" role="radio" aria-checked="${c === form.color}" style="background:${cvar(c)}" data-act="fcolor" data-v="${c}" aria-label="${l}" title="${l}"></button>`).join("");
  $("fSlot").innerHTML = SLOTS.map(([s, zh]) => `<button type="button" role="radio" aria-checked="${s === form.slot}" data-act="fslot" data-v="${s}">${zh}</button>`).join("");
  const cur = [...form.days].sort().join("");
  $("fPreset").innerHTML = [["每天", EVERY], ["工作日", WORK], ["周末", WEEKEND]].map(([l, d]) => `<button type="button" aria-pressed="${[...d].sort().join("") === cur}" data-act="fpreset" data-v="${d.join(",")}">${l}</button>`).join("");
  $("fDays").innerHTML = [1, 2, 3, 4, 5, 6, 0].map(d => `<button type="button" aria-pressed="${form.days.includes(d)}" data-act="fday" data-v="${d}" aria-label="周${WK[d]}">${WK[d]}</button>`).join("");
}
$("habitForm").addEventListener("submit", e => {
  e.preventDefault();
  const name = $("fName").value.trim().slice(0, 16);
  if (!name) { $("fName").focus(); toast("先给习惯起个名字"); return; }
  if (!form.days.length) { toast("至少选一天"); return; }
  if (state.habits.some(h => h.name === name && h.id !== form.id)) { toast("「" + name + "」已经在本子上了"); return; }
  form.name = name;
  if (form.id) { Object.assign(habit(form.id), { name, emoji: form.emoji, color: form.color, slot: form.slot, days: form.days.slice() }); toast("已保存"); }
  else { if (!addHabit(form)) return; toast("「" + name + "」贴好了"); }
  save(); closeSheet(); render();
});
sheet.addEventListener("click", e => { if (e.target === sheet) closeSheet(); });

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  const a = el.dataset.act, v = el.dataset.v;
  switch (a) {
    case "toggle": case "cal": {
      const h = habit(el.dataset.id || route.slice(2)); if (!h) return;
      const k = el.dataset.k; setDone(h, k, !isDone(h, k)); break;
    }
    case "new": openSheet(null); break;
    case "edit": openSheet(habit(el.dataset.id)); break;
    case "close": closeSheet(); break;
    case "femoji": form.emoji = v; drawSheet(); break;
    case "fcolor": form.color = v; drawSheet(); break;
    case "fslot": form.slot = v; drawSheet(); break;
    case "fpreset": form.days = v.split(",").map(Number); drawSheet(); break;
    case "fday": { const d = Number(v); form.days = form.days.includes(d) ? form.days.filter(x => x !== d) : form.days.concat(d); drawSheet(); break; }
    case "pack": {
      const p = PACKS[Number(el.dataset.i)]; let n = 0;
      p.items.forEach(([name, emoji, color, slot, days]) => { if (!state.habits.some(h => h.name === name) && addHabit({ name, emoji, color, slot, days })) n++; });
      save(); toast(n ? `贴上了 ${n} 个习惯` : "这套已经都在了"); render(); break;
    }
    case "calprev": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); render(); break;
    case "calnext": calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); render(); break;
    case "del":
      if (!confirmDel) { confirmDel = true; render(); break; }
      { const h = habit(el.dataset.id); deleteHabit(el.dataset.id); toast("已删除「" + (h ? h.name : "") + "」"); location.hash = "#habits"; render(); break; }
    case "export": exportData(); break;
    case "importyes": state = pendingImport; pendingImport = null; save(); toast("已导入 " + state.habits.length + " 个习惯"); render(); break;
    case "importno": pendingImport = null; render(); break;
  }
});
document.addEventListener("change", e => {
  if (e.target.id !== "importFile" || !e.target.files[0]) return;
  const r = new FileReader();
  r.onload = () => {
    try { const d = normalize(JSON.parse(r.result)); if (!d.habits.length) throw 0; pendingImport = d; render(); }
    catch (err) { toast("这个文件不是 DotDot 的备份"); }
  };
  r.readAsText(e.target.files[0]);
});
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "dotdot-backup-" + keyOf(today()) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("备份已导出");
}

/* sync across tabs, and roll over at midnight */
window.addEventListener("storage", e => { if (e.key === STORE && e.newValue) { try { state = normalize(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore */ } } });
let day = keyOf(today());
setInterval(() => { const k = keyOf(today()); if (k !== day) { day = k; render(); } }, 60000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && keyOf(today()) !== day) { day = keyOf(today()); render(); } });

if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

render();
})();
