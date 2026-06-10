/* ============================================================
 * JourneyTab — 여정 탭: 월간 스탬프 보드 + 통계 벤토
 * Source: HANDOFF.md §3-9 (StampBoard) / §3-3 (StatCard), playbook Part 10
 *
 * 규칙:
 *  - 색·라운드·그림자는 토큰 클래스만 (hex 금지)
 *  - 다크 강조(bg-ink)는 화면당 1개 — 홈 우측의 '이번 달 흐름' 카드가
 *    이미 다크 앵커이므로 이 탭의 카드는 전부 화이트 유지
 *  - 빈 상태는 질책 없이 행동 초대 카피 (HANDOFF §1-7)
 * ============================================================ */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Stamp } from '../stamp/Stamp';
import { computeMonthlyStamps } from './stamps';

export default function JourneyTab({ entries, reflections, monthTotal, fmtAmt }) {
  const { t, i18n } = useTranslation();
  const now = new Date();
  const monthLabel = (() => {
    try {
      return new Date(now.getFullYear(), now.getMonth(), 1)
        .toLocaleString(i18n.language || 'ko', { month: 'long' });
    } catch {
      return `${now.getMonth() + 1}`;
    }
  })();

  const { stamps, stats } = useMemo(
    () => computeMonthlyStamps(entries, reflections, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [entries, reflections],
  );

  const captions = {
    start: t('ledger.journey.stamps.start', { defaultValue: '출발 도장' }),
    streak7: t('ledger.journey.stamps.streak7', { defaultValue: '7일 연속' }),
    streak14: t('ledger.journey.stamps.streak14', { defaultValue: '14일 연속' }),
    steady20: t('ledger.journey.stamps.steady20', { defaultValue: '꾸준함 20' }),
    saving1: t('ledger.journey.stamps.saving1', { defaultValue: '첫 아낌' }),
    saving5: t('ledger.journey.stamps.saving5', { defaultValue: '아낌 5회' }),
    forward: t('ledger.journey.stamps.forward', { defaultValue: '전진 도장' }),
    review: t('ledger.journey.stamps.review', { defaultValue: '돌아보기' }),
    hidden: '???',
  };

  const onHiddenTap = () => {
    toast(t('ledger.journey.hiddenHint', { defaultValue: '아침 해보다 부지런한 사람에게.' }), {
      icon: null,
    });
  };

  return (
    <div className="space-y-4 animate-fade-up">
      {/* ===== 통계 벤토 ===== */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface rounded-card shadow-soft p-4">
          <div className="text-xs font-caption text-ink-tertiary">
            {t('ledger.journey.statRecordedDays', { defaultValue: '이번 달 기록' })}
          </div>
          <div className="text-[22px] font-display text-ink">
            {stats.distinctDays}
            <span className="text-sm font-medium text-ink-tertiary ml-0.5">
              {t('ledger.journey.daysUnit', { defaultValue: '일' })}
            </span>
          </div>
        </div>
        <div className="bg-surface rounded-card shadow-soft p-4">
          <div className="text-xs font-caption text-ink-tertiary">
            {t('ledger.journey.statStreak', { defaultValue: '연속 기록' })}
          </div>
          <div className="text-[22px] font-display text-record">
            {stats.currentStreak}
            <span className="text-sm font-medium text-ink-tertiary ml-0.5">
              {t('ledger.journey.streakUnit', { defaultValue: '일째' })}
            </span>
          </div>
        </div>
        <div className="bg-surface rounded-card shadow-soft p-4">
          <div className="text-xs font-caption text-ink-tertiary">
            {t('ledger.journey.statSpent', { defaultValue: '이번 달 지출' })}
          </div>
          <div className="text-[22px] font-display text-ink truncate">{fmtAmt(monthTotal)}</div>
        </div>
        <div className="bg-surface rounded-card shadow-soft p-4">
          <div className="text-xs font-caption text-ink-tertiary">
            {t('ledger.journey.statBoard', { defaultValue: '스탬프 보드' })}
          </div>
          <div className="text-[22px] font-display text-journey">
            {stats.earnedCount}
            <span className="text-sm font-medium text-ink-tertiary ml-0.5">/ {stats.totalSlots}</span>
          </div>
        </div>
      </div>

      {/* ===== 월간 스탬프 보드 (히어로 벤토) ===== */}
      <div className="bg-surface rounded-card-lg shadow-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-ink">
            {t('ledger.journey.boardTitle', { month: monthLabel, defaultValue: '{{month}} 스탬프 보드' })}
          </h3>
          <span className="bg-sunken rounded-pill px-3 py-1 text-xs font-semibold text-ink-secondary tabular-nums">
            {stats.earnedCount} / {stats.totalSlots}
          </span>
        </div>

        {stats.distinctDays === 0 && (
          <p className="text-[13px] text-ink-tertiary mb-4">
            {t('ledger.journey.emptyInvite', {
              defaultValue: '아직 한 줄도 없어요. 오늘 쓴 돈 하나만 적어볼까요?',
            })}
          </p>
        )}

        {/* 그리드는 정렬, 회전은 Stamp 내부 seed 회전만 (셀 자체 회전 금지) */}
        <div className="grid grid-cols-3 gap-y-5">
          {stamps.map((s) => {
            const caption = captions[s.key];
            const earnedLabel = s.earned
              ? t('ledger.journey.earned', { defaultValue: '획득' })
              : t('ledger.journey.notEarned', { defaultValue: '미획득' });
            const cell = (
              <div className="flex flex-col items-center gap-1.5">
                <Stamp
                  category={s.category}
                  size={68}
                  state={s.hidden ? 'earned' : s.earned ? 'earned' : 'empty'}
                  icon={s.icon}
                  seed={s.id}
                  aria-label={`${caption} (${earnedLabel})`}
                  className={s.hidden && !s.earned ? 'opacity-80' : undefined}
                />
                <span className={`text-[11px] font-semibold ${s.earned ? 'text-ink' : 'text-ink-faint'}`}>
                  {caption}
                </span>
              </div>
            );
            // 히든 슬롯: 탭하면 수수께끼 힌트 (Part 10-5)
            return s.hidden ? (
              <button key={s.id} type="button" onClick={onHiddenTap} className="min-h-touch">
                {cell}
              </button>
            ) : (
              <div key={s.id}>{cell}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
