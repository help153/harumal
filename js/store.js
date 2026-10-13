// 이 기기(브라우저)에 학습 기록과 API 키를 저장한다.
// 학습 기록과 키는 따로 보관해서, 백업 파일에는 키가 들어가지 않게 한다.

const STATE_KEY = "harumal:v1";
const KEYS_KEY = "harumal:keys";

export function emptyState() {
  return {
    prog: { ja: {}, en: {} },
    custom: { ja: { vocab: [], expr: [], sent: [] }, en: { vocab: [], expr: [], sent: [] } },
    stats: { days: {} },
    prefs: { pv: 2, lang: "ja", tab: "vocab", showReading: true, autoSend: true, autoSpeak: true, autoReveal: true, slow: false },
  };
}

// 저장된 값이 일부 빠져 있어도 기본 구조를 채워서 돌려준다.
export function normalize(raw) {
  const s = emptyState();
  if (!raw || typeof raw !== "object") return s;
  for (const lang of ["ja", "en"]) {
    if (raw.prog?.[lang] && typeof raw.prog[lang] === "object") s.prog[lang] = raw.prog[lang];
    for (const kind of ["vocab", "expr", "sent"]) {
      const list = raw.custom?.[lang]?.[kind];
      if (Array.isArray(list)) s.custom[lang][kind] = list;
    }
  }
  if (raw.stats?.days && typeof raw.stats.days === "object") s.stats.days = raw.stats.days;
  if (raw.prefs && typeof raw.prefs === "object") Object.assign(s.prefs, raw.prefs);
  // v2: AI 답변 자동 읽기를 기본으로 켠다 (이전 버전은 꺼진 채로 저장돼 있었음)
  if (raw.prefs && !(raw.prefs.pv >= 2)) {
    s.prefs.autoSpeak = true;
    s.prefs.pv = 2;
  }
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
