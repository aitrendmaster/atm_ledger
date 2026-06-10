/* ============================================================
 * Stamp.tsx — moa365 스탬프 SVG 컴포넌트 (의존성 없음)
 * Source: moa365-brand-playbook.md Part 10-2 (Shape Language)
 *
 * 카테고리 = 고유 형태 + 고유 그라데이션:
 *  record(기록)      → 스캘럽 서클 / 오렌지
 *  saving(아낌)      → 플라워 실   / 그린
 *  destination(목적지)→ 선버스트   / 블루
 *  review(리뷰)      → 아치 윈도우 / 퍼플
 *  memorial(기념)    → 스쿼클     / 코럴 핑크
 *  hidden(히든)      → 티켓 스텁   / 다크
 *
 * 공통 규칙:
 *  - ±10° 결정적(seed 기반) 회전 → 손도장 느낌. 같은 스탬프는 항상 같은 각도.
 *  - 내부 화이트 점선 링.
 *  - state="empty"면 점선 슬롯 + "?" (모양·색 미공개).
 * ============================================================ */

import React, { useId } from 'react';

export type StampCategory =
  | 'record' | 'saving' | 'destination' | 'review' | 'memorial' | 'hidden';

export interface StampProps {
  category: StampCategory;
  /** px. 기본 68 (보드 그리드), 토스트 48, 풀스크린 모먼트 160 권장 */
  size?: number;
  /** earned = 획득(컬러 도장), empty = 미획득 점선 슬롯 */
  state?: 'earned' | 'empty';
  /** 중앙 아이콘: 짧은 텍스트("7", "₩", "×5", "6.10") 또는 SVG 노드 */
  icon?: React.ReactNode;
  /** 결정적 회전용 시드. 보통 스탬프 고유 id. 미지정 시 category 사용 */
  seed?: string;
  /** 회전 비활성화 (공유 카드 등 정렬이 필요한 곳) */
  noRotate?: boolean;
  className?: string;
  'aria-label'?: string;
}

/* ---------- 형태별 메타 ---------- */
const META: Record<StampCategory, { from: string; to: string }> = {
  record:      { from: 'var(--record-from)',   to: 'var(--record-to)' },
  saving:      { from: 'var(--saving-from)',   to: 'var(--saving-to)' },
  destination: { from: 'var(--journey-from)',  to: 'var(--journey-to)' },
  review:      { from: 'var(--insight-from)',  to: 'var(--insight-to)' },
  memorial:    { from: 'var(--memorial-from)', to: 'var(--memorial-to)' },
  hidden:      { from: 'var(--hidden-from)',   to: 'var(--hidden-to)' },
};

/* ---------- 결정적 회전: seed 해시 → -10° ~ +10° ---------- */
function seededRotation(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 2001) / 100) - 10; // -10.00 ~ +10.00
}

/* ---------- 패스 제너레이터 (viewBox 0 0 100 100, 중심 50,50) ---------- */
const C = 50;

function radialPoints(samples: number, rFn: (th: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i < samples; i++) {
    const th = (2 * Math.PI * i) / samples;
    const r = rFn(th);
    pts.push(`${(C + r * Math.cos(th)).toFixed(1)},${(C + r * Math.sin(th)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 스캘럽 서클 (기록) — 부드러운 톱니 */
const scallop = (R = 40) =>
  radialPoints(120, (th) => R * (1 + 0.075 * Math.sin(14 * th)));

/** 플라워 실 (아낌) — 꽃잎 8장 */
const flower = (R = 38) =>
  radialPoints(160, (th) => R * (1 + 0.16 * Math.cos(8 * th)));

/** 선버스트 (목적지) — 16각 폭죽 */
function sunburst(R = 40): string {
  const pts: string[] = [];
  const n = 16;
  for (let i = 0; i < 2 * n; i++) {
    const r = i % 2 === 0 ? R * 1.14 : R * 0.93;
    const th = (Math.PI * i) / n;
    pts.push(`${(C + r * Math.cos(th)).toFixed(1)},${(C + r * Math.sin(th)).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** 아치 윈도우 (리뷰) — 위 반원 + 아래 라운드 사각 */
function archPath(): string {
  const w = 64, h = 80, x0 = C - w / 2, y0 = C - h / 2, r = 8;
  return `M ${x0},${y0 + w / 2} A ${w / 2},${w / 2} 0 0 1 ${x0 + w},${y0 + w / 2}
          L ${x0 + w},${y0 + h - r} Q ${x0 + w},${y0 + h} ${x0 + w - r},${y0 + h}
          L ${x0 + r},${y0 + h} Q ${x0},${y0 + h} ${x0},${y0 + h - r} Z`;
}

/* ---------- 본체 ---------- */
export function Stamp({
  category,
  size = 68,
  state = 'earned',
  icon,
  seed,
  noRotate = false,
  className,
  'aria-label': ariaLabel,
}: StampProps) {
  const uid = useId().replace(/:/g, '');
  const gradId = `stamp-g-${uid}`;
  const rot = noRotate ? 0 : seededRotation(seed ?? category);
  const { from, to } = META[category];

  /* 미획득 슬롯: 형태·색 비공개 (점선 원 + ?) */
  if (state === 'empty') {
    return (
      <svg
        width={size} height={size} viewBox="0 0 100 100"
        role="img" aria-label={ariaLabel ?? '미획득 스탬프'}
        className={className}
      >
        <circle cx={C} cy={C} r={44} fill="var(--surface)" opacity={0.6}
                stroke="var(--line)" strokeWidth={2.5} strokeDasharray="7 6" />
        <text x={C} y={C + 7} textAnchor="middle"
              fontFamily="var(--font-sans)" fontWeight={700} fontSize={22}
              fill="var(--ink-faint)">?</text>
      </svg>
    );
  }

  /* 카테고리별 도형 + 점선 링 반경 */
  let shapeEl: React.ReactNode;
  let innerR = 30;
  switch (category) {
    case 'record':
      shapeEl = <polygon points={scallop()} fill={`url(#${gradId})`} />; break;
    case 'saving':
      shapeEl = <polygon points={flower()} fill={`url(#${gradId})`} />; innerR = 27; break;
    case 'destination':
      shapeEl = <polygon points={sunburst()} fill={`url(#${gradId})`} />; break;
    case 'review':
      shapeEl = <path d={archPath()} fill={`url(#${gradId})`} />; innerR = 25; break;
    case 'memorial':
      shapeEl = <rect x={16} y={16} width={68} height={68} rx={22} fill={`url(#${gradId})`} />;
      innerR = 27; break;
    case 'hidden':
      shapeEl = (
        <g>
          <mask id={`m-${uid}`}>
            <rect x={5} y={22} width={90} height={56} rx={10} fill="#fff" />
            <circle cx={5} cy={C} r={7} fill="#000" />
            <circle cx={95} cy={C} r={7} fill="#000" />
          </mask>
          <rect x={5} y={22} width={90} height={56} rx={10}
                fill={`url(#${gradId})`} mask={`url(#m-${uid})`} />
          <line x1={72} y1={28} x2={72} y2={72}
                stroke="var(--bg-base)" strokeWidth={2} strokeDasharray="4 4" />
        </g>
      );
      innerR = 22; break;
  }

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      role="img" aria-label={ariaLabel ?? `${category} 스탬프`}
      className={className}
      style={{ ['--stamp-rot' as string]: `${rot}deg`, transform: `rotate(${rot}deg)` }}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      {shapeEl}
      {/* 공통 내부 점선 링 */}
      <circle cx={C} cy={C} r={innerR} fill="none"
              stroke="#FFFFFF" strokeWidth={2} strokeDasharray="4 4" opacity={0.85} />
      {/* 중앙 아이콘 */}
      {typeof icon === 'string' ? (
        <text x={C} y={C + (icon.length <= 1 ? 9 : 7)} textAnchor="middle"
              fontFamily="var(--font-sans)" fontWeight={800}
              fontSize={icon.length <= 1 ? 26 : icon.length <= 2 ? 20 : 15}
              fill="#FFFFFF">{icon}</text>
      ) : (
        <g transform={`translate(${C},${C})`}>{icon}</g>
      )}
    </svg>
  );
}

/* ---------- 획득 애니메이션 래퍼 ----------
 * 도장 찍힘 연출이 필요할 때만 감싼다 (보드 정적 렌더에는 사용 금지).
 * tokens.css의 stamp-in 키프레임 사용. 햅틱은 호출부에서 1회.
 */
export function StampIn({ children }: { children: React.ReactNode }) {
  return <div className="animate-stamp-in" style={{ display: 'inline-block' }}>{children}</div>;
}

/* ---------- 사용 예 ----------
 * <Stamp category="record" icon="7" seed="2026-06-streak7" aria-label="7일 연속" />
 * <Stamp category="saving" icon="₩" seed="2026-06-first-saving" />
 * <Stamp category="hidden" icon="?" size={56} />
 * <Stamp category="record" state="empty" aria-label="30일 연속 (미획득)" />
 * 획득 순간: <StampIn><Stamp category="saving" icon="×5" size={160} /></StampIn>
 */
