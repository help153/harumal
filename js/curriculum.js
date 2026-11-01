// 회화 단계(1~6). 단계마다 주제별(일상 · 가족 · 집 · 가벼운 대화 · 사업) 핵심 표현과 AI 대화 장면을 정한다.
// 단계 안에는 난이도 3칸이 있고, 매일 보는 '오늘의 시험' 점수로 한 칸씩 오르내린다.
import { LIFE } from "./life.js";

const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i));

export const TOPICS = ["일상", "가족", "집", "대화", "사업"];
export const TOPIC_KO = { 일상: "일상", 가족: "가족", 집: "집", 대화: "가벼운 대화", 사업: "사업" };

// 기존 표현(일상 · 사업)의 단계와 주제. 생활 표현(life.js)은 행마다 단계와 주제가 들어 있다.
const BASE_TOPICS = {
  ja: {
    1: { 일상: ["jp21", "jp18", "jp17", "jp20"], 사업: ["jp13", "jp22"] },
    2: { 일상: range("jp", 0, 6), 사업: ["jp23", "jp24", "jp55"] },
    3: { 일상: ["jp19"], 대화: range("jp", 7, 11), 사업: ["jp12", "jp33"] },
    4: { 사업: ["jp14", "jp15", "jp16", "jp34", "jp52", "jp26", "jp27"] },
    5: { 사업: ["jp25", "jp30", "jp31", "jp32", "jp36", "jp37", "jp38", "jp39", "jp50", "jp51", "jp53", "jp56", "jp57"] },
    6: { 사업: ["jp28", "jp29", "jp35", ...range("jp", 40, 49), "jp54"] },
  },
  en: {
    1: { 일상: range("ed", 0, 7), 대화: ["ed16", "ed17"], 사업: ["bs49", "bs63", "bs57"] },
    2: { 일상: range("ed", 8, 15), 대화: ["ed19", "ed18"], 사업: ["bs48", "bs55", "bs67"] },
    3: { 일상: ["ed20", "ed21", "ed26", "ed27"], 대화: range("ed", 22, 25), 사업: ["bs53", "bs60", "bs62"] },
    4: { 사업: ["bs50", "bs51", "bs52", "bs54", "bs56", "bs58", "bs59", "bs61", "bs64", "bs65", "bs66"] },
    5: { 사업: range("bs", 25, 47) },
    6: { 사업: range("bs", 0, 24) },
  },
};

const LEVELS = {
  ja: [
    { lv: 1, band: "입문", name: "인사 · 집에서 쓰는 한마디", goal: "아침·저녁 인사, 집에서 나가고 들어올 때 하는 말, 짧은 맞장구를 바로 말한다",
      scene: "You are a friendly Japanese neighbor and coworker. Chat in very short, polite sentences: morning and evening greetings, いってきます/ただいま style home phrases, and simple reactions like そうですね or いいですね. Give the learner chances to answer with short set phrases." },
    { lv: 2, band: "초급", name: "가족 소개 · 가게 · 집안 생활", goal: "가족을 소개하고, 가게에서 주문·계산하고, 집에서 아이에게 짧게 말한다",
      scene: "You are a staff member at a family restaurant in Tokyo who is friendly with customers. The learner comes with their family: ask how many people, take the order, and chat a little about their family and where they are from. Polite, short sentences." },
    { lv: 3, band: "초급", name: "가벼운 대화 · 주말 · 아이 이야기", goal: "날씨·주말·취미·아이 이야기로 편하게 대화한다",
      scene: "You are the learner's Japanese friend, also a parent. Speak casually (タメ口). Talk about the weather, what you both did on the weekend, hobbies and your kids' school. React with それな or まじで, and make plans to meet again." },
    { lv: 4, band: "중급", name: "회사 생활 · 집안일 · 가족 계획", goal: "사무실 확인·사과, 재택근무, 집안일 부탁, 가족 여행 계획을 말한다",
      scene: "You are the learner's Japanese team leader. At the office, ask them to check something and accept an apology for a late reply. Then chat about working from home, chores and a family trip they are planning. Polite workplace Japanese." },
    { lv: 5, band: "중급", name: "비즈니스 인사 · 전화 · 근황 대화", goal: "거래처와 첫인사·전화·메일 표현을 쓰고, 가족·건강 근황을 나눈다",
      scene: "You are a sales manager at a Japanese food company meeting the learner (a Korean business owner). Exchange business cards, talk about a phone message and email, and in between have friendly small talk about family, children, health and Japanese food. Polite business Japanese." },
    { lv: 6, band: "중상급", name: "회의 · 거래 · 협상 · 의견 나누기", goal: "견적·가격·납기·결제를 협상하고, 자기 의견과 생활 이야기를 자연스럽게 섞는다",
      scene: "You are a purchasing manager at a Japanese importer meeting the learner, a Korean supplier, over dinner. Discuss a quotation, price, lead time and payment terms, sometimes saying 検討します or ちょっと難しいかもしれません. Also share opinions about work-life balance and family. Business Japanese." },
  ],
  en: [
    { lv: 1, band: "입문", name: "일상 반응 · 집에서 한마디", goal: "짧은 반응과 집에서 쓰는 인사를 바로 말한다",
      scene: "You are a friendly English-speaking neighbor and colleague. Ask simple questions about the learner's day and family so they can answer with short reactions like \"Sounds good\", \"No worries\", \"I'm home!\"." },
    { lv: 2, band: "초급", name: "가게 · 식당 · 가족 소개", goal: "주문·계산을 하고, 가족을 소개하고, 집에서 간단히 부탁한다",
      scene: "You are a server at a family restaurant in New York. The learner comes in with their family. Seat them, take the order, chat a little about their kids, and handle the check. Short, natural English." },
    { lv: 3, band: "초급", name: "스몰톡 · 주말 · 집 생활", goal: "주말·취미·가족 이야기를 하고, 못 들었을 때 되물을 수 있다",
      scene: "You are an overseas business acquaintance who is also a parent, meeting the learner at a hotel lobby. Make small talk about the weekend, hobbies, kids and working from home. Sometimes speak a bit fast so the learner has to ask you to repeat." },
    { lv: 4, band: "중급", name: "메신저 소통 · 집안일 · 가족 계획", goal: "거래처와 메신저로 짧게 주고받고, 집안일·가족 일정을 말한다",
      scene: "You are an overseas supplier and friend chatting with the learner on WhatsApp. Mix quick work updates (order, photo, call) with personal chat about family trips, picking up the kids and chores. Keep each message to one or two short lines." },
    { lv: 5, band: "중급", name: "이메일 · 회의 · 근황", goal: "메일 표현과 회의·일정 조율을 하고, 가족·일 이야기로 관계를 쌓는다",
      scene: "You are a business partner in a video meeting with the learner. Start with small talk about family and work-life balance, then schedule a follow-up, go over a proposal and agree on next steps to confirm by email. Professional but friendly English." },
    { lv: 6, band: "중상급", name: "무역 · 협상 · 의견 나누기", goal: "가격·MOQ·결제·선적·클레임을 협상하고, 자기 의견을 부드럽게 말한다",
      scene: "You are a purchasing manager at an overseas importer having dinner with the learner, a Korean supplier. Discuss MOQ, unit price, payment terms, lead time and a past quality issue, and also share opinions about family, housing and lifestyle. Be polite but firm." },
  ],
};

// 단계별 주제 → 표현 id
function build(lang) {
  return LEVELS[lang].map((L) => {
    const topics = {};
    for (const t of TOPICS) {
      topics[t] = [...(BASE_TOPICS[lang][L.lv][t] || []), ...LIFE[lang].filter((x) => x.lv === L.lv && x.topic === t).map((x) => x.id)];
      if (!topics[t].length) delete topics[t];
    }
    return { ...L, topics, ids: Object.values(topics).flat() };
  });
}
export const CURRICULUM = { ja: build("ja"), en: build("en") };

const TOPIC_OF = { ja: {}, en: {} };
for (const lang of ["ja", "en"]) for (const L of CURRICULUM[lang]) for (const [t, ids] of Object.entries(L.topics)) for (const id of ids) TOPIC_OF[lang][id] = t;
export const topicOf = (lang, id) => TOPIC_OF[lang][id] || "일상";

export const MAX_LEVEL = 6;
export const SUBS = 3; // 단계마다 난이도 3칸
export const levelOf = (lang, lv) => CURRICULUM[lang].find((x) => x.lv === lv) || CURRICULUM[lang][0];
