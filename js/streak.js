// 연속 학습: 하루 목표(10문제)를 채운 날이 며칠 이어졌는지 계산한다 (하루말 · 하루영어 공용)
// days = { "2026-10-23": 오늘 푼 문제 수, ... }

export const GOAL = 10;
const pad = (n) => String(n).padStart(2, "0");
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function streakInfo(days, goal = GOAL) {
  const todayCount = days[dkey(new Date())] || 0;
  const doneToday = todayCount >= goal;
  // 오늘 아직 목표 전이면 어제까지의 연속을 보여 준다 (오늘 밤까지 이어갈 수 있음)
  const d = new Date();
  if (!doneToday) d.setDate(d.getDate() - 1);
  let current = 0;
  while ((days[dkey(d)] || 0) >= goal) { current++; d.setDate(d.getDate() - 1); }
  // 최고 기록
  let best = 0, run = 0, prev = null;
  for (const k of Object.keys(days).filter((k) => days[k] >= goal).sort()) {
    const t = new Date(k + "T12:00:00");
    run = prev && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  // 최근 7일
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const x = new Date();
    x.setDate(x.getDate() - i);
    const c = days[dkey(x)] || 0;
    week.push({ label: "일월화수목금토"[x.getDay()], done: c >= goal, today: i === 0 });
  }
  return { current, best: Math.max(best, current), todayCount, doneToday, left: Math.max(0, goal - todayCount), week, goal };
}

// 기념일 메시지
export function milestone(n) {
  return { 3: "3일 연속! 습관이 시작됐어요.", 7: "일주일 연속! 정말 대단해요.", 14: "2주 연속! 이제 습관이 됐어요.", 21: "3주 연속! 꾸준함이 실력이에요.", 30: "한 달 연속! 최고예요.", 50: "50일 연속! 놀라워요.", 100: "100일 연속! 전설이에요.", 200: "200일 연속!", 365: "1년 연속! 축하해요!" }[n] || "";
}

// 첫 화면 연속 카드 (각 앱의 el 함수와 아이콘 함수를 받아 그린다)
export function streakCard(el, flameIcon, info) {
  const pct = Math.min(100, Math.round((info.todayCount / info.goal) * 100));
  return el("div", { class: "card streak-card" + (info.doneToday ? " done" : "") },
    el("div", { class: "row between" },
      el("div", { class: "streak-big" }, flameIcon(), el("b", null, info.current), el("span", null, "일 연속")),
      el("span", { class: "small muted" }, `최고 ${info.best}일`)),
    el("div", { class: "week" }, info.week.map((w) =>
      el("div", { class: "day" + (w.done ? " on" : "") + (w.today ? " today" : "") }, el("i", null, w.done ? "✓" : ""), el("span", null, w.label)))),
    el("div", { class: "goal" },
      el("div", { class: "progress" }, el("span", { style: `width:${pct}%` })),
      el("div", { class: "small" + (info.doneToday ? " ok" : "") },
        info.doneToday
          ? `오늘 목표 달성! ${info.todayCount}문제 풀었어요. 내일도 만나요.`
          : info.todayCount === 0
            ? `오늘 ${info.goal}문제를 풀면 ${info.current + 1}일 연속이 돼요.`
            : `오늘 ${info.todayCount}/${info.goal} · ${info.left}문제만 더 풀면 ${info.current + 1}일 연속!`)));
}
