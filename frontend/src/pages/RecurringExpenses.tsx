/**
 * /recurring — 반복 지출 관리 페이지.
 *
 * 매월/매주/매년 반복되는 지출(이자, 월세, 통신비 등) 을 표 형식으로 일괄 등록·수정·삭제.
 * 저장된 규칙은 캘린더/대시보드에 자동으로 모든 occurrence 가 표시됨 (backend expansion).
 *
 * 작업 흐름:
 *  1) 페이지 진입 시 기존 규칙 목록(`include_rules=1`) 조회
 *  2) "+ 행 추가" 로 빈 행 (description='', amount=0, ...) 을 로컬 상태에 추가
 *  3) 각 행 inline 편집 → 신규 행은 `useCreatePlannedBatch` 로 일괄 저장,
 *     기존 행은 `useUpdatePlanned` 로 즉시 patch
 *  4) 삭제는 `useDeletePlanned` (확인 모달 없이 즉시 — undo 토스트로 충분)
 *
 * UX 결정:
 *  - 행 단위 inline edit, 변경된 신규 행만 모아 "저장" 누르면 일괄 등록.
 *  - 기존 행은 onBlur 시 individual PATCH.
 */
import { ChangeEvent, ReactNode, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, ChevronLeft, Plus, Save, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

import AppHeader from '../components/AppHeader'
import { Planned, Recurrence } from '../services/api'
import {
  CreatePlannedInput,
  useCreatePlannedBatch,
  useDeletePlanned,
  usePlannedRules,
  useUpdatePlanned,
} from '../hooks/useLedgerData'
import { useAuth } from '../hooks/useAuth'
import { currencySymbol, formatCurrency } from '../utils/currency'

const CATEGORIES = [
  '식비',
  '카페/간식',
  '쇼핑',
  '교통',
  '주거/공과금',
  '건강/뷰티',
  '여행/이벤트',
  '경조사/선물',
  '금융/대출',
  '기타',
]

const FREQUENCIES: Recurrence[] = ['none', 'monthly', 'weekly', 'yearly']
const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

/** UI 행 — 신규는 id 가 undefined, 기존은 number. */
interface RowDraft {
  id?: number
  description: string
  amount: number
  category: string
  date: string
  recurrence: Recurrence
  recurrence_day: number | null
  recurrence_until: string | null
  note: string | null
}

const TODAY = new Date().toISOString().slice(0, 10)

function emptyRow(): RowDraft {
  return {
    description: '',
    amount: 0,
    category: '금융/대출',
    date: TODAY,
    recurrence: 'monthly',
    recurrence_day: 1,
    recurrence_until: null,
    note: null,
  }
}

function planToRow(p: Planned): RowDraft {
  return {
    id: p.id,
    description: p.description,
    amount: p.amount,
    category: p.category,
    date: p.date,
    recurrence: p.recurrence,
    recurrence_day: p.recurrence_day,
    recurrence_until: p.recurrence_until,
    note: p.note,
  }
}

function rowToInput(r: RowDraft): CreatePlannedInput {
  return {
    description: r.description.trim() || '반복 지출',
    amount: Math.max(0, Math.floor(r.amount || 0)),
    category: r.category,
    date: r.date,
    type: 'event',
    recurrence: r.recurrence,
    recurrence_day: r.recurrence_day,
    recurrence_until: r.recurrence_until,
    note: r.note,
  }
}

function validateRow(r: RowDraft, t: (k: string, opts?: any) => string): string | null {
  if (!r.description.trim()) return t('recurring.validation.descriptionRequired', { defaultValue: '설명을 입력해줘' })
  if (!r.amount || r.amount <= 0) return t('recurring.validation.amountRequired', { defaultValue: '금액을 입력해줘' })
  if (!CATEGORIES.includes(r.category)) return t('recurring.validation.categoryInvalid', { defaultValue: '카테고리가 잘못됨' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return t('recurring.validation.startDateInvalid', { defaultValue: '시작일이 잘못됨 (YYYY-MM-DD)' })
  if (r.recurrence === 'monthly') {
    if (r.recurrence_day == null || r.recurrence_day < 1 || r.recurrence_day > 31)
      return t('recurring.validation.monthlyDay', { defaultValue: '매월 반복은 1~31일 사이' })
  }
  if (r.recurrence === 'weekly') {
    if (r.recurrence_day == null || r.recurrence_day < 0 || r.recurrence_day > 6)
      return t('recurring.validation.weeklyDay', { defaultValue: '매주 반복은 요일을 선택' })
  }
  // 반복 항목이면 종료일 필수 + 시작일 이후
  if (r.recurrence !== 'none') {
    if (!r.recurrence_until)
      return t('recurring.validation.endDateRequired', { defaultValue: '종료일을 입력해줘 (반복 지출은 종료일이 반드시 필요해)' })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.recurrence_until))
      return t('recurring.validation.endDateInvalid', { defaultValue: '종료일 형식이 잘못됨' })
    if (r.recurrence_until < r.date)
      return t('recurring.validation.endDateAfterStart', { defaultValue: '종료일은 시작일 이후여야 해' })
  }
  return null
}

export default function RecurringExpenses() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const cur = user?.currency_code || 'KRW'
  const curSym = currencySymbol(cur)

  const { data: rules = [], isLoading } = usePlannedRules()
  const createBatch = useCreatePlannedBatch()
  const update = useUpdatePlanned()
  const remove = useDeletePlanned()

  // 신규 draft 행
  const [drafts, setDrafts] = useState<RowDraft[]>([])
  // 기존 행의 미저장 변경사항 누적 — id 별 부분 패치.
  // 사용자가 셀을 수정해도 즉시 PATCH 보내지 않고 여기에 모았다가, [일괄 저장] 버튼으로 일괄 commit.
  const [pendingPatches, setPendingPatches] = useState<Record<number, Partial<RowDraft>>>({})

  const existingRowsRaw = useMemo(() => rules.map(planToRow), [rules])

  // 표시용: pendingPatches 가 있는 행은 변경된 값이 미리 보이도록 머지
  const existingRows = useMemo(
    () =>
      existingRowsRaw.map((r) =>
        r.id != null && pendingPatches[r.id] ? { ...r, ...pendingPatches[r.id] } : r,
      ),
    [existingRowsRaw, pendingPatches],
  )

  const addRow = () => setDrafts((d) => [...d, emptyRow()])

  const updateDraft = (idx: number, patch: Partial<RowDraft>) => {
    setDrafts((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeDraft = (idx: number) => {
    setDrafts((d) => d.filter((_, i) => i !== idx))
  }

  /** 기존 행을 셀 단위로 수정 — 즉시 서버 PATCH 하지 않고 pendingPatches 에 누적. */
  const stashExistingPatch = (id: number, patch: Partial<RowDraft>) => {
    const cleaned: Partial<RowDraft> = { ...patch }
    // recurrence='none' 으로 변경되면 종료일/요일은 자동 정리
    if (cleaned.recurrence === 'none') {
      cleaned.recurrence_until = null
      cleaned.recurrence_day = null
    }
    setPendingPatches((prev) => ({
      ...prev,
      [id]: { ...(prev[id] || {}), ...cleaned },
    }))
  }

  const pendingCount = Object.keys(pendingPatches).length
  const totalToSave = drafts.length + pendingCount

  const saveAll = async () => {
    if (totalToSave === 0) {
      toast.error(t('recurring.emptyDraft', { defaultValue: '저장할 변경사항이 없어' }))
      return
    }

    // 1) 신규 drafts 검증
    for (const r of drafts) {
      const err = validateRow(r, t)
      if (err) {
        toast.error(err)
        return
      }
    }
    // 2) 기존 행 + pendingPatches merged state 검증
    for (const id of Object.keys(pendingPatches).map(Number)) {
      const base = existingRowsRaw.find((r) => r.id === id)
      if (!base) continue
      const merged: RowDraft = { ...base, ...pendingPatches[id] }
      const err = validateRow(merged, t)
      if (err) {
        toast.error(err)
        return
      }
    }

    // 3) 일괄 등록 (drafts) + 개별 PATCH (pendingPatches) 병렬 실행
    try {
      const ops: Promise<unknown>[] = []
      if (drafts.length > 0) {
        ops.push(createBatch.mutateAsync(drafts.map(rowToInput)))
      }
      for (const idStr of Object.keys(pendingPatches)) {
        const id = Number(idStr)
        const p = pendingPatches[id]
        const apiPatch: Partial<Planned> = {
          description: p.description,
          amount: p.amount,
          category: p.category,
          date: p.date,
          recurrence: p.recurrence,
          recurrence_day: p.recurrence_day,
          recurrence_until: p.recurrence_until,
          note: p.note,
        }
        // 보내지 않을 키 (undefined) 는 useUpdatePlanned 가 mapping 단에서 제거하거나
        // 그대로 보내도 백엔드 PlannedUpdate 가 None 으로 받음 → patch.model_dump(exclude_unset=True)
        // 가 제대로 동작하려면 undefined 인 키는 명시적으로 빼야 한다.
        for (const k of Object.keys(apiPatch) as (keyof Planned)[]) {
          if (apiPatch[k] === undefined) delete apiPatch[k]
        }
        ops.push(update.mutateAsync({ id, patch: apiPatch }))
      }
      await Promise.all(ops)
      toast.success(
        t('recurring.savedCount', {
          count: totalToSave,
          defaultValue: `${totalToSave}건 저장 완료`,
        }),
      )
      setDrafts([])
      setPendingPatches({})
    } catch (e) {
      // 개별 mutation 의 onError 에서 toast 처리됨. 여기서는 일괄저장이 부분 실패한 경우를 위해 보조 메시지.
      toast.error(t('common.retry', { defaultValue: '잠시 후 다시 시도해 주세요.' }))
    }
  }

  const revertPending = (id: number) => {
    setPendingPatches((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // 레거시 경고: 종료일 없는 반복 규칙
  const legacyMissingEnd = useMemo(
    () => existingRows.filter((r) => r.recurrence !== 'none' && !r.recurrence_until),
    [existingRows],
  )

  // 레거시 행이 상단에 오도록 정렬한 표시용 목록
  const sortedExistingRows = useMemo(() => {
    const legacyIds = new Set(legacyMissingEnd.map((r) => r.id))
    return [
      ...existingRows.filter((r) => legacyIds.has(r.id)),
      ...existingRows.filter((r) => !legacyIds.has(r.id)),
    ]
  }, [existingRows, legacyMissingEnd])

  return (
    <div className="min-h-screen bg-cream font-sans">
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/app"
            className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-line rounded-pill text-sm text-ink-secondary hover:bg-sunken"
          >
            <ChevronLeft size={16} /> {t('recurring.backToLedger', { defaultValue: '가계부로' })}
          </Link>
          <h1 className="text-2xl font-display text-ink">
            {t('recurring.title', { defaultValue: '반복 지출 관리' })}
          </h1>
        </div>

        <div className="rounded-card bg-amber-50 border border-amber-200 p-4 mb-6 text-sm text-amber-900">
          {t('recurring.helpText', {
            defaultValue:
              '매월/매주/매년 자동으로 반복되는 지출을 한 번만 등록하면 캘린더에 자동으로 표시돼. 예시: 매월 16일 이자, 매주 월요일 점심 모임 회비 등.',
          })}
        </div>

        {/* 레거시 경고: 종료일 없는 반복 규칙 */}
        {legacyMissingEnd.length > 0 && (
          <div className="rounded-card bg-red-50 border border-red-200 p-4 mb-6 text-sm text-red-900 flex items-start gap-2">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden />
            <div>
              <div className="font-semibold mb-1">
                {t('recurring.validation.missingEndDateTitle', {
                  count: legacyMissingEnd.length,
                  defaultValue: `${legacyMissingEnd.length}건의 반복 지출에 종료일이 없어요.`,
                })}
              </div>
              <div className="opacity-90">
                {t('recurring.validation.missingEndDateBody', {
                  defaultValue:
                    '종료일이 없으면 캘린더에 정확히 표시되지 않아요. 아래 표시된 행의 "종료일" 칸을 채워주세요.',
                })}
              </div>
            </div>
          </div>
        )}

        {/* 기존 규칙 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-ink-secondary">
              {t('recurring.existing', { defaultValue: '등록된 반복 지출' })} ({existingRowsRaw.length})
            </h2>
            {pendingCount > 0 && (
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {t('recurring.unsavedChanges', {
                    count: pendingCount,
                    defaultValue: `${pendingCount}건 미저장 변경`,
                  })}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPatches({})}
                  className="px-2 py-0.5 text-ink-secondary hover:text-ink underline"
                >
                  {t('recurring.revertAll', { defaultValue: '되돌리기' })}
                </button>
              </div>
            )}
          </div>
          {isLoading ? (
            <div className="text-sm text-ink-secondary">{t('recurring.loading', { defaultValue: '불러오는 중…' })}</div>
          ) : existingRows.length === 0 ? (
            <div className="text-sm text-ink-secondary bg-surface border border-line rounded-card p-4">
              {t('recurring.empty', { defaultValue: '아직 등록된 반복 지출이 없어. 아래 + 추가 버튼으로 시작해봐.' })}
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-card overflow-hidden">
              <Table
                rows={sortedExistingRows}
                onPatch={(id, patch) => stashExistingPatch(id!, patch)}
                onRemove={(id) => {
                  if (window.confirm(t('recurring.confirmDelete', { defaultValue: '이 반복 규칙을 삭제할까? 이미 표시된 미래 occurrence 도 모두 사라져.' }))) {
                    // 삭제는 즉시 처리 (일괄저장과 별개 — 사용자 의도가 명확)
                    if (id != null) revertPending(id)
                    remove.mutate(id!)
                  }
                }}
                t={t}
                curSym={curSym}
                cur={cur}
                editable
                missingEndIds={new Set(legacyMissingEnd.map((r) => r.id!))}
                dirtyIds={new Set(Object.keys(pendingPatches).map(Number))}
              />
            </div>
          )}
        </section>

        {/* 신규 추가 draft */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-secondary">
              {t('recurring.newRows', { defaultValue: '새로 추가' })} ({drafts.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-surface border border-line rounded-pill text-sm text-ink hover:bg-sunken"
              >
                <Plus size={14} /> {t('recurring.addRow', { defaultValue: '행 추가' })}
              </button>
              <button
                type="button"
                onClick={saveAll}
                disabled={totalToSave === 0 || createBatch.isPending || update.isPending}
                className="flex items-center gap-1 px-4 py-2 min-h-touch rounded-pill text-sm font-bold text-ink-ondark bg-grad-record disabled:opacity-50 active:scale-[0.97]"
              >
                <Save size={14} /> {createBatch.isPending || update.isPending
                  ? t('recurring.saving', { defaultValue: '저장 중…' })
                  : totalToSave > 0
                    ? t('recurring.saveAllWithCount', {
                        count: totalToSave,
                        defaultValue: `일괄 저장 (${totalToSave})`,
                      })
                    : t('recurring.saveAll', { defaultValue: '일괄 저장' })}
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="text-sm text-ink-secondary bg-surface border border-dashed border-line rounded-card p-6 text-center">
              {t('recurring.emptyDraft', { defaultValue: '“+ 행 추가” 로 시작 — 여러 건을 한꺼번에 추가하고 마지막에 일괄 저장하면 돼.' })}
            </div>
          ) : (
            <div className="bg-surface border border-line rounded-card overflow-hidden">
              <Table
                rows={drafts}
                onPatch={(_, patch, idx) => updateDraft(idx!, patch)}
                onRemove={(_id, idx) => removeDraft(idx!)}
                t={t}
                curSym={curSym}
                cur={cur}
                editable
                isDraft
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

interface TableProps {
  rows: RowDraft[]
  /** existing 행이면 (id, patch), draft 행이면 (undefined, patch, idx) */
  onPatch: (id: number | undefined, patch: Partial<RowDraft>, idx?: number) => void
  onRemove: (id: number | undefined, idx?: number) => void
  t: (k: string, opts?: any) => string
  curSym: string
  cur: string
  editable?: boolean
  isDraft?: boolean
  /** 종료일 없는 (레거시) 반복 규칙 id 들 — 행 배경을 red 로 강조 */
  missingEndIds?: Set<number>
  /** 미저장 변경사항이 있는 기존 행 id 들 — 행 배경을 amber 로 강조 */
  dirtyIds?: Set<number>
}

/** 모바일 카드 필드 라벨 */
function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-[11px] text-ink-tertiary mb-1">{children}</label>
}

const M_INPUT =
  'w-full bg-sunken rounded-pill px-3.5 py-2.5 text-sm text-ink outline-none disabled:opacity-40'

function Table({ rows, onPatch, onRemove, t, curSym, cur, editable = false, isDraft = false, missingEndIds, dirtyIds }: TableProps) {
  return (
    <>
      {/* ===== 모바일 (< md): 행당 카드 — 가로 스크롤 테이블 대신 세로 스택 ===== */}
      <div className="md:hidden divide-y divide-line">
        {rows.map((r, idx) => {
          const isMissingEnd = r.id != null && missingEndIds?.has(r.id)
          const isDirty = r.id != null && dirtyIds?.has(r.id)
          const rowBg = isMissingEnd ? 'bg-red-50' : isDirty ? 'bg-amber-50' : ''
          return (
            <div key={r.id ?? `draft-${idx}`} className={`p-4 ${rowBg}`}>
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <FieldLabel>{t('recurring.headers.description', { defaultValue: '설명' })}</FieldLabel>
                  <input
                    className={M_INPUT}
                    value={r.description}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onPatch(r.id, { description: e.target.value }, idx)
                    }
                    placeholder={t('recurring.placeholders.description', { defaultValue: '예: 16일 대출 이자' })}
                    disabled={!editable}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(r.id, idx)}
                  className="mt-5 w-11 h-11 flex-shrink-0 flex items-center justify-center rounded-pill text-red-500 active:bg-red-50"
                  title={t('recurring.delete', { defaultValue: '삭제' })}
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <div>
                  <FieldLabel>{t('recurring.headers.amount', { defaultValue: '금액' })}</FieldLabel>
                  <input
                    type="number"
                    inputMode="numeric"
                    className={M_INPUT}
                    value={r.amount || ''}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      onPatch(r.id, { amount: Number(e.target.value) }, idx)
                    }
                    placeholder="0"
                    disabled={!editable}
                  />
                  <div className="mt-0.5 text-[10px] text-ink-tertiary text-right">
                    {r.amount ? formatCurrency(r.amount, cur) : `${curSym}0`}
                  </div>
                </div>
                <div>
                  <FieldLabel>{t('recurring.headers.category', { defaultValue: '카테고리' })}</FieldLabel>
                  <select
                    className={M_INPUT}
                    value={r.category}
                    onChange={(e) => onPatch(r.id, { category: e.target.value }, idx)}
                    disabled={!editable}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {t(`ledger.categories.${c}`, c)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('recurring.headers.recurrence', { defaultValue: '반복 주기' })}</FieldLabel>
                  <select
                    className={M_INPUT}
                    value={r.recurrence}
                    onChange={(e) => {
                      const rec = e.target.value as Recurrence
                      onPatch(
                        r.id,
                        {
                          recurrence: rec,
                          recurrence_day:
                            rec === 'monthly'
                              ? r.recurrence_day || 1
                              : rec === 'weekly'
                                ? r.recurrence_day || 0
                                : null,
                        },
                        idx,
                      )
                    }}
                    disabled={!editable}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {t(`recurring.frequency.${f}`, {
                          defaultValue:
                            f === 'none'
                              ? '없음 (1회성)'
                              : f === 'monthly'
                                ? '매월'
                                : f === 'weekly'
                                  ? '매주'
                                  : '매년',
                        })}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>{t('recurring.headers.day', { defaultValue: '반복 일' })}</FieldLabel>
                  {r.recurrence === 'monthly' && (
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={31}
                      className={M_INPUT}
                      value={r.recurrence_day ?? ''}
                      onChange={(e) =>
                        onPatch(r.id, { recurrence_day: e.target.value === '' ? null : Number(e.target.value) }, idx)
                      }
                      placeholder="16"
                      disabled={!editable}
                    />
                  )}
                  {r.recurrence === 'weekly' && (
                    <select
                      className={M_INPUT}
                      value={r.recurrence_day ?? 0}
                      onChange={(e) => onPatch(r.id, { recurrence_day: Number(e.target.value) }, idx)}
                      disabled={!editable}
                    >
                      {WEEKDAYS.map((wd, wi) => (
                        <option key={wd} value={wi}>
                          {t(`recurring.weekday.${wd}`, {
                            defaultValue: ['월', '화', '수', '목', '금', '토', '일'][wi],
                          })}
                        </option>
                      ))}
                    </select>
                  )}
                  {r.recurrence === 'none' && (
                    <div className={`${M_INPUT} text-ink-faint`}>—</div>
                  )}
                  {r.recurrence === 'yearly' && (
                    <div className={`${M_INPUT} text-ink-faint text-xs flex items-center`}>
                      {t('recurring.fromStartDate', { defaultValue: '시작일의 월/일' })}
                    </div>
                  )}
                </div>
                <div>
                  <FieldLabel>{t('recurring.headers.startDate', { defaultValue: '시작일' })}</FieldLabel>
                  <input
                    type="date"
                    className={M_INPUT}
                    value={r.date}
                    onChange={(e) => onPatch(r.id, { date: e.target.value }, idx)}
                    disabled={!editable}
                  />
                </div>
                <div>
                  <FieldLabel>{t('recurring.headers.until', { defaultValue: '종료일 (선택)' })}</FieldLabel>
                  <input
                    type="date"
                    className={M_INPUT}
                    value={r.recurrence_until ?? ''}
                    onChange={(e) =>
                      onPatch(r.id, { recurrence_until: e.target.value || null }, idx)
                    }
                    disabled={!editable || r.recurrence === 'none'}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ===== 데스크탑 (md+): 기존 테이블 ===== */}
      <div className="hidden md:block overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-sunken text-xs uppercase tracking-wide text-ink-secondary">
          <tr>
            <th className="text-left px-3 py-2 min-w-[180px]">{t('recurring.headers.description', { defaultValue: '설명' })}</th>
            <th className="text-right px-3 py-2 min-w-[120px]">{t('recurring.headers.amount', { defaultValue: '금액' })}</th>
            <th className="text-left px-3 py-2 min-w-[120px]">{t('recurring.headers.category', { defaultValue: '카테고리' })}</th>
            <th className="text-left px-3 py-2 min-w-[110px]">{t('recurring.headers.recurrence', { defaultValue: '반복 주기' })}</th>
            <th className="text-left px-3 py-2 min-w-[120px]">{t('recurring.headers.day', { defaultValue: '반복 일' })}</th>
            <th className="text-left px-3 py-2 min-w-[150px]">{t('recurring.headers.startDate', { defaultValue: '시작일' })}</th>
            <th className="text-left px-3 py-2 min-w-[150px]">{t('recurring.headers.until', { defaultValue: '종료일 (선택)' })}</th>
            <th className="text-right px-3 py-2 w-[60px]"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => {
            const isMissingEnd = r.id != null && missingEndIds?.has(r.id)
            const isDirty = r.id != null && dirtyIds?.has(r.id)
            // missingEnd 우선 (가장 위험), 그 다음 dirty (저장 대기)
            const rowBg = isMissingEnd ? 'bg-red-50' : isDirty ? 'bg-amber-50' : ''
            return (
            <tr
              key={r.id ?? `draft-${idx}`}
              className={`border-t border-line ${rowBg}`}
            >
              <td className="px-3 py-2">
                <input
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                  value={r.description}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(r.id, { description: e.target.value }, idx)
                  }
                  placeholder={t('recurring.placeholders.description', { defaultValue: '예: 16일 대출 이자' })}
                  disabled={!editable}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <input
                  type="number"
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded text-right"
                  value={r.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(r.id, { amount: Number(e.target.value) }, idx)
                  }
                  placeholder="0"
                  disabled={!editable}
                />
                <div className="text-[10px] text-ink-secondary">{r.amount ? formatCurrency(r.amount, cur) : `${curSym}0`}</div>
              </td>
              <td className="px-3 py-2">
                <select
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                  value={r.category}
                  onChange={(e) => onPatch(r.id, { category: e.target.value }, idx)}
                  disabled={!editable}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {t(`ledger.categories.${c}`, c)}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <select
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                  value={r.recurrence}
                  onChange={(e) => {
                    const rec = e.target.value as Recurrence
                    onPatch(
                      r.id,
                      {
                        recurrence: rec,
                        recurrence_day:
                          rec === 'monthly'
                            ? r.recurrence_day || 1
                            : rec === 'weekly'
                              ? r.recurrence_day || 0
                              : null,
                      },
                      idx,
                    )
                  }}
                  disabled={!editable}
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {t(`recurring.frequency.${f}`, {
                        defaultValue:
                          f === 'none'
                            ? '없음 (1회성)'
                            : f === 'monthly'
                              ? '매월'
                              : f === 'weekly'
                                ? '매주'
                                : '매년',
                      })}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                {r.recurrence === 'monthly' && (
                  <input
                    type="number"
                    min={1}
                    max={31}
                    className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                    value={r.recurrence_day ?? ''}
                    onChange={(e) =>
                      onPatch(r.id, { recurrence_day: e.target.value === '' ? null : Number(e.target.value) }, idx)
                    }
                    placeholder="16"
                    disabled={!editable}
                  />
                )}
                {r.recurrence === 'weekly' && (
                  <select
                    className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                    value={r.recurrence_day ?? 0}
                    onChange={(e) => onPatch(r.id, { recurrence_day: Number(e.target.value) }, idx)}
                    disabled={!editable}
                  >
                    {WEEKDAYS.map((wd, wi) => (
                      <option key={wd} value={wi}>
                        {t(`recurring.weekday.${wd}`, {
                          defaultValue: ['월', '화', '수', '목', '금', '토', '일'][wi],
                        })}
                      </option>
                    ))}
                  </select>
                )}
                {r.recurrence === 'none' && <span className="text-xs text-ink-secondary">—</span>}
                {r.recurrence === 'yearly' && <span className="text-xs text-ink-secondary">{t('recurring.fromStartDate', { defaultValue: '시작일의 월/일' })}</span>}
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                  value={r.date}
                  onChange={(e) => onPatch(r.id, { date: e.target.value }, idx)}
                  disabled={!editable}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none focus:bg-sunken px-1 py-0.5 rounded"
                  value={r.recurrence_until ?? ''}
                  onChange={(e) =>
                    onPatch(r.id, { recurrence_until: e.target.value || null }, idx)
                  }
                  disabled={!editable || r.recurrence === 'none'}
                />
              </td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  onClick={() => onRemove(r.id, idx)}
                  className="p-1 rounded hover:bg-red-50 text-red-500"
                  title={t('recurring.delete', { defaultValue: '삭제' })}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          )})}
        </tbody>
      </table>
      </div>
    </>
  )
}
