import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, Info, X } from 'lucide-react'
import { announcementsApi, type Announcement, type AnnouncementLevel } from '../services/api'

const DISMISS_KEY = 'moa_dismissed_announcements'

function loadDismissed(): Set<number> {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return new Set()
    const ids = JSON.parse(raw) as number[]
    return new Set(ids)
  } catch {
    return new Set()
  }
}

function saveDismissed(ids: Set<number>) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(ids)))
  } catch {
    /* ignore */
  }
}

const LEVEL_STYLES: Record<AnnouncementLevel, { bg: string; border: string; text: string; icon: typeof Info }> = {
  info: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-900',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    text: 'text-amber-900',
    icon: AlertTriangle,
  },
  critical: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-900',
    icon: AlertCircle,
  },
}

/**
 * 활성 공지 배너. 페이지 최상단에 표시. critical 은 dismiss 불가, info/warning 은 사용자가 닫을 수 있음(브라우저별 저장).
 * 새로운 id 가 추가되면 다시 노출.
 */
export default function AnnouncementBar() {
  const [dismissed, setDismissed] = useState<Set<number>>(() => loadDismissed())
  const q = useQuery({
    queryKey: ['announcements', 'active'],
    queryFn: () => announcementsApi.active().then(r => r.data),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  useEffect(() => saveDismissed(dismissed), [dismissed])

  const items = (q.data ?? []).filter(a => a.level === 'critical' || !dismissed.has(a.id))
  if (items.length === 0) return null

  return (
    <div className="w-full">
      {items.map((a) => (
        <Bar
          key={a.id}
          announcement={a}
          onDismiss={() => {
            const next = new Set(dismissed)
            next.add(a.id)
            setDismissed(next)
          }}
        />
      ))}
    </div>
  )
}

function Bar({ announcement, onDismiss }: { announcement: Announcement; onDismiss: () => void }) {
  const s = LEVEL_STYLES[announcement.level]
  const Icon = s.icon
  return (
    <div className={`${s.bg} ${s.border} ${s.text} border-b px-4 py-2.5 text-sm`}>
      <div className="max-w-5xl mx-auto flex items-start gap-3">
        <Icon size={16} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="font-semibold">{announcement.title}</div>
          {announcement.body && (
            <div className="text-xs opacity-90 mt-0.5 whitespace-pre-wrap break-words">
              {announcement.body}
            </div>
          )}
        </div>
        {announcement.level !== 'critical' && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 opacity-70 hover:opacity-100"
            aria-label="공지 닫기"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
