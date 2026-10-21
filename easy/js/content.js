// 하루영어 콘텐츠: 초등 아이와 집에서 쓰는 영어 (하루말 영어와 같은 데이터, ../../js/family-en.js)
// 각 항목: w = 영어, m = 한국어 뜻, ex = 예문, exk = 예문 해석

import { FAMILY } from "../../js/family-en.js";

export const KINDS = {
  life: { label: "생활영어", short: "생활", obj: "생활영어를" },
  kids: { label: "초등단어", short: "단어", obj: "초등단어를" },
  idiom: { label: "숙어", short: "숙어", obj: "숙어를" },
};

export const BASE = {
  life: FAMILY.sentences, // 일어나! 밥 먹자! 숙제 다 했어? 티비 꺼. 이제 잘 시간이야. …
  kids: FAMILY.words, // breakfast, homework, pajamas, bedtime, sleepy …
  idiom: FAMILY.phrasal, // wake up, put on, turn off, clean up, fall asleep …
};
