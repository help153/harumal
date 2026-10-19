// Claude API 호출. 서버 없이 브라우저에서 바로 부르고, API 키는 이 기기에만 저장된다.
// SDK는 처음 쓸 때 CDN에서 불러온다 (오프라인에서도 앱의 나머지는 동작하도록).

const SDK_URL = "https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.129.0/+esm";

export const MODELS = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", note: "교정이 가장 정확해요 (기본값)" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", note: "빠르고 정확도도 좋아요" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", note: "가장 빠르고 저렴해요" },
];

// 안전 분류기가 거절하면 서버가 다른 모델로 다시 실행해 주는 기능 (Opus·Sonnet만 지원)
const SERVER_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export class AIError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

let sdkPromise = null;
let client = null;
let clientKey = null;

async function getClient(apiKey) {
  if (!apiKey) throw new AIError("no_key", "설정에서 Claude API 키를 넣어 주세요.");
  let mod;
  try {
    mod = await (sdkPromise ??= import(SDK_URL));
  } catch {
    sdkPromise = null;
    throw new AIError("network", "AI 모듈을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
  const Anthropic = mod.default;
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
    clientKey = apiKey;
  }
  return { client, Anthropic };
}

function mapError(e, Anthropic) {
  if (e instanceof AIError) return e;
  if (e?.name === "AbortError" || (Anthropic.APIUserAbortError && e instanceof Anthropic.APIUserAbortError)) return new AIError("cancelled");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new AIError("auth", "API 키가 맞지 않아요. 설정에서 키를 확인해 주세요.");
  if (e instanceof Anthropic.RateLimitError) return new AIError("rate", "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.");
  if (e instanceof Anthropic.BadRequestError) {
    const msg = e?.error?.error?.message || e.message || "";
    if (/credit|balance|billing/i.test(msg)) return new AIError("billing", "API 크레딧이 부족해요. Anthropic 콘솔에서 결제 상태를 확인해 주세요.");
    return new AIError("bad_request", "요청이 거절됐어요: " + msg);
  }
  if (e instanceof Anthropic.APIConnectionError) return new AIError("network", "인터넷 연결이 끊겼어요. 다시 시도해 주세요.");
  if (e instanceof Anthropic.APIError) return new AIError("server", `Claude 서버가 바빠요 (${e.status ?? "오류"}). 잠시 후 다시 시도해 주세요.`);
  return new AIError("unknown", "알 수 없는 오류가 났어요. 다시 시도해 주세요.");
}

/**
 * Claude에게 JSON 스키마에 맞는 답을 받는다.
 * messages는 user로 시작해서 user로 끝나야 한다.
 */
export async function askJSON({ apiKey, model, system, messages, schema, effort = "low", maxTokens = 8000, signal }) {
  const { client, Anthropic } = await getClient(apiKey);
  const params = {
    model,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { effort, format: { type: "json_schema", schema } },
  };
  let res;
  try {
    res = SERVER_FALLBACK.has(model)
      ? await client.beta.messages.create({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }, { signal })
      : await client.messages.create(params, { signal });
  } catch (e) {
    throw mapError(e, Anthropic);
  }
  if (res.stop_reason === "refusal") throw new AIError("refused", "이 내용에는 답할 수 없대요. 다르게 써 보세요.");
  if (res.stop_reason === "max_tokens") throw new AIError("truncated", "답이 너무 길어서 잘렸어요. 다시 시도해 주세요.");
  const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  try {
    return JSON.parse(text);
  } catch {
    throw new AIError("invalid_json", "AI 답변 형식이 어긋났어요. 다시 시도해 주세요.");
  }
}

export async function testConnection(apiKey, model) {
  const r = await askJSON({
    apiKey,
    model,
    system: "You check that an API connection works.",
    messages: [{ role: "user", content: "Reply with ok set to true." }],
    schema: { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false },
    maxTokens: 2000,
  });
  return r.ok === true;
}

/* ───────── 회화 ───────── */

export const CHAT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    reading: { type: "string" },
    ko: { type: "string" },
    feedback: {
      type: "object",
      properties: {
        fixed: { type: "string" },
        reading: { type: "string" },
        ko: { type: "string" },
        why: { type: "string" },
      },
      required: ["fixed", "reading", "ko", "why"],
      additionalProperties: false,
    },
    hints: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "reading", "ko", "feedback", "hints"],
  additionalProperties: false,
};

export function chatSystem({ langName, isJa, scenario, level }) {
  return `You are a conversation partner helping a Korean native speaker practice spoken ${langName}.

Scenario: ${scenario}
Learner level: ${level}.

How to reply:
- Stay in character. "reply" is ${langName} only: 1-2 short, natural spoken sentences at the learner's level${isJa ? ", in polite です/ます form unless the scenario says the speakers are friends" : ""}. Usually end with something the learner can answer, so the conversation keeps going.
- "reading": ${isJa ? "the reply written entirely in hiragana and katakana" : "an empty string"}.
- "ko": a natural Korean translation of the reply.
- "feedback": look at the learner's latest message. The learner's messages often come from speech recognition, so ignore punctuation, spacing and obvious transcription slips.
  - If it has a real mistake or sounds unnatural, set "fixed" to a natural ${langName} version, ${isJa ? '"reading" to fixed in hiragana, ' : '"reading" to "", '}"ko" to its Korean meaning, and "why" to one or two short Korean sentences explaining the point.
  - If the learner wrote Korean (or mixed Korean in), set "fixed" to the natural ${langName} way to say it, explain briefly in Korean in "why", and reply as if they had said it.
  - If the message is already natural, or there is no learner message yet, set every feedback field to "".
- "hints": 2-3 short things the learner could say next, in ${langName}, at their level.`;
}

/* ───────── 퀴즈 항목 자세히 설명 ───────── */

export function explainRequest(lang, kindLabel, it) {
  const isJa = lang === "ja";
  const L = isJa ? "Japanese" : "English";
  const item = [`${L} ${kindLabel === "숙어" ? "idiom / set phrase" : "word"}: ${it.w}`, it.r ? `reading: ${it.r}` : "", `Korean meaning given in the app: ${it.m}`, it.ex ? `example from the app: ${it.ex} (${it.exk || ""})` : ""].filter(Boolean).join("\n");
  const ex = { type: "object", properties: { t: { type: "string" }, r: { type: "string" }, ko: { type: "string" } }, required: ["t", "r", "ko"], additionalProperties: false };
  const rel = { type: "object", properties: { w: { type: "string" }, r: { type: "string" }, m: { type: "string" } }, required: ["w", "r", "m"], additionalProperties: false };
  return {
    system: `You are a friendly ${L} tutor for a Korean native speaker${isJa ? " who is a beginner (JLPT N5-N4)" : ""}. Write all explanations in natural, plain Korean. Be accurate and concise.`,
    prompt: `Explain this item so the learner really understands it.

${item}

Fields:
- nuance: what it means and how it feels, in 1-2 short Korean sentences (mention politeness or casualness if it matters).
- usage: when and how people actually use it, in 1-2 short Korean sentences (common patterns, things to avoid).
- examples: 2 more short, natural example sentences in ${L}${isJa ? " using only beginner grammar" : ""}. t = the sentence, r = ${isJa ? "the sentence in hiragana" : '""'}, ko = Korean translation.
- related: up to 3 ${L} words or phrases that are similar or easy to confuse with it. w = the word, r = ${isJa ? "reading in hiragana" : '""'}, m = short Korean meaning and how it differs.`,
    schema: {
      type: "object",
      properties: { nuance: { type: "string" }, usage: { type: "string" }, examples: { type: "array", items: ex }, related: { type: "array", items: rel } },
      required: ["nuance", "usage", "examples", "related"],
      additionalProperties: false,
    },
  };
}

/* ───────── 콘텐츠 생성 ───────── */

const str = { type: "string" };
function listSchema(item) {
  return { type: "object", properties: { items: { type: "array", items: item } }, required: ["items"], additionalProperties: false };
}
function obj(props) {
  return { type: "object", properties: Object.fromEntries(props.map((p) => [p, p === "tk" || p === "x" ? { type: "array", items: str } : str])), required: props, additionalProperties: false };
}

export function generationRequest(kind, lang, topic, known) {
  const isJa = lang === "ja";
  const L = isJa ? "Japanese" : "English";
  const avoid = known.length ? `\nDo not repeat any of these: ${known.join(" / ")}` : "";
  const t = topic || "everyday life";
  if (kind === "vocab") {
    return {
      schema: listSchema(obj(isJa ? ["w", "r", "m", "ex", "exr", "exk"] : ["w", "m", "ex", "exk"])),
      prompt: isJa
        ? `Create 8 easy Japanese vocabulary items for a Korean native speaker who is a beginner (JLPT N5 level, at most easy N4) about the topic: "${t}". Prefer short, very common words people use in daily conversation. Example sentences must be short and simple, in polite です/ます form, using only beginner grammar and vocabulary.
Fields: w = the word as normally written (kanji if common), r = reading in hiragana, m = short Korean meaning, ex = a short natural example sentence, exr = the example in hiragana, exk = Korean translation of the example.${avoid}`
        : `Create 8 useful English words or phrasal verbs for a Korean native speaker (intermediate) about the topic: "${t}". Prefer words people use in real daily conversation.
Fields: w = the word or phrase, m = short Korean meaning, ex = a short natural example sentence, exk = Korean translation of the example.${avoid}`,
    };
  }
  if (kind === "expr") {
    return {
      schema: listSchema(obj(isJa ? ["t", "r", "ko", "sit", "note"] : ["t", "ko", "sit", "note"])),
      prompt: `Create 6 natural, frequently used everyday ${L} expressions for a Korean native speaker about the situation: "${t}". Use real spoken phrases people actually say, not textbook sentences.${isJa ? " Keep them short and easy enough for a beginner (JLPT N5-N4)." : ""}
Fields: t = the ${L} expression,${isJa ? " r = reading in hiragana," : ""} ko = the natural Korean equivalent, sit = a situation label in Korean (2-6 characters), note = one short usage tip in Korean, or "".${avoid}`,
    };
  }
  // idiom
  return {
    schema: listSchema(obj(isJa ? ["w", "r", "m", "ex", "exr", "exk"] : ["w", "m", "ex", "exk"])),
    prompt: isJa
      ? `Create 6 easy Japanese set phrases for a beginner Korean learner (JLPT N5-N4) that relate to: "${t}". Prefer everyday collocations like お腹がすく, 風邪をひく, 写真を撮る and only the most common, easy 慣用句 like 気をつける. No literary proverbs or rare idioms. Example sentences must be short and simple, using only beginner grammar.
Fields: w = the idiom as normally written, r = reading in hiragana, m = its meaning in short natural Korean (use a matching Korean idiom when one exists), ex = a short natural example sentence, exr = the example in hiragana, exk = Korean translation of the example.${avoid}`
      : `Create 6 common English idioms or idiomatic phrases for a Korean native speaker (intermediate) that relate to: "${t}". Choose ones native speakers really use in everyday conversation.
Fields: w = the idiom, m = its meaning in short natural Korean (use a matching Korean idiom when one exists), ex = a short natural example sentence, exk = Korean translation of the example.${avoid}`,
  };
}
