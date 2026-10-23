// 하루영어: 쉬운 영어 퀴즈 앱 (생활영어 · 초등단어 · 숙어)
// 하루말과 같은 주소(help153.github.io)에 있어서 저장 공간 이름을 따로 쓴다.
import { BASE, KINDS } from "./content.js";
import * as ai from "../../js/ai.js";
import * as sp from "../../js/speech.js";
import { GOAL, streakInfo, streakCard, milestone } from "../../js/streak.js";

const APP_VERSION = "2026.10.23";
const SKEY = "haruen:v1";
const KKEY = "haruen:keys";
const LANG = "en";
const IV = [0, 1, 3, 7, 14, 30, 60]; // 익힘 단계별 다음 복습까지 일 수
const DAY = 864e5;
const SKIP = "__skip";

/* ───────── 저장 ───────── */
function normalize(r) {
  const s = { prog: {}, stats: { days: {}, done: {} }, explain: {}, marks: {}, prefs: { tab: "today", autoReveal: true, autoQuestion: true, sfx: true, slow: false } };
  if (r && typeof r === "object") {
    if (r.prog && typeof r.prog === "object") s.prog = r.prog;
    if (r.marks && typeof r.marks === "object") s.marks = r.marks;
    if (r.stats?.days && typeof r.stats.days === "object") s.stats.days = r.stats.days;
    if (r.stats?.done && typeof r.stats.done === "object") s.stats.done = r.stats.done;
    if (r.explain && typeof r.explain === "object") s.explain = r.explain;
    if (r.prefs && typeof r.prefs === "object") Object.assign(s.prefs, r.prefs);
  }
  return s;
}
function loadState() {
  try { return normalize(JSON.parse(localStorage.getItem(SKEY) || "null")); } catch { return normalize(null); }
}
function loadKeys() {
  const d = { anthropicKey: "", model: "claude-opus-5-5" };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KKEY) || "{}") }; } catch { return d; }
}
const S = loadState();
const P = S.prefs;
const K = loadKeys();
sp.configure({ azureKey: "", slow: P.slow });
sp.setSfx(P.sfx !== false);
const R = { sess: {}, explain: {}, open: {}, msg: {}, pendingImport: null, installEvt: null };

let saveTimer = null;
function persist() { clearTimeout(saveTimer); saveTimer = setTimeout(flushSave, 400); }
function flushSave() { clearTimeout(saveTimer); try { localStorage.setItem(SKEY, JSON.stringify(S)); } catch {} }
function saveKeys() { try { localStorage.setItem(KKEY, JSON.stringify(K)); } catch {} }
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
  flame: '<path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.4 1.3-4.2 2.6-5.4.2 1.6 1 2.7 2.1 3.2C11.3 8 11 5 12 2z" fill="currentColor" stroke="none"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  starOn: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  life: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/>',
  kids: '<path d="M4 5h11a3 3 0 0 1 3 3v11H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h4"/>',
  idiom: '<path d="M10 7H6a2 2 0 0 0-2 2v3h5v5H4"/><path d="M20 7h-4a2 2 0 0 0-2 2v3h5v5h-5"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
};
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pad = (n) => String(n).padStart(2, "0");
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const speak = (t) => sp.speak(t, LANG);

function spk(text) {
  if (!text || !sp.canSpeak()) return null;
  return el("button", { class: "icon-btn", type: "button", "aria-label": "발음 듣기", onclick: (e) => { e.stopPropagation(); speak(text); } }, svg(ICON.speaker));
}
// 누르면 발음을 들려주는 글자
function say(text, cls) {
  return el("button", { type: "button", class: "say " + (cls || ""), title: "누르면 발음을 들려줘요", onclick: (e) => { e.stopPropagation(); speak(text); } },
    el("span", null, text), svg(ICON.speaker));
}

/* ───────── 간격 반복 ───────── */
const pool = (kind) => BASE[kind];
const pkey = (kind, id) => kind + ":" + id;
const prog = (kind, id) => S.prog[pkey(kind, id)];
function buildQueue(kind, size) {
  const now = Date.now(), items = pool(kind), Pg = (it) => prog(kind, it.id);
  const due = items.filter((it) => Pg(it) && Pg(it).due <= now).sort((a, b) => Pg(a).due - Pg(b).due);
  const fresh = shuffle(items.filter((it) => !Pg(it)));
  let q = [...due.slice(0, size), ...fresh].slice(0, size);
  if (q.length < size) {
    const rest = items.filter((it) => !q.includes(it) && Pg(it)).sort((a, b) => Pg(a).due - Pg(b).due);
    q = q.concat(rest.slice(0, size - q.length));
  }
  return q;
}
function grade(kind, id, ok) {
  const k = pkey(kind, id);
  const p = { ...(S.prog[k] || { b: 0, due: 0, n: 0, ok: 0 }) };
  p.n++;
  if (ok) { p.ok++; p.b = Math.min(p.b + 1, IV.length - 1); p.due = Date.now() + IV[p.b] * DAY - 3600e3; }
  else { p.b = 0; p.due = Date.now() + 5 * 60e3; }
  S.prog[k] = p;
  const today = dkey(new Date());
  S.stats.days[today] = (S.stats.days[today] || 0) + 1;
  persist();
  renderStreak();
  // 오늘 목표(10문제)를 채운 순간: 연속 달성 축하
  if (S.stats.days[today] === GOAL) {
    const n = streakInfo(S.stats.days).current;
    setTimeout(() => sp.sfx("streak"), 450);
    toast(`🔥 ${n}일 연속 달성!`, milestone(n) || "오늘 목표 10문제 완료. 내일도 만나요!", "celebrate");
  }
}

// 화면 위에 잠깐 떴다 사라지는 알림
function toast(title, text, kind = "", action = null) {
  document.querySelector(".toast")?.remove();
  const t = el("div", { class: "toast " + kind, role: "status" },
    el("b", null, title), text ? el("span", null, text) : null,
    action ? el("button", { class: "link", onclick: () => { t.remove(); action.run(); } }, action.label) : null);
  document.body.append(t);
  setTimeout(() => t.classList.add("out"), kind === "celebrate" ? 3200 : 6000);
  setTimeout(() => t.remove(), kind === "celebrate" ? 3700 : 6500);
}
// 읽어 주기가 실패하면 한 번만 이유와 해결 방법을 알려 준다
let soundWarned = false;
sp.onSpeakFail((error, lang, voiceName) => {
  if (soundWarned) return;
  soundWarned = true;
  toast("소리가 나지 않았어요",
    voiceName === "" ? "이 폰에 영어 음성이 없는 것 같아요. 설정에서 해결 방법을 확인해 주세요." : "무음 모드나 미디어 볼륨을 확인해 주세요.",
    "warn", { label: "해결 방법 보기", run: () => { P.tab = "settings"; render(); scrollTo(0, document.body.scrollHeight); } });
});

/* ───────── 북마크: 기억하고 싶은 것 표시 ───────── */
const isMarked = (kind, id) => Boolean(S.marks[pkey(kind, id)]);
function markedItems(onlyKind = null) {
  return Object.keys(S.marks).map((k) => {
    const i = k.indexOf(":"), kind = k.slice(0, i), id = k.slice(i + 1);
    if (onlyKind && kind !== onlyKind) return null;
    const it = (BASE[kind] || []).find((x) => x.id === id);
    return it ? { kind, it } : null;
  }).filter(Boolean);
}
function toggleMark(kind, id) {
  const k = pkey(kind, id);
  if (S.marks[k]) delete S.marks[k];
  else S.marks[k] = Date.now();
  persist();
  try { navigator.vibrate?.(10); } catch {}
  renderPanel();
}
function markBtn(kind, it) {
  const on = isMarked(kind, it.id);
  return el("button", { type: "button", class: "mark-btn" + (on ? " on" : ""), "aria-pressed": String(on), "aria-label": on ? "북마크 해제" : "북마크", title: on ? "북마크 해제" : "기억하고 싶으면 북마크",
    onclick: (e) => { e.stopPropagation(); toggleMark(kind, it.id); } }, svg(on ? ICON.starOn : ICON.star));
}
// 퀴즈에 아직 없는 북마크를 n개까지 골라 뒤쪽 문제와 바꾼다
function mixMarks(queue, marks, n) {
  const have = new Set(queue.map((e) => pkey(e.kind, e.it.id)));
  const pick = shuffle(marks.filter((e) => !have.has(pkey(e.kind, e.it.id)))).slice(0, n);
  pick.forEach((e, i) => { if (queue.length > i) queue[queue.length - 1 - i] = e; else queue.push(e); });
  return queue;
}

/* ───────── 화면 골격 ───────── */
const TABS = [
  { id: "today", label: "오늘", icon: ICON.today },
  { id: "life", label: "생활영어", icon: ICON.life },
  { id: "kids", label: "초등단어", icon: ICON.kids },
  { id: "idiom", label: "숙어", icon: ICON.idiom },
  { id: "settings", label: "설정", icon: ICON.gear },
];
function renderStreak() {
  const info = streakInfo(S.stats.days);
  const pill = $("#streak");
  pill.replaceChildren(svg(ICON.flame), `${info.current}일`);
  pill.classList.toggle("on", info.doneToday);
  pill.title = info.doneToday ? "오늘 목표 달성" : `오늘 ${info.left}문제 더 풀면 연속 유지`;
}
function renderNav() {
  $("#nav").replaceChildren(...TABS.map((t) =>
    el("button", { type: "button", "aria-current": P.tab === t.id ? "page" : null, onclick: () => { if (P.tab !== t.id) { P.tab = t.id; persist(); render(); scrollTo(0, 0); } } }, svg(t.icon), el("span", null, t.label))));
}
function renderPanel() {
  const r = P.tab === "settings" ? renderSettings() : P.tab === "today" ? renderToday() : P.tab === "marks" ? renderMarks() : renderKindTab(P.tab);
  $("#panel").replaceChildren(r);
}
function render() { renderNav(); renderStreak(); renderPanel(); }

/* ───────── 퀴즈 ───────── */
// 오늘: 생활영어 4 + 초등단어 4 + 숙어 2, 각 탭: 10문제
// 북마크한 것은 오늘의 퀴즈에 2개, 각 탭 퀴즈에 3개까지 섞어서 더 자주 나오게 한다
function quizQueue(key) {
  if (key === "today")
    return shuffle(mixMarks([
      ...buildQueue("life", 4).map((it) => ({ kind: "life", it })),
      ...buildQueue("kids", 4).map((it) => ({ kind: "kids", it })),
      ...buildQueue("idiom", 2).map((it) => ({ kind: "idiom", it })),
    ], markedItems(), 2));
  if (key === "marks") return shuffle(markedItems()).slice(0, 10);
  return shuffle(mixMarks(buildQueue(key, 10).map((it) => ({ kind: key, it })), markedItems(key), 3));
}
function quizSess(key) {
  const today = dkey(new Date());
  if (!R.sess[key] || (key === "today" && R.sess[key].date !== today)) {
    const queue = quizQueue(key);
    R.sess[key] = { queue, first: queue.length, i: 0, right: 0, wrong: [], retried: false, st: null, date: today };
  }
  return R.sess[key];
}
const doneKey = () => dkey(new Date());

function quizCard(key) {
  const s = quizSess(key);
  if (s.i >= s.queue.length) return quizDone(key, s);
  const entry = s.queue[s.i], { kind, it } = entry;
  if (!s.st || s.st.at !== s.i) {
    const others = shuffle(pool(kind).filter((x) => x.id !== it.id && x.m !== it.m)).slice(0, 3);
    s.st = { at: s.i, dir: Math.random() < 0.75 ? 0 : 1, choices: shuffle([it, ...others]), chosen: null };
  }
  const st = s.st, label = KINDS[kind].label;
  const promptEl = el("div", { class: "prompt" },
    el("div", { class: "row" },
      el("span", { class: "tag tag-" + kind }, `${label} · ${st.dir === 0 ? "뜻 고르기" : "영어로 고르기"}`),
      entry.retry ? el("span", { class: "tag tag-retry" }, "다시 풀기") : null),
    st.dir === 0 ? say(it.w, "big") : el("div", { class: "big ko" }, it.m));
  const choiceBtns = st.choices.map((c, i) => {
    let cls = "choice";
    if (st.chosen) { if (c.id === it.id) cls += " right"; else if (c.id === st.chosen) cls += " wrong"; else cls += " done"; if (st.anim) cls += " anim"; }
    const btn = el("button", { class: cls, onclick: () => (st.chosen ? speak(c.w) : answerQuiz(key, c.id)) },
      st.chosen ? null : el("span", { class: "k" }, i + 1),
      st.dir === 0 && !st.chosen ? el("span", { class: "ck" }, c.m) : null,
      st.dir === 1 || st.chosen ? el("span", { class: "cw" }, c.w) : null,
      st.chosen ? el("span", { class: "cm" }, c.m) : null);
    return st.dir === 1 && !st.chosen ? el("div", { class: "choice-wrap" }, btn, spk(c.w)) : btn;
  });
  st.anim = false;
  let result = null;
  if (st.chosen) {
    const ok = st.chosen === it.id;
    result = el("div", { class: "result " + (ok ? "ok" : "no") },
      el("div", { class: "head" }, ok ? "정답이에요!" : st.chosen === SKIP ? "정답은 이거예요" : "아쉬워요"),
      el("div", { class: "answer-line" }, say(it.w, "md"), el("span", null, "— ", it.m)),
      it.ex ? el("div", { class: "example-box" }, say(it.ex, "ex"), el("div", { class: "small muted" }, it.exk)) : null,
      explainBox(kind, it));
  }
  return el("div", { class: "card quiz", id: "quiz-" + key },
    el("div", { class: "row between" },
      el("span", { class: "quiz-title" }, key === "today" ? "오늘의 퀴즈" : key === "marks" ? "북마크 퀴즈" : `${label} 퀴즈`),
      el("div", { class: "row", style: "gap:4px" },
        isMarked(kind, it.id) && key !== "marks" ? el("span", { class: "small mark-tag" }, "북마크") : null,
        el("span", { class: "small muted" }, s.i < s.first ? `${s.i + 1} / ${s.first}` : `다시 ${s.i - s.first + 1} / ${s.queue.length - s.first}`),
        markBtn(kind, it))),
    el("div", { class: "progress" }, el("span", { style: `width:${Math.min(1, s.i / s.queue.length) * 100}%` })),
    promptEl,
    el("div", { class: "choices" }, choiceBtns),
    st.chosen ? null : el("div", { class: "row", style: "justify-content:center" }, el("button", { class: "link quiet", onclick: () => answerQuiz(key, SKIP) }, "모르겠어요")),
    result,
    st.chosen
      ? [el("div", { class: "next-spacer" }), el("div", { class: "next-bar" }, el("button", { class: "btn", id: "next-btn", onclick: () => nextQuiz(key) }, isLast(s) ? "결과 보기" : "다음 →"))]
      : null);
}
// 마지막 문제인지: 틀린 문제가 남아 있으면 다시 풀기가 이어지므로 아직 마지막이 아니다
const isLast = (s) => s.i + 1 >= s.queue.length && (s.retried || (!s.wrong.length && s.st?.chosen === s.queue[s.i].it.id));

function answerQuiz(key, id) {
  const s = R.sess[key];
  if (!s?.st || s.st.chosen) return;
  const entry = s.queue[s.i], { kind, it } = entry;
  s.st.chosen = id;
  s.st.anim = true; // 이번 그리기에서만 맞힘·틀림 애니메이션
  const ok = id === it.id;
  if (!entry.retry) {
    if (ok) s.right++;
    else s.wrong.push(entry);
    grade(kind, it.id, ok);
  }
  sp.sfx(ok ? "right" : "wrong");
  if (P.autoReveal) setTimeout(() => speak(it.w), 320); // 효과음 다음에 정답 발음
  renderPanel();
  // 정답 설명이 고정된 다음 버튼에 가려지면, 문제가 화면 위로 넘어가지 않는 만큼만 올려 준다
  requestAnimationFrame(() => {
    const card = $("#quiz-" + key), target = card?.querySelector(".result"), bar = $(".next-bar .btn");
    if (!card || !target || !bar) return;
    const hidden = target.getBoundingClientRect().bottom - (bar.getBoundingClientRect().top - 8);
    const room = card.getBoundingClientRect().top - 12;
    if (hidden > 0 && room > 0) scrollBy({ top: Math.min(hidden, room), behavior: "smooth" });
  });
}
function nextQuiz(key) {
  const s = R.sess[key];
  s.i++;
  s.st = null;
  // 첫 바퀴가 끝나면 틀린 문제를 한 번 더 낸다
  if (s.i >= s.queue.length && !s.retried && s.wrong.length) {
    s.retried = true;
    s.queue.push(...shuffle(s.wrong).map((e) => ({ ...e, retry: true })));
  }
  if (s.i >= s.queue.length) {
    if (key === "today") { S.stats.done[doneKey()] = { right: s.right, total: s.first }; persist(); }
    sp.sfx("done");
  }
  renderPanel();
  $("#quiz-" + key)?.scrollIntoView({ block: "start", behavior: "smooth" });
  // 다음 문제가 영어로 나오면 바로 읽어 준다
  const nx = s.queue[s.i];
  if (nx && P.autoQuestion && s.st?.dir === 0) speak(nx.it.w);
}
function quizDone(key, s) {
  const wrong = s.wrong.map((e) => e.it);
  return el("div", { class: "card quiz", id: "quiz-" + key },
    el("div", { class: "prompt" },
      el("span", { class: "tag" }, key === "today" ? "오늘의 퀴즈 완료" : "세트 완료"),
      el("div", { class: "mid" }, `${s.first}문제 중 ${s.right}개를 맞혔어요.`),
      el("p", { class: "muted", style: "margin:0" }, "틀린 건 5분 뒤, 맞힌 건 1일·3일·7일 뒤에 다시 나와요.")),
    wrong.length ? el("div", { class: "wrong-list" }, el("b", null, "이번에 틀린 것"),
      wrong.map((it) => el("div", { class: "answer-line" }, say(it.w, "lw"), el("span", { class: "small" }, "— ", it.m)))) : null,
    el("div", { class: "row" }, el("button", { class: "btn", onclick: () => { R.sess[key] = null; renderPanel(); } }, key === "today" ? "한 세트 더 풀기" : "다음 세트")));
}

// 자세히 설명: Claude가 뜻과 느낌, 쓰는 상황, 예문, 비슷한 말을 쉽게 설명한다. 받은 설명은 기기에 저장한다.
function explainBox(kind, it) {
  const saved = S.explain[it.id], st = R.explain[it.id] || {};
  if (saved)
    return el("div", { class: "explain" },
      saved.nuance ? el("div", null, el("b", null, "뜻과 느낌 "), saved.nuance) : null,
      saved.usage ? el("div", null, el("b", null, "이럴 때 써요 "), saved.usage) : null,
      saved.examples?.length ? el("div", { class: "explain-list" }, el("b", null, "예문 더 보기"),
        saved.examples.map((e) => el("div", { class: "example-box" }, say(e.t, "ex"), el("div", { class: "small muted" }, e.ko)))) : null,
      saved.related?.length ? el("div", { class: "explain-list" }, el("b", null, "비슷하거나 헷갈리는 말"),
        saved.related.map((e) => el("div", { class: "answer-line" }, say(e.w, "lw"), el("span", { class: "small" }, "— ", e.m)))) : null);
  if (!K.anthropicKey) return null;
  return el("div", { class: "row" },
    el("button", { class: "btn ghost sm", disabled: st.busy || null, onclick: () => explain(kind, it) }, st.busy ? "설명을 만드는 중…" : "자세히 설명 보기"),
    st.err ? el("span", { class: "status err" }, st.err) : null);
}
async function explain(kind, it) {
  if (R.explain[it.id]?.busy) return;
  R.explain[it.id] = { busy: true };
  renderPanel();
  try {
    const { system, prompt, schema } = ai.explainRequest(LANG, KINDS[kind].label, it, { beginner: true });
    const out = await ai.askJSON({ apiKey: K.anthropicKey, model: K.model, system, messages: [{ role: "user", content: prompt }], schema, effort: "low", maxTokens: 8000 });
    const str = (v) => (typeof v === "string" ? v.trim() : "");
    S.explain[it.id] = {
      nuance: str(out.nuance),
      usage: str(out.usage),
      examples: (Array.isArray(out.examples) ? out.examples : []).map((e) => ({ t: str(e.t), ko: str(e.ko) })).filter((e) => e.t).slice(0, 3),
      related: (Array.isArray(out.related) ? out.related : []).map((e) => ({ w: str(e.w), m: str(e.m) })).filter((e) => e.w).slice(0, 3),
    };
    persist();
    R.explain[it.id] = {};
  } catch (e) {
    R.explain[it.id] = { err: e.message };
  }
  renderPanel();
}

/* ───────── 화면 ───────── */
function marksCard() {
  const n = markedItems().length;
  if (!n) return el("p", { class: "small muted marks-hint" }, "기억하고 싶은 문제는 오른쪽 위 ☆을 눌러 북마크하세요. 북마크는 퀴즈에 더 자주 나와요.");
  return el("div", { class: "card marks-card" },
    el("div", { class: "row between" },
      el("span", { class: "row", style: "gap:6px" }, el("span", { class: "mark-ico" }, svg(ICON.starOn)), el("b", null, `북마크 ${n}개`)),
      el("div", { class: "row" },
        el("button", { class: "btn sm ghost", onclick: () => { P.tab = "marks"; R.open.marksList = true; render(); scrollTo(0, 0); } }, "모아 보기"),
        el("button", { class: "btn sm", onclick: () => { R.sess.marks = null; P.tab = "marks"; render(); scrollTo(0, 0); } }, "북마크만 풀기"))));
}
function renderMarks() {
  const items = markedItems();
  const wrap = el("div", { class: "stack" },
    el("button", { type: "button", class: "link back", onclick: () => { P.tab = "today"; render(); } }, "← 오늘로 돌아가기"));
  if (!items.length) {
    wrap.append(el("div", { class: "card" }, el("div", { class: "mid" }, "아직 북마크가 없어요"), el("p", { class: "muted", style: "margin:0" }, "퀴즈나 전체 목록에서 ☆을 누르면 여기에 모여요.")));
    return wrap;
  }
  wrap.append(quizCard("marks"),
    el("details", { class: "box", open: R.open.marksList || null, ontoggle: (e) => { R.open.marksList = e.target.open; } },
      el("summary", null, `북마크 모아 보기 (${items.length})`),
      el("div", { class: "boxbody" }, el("ul", { class: "items" }, items.map(({ kind, it }) =>
        el("li", { class: "mark-row" }, el("div", null, say(it.w, "lw"), el("div", { class: "m" }, `${KINDS[kind].label} · ${it.m}`)), markBtn(kind, it)))))));
  return wrap;
}
function renderToday() {
  return el("div", { class: "stack" },
    streakCard(el, () => svg(ICON.flame), streakInfo(S.stats.days)),
    marksCard(),
    quizCard("today"));
}
function renderKindTab(kind) {
  const items = pool(kind);
  return el("div", { class: "stack" },
    quizCard(kind),
    el("details", { class: "box", open: R.open[kind] || null, ontoggle: (e) => { R.open[kind] = e.target.open; } },
      el("summary", null, `전체 ${KINDS[kind].label} 보기 (${items.length})`),
      el("div", { class: "boxbody" }, el("ul", { class: "items" }, items.map((it) =>
        el("li", { class: "mark-row" }, el("div", null, say(it.w, "lw"), el("div", { class: "m" }, it.m)), markBtn(kind, it)))))));
}

function toggle(id, label, val, on) {
  return el("label", { class: "toggle" }, el("input", { type: "checkbox", id, checked: val || null, onchange: (e) => on(e.target.checked) }), el("span", null, label));
}
function msgLine(key) {
  const m = R.msg[key];
  return m ? el("div", { class: "status" + (m.err ? " err" : m.ok ? " ok" : "") }, m.text) : null;
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
    el("h2", null, "읽어 주기"),
    toggle("p-question", "문제가 나오면 영어를 읽어 주기", P.autoQuestion, (v) => { P.autoQuestion = v; persist(); }),
    toggle("p-reveal", "답을 고르면 정답을 읽어 주기", P.autoReveal, (v) => { P.autoReveal = v; persist(); }),
    toggle("p-slow", "천천히 읽기", P.slow, (v) => { P.slow = v; persist(); sp.configure({ slow: v }); }),
    toggle("p-sfx", "맞힘·틀림 효과음과 진동", P.sfx !== false, (v) => { P.sfx = v; persist(); sp.setSfx(v); if (v) sp.sfx("right"); }),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", onclick: async () => {
        R.msg.voice = { text: "읽는 중…" }; renderPanel();
        const r = await speak("Hello! Let's learn English together.");
        const name = sp.browserVoiceName(LANG);
        R.msg.voice = name === null ? { text: "이 브라우저는 읽어 주기를 지원하지 않아요. Safari(아이폰)나 Chrome(안드로이드)으로 열어 주세요.", err: true }
          : r.ok ? { text: "읽었어요. 안 들리면 무음 모드(아이폰 옆 스위치)와 미디어 볼륨을 확인해 주세요.", ok: true }
          : { text: `소리를 내지 못했어요 (${r.error}). 무음 모드와 볼륨, 폰의 텍스트 음성 변환(TTS) 설정을 확인해 주세요.`, err: true };
        renderPanel();
      } }, "읽어 주기 테스트")),
    msgLine("voice"),
    el("details", { class: "box", open: R.open.soundHelp || null, ontoggle: (e) => { R.open.soundHelp = e.target.open; } },
      el("summary", null, "소리가 안 날 때"),
      el("div", { class: "boxbody small" },
        el("div", null, el("b", null, "아이폰: "), "옆면 무음 스위치를 끄고 볼륨을 올리세요. 무음 모드에서는 읽어 주기와 효과음이 모두 안 나와요."),
        el("div", null, el("b", null, "안드로이드: "), "미디어 볼륨을 올리세요. 영어가 안 나오면 설정 → 일반(시스템) → 언어 및 입력 → 텍스트 음성 변환(TTS)에서 영어 음성을 내려받으세요."),
        el("div", null, el("b", null, "그래도 안 되면: "), "Chrome(안드로이드)이나 Safari(아이폰)로 열었는지 확인하세요. 카카오톡 같은 앱 안의 브라우저에서는 소리가 안 날 수 있어요.")))));
  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "자세히 설명 (선택)"),
    el("p", { class: "small muted", style: "margin:0" }, "Claude API 키를 넣으면 퀴즈에서 ‘자세히 설명 보기’로 뜻과 느낌, 예문, 비슷한 말을 볼 수 있어요. 없어도 퀴즈는 그대로 쓸 수 있어요."),
    el("label", { class: "field" }, el("span", { class: "flabel" }, "Claude API 키"),
      el("input", { type: "password", id: "k-anthropic", autocomplete: "off", spellcheck: "false", placeholder: "sk-ant-...", value: K.anthropicKey,
        onchange: (e) => { K.anthropicKey = e.target.value.trim(); saveKeys(); R.msg.claude = null; renderPanel(); } })),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", disabled: !K.anthropicKey || R.msg.claude?.busy || null, onclick: async () => {
        R.msg.claude = { text: "확인하는 중…", busy: true }; renderPanel();
        try { await ai.testConnection(K.anthropicKey, K.model); R.msg.claude = { text: "연결됐어요.", ok: true }; }
        catch (e) { R.msg.claude = { text: e.message, err: true }; }
        renderPanel();
      } }, "연결 테스트"),
      K.anthropicKey ? el("button", { class: "link danger", onclick: () => { K.anthropicKey = ""; saveKeys(); R.msg.claude = { text: "키를 지웠어요.", ok: true }; renderPanel(); } }, "키 지우기") : null),
    msgLine("claude")));
  const total = Object.keys(S.prog).length;
  wrap.append(el("div", { class: "card tight" },
    el("h2", null, "기록 백업"),
    el("p", { class: "small muted", style: "margin:0" }, `학습 기록 ${total}개가 이 폰에 저장돼 있어요. 폰을 바꾸기 전에 백업해 두세요.`),
    el("div", { class: "row" },
      el("button", { class: "btn sm ghost", onclick: exportBackup }, "백업 내보내기"),
      el("label", { class: "btn sm ghost" }, "백업 가져오기", el("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: pickImport }))),
    R.pendingImport ? el("div", { class: "result no" },
      el("div", null, `지금 기록을 이 파일로 덮어써요 (학습 기록 ${Object.keys(R.pendingImport.prog).length}개). 되돌릴 수 없어요.`),
      el("div", { class: "row" },
        el("button", { class: "btn sm", onclick: () => { const n = R.pendingImport; Object.assign(S, n); Object.assign(P, n.prefs); S.prefs = P; R.pendingImport = null; R.sess = {}; flushSave(); R.msg.data = { text: "백업을 가져왔어요.", ok: true }; render(); } }, "덮어쓰기"),
        el("button", { class: "btn sm ghost", onclick: () => { R.pendingImport = null; renderPanel(); } }, "취소"))) : null,
    msgLine("data")));
  wrap.append(el("p", { class: "small muted", style: "margin:0;text-align:center" }, `하루영어 ${APP_VERSION}`));
  return wrap;
}
function exportBackup() {
  flushSave();
  const blob = new Blob([JSON.stringify({ app: "haruen", version: 1, exportedAt: new Date().toISOString(), data: S }, null, 1)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: `haruen-backup-${dkey(new Date())}.json` });
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
    const obj = JSON.parse(await f.text());
    if (!obj || obj.app !== "haruen" || !obj.data) throw new Error("하루영어 백업 파일이 아니에요.");
    R.pendingImport = normalize(obj.data);
    R.msg.data = null;
  } catch (err) {
    R.msg.data = { text: err.message || "파일을 읽지 못했어요.", err: true };
  }
  renderPanel();
}

/* ───────── 시작 ───────── */
document.addEventListener("keydown", (e) => {
  if (P.tab === "settings" || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const key = P.tab, s = R.sess[key];
  if (!s?.st) return;
  if (!s.st.chosen && /^[1-4]$/.test(e.key)) { const c = s.st.choices[+e.key - 1]; if (c) answerQuiz(key, c.id); }
  else if (s.st.chosen && e.key === "Enter") nextQuiz(key);
});
addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); R.installEvt = e; if (P.tab === "settings") renderPanel(); });
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("./sw.js").catch(() => {});
try { navigator.storage?.persist?.(); } catch {}
P.tab = "today"; // 앱을 열면 항상 오늘의 퀴즈부터
render();
