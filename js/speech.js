// 음성: 듣기(TTS), 말하기 인식(STT), 발음 평가.
// Azure Speech 키가 있으면 Azure를 쓰고, 없으면 브라우저에 내장된 음성 기능을 쓴다.

const AZURE_SDK_URL = "https://cdn.jsdelivr.net/npm/microsoft-cognitiveservices-speech-sdk@1.51.0/distrib/browser/microsoft.cognitiveservices.speech.sdk.bundle-min.js";
const LOC = { ja: "ja-JP", en: "en-US" };

export const VOICES = {
  ja: [
    { id: "ja-JP-NanamiNeural", name: "Nanami (여성)" },
    { id: "ja-JP-KeitaNeural", name: "Keita (남성)" },
    { id: "ja-JP-AoiNeural", name: "Aoi (여성)" },
    { id: "ja-JP-DaichiNeural", name: "Daichi (남성)" },
  ],
  en: [
    { id: "en-US-JennyNeural", name: "Jenny (여성)" },
    { id: "en-US-GuyNeural", name: "Guy (남성)" },
    { id: "en-US-AriaNeural", name: "Aria (여성)" },
    { id: "en-US-DavisNeural", name: "Davis (남성)" },
  ],
};

export const REGIONS = [
  ["koreacentral", "한국 중부 (권장)"],
  ["japaneast", "일본 동부"],
  ["eastasia", "동아시아 (홍콩)"],
  ["southeastasia", "동남아시아 (싱가포르)"],
  ["eastus", "미국 동부"],
  ["westus2", "미국 서부 2"],
];

const cfg = { azureKey: "", azureRegion: "koreacentral", voiceJa: VOICES.ja[0].id, voiceEn: VOICES.en[0].id, slow: false };
export function configure(next) {
  Object.assign(cfg, next);
}
export const hasAzure = () => Boolean(cfg.azureKey && cfg.azureRegion);

export class SpeechError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

let sdkPromise = null;
function loadSdk() {
  if (window.SpeechSDK) return Promise.resolve(window.SpeechSDK);
  sdkPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = AZURE_SDK_URL;
    s.async = true;
    s.onload = () => (window.SpeechSDK ? resolve(window.SpeechSDK) : reject(new Error("no SpeechSDK")));
    s.onerror = () => reject(new Error("load failed"));
    document.head.append(s);
  }).catch((e) => {
    sdkPromise = null;
    throw new SpeechError("network", "음성 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
  });
  return sdkPromise;
}

function speechConfig(SDK) {
  return SDK.SpeechConfig.fromSubscription(cfg.azureKey, cfg.azureRegion);
}

/* ───────── 듣기 (TTS) ───────── */

// 휴대폰은 사용자가 화면을 한 번 터치해야 소리를 낼 수 있어서, 첫 터치 때 오디오를 깨워 둔다.
let ctx = null;
function audioCtx() {
  ctx ??= new (window.AudioContext || window.webkitAudioContext)();
  return ctx;
}
// 아이폰 Safari는 터치 안에서 한 번 소리를 내 둬야, 나중에 AI 답변이 도착했을 때 읽어 줄 수 있다.
let speechUnlocked = false;
function unlockSpeech() {
  if (speechUnlocked || !("speechSynthesis" in window)) return;
  speechUnlocked = true;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
  } catch {}
}
document.addEventListener(
  "pointerdown",
  () => {
    unlockSpeech();
    try {
      const c = audioCtx();
      if (c.state === "suspended") c.resume();
    } catch {}
  },
  { passive: true }
);

const audioCache = new Map(); // text+voice+rate → AudioBuffer
let current = null;

function stopAudio() {
  try { current?.stop(); } catch {}
  current = null;
}

// 기기에 설치된 음성 목록은 늦게 채워지는 경우가 많아서 바뀔 때마다 다시 읽는다.
let voices = [];
function loadVoices() {
  try { voices = speechSynthesis.getVoices(); } catch {}
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.addEventListener?.("voiceschanged", loadVoices);
}
function pickVoice(lang) {
  if (!voices.length) loadVoices();
  const loc = LOC[lang].toLowerCase();
  const norm = (v) => v.lang.replace("_", "-").toLowerCase();
  return voices.find((v) => norm(v) === loc && v.localService) || voices.find((v) => norm(v) === loc) || voices.find((v) => norm(v).startsWith(lang)) || null;
}
export function browserVoiceName(lang) {
  return "speechSynthesis" in window ? pickVoice(lang)?.name || "" : null;
}

const escapeXml = (t) => t.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]);

async function azureAudio(text, lang) {
  const voice = lang === "ja" ? cfg.voiceJa : cfg.voiceEn;
  const rate = cfg.slow ? "-20%" : "0%";
  const key = `${voice}|${rate}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const SDK = await loadSdk();
  const sc = speechConfig(SDK);
  sc.speechSynthesisOutputFormat = SDK.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3;
  const synth = new SDK.SpeechSynthesizer(sc, null); // null: 직접 재생하지 않고 오디오 데이터만 받는다
  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${LOC[lang]}"><voice name="${voice}"><prosody rate="${rate}">${escapeXml(text)}</prosody></voice></speak>`;
  const data = await new Promise((resolve, reject) => {
    synth.speakSsmlAsync(
      ssml,
      (r) => {
        synth.close();
        if (r.reason === SDK.ResultReason.SynthesizingAudioCompleted) resolve(r.audioData);
        else reject(new SpeechError("azure", azureMessage(SDK.CancellationDetails.fromResult(r)?.errorDetails)));
      },
      (err) => {
        synth.close();
        reject(new SpeechError("azure", azureMessage(String(err))));
      }
    );
  });
  const buf = await audioCtx().decodeAudioData(data.slice(0));
  if (audioCache.size > 150) audioCache.delete(audioCache.keys().next().value);
  audioCache.set(key, buf);
  return buf;
}

function browserSpeak(text, lang) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const go = () => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOC[lang];
    u.rate = (lang === "ja" ? 0.9 : 0.95) * (cfg.slow ? 0.8 : 1);
    const v = pickVoice(lang);
    if (v) u.voice = v;
    synth.speak(u);
    if (synth.paused) synth.resume();
  };
  // Chrome은 cancel 직후 바로 speak하면 소리를 버리는 경우가 있어서 잠깐 쉬었다가 읽는다.
  if (synth.speaking || synth.pending) {
    synth.cancel();
    setTimeout(go, 120);
  } else go();
}

export const canSpeak = () => hasAzure() || "speechSynthesis" in window;

export function stopSpeaking() {
  stopAudio();
  try { speechSynthesis.cancel(); } catch {}
}

export async function speak(text, lang) {
  if (!text) return;
  stopAudio();
  if (hasAzure()) {
    try { speechSynthesis.cancel(); } catch {}
    try {
      const buf = await azureAudio(text, lang);
      const c = audioCtx();
      if (c.state === "suspended") await c.resume();
      const src = c.createBufferSource();
      src.buffer = buf;
      src.connect(c.destination);
      src.start();
      current = src;
      return;
    } catch (e) {
      console.warn("Azure TTS failed, using browser voice", e);
    }
  }
  try { browserSpeak(text, lang); } catch {}
}

/* ───────── 말하기 인식 + 발음 평가 ───────── */

const BrowserSR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => hasAzure() || Boolean(BrowserSR);
export const canScore = () => hasAzure();

function azureMessage(detail = "") {
  if (/401|1006|Unauthorized|authentication|subscription/i.test(detail)) return "Azure 키나 지역이 맞지 않아요. 설정을 확인해 주세요.";
  if (/quota|429|Too many/i.test(detail)) return "Azure 무료 사용량을 다 썼어요. 다음 달에 다시 채워져요.";
  if (/microphone|NotAllowed|Permission/i.test(detail)) return "마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요.";
  return "Azure 음성 서비스 오류가 났어요. 잠시 후 다시 시도해 주세요.";
}

/**
 * 한 문장을 듣고 글자로 바꾼다. reference를 주면 그 문장 기준으로 발음 점수도 매긴다.
 * 돌려주는 값: { text, score? }  score = { pron, accuracy, fluency, completeness, words:[{w, s, err}] }
 */
export async function listen(lang, { reference, onPartial, signal } = {}) {
  if (hasAzure()) return azureListen(lang, { reference, onPartial, signal });
  if (BrowserSR) return browserListen(lang, { onPartial, signal });
  throw new SpeechError("unsupported", "이 브라우저는 음성 인식을 지원하지 않아요. 설정에서 Azure 키를 넣으면 쓸 수 있어요.");
}

async function azureListen(lang, { reference, onPartial, signal }) {
  const SDK = await loadSdk();
  const sc = speechConfig(SDK);
  sc.speechRecognitionLanguage = LOC[lang];
  const rec = new SDK.SpeechRecognizer(sc, SDK.AudioConfig.fromDefaultMicrophoneInput());
  if (reference) {
    const pa = new SDK.PronunciationAssessmentConfig(
      reference,
      SDK.PronunciationAssessmentGradingSystem.HundredMark,
      SDK.PronunciationAssessmentGranularity.Word,
      true
    );
    pa.applyTo(rec);
  }
  rec.recognizing = (_s, e) => onPartial?.(e.result.text);
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn) => {
      if (done) return;
      done = true;
      try { rec.close(); } catch {}
      fn();
    };
    signal?.addEventListener("abort", () => finish(() => reject(new SpeechError("cancelled"))));
    rec.recognizeOnceAsync(
      (r) =>
        finish(() => {
          if (r.reason === SDK.ResultReason.RecognizedSpeech) {
            const out = { text: r.text };
            if (reference) {
              try {
                const pa = SDK.PronunciationAssessmentResult.fromResult(r);
                out.score = {
                  pron: Math.round(pa.pronunciationScore ?? 0),
                  accuracy: Math.round(pa.accuracyScore ?? 0),
                  fluency: Math.round(pa.fluencyScore ?? 0),
                  completeness: Math.round(pa.completenessScore ?? 0),
                  words: (pa.detailResult?.Words || []).map((w) => ({
                    w: w.Word,
                    s: Math.round(w.PronunciationAssessment?.AccuracyScore ?? 0),
                    err: w.PronunciationAssessment?.ErrorType || "None",
                  })),
                };
              } catch (e) {
                console.warn("pronunciation result parse failed", e);
              }
            }
            resolve(out);
          } else if (r.reason === SDK.ResultReason.NoMatch) {
            reject(new SpeechError("nomatch", "말소리를 알아듣지 못했어요. 조금 더 크게 말해 보세요."));
          } else {
            const d = SDK.CancellationDetails.fromResult(r);
            reject(new SpeechError("azure", azureMessage(d?.errorDetails)));
          }
        }),
      (err) => finish(() => reject(new SpeechError("azure", azureMessage(String(err)))))
    );
  });
}

function browserListen(lang, { onPartial, signal }) {
  return new Promise((resolve, reject) => {
    const r = new BrowserSR();
    r.lang = LOC[lang];
    r.interimResults = true;
    r.maxAlternatives = 1;
    let text = "";
    let failed = false;
    r.onresult = (e) => {
      text = Array.from(e.results).map((x) => x[0].transcript).join("");
      onPartial?.(text);
    };
    r.onerror = (e) => {
      failed = true;
      if (e.error === "aborted") reject(new SpeechError("cancelled"));
      else if (e.error === "not-allowed" || e.error === "service-not-allowed") reject(new SpeechError("permission", "마이크 권한이 필요해요. 브라우저 설정에서 마이크를 허용해 주세요."));
      else if (e.error === "no-speech") reject(new SpeechError("nomatch", "말소리가 들리지 않았어요. 다시 시도해 주세요."));
      else reject(new SpeechError("browser", "음성 인식에 실패했어요. 다시 시도해 주세요."));
    };
    r.onend = () => {
      if (failed) return;
      if (text.trim()) resolve({ text: text.trim() });
      else reject(new SpeechError("nomatch", "말소리가 들리지 않았어요. 다시 시도해 주세요."));
    };
    signal?.addEventListener("abort", () => { try { r.abort(); } catch {} });
    r.start();
  });
}

// Azure 없이 따라 말하기를 할 때 쓰는 대략적인 일치율 (글자 단위 편집 거리)
export function roughMatch(said, target, lang) {
  const norm = (s) =>
    lang === "en"
      ? s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").replace(/\s+/g, " ").trim()
      : s.replace(/[\s、。！？!?,.「」『』・ー〜]/g, "");
  const a = norm(said), b = norm(target);
  if (!a || !b) return 0;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return Math.max(0, Math.round((1 - dp[a.length][b.length] / Math.max(a.length, b.length)) * 100));
}

export async function testVoice(lang) {
  if (!hasAzure()) throw new SpeechError("no_key", "Azure 키와 지역을 먼저 넣어 주세요.");
  audioCache.clear();
  const buf = await azureAudio(lang === "ja" ? "こんにちは。今日も一緒に練習しましょう。" : "Hi there! Let's practice together today.", lang);
  stopAudio();
  try { speechSynthesis.cancel(); } catch {}
  const c = audioCtx();
  if (c.state === "suspended") await c.resume();
  const src = c.createBufferSource();
  src.buffer = buf;
  src.connect(c.destination);
  src.start();
  current = src;
}

export function clearAudioCache() {
  audioCache.clear();
}
