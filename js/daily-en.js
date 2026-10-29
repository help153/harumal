// 하루말 영어: 어른의 일상 회화 (기본 반응 · 식당·가게 · 스몰톡·여행)
// 행: [영어, 뜻, 예문 3개 [[영어, 한국어] x3], 상황, 팁(선택)]

const rows = [
  // 일상 반응
  ["No worries.", "괜찮아요, 신경 쓰지 마세요.", [["No worries at all.", "전혀 걱정 마세요."], ["No worries, take your time.", "괜찮아요, 천천히 하세요."], ["Sorry! — No worries.", "미안해요! — 괜찮아요."]], "일상 반응", "Thank you와 Sorry 양쪽에 다 답할 수 있어요."],
  ["That makes sense.", "이해가 되네요.", [["Okay, that makes sense.", "네, 이해가 돼요."], ["Does that make sense?", "이해되세요?"], ["That doesn't make sense to me.", "저는 이해가 안 돼요."]], "일상 반응"],
  ["Sounds good to me.", "저는 좋아요.", [["Sounds good!", "좋아요!"], ["That sounds great.", "그거 정말 좋네요."], ["Friday at 3 sounds good.", "금요일 3시 좋아요."]], "일상 반응"],
  ["I'm not sure, to be honest.", "솔직히 잘 모르겠어요.", [["I'm not sure yet.", "아직 잘 모르겠어요."], ["I'm not sure I understand.", "이해한 건지 잘 모르겠어요."], ["Let me check and get back to you.", "확인하고 다시 알려 드릴게요."]], "일상 반응"],
  ["Let me think about it.", "생각해 볼게요.", [["Let me think about it and get back to you.", "생각해 보고 다시 연락드릴게요."], ["Can I think about it?", "생각 좀 해 봐도 될까요?"], ["I need some time to think.", "생각할 시간이 좀 필요해요."]], "일상 반응"],
  ["It's up to you.", "당신이 정하세요.", [["It's totally up to you.", "전적으로 당신 뜻대로 하세요."], ["The date is up to you.", "날짜는 당신이 정하세요."], ["It's not up to me.", "제가 정할 수 있는 게 아니에요."]], "일상 반응"],
  ["I'll let you know.", "알려 드릴게요.", [["I'll let you know by Friday.", "금요일까지 알려 드릴게요."], ["Let me know if you need anything.", "필요한 거 있으면 알려 주세요."], ["Please let me know your thoughts.", "의견 알려 주세요."]], "일상 반응"],
  ["Really? That's great!", "정말요? 잘됐네요!", [["Really? Congratulations!", "정말요? 축하해요!"], ["That's great news!", "좋은 소식이네요!"], ["I'm happy for you.", "잘돼서 저도 기뻐요."]], "일상 반응"],
  // 식당 · 가게
  ["Can I get a latte to go?", "라떼 포장해 주세요.", [["Can I get an iced Americano?", "아이스 아메리카노 주세요."], ["Can I get a large one?", "큰 사이즈로 주세요."], ["Can I get it to go?", "포장해 주세요."]], "식당·가게", "주문할 때는 \"Can I get ~?\"이 가장 자연스러워요."],
  ["For here or to go?", "드시고 가세요, 가져가세요?", [["For here, please.", "먹고 갈게요."], ["To go, please.", "가져갈게요."], ["Is this for here or to go?", "드시고 가세요, 가져가세요?"]], "식당·가게", "점원이 하는 말이에요."],
  ["I'm just looking, thanks.", "그냥 둘러보는 중이에요.", [["I'm just browsing.", "그냥 구경하는 중이에요."], ["I'll let you know if I need help.", "도움 필요하면 말할게요."], ["Do you have this in another color?", "이거 다른 색 있어요?"]], "식당·가게"],
  ["Could we get the check, please?", "계산서 주시겠어요?", [["Can we split the check?", "나눠서 계산할 수 있어요?"], ["I'll get the check.", "계산은 제가 할게요."], ["Is service included?", "봉사료 포함인가요?"]], "식당·가게", "영국에서는 check 대신 bill을 써요."],
  ["Is this seat taken?", "여기 자리 있어요?", [["Is anyone sitting here?", "여기 누구 앉아요?"], ["Do you mind if I sit here?", "여기 앉아도 될까요?"], ["Sorry, this seat is taken.", "죄송해요, 자리 있어요."]], "식당·가게"],
  ["Can I have a table for two?", "두 명 자리 있어요?", [["Do you have a table for four?", "네 명 자리 있나요?"], ["Can we sit by the window?", "창가에 앉을 수 있을까요?"], ["How long is the wait?", "얼마나 기다려야 해요?"]], "식당·가게"],
  ["What do you recommend?", "뭘 추천하세요?", [["What's popular here?", "여기 뭐가 인기 있어요?"], ["I'll have the same.", "저도 같은 걸로 할게요."], ["Is it spicy?", "매워요?"]], "식당·가게"],
  ["Do you take credit cards?", "카드 되나요?", [["Can I pay by card?", "카드로 계산할 수 있어요?"], ["Can I get a receipt?", "영수증 주시겠어요?"], ["Keep the change.", "잔돈은 괜찮아요."]], "식당·가게"],
  // 스몰톡 · 약속 · 여행
  ["How's it going?", "잘 지내세요? / 요즘 어때요?", [["Hey, how's it going?", "안녕하세요, 잘 지내요?"], ["How's everything going?", "다 잘되고 있어요?"], ["How's your day going?", "오늘 하루 어때요?"]], "스몰톡·여행", "\"Good, you?\" 정도로 가볍게 답해요."],
  ["Long time no see!", "오랜만이에요!", [["Long time no see! How have you been?", "오랜만이에요! 어떻게 지냈어요?"], ["It's been a while.", "오랜만이네요."], ["Good to see you again.", "다시 만나서 반가워요."]], "스몰톡·여행"],
  ["What do you do for work?", "무슨 일 하세요?", [["I run a small trading company.", "작은 무역 회사를 운영해요."], ["I'm in the food business.", "식품 사업을 해요."], ["How long have you been doing that?", "그 일은 얼마나 하셨어요?"]], "스몰톡·여행"],
  ["How was your weekend?", "주말 어떻게 보냈어요?", [["It was relaxing.", "푹 쉬었어요."], ["I went hiking with my family.", "가족이랑 등산 갔어요."], ["Did you do anything fun?", "재밌는 거 했어요?"]], "스몰톡·여행"],
  ["I'm running a bit late.", "조금 늦을 것 같아요.", [["Sorry, I'm running about ten minutes late.", "죄송해요, 10분 정도 늦을 것 같아요."], ["I'll be there in five minutes.", "5분 안에 도착해요."], ["Go ahead and start without me.", "저 없이 먼저 시작하세요."]], "스몰톡·여행"],
  ["I'm on my way.", "가는 중이에요.", [["I'm on my way to the office.", "사무실 가는 중이에요."], ["I'm on my way. See you soon.", "가는 중이에요. 곧 봐요."], ["Are you on your way?", "오는 중이에요?"]], "스몰톡·여행"],
  ["Let's catch up soon.", "조만간 만나서 얘기해요.", [["Let's catch up over lunch.", "점심 먹으면서 얘기해요."], ["It was great catching up.", "오랜만에 얘기해서 좋았어요."], ["Let's get together soon.", "조만간 만나요."]], "스몰톡·여행"],
  ["Sorry, I didn't catch that.", "죄송한데 잘 못 들었어요.", [["Sorry, I didn't catch your name.", "죄송한데 성함을 못 들었어요."], ["Could you speak a little slower?", "조금만 천천히 말해 주시겠어요?"], ["Sorry, what was that?", "죄송해요, 뭐라고 하셨죠?"]], "스몰톡·여행", "\"What?\"보다 훨씬 부드러워요."],
  ["Could you say that again?", "다시 한번 말씀해 주시겠어요?", [["Could you repeat that, please?", "한 번 더 말씀해 주시겠어요?"], ["One more time, please.", "한 번만 더요."], ["Could you spell that for me?", "철자 좀 불러 주시겠어요?"]], "스몰톡·여행"],
  ["What do you mean by that?", "그게 무슨 뜻이에요?", [["What do you mean?", "무슨 뜻이에요?"], ["Can you give me an example?", "예를 들어 주실래요?"], ["So you mean we need more time?", "그러니까 시간이 더 필요하다는 거죠?"]], "스몰톡·여행"],
  ["I'd like to check in, please.", "체크인하려고요.", [["I have a reservation under Kim.", "김으로 예약했어요."], ["What time is checkout?", "체크아웃은 몇 시예요?"], ["Is breakfast included?", "조식 포함인가요?"]], "스몰톡·여행"],
  ["Could you take me to this address?", "이 주소로 가 주시겠어요?", [["How long will it take?", "얼마나 걸려요?"], ["Please drop me off here.", "여기서 내려 주세요."], ["How much is it to the airport?", "공항까지 얼마예요?"]], "스몰톡·여행"],
];

export const DAILY_EN = rows.map(([w, m, ex, sit, note], i) => ({
  id: "ed" + i, w, r: "", m, sit, note: note || "",
  ex: ex[0][0], exk: ex[0][1],
  xs: ex.slice(1).map(([t, ko]) => ({ t, r: "", ko })),
}));
