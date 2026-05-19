// 백엔드 ↔ Ledger UI 사이의 순수 매핑. React 의존성 없음.
// - place: 백엔드는 flat snake_case 4개 컬럼, UI 는 nested 객체.
// - photos: 백엔드는 {id, url}[], UI 는 표시용 URL string[] + 삭제용 photoMeta 보존.

import type { Entry, EntryPhoto } from './api'

export interface UiPlace {
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}

export interface UiEntry {
  id: number
  description: string
  amount: number
  category: string
  date: string
  place: UiPlace | null
  rating: number | null
  review: string | null
  mood: string | null
  photos: string[]
  photoMeta: EntryPhoto[]
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || ''

/**
 * 백엔드 photo URL 을 표시 가능한 절대 URL 로 변환.
 * - local storage: `/files/u3/abc.jpg` → `${VITE_API_BASE_URL}/files/u3/abc.jpg`
 * - R2 / 절대 URL: 그대로 통과
 * - data URL (base64): 그대로 통과 (낙관적 업로드 프리뷰 등)
 */
export function absolutizePhotoUrl(url: string): string {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url
  }
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

export function mapEntryFromApi(api: Entry): UiEntry {
  const photoMeta = api.photos || []
  return {
    id: api.id,
    description: api.description,
    amount: api.amount,
    category: api.category,
    date: api.date,
    place: api.place_name
      ? {
          name: api.place_name,
          lat: api.place_lat ?? null,
          lng: api.place_lng ?? null,
          address: api.place_address ?? null,
        }
      : null,
    rating: api.rating ?? null,
    review: api.review ?? null,
    mood: api.mood ?? null,
    photos: photoMeta.map((p) => absolutizePhotoUrl(p.url)),
    photoMeta,
  }
}

/**
 * UI patch 객체를 백엔드 patch 페이로드로 변환.
 * `place: null` 이면 4개 컬럼을 모두 null 로 명시 (장소 제거).
 * `place` 키가 patch 에 아예 없으면 4개 컬럼 미포함 (변경 안 함).
 * photos/photoMeta 는 별도 엔드포인트라 항상 제거.
 */
export function mapEntryToApi(
  ui: Partial<UiEntry> & { place?: UiPlace | null },
): Partial<Entry> {
  const { place, photos: _photos, photoMeta: _photoMeta, id: _id, ...rest } = ui
  const out: Partial<Entry> = { ...rest }
  if (place === null) {
    out.place_name = null
    out.place_lat = null
    out.place_lng = null
    out.place_address = null
  } else if (place !== undefined) {
    out.place_name = place.name
    out.place_lat = place.lat
    out.place_lng = place.lng
    out.place_address = place.address
  }
  return out
}
