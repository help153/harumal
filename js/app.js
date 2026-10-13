import { BASE, SCEN, LEVELS, LANG } from "./content.js";
import * as store from "./store.js";
import * as ai from "./ai.js";
import * as sp from "./speech.js";

/* ───────── 상태 ───────── */
// S: 기기에 저장되는 학습 상태, K: API 키와 음성 설정, R: 화면에만 있는 임시 상태
const S = store.loadState();
const P = S.prefs;
const K = store.loadKeys();
sp.configure({ ...K, slow: P.slow });
const R = {
  sess: { ja: {}, en: {} },
  chat: { ja: null, en: null },
  pick: { ja: { sc: "cafe", lv: 0 }, en: { sc: "cafe", lv: 1 } },
  open: {}, topic: {}, gen: {}, shadow: {}, mic: null, msg: {}, pendingImport: null, installEvt: null,
};
const IV = [0, 1, 3, 7, 14, 30, 60]; // 익힘 단계별 다음 복습까지 일 수
const DAY = 864e5;

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.saveState(S), 400);
}
function flushSave() {
  clearTimeout(saveTimer);
  store.saveState(S);
}
addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

/* ───────── 도우미 ───────── */
const $ = (s) => document.querySelector(s);
function el(tag, props, ...kids) {
  const n = document.createElement(tag);
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (k === "value") n.value = v;
      else n.setAttribute(k, v === true ? "" : v);
    }
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    n.append(k instanceof Node ? k : String(k));
  }
  return n;
}
function svg(path) {
  const s = el("span", { class: "ico", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  return s;
}
const ICON = {
  speaker: '<path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
  vocab: '<path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h4"/>',
  expr: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/>',
  sent: '<rect x="3" y="7" width="6" height="5" rx="1"/><rect x="11" y="7" width="10" height="5" rx="1"/><rect x="6" y="14" width="9" height="5" rx="1"/>',
  chat: '<path d="M7 10h.01M12 10h.01M17 10h.01"/><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.4A8 8 0 1 1 21 12z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isJa = () => P.lang === "ja";
const langKo = () => LANG[P.lang].ko;

function spk(text) {
  if (!text || !sp.canSpeak()) return null;
  return el("button", { class: "icon-btn", type: "button", "aria-label": "발음 듣기", title: "발음 듣기", onclick: (e) => { e.stopPropagation(); sp.speak(text, P.lang); } }, svg(ICON.speaker));
}
function dots(b) {
  return el("span", { class: "dots", title: `익힘 단계 ${b}/6`, "aria-label": `익힘 단계 ${b}/6` }, [1, 2, 3, 4, 5, 6].map((i) => el("i", { class: i <= b ? "on" : null })));
}

/* ───────── 항목과 간격 반복 ───────── */
function prepSent(lang, s) {
  if (lang === "en") {
    const m = s.s.trim().match(/^(.*?)([.?!])?$/);
    return { ...s, tk: m[1].split(/\s+/), end: m[2] || ".", full: s.s.trim() };
  }
  return { ...s, full: s.tk.join("") + (s.end || "。") };
}
function pool(kind, lang = P.lang) {
  const mine = (S.custom[lang][kind] || []).map((x) => ({ ...x, mine: true }));
  let all = [...mine, ...BASE[lang][kind]];
  if (kind === "sent") all = all.map((s) => prepSent(lang, s));
  return all;
}
const pkey = (kind, id) => kind[0] + ":" + id;
const prog = (kind, id, lang = P.lang) => S.prog[lang][pkey(kind, id)];
function counts(kind) {
  const now = Date.now(); let due = 0, fresh = 0, learned = 0;
  const items = pool(kind);
  for (const it of items) {
    const p = prog(kind, it.id);
    if (!p) fresh++;
    else { if (p.due <= now) due++; if (p.b >= 4) learned++; }
  }
  return { due, fresh, learned, total: items.length };
}
function buildQueue(kind, size = 10) {
  const now = Date.now(), items = pool(kind), Pg = (it) => prog(kind, it.id);
  const due = items.filter((it) => Pg(it) && Pg(it).due <= now).sort((a, b) => Pg(a).due - Pg(b).due);
  const freshAll = items.filter((it) => !Pg(it));
  const fresh = [...shuffle(freshAll.filter((i) => i.mine)), ...shuffle(freshAll.filter((i) => !i.mine))];
  let q = [...due.slice(0, size), ...fresh].slice(0, size);
  if (q.length < size) {
    const rest = items.filter((it) => !q.includes(it) && Pg(it)).sort((a, b) => Pg(a).due - Pg(b).due);
    q = q.concat(rest.slice(0, size - q.length));
  }
  return shuffle(q);
}
function grade(kind, id, ok) {
  const k = pkey(kind, id), PR = S.prog[P.lang];
  const p = { ...(PR[k] || { b: 0, due: 0, n: 0, ok: 0 }) };
  p.n++;
  if (ok) { p.ok++; p.b = Math.min(p.b + 1, IV.length - 1); p.due = Date.now() + IV[p.b] * DAY - 3600e3; }
  else { p.b = 0; p.due = Date.now() + 5 * 60e3; }
  PR[k] = p;
  bumpToday();
}
function bumpToday() {
  const k = dkey(new Date());
  S.stats.days[k] = (S.stats.days[k] || 0) + 1;
  persist();
  renderStats();
}
function streak() {
  const d = new Date(); let n = 0;
  if (!S.stats.days[dkey(d)]) d.setDate(d.getDate() - 1);
  while (S.stats.days[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

/* ───────── 화면 골격 ───────── */
const TABS = [
  { id: "vocab", label: "단어", icon: ICON.vocab },
  { id: "expr", label: "표현", icon: ICON.expr },
  { id: "sent", label: "조립", icon: ICON.sent },
  { id: "chat", label: "회화", icon: ICON.chat },
  { id: "settings", label: "설정", icon: ICON.gear },
];
function renderStats() {
  const today = S.stats.days[dkey(new Date())] || 0;
  const due = counts("vocab").due + counts("expr").due + counts("sent").due;
  $("#statline").replaceChildren(
    el("span", null, "오늘 ", el("b", null, today), "회"),
    el("span", null, el("b", null, streak()), "일 연속"),
    el("span", null, langKo(), " 복습 ", el("b", null, due), "개")
  );
}
function renderChrome() {
  document.body.dataset.lang = P.lang;
  $("#mark").textContent = LANG[P.lang].mark;
  $("#lang-ja").setAttribute("aria-pressed", String(P.lang === "ja"));
  $("#lang-en").setAttribute("aria-pressed", String(P.lang === "en"));
  $("#nav").replaceChildren(
    ...TABS.map((t) =>
      el("button", { type: "button", "aria-current": P.tab === t.id ? "page" : null, onclick: () => { if (P.tab !== t.id) { P.tab = t.id; persist(); render(); scrollTo(0, 0); } } }, svg(t.icon), el("span", null, t.label))
    )
  );
  renderStats();
}
function renderPanel() {
  const r = { vocab: renderVocab, expr: renderExpr, sent: renderSent, chat: renderChat, settings: renderSettings }[P.tab] || renderVocab;
  $("#panel").replaceChildren(r());
  if (P.tab === "chat") { const m = $(".msgs"); if (m) m.scrollTop = m.scrollHeight; }
}
function render() { renderChrome(); renderPanel(); }

/* ───────── 공통: 세트, AI 생성, 목록, 따라 말하기 ───────── */
function sess(kind) {
  const L = R.sess[P.lang];
  if (!L[kind]) L[kind] = { queue: buildQueue(kind), i: 0, right: 0, st: null };
  return L[kind];
}
function newSet(kind) { R.sess[P.lang][kind] = null; renderPanel(); scrollTo(0, 0); }
function setHeader(kind, s) {
  const c = counts(kind);
  return [
    el("div", { class: "row between" },
      el("div", { class: "counts" },
        el("span", null, "복습 ", el("b", null, c.due)),
        el("span", null, "새 항목 ", el("b", null, c.fresh)),
        el("span", null, "익힘 ", el("b", null, c.learned), "/", c.total)),
      el("span", { class: "small muted" }, `${Math.min(s.i + 1, s.queue.length)} / ${s.queue.length}`)),
    el("div", { class: "progress" }, el("span", { style: `width:${s.queue.length ? (s.i / s.queue.length) * 100 : 0}%` })),
  ];
}
function doneCard(kind, s) {
  return el("div", { class: "card" },
    el("div", { class: "prompt" },
      el("span", { class: "tag" }, "세트 완료"),
      el("div", { class: "mid" }, `${s.queue.length}개 중 ${s.right}개를 맞혔어요.`),
      el("p", { class: "muted", style: "margin:0" }, "틀린 항목은 5분 뒤, 맞힌 항목은 익힘 단계에 따라 1일·3일·7일 뒤에 다시 나와요.")),
    el("div", { class: "row" }, el("button", { class: "btn", onclick: () => newSet(kind) }, "다음 세트")));
}
function needKeyCard(what) {
  return el("div", { class: "card" },
    el("div", { class: "mid" }, `${what}에는 Claude API 키가 필요해요`),
    el("p", { class: "muted", style: "margin:0" }, "설정에서 키를 한 번 넣으면 이 기기에만 저장돼요. 키 발급 방법도 설정 화면에 있어요."),
    el("div", { class: "row" }, el("button", { class: "btn", onclick: () => { P.tab = "settings"; persist(); render(); } }, "설정으로 가기")));
}

const GEN_LABEL = { vocab: "단어", expr: "표현", sent: "문장" };
function genBox(kind) {
  if (!K.anthropicKey) return null;
  const key = P.lang + kind, st = R.gen[key] || {};
  const go = () => generate(kind, (R.topic[key] || "").trim());
  return el("details", { class: "box", open: R.open["gen" + kind] || st.busy || st.msg ? true : null, ontoggle: (e) => { R.open["gen" + kind] = e.target.open; } },
    el("summary", null, `AI로 ${GEN_LABEL[kind]} 더 만들기`),
    el("div", { class: "boxbody" },
      el("p", { class: "small muted", style: "margin:0" }, `관심 있는 주제를 적으면 그에 맞는 ${langKo()} ${GEN_LABEL[kind]}을 만들어 학습 목록에 추가해요.`),
      el("div", { class: "row" },
        el("input", { type: "text", id: "gen-" + kind, placeholder: "주제 (예: 병원, 회식, 여행, 쇼핑)", value: R.topic[key] || "", oninput: (e) => { R.topic[key] = e.target.value; },
          onkeydown: (e) => { if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) go(); } }),
        el("button", { class: "btn sm", disabled: st.busy || null, onclick: go }, st.busy ? "만드는 중…" : "만들기")),
      st.msg ? el("div", { class: "status" + (st.err ? " err" : "") }, st.msg) : null));
}
async function generate(kind, topic) {
  const lang = P.lang, key = lang + kind;
  if (R.gen[key]?.busy) return;
  R.gen[key] = { busy: true, msg: "Claude가 만드는 중이에요… (10~40초)" };
  renderPanel();
  const known = pool(kind, lang).map((it) => it.w || it.t || it.full).slice(0, 150);
  const { prompt, schema } = ai.generationRequest(kind, lang, topic, known);
  try {
    const out = await ai.askJSON({ apiKey: K.anthropicKey, model: K.model, system: "You write accurate, natural language-learning material for Korean native speakers.", messages: [{ role: "user", content: prompt }], schema, effort: "medium", maxTokens: 16000 });
    const s = (v) => (typeof v === "string" ? v.trim() : "");
    const arr = Array.isArray(out?.items) ? out.items : [];
    const stamp = Date.now().toString(36);
    const items = arr.map((o, i) => {
      const id = "c" + stamp + i;
      if (kind === "vocab") { const it = { id, w: s(o.w), m: s(o.m), ex: s(o.ex), exk: s(o.exk) }; if (lang === "ja") { it.r = s(o.r); it.exr = s(o.exr); } return it.w && it.m ? it : null; }
      if (kind === "expr") { const it = { id, t: s(o.t), ko: s(o.ko), sit: s(o.sit) || "AI", note: s(o.note) }; if (lang === "ja") it.r = s(o.r); return it.t && it.ko ? it : null; }
      const x = Array.isArray(o.x) ? o.x.map(s).filter(Boolean).slice(0, 3) : [];
      if (lang === "ja") { const tk = Array.isArray(o.tk) ? o.tk.map(s).filter(Boolean) : []; return s(o.ko) && tk.length >= 2 ? { id, ko: s(o.ko), tk, x, end: s(o.end) || "。", r: s(o.r) } : null; }
      return s(o.ko) && s(o.s) ? { id, ko: s(o.ko), s: s(o.s), x } : null;
    }).filter(Boolean);
    const have = new Set(pool(kind, lang).map((it) => it.w || it.t || it.full));
    const fresh = items.filter((it) => !have.has(it.w || it.t || it.s));
    S.custom[lang][kind] = [...fresh, ...S.custom[lang][kind]];
    persist();
    R.sess[lang][kind] = null;
    R.gen[key] = { msg: fresh.length ? `새 ${GEN_LABEL[kind]} ${fresh.length}개를 추가했어요. 지금 세트에 먼저 나와요.` : "겹치지 않는 항목이 없었어요. 다른 주제로 해 보세요." };
  } catch (e) {
    R.gen[key] = { msg: e.message, err: true };
  }
  if (P.lang === lang) renderPanel();
}
function listBox(kind) {
  const items = pool(kind);
  return el("details", { class: "box", open: R.open["list" + kind] || null, ontoggle: (e) => { R.open["list" + kind] = e.target.open; } },
    el("summary", null, `전체 ${GEN_LABEL[kind]} 보기 (${items.length})`),
    el("div", { class: "boxbody" }, el("ul", { class: "items" }, items.map((it) => {
      const p = prog(kind, it.id);
      return el("li", null,
        el("div", { class: "w tl" }, it.w || it.t || it.full, isJa() && it.r ? el("span", { class: "rd" }, " ", it.r) : null),
        el("div", { class: "m" }, it.m || it.ko),
        el("div", { class: "side" }, dots(p ? p.b : 0),
          it.mine ? el("span", { class: "row" }, el("span", { class: "mine" }, "내 항목"), el("button", { class: "link", onclick: () => removeCustom(kind, it.id) }, "삭제")) : null));
    }))));
}
function removeCustom(kind, id) {
  S.custom[P.lang][kind] = S.custom[P.lang][kind].filter((x) => x.id !== id);
  persist();
  renderPanel();
}

// 따라 말하기: 문장을 읽으면 발음 점수(Azure) 또는 대략적인 일치율(브라우저)을 보여준다
function shadowBox(key, text) {
  if (!text || !sp.canListen()) return null;
  const st = R.shadow[key] || {};
  return el("div", { class: "shadow" },
    el("button", { class: "mic-btn" + (st.busy ? " on" : ""), type: "button", onclick: () => (st.busy ? R.mic?.abort() : startShadow(key, text)) },
      svg(st.busy ? ICON.stop : ICON.mic), st.busy ? "듣는 중… 누르면 멈춰요" : st.res ? "다시 말하기" : "따라 말하기"),
    st.busy ? el("div", { class: "small muted", id: "partial-" + key }, st.partial || "") : null,
    st.err ? el("div", { class: "status err" }, st.err) : null,
    st.res ? scoreView(st.res, text) : null);
}
async function startShadow(key, text) {
  R.mic?.abort();
  const ctl = new AbortController();
  R.mic = ctl;
  R.shadow[key] = { busy: true };
  renderPanel();
  try {
    const res = await sp.listen(P.lang, {
      reference: text,
      signal: ctl.signal,
      onPartial: (t) => { if (R.shadow[key]) R.shadow[key].partial = t; const n = document.getElementById("partial-" + key); if (n) n.textContent = t; },
    });
    R.shadow[key] = { res };
    bumpToday();
  } catch (e) {
    R.shadow[key] = e.code === "cancelled" ? {} : { err: e.message };
  } finally {
    if (R.mic === ctl) R.mic = null;
    renderPanel();
  }
}
const band = (n) => (n >= 80 ? "good" : n >= 60 ? "mid" : "bad");
function scoreView(res, target) {
  if (res.score) {
    const sc = res.score;
    return el("div", { class: "score" },
      el("div", { class: "score-top" },
        el("div", { class: "score-main " + band(sc.pron) }, el("b", null, sc.pron), el("span", null, "발음 점수")),
        el("dl", { class: "score-sub" },
          el("div", null, el("dt", null, "정확도"), el("dd", null, sc.accuracy)),
          el("div", null, el("dt", null, "유창성"), el("dd", null, sc.fluency)),
          el("div", null, el("dt", null, "완성도"), el("dd", null, sc.completeness)))),
      sc.words.length ? el("div", { class: "words tl" }, sc.words.map((w) =>
        el("span", { class: "w " + (w.err === "Omission" ? "miss" : band(w.s)), title: w.err === "Omission" ? "빠뜨림" : `${w.s}점` }, w.w))) : null,
      el("div", { class: "small muted" }, "들린 문장: ", el("span", { class: "tl" }, res.text || "—")));
  }
  const m = sp.roughMatch(res.text, target, P.lang);
  return el("div", { class: "score" },
    el("div", { class: "score-top" },
      el("div", { class: "score-main " + band(m) }, el("b", null, m), el("span", null, "일치율 (대략)"))),
    el("div", { class: "small muted" }, "들린 문장: ", el("span", { class: "tl" }, res.text)),
    el("div", { class: "small muted" }, "설정에서 Azure 키를 넣으면 단어별 발음 점수를 받을 수 있어요."));
}

/* ───────── 단어 ───────── */
function renderVocab() {
  const s = sess("vocab");
  const wrap = el("div", { class: "stack" });
  if (s.i >= s.queue.length) { wrap.append(doneCard("vocab", s), genBox("vocab") || "", listBox("vocab")); return wrap; }
  const it = s.queue[s.i];
  if (!s.st || s.st.id !== it.id) {
    const others = shuffle(pool("vocab").filter((x) => x.id !== it.id && x.m !== it.m)).slice(0, 3);
    s.st = { id: it.id, dir: Math.random() < 0.6 ? 0 : 1, choices: shuffle([it, ...others]), chosen: null };
  }
  const st = s.st, ja = isJa(), p = prog("vocab", it.id);
  const showR = ja && (P.showReading || st.chosen);
  const promptEl = st.dir === 0
    ? el("div", { class: "prompt" },
        el("div", { class: "row" }, el("span", { class: "tag" }, "뜻 고르기"), dots(p ? p.b : 0), p ? null : el("span", { class: "small muted" }, "처음 보는 단어")),
        el("div", { class: "row", style: "gap:12px" }, el("div", { class: "big tl" }, it.w), spk(it.w)),
        showR && it.r ? el("div", { class: "rd" }, it.r) : null)
    : el("div", { class: "prompt" },
        el("div", { class: "row" }, el("span", { class: "tag" }, `${langKo()}로 고르기`), dots(p ? p.b : 0)),
        el("div", { class: "big" }, it.m));
  const choiceBtns = st.choices.map((c, i) => {
    let cls = "choice";
    if (st.chosen) { if (c.id === it.id) cls += " right"; else if (c.id === st.chosen) cls += " wrong"; }
    return el("button", { class: cls, disabled: st.chosen ? true : null, onclick: () => answerVocab(c.id) },
      el("span", { class: "k" }, i + 1),
      st.dir === 0 ? el("span", null, c.m) : el("span", { class: "tl", style: "font-size:18px" }, c.w),
      st.dir === 1 && ja && (P.showReading || st.chosen) && c.r ? el("span", { class: "rd" }, c.r) : null);
  });
  let result = null;
  if (st.chosen) {
    const ok = st.chosen === it.id;
    result = el("div", { class: "result " + (ok ? "ok" : "no") },
      el("div", { class: "head" }, ok ? "정답이에요" : "아쉬워요"),
      el("div", null, el("span", { class: "tl", style: "font-size:18px" }, it.w), ja && it.r ? el("span", { class: "rd" }, "  ", it.r) : null, " — ", it.m),
      it.ex ? el("div", { class: "example" }, spk(it.ex), el("div", null,
        el("div", { class: "tl", style: "font-size:17px" }, it.ex),
        ja && it.exr ? el("div", { class: "rd" }, it.exr) : null,
        el("div", { class: "small muted" }, it.exk))) : null,
      it.ex ? shadowBox("v" + it.id, it.ex) : null);
  }
  wrap.append(
    el("div", { class: "card" }, setHeader("vocab", s), promptEl, el("div", { class: "choices" }, choiceBtns), result,
      el("div", { class: "row between" },
        ja ? el("label", { class: "small muted row", style: "gap:6px" }, el("input", { type: "checkbox", id: "opt-reading", checked: P.showReading || null, onchange: (e) => { P.showReading = e.target.checked; persist(); renderPanel(); } }), "읽는 법 미리 보기") : el("span"),
        st.chosen ? el("button", { class: "btn", id: "next-btn", onclick: nextVocab }, "다음") : null)),
    genBox("vocab") || "", listBox("vocab"));
  return wrap;
}
function answerVocab(id) {
  const s = R.sess[P.lang].vocab, it = s.queue[s.i];
  if (s.st.chosen) return;
  s.st.chosen = id;
  const ok = id === it.id;
  if (ok) s.right++;
  grade("vocab", it.id, ok);
  renderPanel();
  $("#next-btn")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
}
function nextVocab() { const s = R.sess[P.lang].vocab; s.i++; s.st = null; R.mic?.abort(); renderPanel(); }

/* ───────── 일상 표현 ───────── */
function renderExpr() {
  const s = sess("expr");
  const wrap = el("div", { class: "stack" });
  if (s.i >= s.queue.length) { wrap.append(doneCard("expr", s), genBox("expr") || "", listBox("expr")); return wrap; }
  const it = s.queue[s.i], p = prog("expr", it.id);
  if (!s.st || s.st.id !== it.id) s.st = { id: it.id, open: false };
  const front = el("div", { class: "flash" },
    el("div", { class: "row" }, el("span", { class: "tag" }, it.sit || "표현"), dots(p ? p.b : 0), it.mine ? el("span", { class: "mine" }, "내 항목") : null),
    el("div", { class: "mid" }, it.ko),
    el("div", { class: "small muted" }, `${langKo()}로 어떻게 말할까요? 먼저 소리 내어 말해 보고 확인하세요.`));
  const back = !s.st.open
    ? el("div", { class: "row" }, el("button", { class: "btn", onclick: () => { s.st.open = true; renderPanel(); } }, "정답 보기"))
    : el("div", { class: "flash" },
        el("div", { class: "row", style: "gap:12px" }, el("div", { class: "big tl", style: "font-size:clamp(24px,6.5vw,32px)" }, it.t), spk(it.t)),
        isJa() && it.r ? el("div", { class: "rd" }, it.r) : null,
        it.note ? el("div", { class: "note" }, el("b", null, "팁 "), it.note) : null,
        shadowBox("e" + it.id, it.t),
        el("div", { class: "row" },
          el("button", { class: "btn ghost", onclick: () => rateExpr(false) }, "아직 헷갈려요"),
          el("button", { class: "btn", onclick: () => rateExpr(true) }, "알고 있었어요")));
  wrap.append(el("div", { class: "card" }, setHeader("expr", s), front, back), genBox("expr") || "", listBox("expr"));
  return wrap;
}
function rateExpr(ok) {
  const s = R.sess[P.lang].expr, it = s.queue[s.i];
  if (ok) s.right++;
  grade("expr", it.id, ok);
  s.i++; s.st = null; R.mic?.abort();
  renderPanel();
}

/* ───────── 문장 조립 ───────── */
function renderSent() {
  const s = sess("sent");
  const wrap = el("div", { class: "stack" });
  if (s.i >= s.queue.length) { wrap.append(doneCard("sent", s), genBox("sent") || ""); return wrap; }
  const it = s.queue[s.i], p = prog("sent", it.id);
  if (!s.st || s.st.id !== it.id) s.st = { id: it.id, bank: shuffle([...it.tk, ...(it.x || [])].map((t, k) => ({ t, k }))), picked: [], checked: null };
  const st = s.st, tok = (k) => st.bank.find((b) => b.k === k);
  const answer = el("div", { class: "answer", "aria-label": "내가 만든 문장" },
    st.picked.length
      ? st.picked.map((k) => el("button", { class: "chip tl", disabled: st.checked !== null || null, onclick: () => { st.picked = st.picked.filter((x) => x !== k); renderPanel(); } }, tok(k).t))
      : el("span", { class: "small muted", style: "align-self:center" }, "아래 조각을 눌러 문장을 만드세요"));
  const bank = el("div", { class: "bank" }, st.bank.map((b) => el("button", { class: "chip tl" + (st.picked.includes(b.k) ? " used" : ""), disabled: st.checked !== null || st.picked.includes(b.k) || null, onclick: () => { st.picked.push(b.k); renderPanel(); } }, b.t)));
  const result = st.checked === null ? null : el("div", { class: "result " + (st.checked ? "ok" : "no") },
    el("div", { class: "head" }, st.checked ? "정답이에요" : "정답은 이거예요"),
    el("div", { class: "example" }, spk(it.full), el("div", null,
      el("div", { class: "tl", style: "font-size:19px" }, it.full),
      isJa() && it.r ? el("div", { class: "rd" }, it.r) : null)),
    shadowBox("s" + it.id, it.full));
  wrap.append(el("div", { class: "card" }, setHeader("sent", s),
    el("div", { class: "prompt" }, el("div", { class: "row" }, el("span", { class: "tag" }, "이 문장을 만들어 보세요"), dots(p ? p.b : 0), it.mine ? el("span", { class: "mine" }, "내 항목") : null),
      el("div", { class: "mid" }, it.ko)),
    answer, bank, result,
    el("div", { class: "row between" },
      st.checked === null ? el("button", { class: "btn ghost sm", disabled: !st.picked.length || null, onclick: () => { st.picked = []; renderPanel(); } }, "다시 놓기") : el("span"),
      st.checked === null
        ? el("button", { class: "btn", disabled: !st.picked.length || null, onclick: checkSent }, "확인")
        : el("button", { class: "btn", onclick: () => { s.i++; s.st = null; R.mic?.abort(); renderPanel(); } }, "다음"))),
    genBox("sent") || "");
  return wrap;
}
function checkSent() {
  const s = R.sess[P.lang].sent, it = s.queue[s.i], st = s.st;
  const mine = st.picked.map((k) => st.bank.find((b) => b.k === k).t);
  const norm = (a) => (P.lang === "en" ? a.join(" ").toLowerCase().replace(/[.,?!]/g, "").replace(/\s+/g, " ").trim() : a.join("").replace(/[、。？]/g, ""));
  st.checked = norm(mine) === norm(it.tk);
  if (st.checked) s.right++;
  grade("sent", it.id, st.checked);
  renderPanel();
  if (st.checked) sp.speak(it.full, P.lang);
}

/* ───────── AI 회화 ───────── */
const chatState = () => R.chat[P.lang];
function startChat() {
  const lang = P.lang, pk = R.pick[lang], sc = SCEN[lang].find((x) => x.id === pk.sc);
  R.chat[lang] = { sc, lv: pk.lv, turns: [{ role: "user", content: "(대화를 시작해 주세요. 아직 학습자가 말하지 않았으니 feedback은 모두 빈 문자열로 두세요.)" }], msgs: [], hints: [], busy: false, ctl: null, draft: "", err: "", micErr: "", listening: false };
  renderPanel();
  chatCall();
}
function apiTurns(turns) {
  const t = turns.slice(-24);
  while (t.length && t[0].role !== "user") t.shift();
  return t;
}
async function chatCall() {
  const lang = P.lang, c = R.chat[lang];
  if (!c || c.busy) return;
  c.busy = true; c.err = "";
  renderPanel();
  const ctl = new AbortController();
  c.ctl = ctl;
  try {
    const res = await ai.askJSON({
      apiKey: K.anthropicKey, model: K.model,
      system: ai.chatSystem({ langName: LANG[lang].en, isJa: lang === "ja", scenario: c.sc.p, level: LEVELS[c.lv].p }),
      messages: apiTurns(c.turns), schema: ai.CHAT_SCHEMA, effort: "low", maxTokens: 8000, signal: ctl.signal,
    });
    const s = (v) => (typeof v === "string" ? v.trim() : "");
    if (!s(res.reply)) throw new ai.AIError("invalid_json", "AI 답변이 비어 있어요. 다시 시도해 주세요.");
    c.turns.push({ role: "assistant", content: JSON.stringify(res) });
    const f = res.feedback || {};
    const fb = s(f.fixed) ? { fixed: s(f.fixed), reading: s(f.reading), ko: s(f.ko), why: s(f.why) } : null;
    const lastMe = [...c.msgs].reverse().find((m) => m.who === "me");
    if (lastMe && !lastMe.answered) { lastMe.fb = fb; lastMe.answered = true; }
    c.msgs.push({ who: "ai", text: s(res.reply), reading: s(res.reading), ko: s(res.ko), showKo: false });
    c.hints = Array.isArray(res.hints) ? res.hints.map(s).filter(Boolean).slice(0, 3) : [];
    if (P.autoSpeak && P.lang === lang) sp.speak(s(res.reply), lang);
  } catch (e) {
    if (e.code !== "cancelled") c.err = e.message;
  } finally {
    c.busy = false; c.ctl = null;
    if (P.lang === lang && P.tab === "chat") renderPanel();
  }
}
function sendChat() {
  const c = chatState();
  if (!c || c.busy) return;
  const text = (c.draft || "").trim();
  if (!text) return;
  c.turns.push({ role: "user", content: text });
  c.msgs.push({ who: "me", text });
  c.draft = ""; c.hints = []; c.micErr = "";
  bumpToday();
  chatCall();
}
async function chatMic() {
  const c = chatState();
  if (!c) return;
  if (c.listening) { R.mic?.abort(); return; }
  R.mic?.abort();
  const ctl = new AbortController();
  R.mic = ctl;
  c.listening = true; c.micErr = "";
  renderPanel();
  let send = false;
  try {
    const r = await sp.listen(P.lang, { signal: ctl.signal, onPartial: (t) => { c.draft = t; const ta = $("#chat-input"); if (ta) ta.value = t; } });
    c.draft = r.text;
    send = P.autoSend;
  } catch (e) {
    if (e.code !== "cancelled") c.micErr = e.message;
  } finally {
    c.listening = false;
    if (R.mic === ctl) R.mic = null;
  }
  if (send) sendChat();
  else renderPanel();
}
const savedExpr = (t) => S.custom[P.lang].expr.some((x) => x.t === t);
function saveExpr(it) {
  if (savedExpr(it.t)) return;
  S.custom[P.lang].expr.unshift({ id: "c" + Date.now().toString(36), t: it.t, r: it.r || "", ko: it.ko || "", sit: "회화에서", note: it.note || "" });
  persist();
  R.sess[P.lang].expr = null;
  renderPanel();
}
function saveBtn(it) {
  const done = savedExpr(it.t);
  return el("button", { class: "link" + (done ? " done" : ""), disabled: done || null, onclick: () => saveExpr(it) }, done ? "표현에 저장됨" : "표현에 저장");
}
function renderChat() {
  const lang = P.lang, c = chatState(), wrap = el("div", { class: "stack" });
  if (!K.anthropicKey) { wrap.append(needKeyCard("AI 회화")); return wrap; }
  if (!c) {
    const pk = R.pick[lang];
    wrap.append(el("div", { class: "card" },
      el("div", { class: "prompt" }, el("span", { class: "tag" }, "상황 고르기"), el("div", { class: "mid" }, `누구와 ${langKo()}로 이야기할까요?`)),
      el("div", { class: "scen" }, SCEN[lang].map((sc) => el("button", { "aria-pressed": String(pk.sc === sc.id), onclick: () => { pk.sc = sc.id; renderPanel(); } }, el("b", null, sc.t), el("span", null, sc.d)))),
      el("div", { class: "row between" },
        el("div", { class: "seg", role: "group", "aria-label": "난이도" }, LEVELS.map((L, i) => el("button", { "aria-pressed": String(pk.lv === i), onclick: () => { pk.lv = i; renderPanel(); } }, L.t))),
        el("button", { class: "btn", onclick: startChat }, "대화 시작")),
      el("p", { class: "small muted", style: "margin:0" },
        sp.canListen() ? "마이크 버튼을 누르고 말하면 글자로 바뀌어 보내져요. " : "",
        `막히면 한국어로 말해도 돼요. 자연스러운 ${langKo()} 문장으로 고쳐 주고, 고친 문장은 ‘표현’ 복습 카드로 저장할 수 있어요.`)));
    return wrap;
  }
  const msgs = el("div", { class: "msgs", "aria-live": "polite" },
    c.msgs.map((m, idx) => {
      if (m.who === "ai")
        return el("div", { class: "msg ai" },
          el("div", { class: "bubble" }, el("div", { class: "tl" }, m.text),
            lang === "ja" && P.showReading && m.reading ? el("div", { class: "rd" }, m.reading) : null,
            m.showKo ? el("div", { class: "ko" }, m.ko) : null),
          el("div", { class: "tools" }, spk(m.text),
            el("button", { class: "link", onclick: () => { m.showKo = !m.showKo; renderPanel(); } }, m.showKo ? "번역 숨기기" : "번역 보기"),
            sp.canListen() ? el("button", { class: "link", onclick: () => { m.shadow = !m.shadow; renderPanel(); } }, m.shadow ? "따라 말하기 닫기" : "따라 말하기") : null,
            saveBtn({ t: m.text, r: m.reading, ko: m.ko })),
          m.shadow ? shadowBox(`c${lang}${idx}`, m.text) : null);
      return el("div", { class: "msg me" }, el("div", { class: "bubble" }, m.text),
        m.fb ? el("div", { class: "fb" },
          el("span", { class: "lbl" }, "이렇게 말하면 더 자연스러워요"),
          el("div", { class: "row", style: "gap:8px" }, el("span", { class: "tl" }, m.fb.fixed), spk(m.fb.fixed)),
          lang === "ja" && m.fb.reading ? el("div", { class: "rd" }, m.fb.reading) : null,
          m.fb.why ? el("div", { class: "small" }, m.fb.why) : null,
          el("div", null, saveBtn({ t: m.fb.fixed, r: m.fb.reading, ko: m.fb.ko, note: m.fb.why }))) : null);
    }),
    c.busy ? el("div", { class: "msg ai" }, el("div", { class: "bubble typing", "aria-label": "답장을 쓰는 중" }, el("i"), el("i"), el("i"))) : null,
    c.err ? el("div", { class: "result no" }, el("div", null, c.err), el("div", null, el("button", { class: "btn sm ghost", onclick: chatCall }, "다시 시도"))) : null);
  const ta = el("textarea", { id: "chat-input", rows: "1", placeholder: c.listening ? "듣고 있어요…" : `${langKo()}나 한국어로 답하기`, value: c.draft,
    oninput: (e) => { c.draft = e.target.value; e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px"; },
    onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && e.keyCode !== 229 && !matchMedia("(pointer:coarse)").matches) { e.preventDefault(); sendChat(); } } });
  wrap.append(el("div", { class: "card chat" },
    el("div", { class: "row between" },
      el("div", { class: "row" }, el("span", { class: "tag" }, c.sc.t), el("span", { class: "small muted" }, LEVELS[c.lv].t)),
      el("div", { class: "row" },
        sp.canSpeak() ? el("button", { class: "btn ghost sm" + (P.autoSpeak ? " on" : ""), "aria-pressed": String(P.autoSpeak), title: "AI 답변 자동으로 읽어 주기",
          onclick: () => { P.autoSpeak = !P.autoSpeak; persist(); if (!P.autoSpeak) sp.stopSpeaking(); renderPanel(); } }, svg(ICON.speaker), P.autoSpeak ? "읽어 주기 켬" : "읽어 주기 꺼짐") : null,
        el("button", { class: "btn ghost sm", onclick: () => { c.ctl?.abort(); R.mic?.abort(); sp.stopSpeaking(); R.chat[lang] = null; renderPanel(); } }, "끝내기"))),
    msgs,
    c.hints.length && !c.busy ? el("div", { class: "hints" }, el("span", { class: "small muted", style: "align-self:center" }, "이렇게 말해 볼까요?"),
      c.hints.map((h) => el("button", { class: "tl", onclick: () => { c.draft = h; renderPanel(); const t = $("#chat-input"); t?.focus(); } }, h))) : null,
    c.micErr ? el("div", { class: "status err" }, c.micErr) : null,
    el("div", { class: "composer" },
      sp.canListen() ? el("button", { class: "mic-round" + (c.listening ? " on" : ""), type: "button", "aria-label": c.listening ? "듣기 멈추기" : "말해서 입력", disabled: c.busy || null, onclick: chatMic }, svg(c.listening ? ICON.stop : ICON.mic)) : null,
      ta,
      c.busy ? el("button", { class: "btn ghost", onclick: () => c.ctl?.abort() }, "멈추기") : el("button", { class: "btn", onclick: sendChat }, "보내기"))));
  return wrap;
}

/* ───────── 설정 ───────── */
function saveK() { store.saveKeys(K); sp.configure({ ...K, slow: P.slow }); }
function field(label, input, help) {
  return el("label", { class: "field" }, el("span", { class: "flabel" }, label), input, help ? el("span", { class: "small muted" }, help) : null);
}
function msgLine(key) {
  const m = R.msg[key];
  return m ? el("div", { class: "status" + (m.err ? " err" : m.ok ? " ok" : "") }, m.text) : null;
}
function toggle(id, label, val, on) {
  return el("label", { class: "toggle" }, el("input", { type: "checkbox", id, checked: val || null, onchange: (e) => on(e.target.checked) }), el("span", null, label));
}
function renderSettings() {
  const wrap = el("div", { class: "stack" });
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;

  if (!standalone) {
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    wrap.append(el("div", { class: "card tight" },
      el("h2", null, "홈 화면에 설치"),
      R.installEvt
        ? el("div", { class: "row" }, el("button", { class: "btn", onclick: async () => { R.installEvt.prompt(); await R.installEvt.userChoice.catch(() => {}); R.installEvt = null; renderPanel(); } }, "앱 설치"))
        : el("p", { class: "small muted", style: "margin:0" }, ios ? "Safari 아래쪽 공유 버튼 → ‘홈 화면에 추가’를 누르면 앱처럼 쓸 수 있어요." : "브라우저 메뉴(⋮) → ‘앱 설치’ 또는 ‘홈 화면에 추가’를 누르면 앱처럼 쓸 수 있어요.")));
  }

  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "Claude (AI 회화 · 콘텐츠 생성)"),
    field("API 키", el("input", { type: "password", id: "k-anthropic", autocomplete: "off", spellcheck: "false", placeholder: "sk-ant-...", value: K.anthropicKey,
      onchange: (e) => { K.anthropicKey = e.target.value.trim(); saveK(); R.msg.claude = null; renderPanel(); } }),
      "console.anthropic.com → API Keys에서 발급해요. 키는 이 기기에만 저장돼요."),
    field("모델", el("select", { id: "k-model", onchange: (e) => { K.model = e.target.value; saveK(); renderPanel(); } },
      ai.MODELS.map((m) => el("option", { value: m.id, selected: K.model === m.id || null }, `${m.name} — ${m.note}`)))),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", disabled: !K.anthropicKey || R.msg.claude?.busy || null, onclick: async () => {
        R.msg.claude = { text: "확인하는 중…", busy: true }; renderPanel();
        try { await ai.testConnection(K.anthropicKey, K.model); R.msg.claude = { text: "연결됐어요.", ok: true }; }
        catch (e) { R.msg.claude = { text: e.message, err: true }; }
        renderPanel();
      } }, "연결 테스트")),
    msgLine("claude")));

  const region = el("select", { id: "k-region", onchange: (e) => { K.azureRegion = e.target.value; saveK(); sp.clearAudioCache(); } },
    sp.REGIONS.map(([id, name]) => el("option", { value: id, selected: K.azureRegion === id || null }, `${name} (${id})`)));
  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "Azure Speech (원어민 음성 · 발음 점수)"),
    el("p", { class: "small muted", style: "margin:0" }, "없어도 앱은 동작해요. 넣으면 휴대폰 기본 음성 대신 자연스러운 원어민 음성을 쓰고, 따라 말하기에서 단어별 발음 점수를 받을 수 있어요."),
    field("키", el("input", { type: "password", id: "k-azure", autocomplete: "off", spellcheck: "false", placeholder: "Azure Speech 리소스의 키 1", value: K.azureKey,
      onchange: (e) => { K.azureKey = e.target.value.trim(); saveK(); sp.clearAudioCache(); R.msg.azure = null; renderPanel(); } })),
    field("지역", region, "Azure 리소스를 만들 때 고른 지역과 같아야 해요."),
    el("div", { class: "grid2" },
      field("일본어 음성", el("select", { id: "k-voice-ja", onchange: (e) => { K.voiceJa = e.target.value; saveK(); } }, sp.VOICES.ja.map((v) => el("option", { value: v.id, selected: K.voiceJa === v.id || null }, v.name)))),
      field("영어 음성", el("select", { id: "k-voice-en", onchange: (e) => { K.voiceEn = e.target.value; saveK(); } }, sp.VOICES.en.map((v) => el("option", { value: v.id, selected: K.voiceEn === v.id || null }, v.name))))),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", disabled: !K.azureKey || null, onclick: async () => {
        R.msg.azure = { text: "음성을 만드는 중…" }; renderPanel();
        try { await sp.testVoice(P.lang); R.msg.azure = { text: "들리면 정상이에요.", ok: true }; }
        catch (e) { R.msg.azure = { text: e.message, err: true }; }
        renderPanel();
      } }, `${langKo()} 음성 테스트`)),
    msgLine("azure")));

  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "학습"),
    toggle("p-reading", "일본어 읽는 법(후리가나) 표시", P.showReading, (v) => { P.showReading = v; persist(); }),
    toggle("p-autosend", "회화에서 말하면 바로 보내기", P.autoSend, (v) => { P.autoSend = v; persist(); }),
    toggle("p-autospeak", "AI 답변 자동으로 읽어 주기", P.autoSpeak, (v) => { P.autoSpeak = v; persist(); }),
    toggle("p-slow", "천천히 읽기", P.slow, (v) => { P.slow = v; persist(); sp.configure({ ...K, slow: v }); sp.clearAudioCache(); }),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", onclick: () => {
        const sample = P.lang === "ja" ? "こんにちは。今日も一緒に練習しましょう。" : "Hi there! Let's practice together today.";
        sp.speak(sample, P.lang);
        const name = sp.browserVoiceName(P.lang);
        R.msg.voice = K.azureKey ? { text: "Azure 음성으로 읽었어요. 안 들리면 무음 모드와 볼륨을 확인해 주세요." }
          : name === null ? { text: "이 브라우저는 읽어 주기를 지원하지 않아요.", err: true }
          : name ? { text: `이 기기의 ${langKo()} 음성(${name})으로 읽었어요. 안 들리면 무음 모드와 미디어 볼륨을 확인해 주세요.` }
          : { text: `이 기기에 ${langKo()} 음성이 없을 수 있어요. 폰 설정 → 텍스트 음성 변환(TTS)에서 ${langKo()} 음성을 내려받아 주세요.`, err: true };
        renderPanel();
      } }, `${langKo()} 읽어 주기 테스트`)),
    msgLine("voice")));

  const total = ["ja", "en"].reduce((n, l) => n + Object.keys(S.prog[l]).length, 0);
  const mine = ["ja", "en"].reduce((n, l) => n + S.custom[l].vocab.length + S.custom[l].expr.length + S.custom[l].sent.length, 0);
  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "데이터"),
    el("p", { class: "small muted", style: "margin:0" }, `학습 기록 ${total}개, 내가 추가한 항목 ${mine}개가 이 기기에 저장돼 있어요. 휴대폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업해 두세요. 백업 파일에는 API 키가 들어가지 않아요.`),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", onclick: exportBackup }, "백업 내보내기"),
      el("label", { class: "btn sm ghost" }, "백업 가져오기", el("input", { type: "file", id: "import-file", accept: "application/json,.json", hidden: true, onchange: pickImport }))),
    R.pendingImport ? el("div", { class: "result no" },
      el("div", null, `이 파일로 지금 기록을 덮어써요: 학습 기록 ${R.pendingImport.count}개. 되돌릴 수 없어요.`),
      el("div", { class: "row" },
        el("button", { class: "btn sm", onclick: () => { Object.assign(S, R.pendingImport.state); Object.assign(P, S.prefs); S.prefs = P; R.pendingImport = null; R.sess = { ja: {}, en: {} }; flushSave(); R.msg.data = { text: "백업을 가져왔어요.", ok: true }; render(); } }, "덮어쓰기"),
        el("button", { class: "btn sm ghost", onclick: () => { R.pendingImport = null; renderPanel(); } }, "취소"))) : null,
    msgLine("data"),
    el("div", { class: "row" },
      el("button", { class: "link danger", onclick: () => { K.anthropicKey = ""; K.azureKey = ""; saveK(); R.msg.data = { text: "이 기기에서 API 키를 지웠어요.", ok: true }; renderPanel(); } }, "이 기기에서 API 키 지우기"))));
  return wrap;
}
function exportBackup() {
  flushSave();
  const blob = new Blob([store.backupJSON(S)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `harumal-backup-${dkey(new Date())}.json` });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  R.msg.data = { text: "백업 파일을 저장했어요.", ok: true };
  renderPanel();
}
async function pickImport(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const state = store.parseBackup(await f.text());
    R.pendingImport = { state, count: Object.keys(state.prog.ja).length + Object.keys(state.prog.en).length };
    R.msg.data = null;
  } catch (err) {
    R.msg.data = { text: err.message || "파일을 읽지 못했어요.", err: true };
  }
  renderPanel();
}

/* ───────── 시작 ───────── */
$("#lang-ja").onclick = () => { R.mic?.abort(); P.lang = "ja"; persist(); render(); };
$("#lang-en").onclick = () => { R.mic?.abort(); P.lang = "en"; persist(); render(); };
document.addEventListener("keydown", (e) => {
  if (P.tab !== "vocab" || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const s = R.sess[P.lang].vocab;
  if (!s?.st) return;
  if (!s.st.chosen && /^[1-4]$/.test(e.key)) { const c = s.st.choices[+e.key - 1]; if (c) answerVocab(c.id); }
  else if (s.st.chosen && e.key === "Enter") nextVocab();
});
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); R.installEvt = e; if (P.tab === "settings") renderPanel(); });
if ("speechSynthesis" in window) try { speechSynthesis.getVoices(); } catch {}
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
store.requestPersist();
render();
