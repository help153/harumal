// 이 기기(브라우저)에 학습 기록과 API 키를 저장한다.
// 학습 기록과 키는 따로 보관해서, 백업 파일에는 키가 들어가지 않게 한다.

const STATE_KEY = "harumal:v1";
const KEYS_KEY = "harumal:keys";

export function emptyState() {
  return {
    prog: { ja: {}, en: {} },
    custom: { ja: { vocab: [], idiom: [], expr: [] }, en: { vocab: [], idiom: [], expr: [] } },
    stats: { days: {}, done: {} },
    explain: { ja: {}, en: {} }, // 퀴즈 '자세히 설명'으로 받은 설명 (항목 id별)
    marks: { ja: {}, en: {} }, // 북마크: "종류:id" → 표시한 시각
    lv: { ja: 1, en: 1 }, // 회화 단계 (1~6)
    sub: { ja: 1, en: 1 }, // 단계 안 난이도 칸 (1~3). 오늘의 시험 점수로 오르내린다
    lvSet: { ja: false, en: false }, // 시작 단계를 골랐는지
    tests: [], // 단계 시험 기록 {date, lang, lv, right, total, pct, passed}
    talks: [], // AI 대화 평가 기록 {date, lang, lv, scene, fluency, accuracy, naturalness, summary}
    speak: { ja: { ok: 0, n: 0, mic: 0 }, en: { ok: 0, n: 0, mic: 0 } }, // 말해 보기 결과
    lessons: {}, // 오늘의 학습 완료 기록 "날짜:언어" → {lv, speak:[맞음,전체], listen:[맞음,전체]}
    prefs: { pv: 3, lang: "ja", tab: "today", showReading: true, autoSend: true, autoSpeak: true, autoReveal: true, kanjiHint: true, sfx: true, slow: false },
  };
}

// 저장된 값이 일부 빠져 있어도 기본 구조를 채워서 돌려준다.
export function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== "object") return s;
  for (const lang of ["ja", "en"]) {
    if (raw.prog?.[lang] && typeof raw.prog[lang] === "object") s.prog[lang] = raw.prog[lang];
    if (raw.explain?.[lang] && typeof raw.explain[lang] === "object") s.explain[lang] = raw.explain[lang];
    if (raw.marks?.[lang] && typeof raw.marks[lang] === "object") s.marks[lang] = raw.marks[lang];
    for (const kind of ["vocab", "idiom", "expr"]) {
      const list = raw.custom?.[lang]?.[kind];
      if (Array.isArray(list)) s.custom[lang][kind] = list;
    }
  }
  for (const k of ["lv", "sub", "lvSet", "speak"]) if (raw[k] && typeof raw[k] === "object") for (const l of ["ja", "en"]) if (raw[k][l] != null) s[k][l] = raw[k][l];
  if (Array.isArray(raw.tests)) s.tests = raw.tests;
  if (Array.isArray(raw.talks)) s.talks = raw.talks;
  if (raw.lessons && typeof raw.lessons === "object") s.lessons = raw.lessons;
  if (raw.stats?.days && typeof raw.stats.days === "object") s.stats.days = raw.stats.days;
  if (raw.stats?.done && typeof raw.stats.done === "object") s.stats.done = raw.stats.done;
  if (raw.prefs && typeof raw.prefs === "object") Object.assign(s.prefs, raw.prefs);
  // v2: AI 답변 자동 읽기를 기본으로 켠다 (이전 버전은 꺼진 채로 저장돼 있었음)
  if (raw.prefs && !(raw.prefs.pv >= 2)) s.prefs.autoSpeak = true;
  // v3: 단어·숙어·표현 위주로 개편. 누르면 읽어 주기를 켜고 첫 화면을 '오늘'로
  if (raw.prefs && !(raw.prefs.pv >= 3)) {
    s.prefs.autoReveal = true;
    s.prefs.tab = "today";
  }
  // v4: 회화 중심 단계형으로 개편. 첫 화면은 '오늘의 학습'
  if (raw.prefs && !(raw.prefs.pv >= 4)) s.prefs.tab = "today";
  s.prefs.pv = 4;
  return s;
}

export function loadState() {
  try {
    return normalize(JSON.parse(localStorage.getItem(STATE_KEY) || "null"));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function loadKeys() {
  const d = { anthropicKey: "", model: "claude-opus-5-5", azureKey: "", azureRegion: "koreacentral", voiceJa: "ja-JP-NanamiNeural", voiceEn: "en-US-JennyNeural" };
  try {
    return { ...d, ...JSON.parse(localStorage.getItem(KEYS_KEY) || "{}") };
  } catch {
    return d;
  }
}

export function saveKeys(keys) {
  try {
    localStorage.setItem(KEYS_KEY, JSON.stringify(keys));
    return true;
  } catch {
    return false;
  }
}

// 브라우저가 저장 공간을 정리할 때 이 앱 데이터를 지우지 않도록 요청한다.
export async function requestPersist() {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

export function backupJSON(state) {
  return JSON.stringify({ app: "harumal", version: 1, exportedAt: new Date().toISOString(), data: state }, null, 1);
}

export function parseBackup(text) {
  const obj = JSON.parse(text);
  if (!obj || obj.app !== "harumal" || !obj.data) throw new Error("하루말 백업 파일이 아니에요.");
  return normalize(obj.data);
}
