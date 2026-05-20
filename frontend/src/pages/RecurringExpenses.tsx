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
import { ChangeEvent, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronLeft, Plus, Save, Trash2 } from 'lucide-react'
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

function validateRow(r: RowDraft): string | null {
  if (!r.description.trim()) return '설명을 입력해줘'
  if (!r.amount || r.amount <= 0) return '금액을 입력해줘'
  if (!CATEGORIES.includes(r.category)) return '카테고리가 잘못됨'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return '시작일이 잘못됨 (YYYY-MM-DD)'
  if (r.recurrence === 'monthly') {
    if (r.recurrence_day == null || r.recurrence_day < 1 || r.recurrence_day > 31) return '매월 반복은 1~31일 사이'
  }
  if (r.recurrence === 'weekly') {
    if (r.recurrence_day == null || r.recurrence_day < 0 || r.recurrence_day > 6) return '매주 반복은 요일을 선택'
  }
  if (r.recurrence_until && !/^\d{4}-\d{2}-\d{2}$/.test(r.recurrence_until)) return '종료일 형식이 잘못됨'
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

  // 기존 규칙은 그대로, 신규 빈 행만 로컬 상태에 보관 (저장 시 batch).
  const [drafts, setDrafts] = useState<RowDraft[]>([])

  const existingRows = useMemo(() => rules.map(planToRow), [rules])

  const addRow = () => setDrafts((d) => [...d, emptyRow()])

  const updateDraft = (idx: number, patch: Partial<RowDraft>) => {
    setDrafts((d) => d.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeDraft = (idx: number) => {
    setDrafts((d) => d.filter((_, i) => i !== idx))
  }

  const saveAllDrafts = async () => {
    if (drafts.length === 0) {
      toast.error('추가된 행이 없어')
      return
    }
    for (const r of drafts) {
      const err = validateRow(r)
      if (err) {
        toast.error(err)
        return
      }
    }
    await createBatch.mutateAsync(drafts.map(rowToInput))
    toast.success(`${drafts.length}건 등록 완료`)
    setDrafts([])
  }

  /** 기존 행의 inline 변경 — onBlur 또는 명시 저장. */
  const commitExistingPatch = (id: number, patch: Partial<RowDraft>) => {
    const apiPatch: Partial<Planned> = {
      description: patch.description,
      amount: patch.amount,
      category: patch.category,
      date: patch.date,
      recurrence: patch.recurrence,
      recurrence_day: patch.recurrence_day,
      recurrence_until: patch.recurrence_until,
      note: patch.note,
    }
    update.mutate({ id, patch: apiPatch })
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F5EF' }}>
      <AppHeader />
      <div className="max-w-6xl mx-auto px-4 pt-16 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <Link
            to="/app"
            className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-atm-muted hover:bg-stone-50"
          >
            <ChevronLeft size={16} /> {t('recurring.backToLedger', { defaultValue: '가계부로' })}
          </Link>
          <h1 className="text-2xl font-bold" style={{ color: '#2C2418' }}>
            {t('recurring.title', { defaultValue: '반복 지출 관리' })}
          </h1>
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6 text-sm text-amber-900">
          {t('recurring.helpText', {
            defaultValue:
              '매월/매주/매년 자동으로 반복되는 지출을 한 번만 등록하면 캘린더에 자동으로 표시돼. 예시: 매월 16일 이자, 매주 월요일 점심 모임 회비 등.',
          })}
        </div>

        {/* 기존 규칙 */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#7A7567' }}>
            {t('recurring.existing', { defaultValue: '등록된 반복 지출' })} ({existingRows.length})
          </h2>
          {isLoading ? (
            <div className="text-sm text-atm-muted">{t('recurring.loading', { defaultValue: '불러오는 중…' })}</div>
          ) : existingRows.length === 0 ? (
            <div className="text-sm text-atm-muted bg-white border border-stone-200 rounded-xl p-4">
              {t('recurring.empty', { defaultValue: '아직 등록된 반복 지출이 없어. 아래 + 추가 버튼으로 시작해봐.' })}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <Table
                rows={existingRows}
                onPatch={(id, patch) => commitExistingPatch(id!, patch)}
                onRemove={(id) => {
                  if (window.confirm(t('recurring.confirmDelete', { defaultValue: '이 반복 규칙을 삭제할까? 이미 표시된 미래 occurrence 도 모두 사라져.' }))) {
                    remove.mutate(id!)
                  }
                }}
                t={t}
                curSym={curSym}
                cur={cur}
                editable
              />
            </div>
          )}
        </section>

        {/* 신규 추가 draft */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: '#7A7567' }}>
              {t('recurring.newRows', { defaultValue: '새로 추가' })} ({drafts.length})
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-sm text-atm-text hover:bg-stone-50"
              >
                <Plus size={14} /> {t('recurring.addRow', { defaultValue: '행 추가' })}
              </button>
              <button
                type="button"
                onClick={saveAllDrafts}
                disabled={drafts.length === 0 || createBatch.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-white disabled:opacity-50"
                style={{ background: '#A0633C' }}
              >
                <Save size={14} /> {createBatch.isPending
                  ? t('recurring.saving', { defaultValue: '저장 중…' })
                  : t('recurring.saveAll', { defaultValue: '일괄 저장' })}
              </button>
            </div>
          </div>

          {drafts.length === 0 ? (
            <div className="text-sm text-atm-muted bg-white border border-dashed border-stone-300 rounded-xl p-6 text-center">
              {t('recurring.emptyDraft', { defaultValue: '“+ 행 추가” 로 시작 — 여러 건을 한꺼번에 추가하고 마지막에 일괄 저장하면 돼.' })}
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
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
}

function Table({ rows, onPatch, onRemove, t, curSym, cur, editable = false, isDraft = false }: TableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-stone-50 text-xs uppercase tracking-wide text-atm-muted">
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
          {rows.map((r, idx) => (
            <tr key={r.id ?? `draft-${idx}`} className="border-t border-stone-100">
              <td className="px-3 py-2">
                <input
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded text-right"
                  value={r.amount || ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onPatch(r.id, { amount: Number(e.target.value) }, idx)
                  }
                  placeholder="0"
                  disabled={!editable}
                />
                <div className="text-[10px] text-atm-muted">{r.amount ? formatCurrency(r.amount, cur) : `${curSym}0`}</div>
              </td>
              <td className="px-3 py-2">
                <select
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
                    className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
                    className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
                {r.recurrence === 'none' && <span className="text-xs text-atm-muted">—</span>}
                {r.recurrence === 'yearly' && <span className="text-xs text-atm-muted">{t('recurring.fromStartDate', { defaultValue: '시작일의 월/일' })}</span>}
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
                  value={r.date}
                  onChange={(e) => onPatch(r.id, { date: e.target.value }, idx)}
                  disabled={!editable}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="date"
                  className="w-full bg-transparent outline-none focus:bg-stone-50 px-1 py-0.5 rounded"
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
          ))}
        </tbody>
      </table>
    </div>
  )
}
