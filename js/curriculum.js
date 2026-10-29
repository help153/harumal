// 회화 중심 단계(1~6). 단계마다 그 상황에서 쓰는 핵심 표현(표현 목록의 id)과 AI 대화 장면을 정한다.
// 단계 시험에 붙으면 다음 단계로 올라간다.

const range = (prefix, from, to) => Array.from({ length: to - from + 1 }, (_, i) => prefix + (from + i));

export const CURRICULUM = {
  ja: [
    { lv: 1, band: "입문", name: "인사와 기본 반응", goal: "매일 쓰는 짧은 인사와 맞장구를 바로 말할 수 있다",
      ids: ["jp13", "jp21", "jp17", "jp18", "jp20", "jp19"],
      scene: "You are a friendly Japanese coworker meeting the learner on their first day. Use very short, polite sentences: greetings, よろしくお願いします, simple reactions like なるほど. Give the learner chances to answer with short set phrases." },
    { lv: 2, band: "초급", name: "가게 · 식당 · 길 묻기", goal: "카페·식당에서 주문하고 계산하고, 길을 물을 수 있다",
      ids: range("jp", 0, 6),
      scene: "You are a staff member at a café-restaurant near a station in Tokyo. The learner orders, asks for a recommendation, chooses eat-in or take-out, pays, and then asks you how to get to the station. Polite customer-service Japanese, short sentences." },
    { lv: 3, band: "초급", name: "친구와 일상 대화", goal: "오랜만에 만난 친구와 근황을 주고받을 수 있다",
      ids: range("jp", 7, 11),
      scene: "You are the learner's Japanese friend you haven't seen for a while. Speak casually (タメ口). Ask how they've been, react with それな or まじで, and make plans to meet again." },
    { lv: 4, band: "중급", name: "회사 생활", goal: "사무실에서 인사·확인·사과·퇴근 인사를 자연스럽게 한다",
      ids: ["jp12", "jp14", "jp15", "jp16", "jp33", "jp34", "jp52"],
      scene: "You are the learner's Japanese team leader at the office. Greet with お疲れさまです, ask them to check something, wait for answers, accept an apology for a late reply, and say goodbye at the end of the day. Polite workplace Japanese." },
    { lv: 5, band: "중급", name: "비즈니스 인사 · 메일 · 전화", goal: "거래처와 첫인사, 명함 교환, 전화 응대, 메일 표현을 쓸 수 있다",
      ids: ["jp22", "jp23", "jp24", "jp25", "jp26", "jp30", "jp31", "jp32", "jp36", "jp37", "jp38", "jp39", "jp50", "jp51"],
      scene: "You are a sales manager at a Japanese food company. First meet the learner (a Korean business owner) and exchange business cards, then switch to a phone call where the learner asks for you, you are busy, and they leave a message or promise to call back. Use polite business Japanese (です/ます, 申します, いつもお世話になっております)." },
    { lv: 6, band: "중상급", name: "회의 · 거래 · 협상", goal: "견적·가격·납기·결제 조건을 협상하고 회의를 마무리할 수 있다",
      ids: ["jp27", "jp28", "jp29", "jp35", "jp40", "jp41", "jp42", "jp43", "jp44", "jp45", "jp46", "jp47", "jp48", "jp49", "jp53", "jp54", "jp55", "jp56", "jp57"],
      scene: "You are a purchasing manager at a Japanese importer meeting the learner, a Korean supplier. Discuss a quotation, ask for a lower price, lead time, stock, payment terms and the contract. Sometimes say 検討します. End the meeting politely. Business Japanese." },
  ],
  en: [
    { lv: 1, band: "입문", name: "일상 기본 반응", goal: "대화 중 짧은 반응과 대답을 바로 할 수 있다",
      ids: range("ed", 0, 7),
      scene: "You are a friendly English-speaking colleague having a light chat. Ask simple questions and make small suggestions so the learner can answer with short reactions like \"Sounds good\", \"That makes sense\", \"Let me think about it\"." },
    { lv: 2, band: "초급", name: "카페 · 식당 · 가게", goal: "주문하고, 자리를 묻고, 계산할 수 있다",
      ids: range("ed", 8, 15),
      scene: "You are a server at a busy restaurant in New York, then a cashier. The learner asks for a table, asks for recommendations, orders, and pays. Short, natural service English." },
    { lv: 3, band: "초급", name: "스몰톡 · 약속 · 여행", goal: "근황·주말·직업 이야기를 하고, 못 들었을 때 되물을 수 있다",
      ids: range("ed", 16, 27),
      scene: "You are an overseas business acquaintance meeting the learner at a hotel lobby during a trip. Make small talk about work, the weekend and travel. Sometimes speak a bit fast so the learner has to ask you to repeat." },
    { lv: 4, band: "중급", name: "메신저(왓츠앱) 소통", goal: "거래처와 메신저로 짧고 자연스럽게 주고받을 수 있다",
      ids: range("bs", 48, 67),
      scene: "You are an overseas supplier chatting with the learner on WhatsApp. Write short, casual-professional messages: ask quick questions, send updates, ask for a call, confirm things. Keep each message to one or two short lines like real chat." },
    { lv: 5, band: "중급", name: "이메일 · 회의 · 일정", goal: "메일 표현과 회의·일정 조율을 영어로 할 수 있다",
      ids: range("bs", 25, 47),
      scene: "You are a business partner in a video meeting with the learner. Schedule a follow-up, go over a proposal, ask for clarification, and agree on next steps to confirm by email. Professional but friendly English." },
    { lv: 6, band: "중상급", name: "무역 · 협상 · 클레임", goal: "가격·MOQ·결제·선적·불량 문제를 협상할 수 있다",
      ids: range("bs", 0, 24),
      scene: "You are a purchasing manager at an overseas importer negotiating with the learner, a Korean supplier. Discuss MOQ, unit price, Incoterms, payment terms, lead time and a quality claim on a past shipment. Be polite but firm." },
  ],
};

export const MAX_LEVEL = 6;
export const levelOf = (lang, lv) => CURRICULUM[lang].find((x) => x.lv === lv) || CURRICULUM[lang][0];
