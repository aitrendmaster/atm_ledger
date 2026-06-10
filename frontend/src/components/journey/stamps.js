/* ============================================================
 * stamps.js — 월간 스탬프 보드 획득 판정 (클라이언트 파생)
 * Source: moa365-brand-playbook.md Part 10-3 (획득 조건 테이블)
 *
 * 백엔드 영속화 전 단계: entries/reflections 서버 데이터에서 매 렌더 파생.
 * 절대 원칙 — 지출을 유도하는 획득 조건 금지 (Part 10-3).
 * 아낌(플러스 한 줄)·목적지 적립은 백엔드 기능 출시 전이므로 미획득 슬롯으로 노출.
 * ============================================================ */

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * @param {Array<{date: string}>} entries  지출 기록 (date: YYYY-MM-DD)
 * @param {Array<{month: string, type: string}>} reflections  회고 (month: YYYY-MM)
 * @param {Date} now
 * @returns {{ stamps: Array, stats: { monthKey, distinctDays, currentStreak, earnedCount, totalSlots, firstRecordDate } }}
 */
export function computeMonthlyStamps(entries, reflections, now) {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based
  const monthKey = `${y}-${pad(m + 1)}`;

  const daysWithEntry = new Set(entries.map((e) => e.date));
  const monthDays = [...daysWithEntry].filter((d) => d.startsWith(monthKey)).sort();
  const distinctDays = monthDays.length;
  const firstRecordDate = monthDays[0] || null;

  // 현재 연속 기록 — 오늘(미기록이면 어제)부터 거꾸로 센다. 월 경계 무관 (Part 10-4 §3).
  let currentStreak = 0;
  {
    const probe = new Date(now);
    if (!daysWithEntry.has(fmtDate(probe))) probe.setDate(probe.getDate() - 1);
    while (daysWithEntry.has(fmtDate(probe))) {
      currentStreak += 1;
      probe.setDate(probe.getDate() - 1);
    }
  }

  // 이번 달에 닿은 최장 연속 — 전월 진입분 포함, 연속 구간이 이번 달 하루라도 포함하면 인정.
  let maxRunThisMonth = 0;
  {
    let run = 0;
    let runTouchesMonth = false;
    const cursor = new Date(y, m - 1, 1); // 전월 1일부터 스캔
    const end = new Date(now);
    while (cursor <= end) {
      if (daysWithEntry.has(fmtDate(cursor))) {
        run += 1;
        if (cursor.getMonth() === m && cursor.getFullYear() === y) runTouchesMonth = true;
        if (runTouchesMonth) maxRunThisMonth = Math.max(maxRunThisMonth, run);
      } else {
        run = 0;
        runTouchesMonth = false;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // 돌아보기 — 이번 달 회고 작성(월간 리뷰 행동) 여부
  const reviewed = reflections.some((r) => r.month === monthKey);

  const firstDay = firstRecordDate ? Number(firstRecordDate.slice(8, 10)) : null;

  /* 정규 8칸 + 히든 1칸 (Part 10-3). icon 은 Stamp 중앙 짧은 텍스트. */
  const stamps = [
    {
      id: `${monthKey}-start`, key: 'start', category: 'destination',
      earned: distinctDays > 0,
      icon: firstDay ? `${m + 1}.${firstDay}` : '!',
    },
    { id: `${monthKey}-streak7`, key: 'streak7', category: 'record', earned: maxRunThisMonth >= 7, icon: '7' },
    { id: `${monthKey}-streak14`, key: 'streak14', category: 'record', earned: maxRunThisMonth >= 14, icon: '14' },
    { id: `${monthKey}-steady20`, key: 'steady20', category: 'record', earned: distinctDays >= 20, icon: '20' },
    // 아낌(플러스 한 줄) — 백엔드 기능 출시 전: 항상 미획득 슬롯
    { id: `${monthKey}-saving1`, key: 'saving1', category: 'saving', earned: false, icon: '₩' },
    { id: `${monthKey}-saving5`, key: 'saving5', category: 'saving', earned: false, icon: '×5' },
    // 목적지 적립/마일스톤 — 목적지 기능 출시 전: 항상 미획득 슬롯
    { id: `${monthKey}-forward`, key: 'forward', category: 'destination', earned: false, icon: '→' },
    { id: `${monthKey}-review`, key: 'review', category: 'review', earned: reviewed, icon: '✓' },
    // 히든 — 조건 비공개, 미획득이어도 티켓 형태 + "???" 노출 (HANDOFF 3-9)
    { id: `${monthKey}-hidden`, key: 'hidden', category: 'hidden', earned: false, icon: '?', hidden: true },
  ];

  const earnedCount = stamps.filter((s) => s.earned).length;

  return {
    stamps,
    stats: { monthKey, distinctDays, currentStreak, earnedCount, totalSlots: stamps.length, firstRecordDate },
  };
}
