import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { importLibrary, setOptions } from '@googlemaps/js-api-loader'

/**
 * 인터랙티브 Google Maps 컴포넌트.
 *
 * - VITE_GOOGLE_MAPS_API_KEY 미설정 시 안내 메시지만 표시 (앱 크래시 없음, 빌드 통과)
 * - setOptions 는 모듈 레벨에 1회만 호출 (앱 lifetime singleton)
 * - 좌표 없는 place 는 자동 제외
 * - 마커 클릭 → onPinClick(place) 호출
 * - 지도 클릭 → onMapClick(lat, lng) 호출 (tap-to-pick)
 */

interface MapPlace {
  name: string
  lat: number | null
  lng: number | null
  totalSpent?: number
  visits?: unknown[]
  avgRating?: number
  category?: string
  /** 카테고리별 핀 색상 */
  color?: string
}

interface GoogleMapProps {
  places: MapPlace[]
  /** 핀 클릭 핸들러 */
  onPinClick?: (place: MapPlace) => void
  /** 지도 빈 영역 클릭 핸들러 (tap-to-pick) */
  onMapClick?: (lat: number, lng: number) => void
  /** GPS / IP 기반 사용자 위치 — 핀이 없을 때 초기 중심 */
  userGeo?: { lat: number; lng: number } | null
  /** 지도 높이 (default 320) */
  height?: number
  /** 지도 외곽 round 정도 */
  rounded?: boolean
}

// ===== Module-level singleton =====
// 같은 페이지에서 GoogleMap 컴포넌트가 여러 개 마운트돼도 google.maps 스크립트는 1회만 로드됨.
const API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
let optionsConfigured = false
function ensureMapsOptions(): boolean {
  if (!API_KEY) return false
  if (!optionsConfigured) {
    setOptions({
      key: API_KEY,
      v: 'weekly',
      libraries: ['places', 'marker'],
    })
    optionsConfigured = true
  }
  return true
}

export default function GoogleMap({
  places,
  onPinClick,
  onMapClick,
  userGeo,
  height = 320,
  rounded = true,
}: GoogleMapProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'no-key'>(
    API_KEY ? 'loading' : 'no-key',
  )

  // 좌표 있는 핀만 사용
  const pinned: MapPlace[] = places.filter(
    (p): p is MapPlace & { lat: number; lng: number } =>
      typeof p.lat === 'number' && typeof p.lng === 'number',
  )

  // 초기 지도 마운트 (1회)
  useEffect(() => {
    if (!ensureMapsOptions() || !containerRef.current) return
    let cancelled = false
    ;(async () => {
      try {
        const { Map: GMap } = await importLibrary('maps')
        if (cancelled || !containerRef.current) return
        const initialCenter = pinned[0]
          ? { lat: pinned[0].lat as number, lng: pinned[0].lng as number }
          : userGeo
            ? { lat: userGeo.lat, lng: userGeo.lng }
            : { lat: 37.5665, lng: 126.978 } // Seoul default
        mapRef.current = new GMap(containerRef.current, {
          center: initialCenter,
          zoom: pinned.length === 1 ? 16 : 13,
          mapId: 'moa-ai-ledger-map', // AdvancedMarker 사용에 필요 (any string OK)
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy', // 모바일 한 손가락 드래그 허용
        })
        // tap-to-pick: 빈 지도 영역 클릭
        if (onMapClick) {
          mapRef.current.addListener('click', (e: google.maps.MapMouseEvent) => {
            if (e.latLng) onMapClick(e.latLng.lat(), e.latLng.lng())
          })
        }
        setStatus('ready')
      } catch (err) {
        console.warn('Google Maps load failed:', err)
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 마커 동기화 (places 변경 시)
  useEffect(() => {
    if (status !== 'ready' || !mapRef.current) return
    let cancelled = false
    ;(async () => {
      const { AdvancedMarkerElement, PinElement } = await importLibrary('marker')
      if (cancelled || !mapRef.current) return

      // 기존 마커 제거
      markersRef.current.forEach((m) => {
        m.map = null
      })
      markersRef.current = []

      // 신규 마커 생성
      for (const p of pinned) {
        const pin = new PinElement({
          background: p.color || '#A0633C',
          borderColor: '#FFFFFF',
          glyphColor: '#FFFFFF',
          scale: Math.min(1.5, 0.9 + Math.sqrt((p.totalSpent || 0) / 1000000)),
        })
        const marker = new AdvancedMarkerElement({
          map: mapRef.current,
          position: { lat: p.lat as number, lng: p.lng as number },
          title: p.name,
          content: pin.element,
          gmpClickable: true,
        })
        if (onPinClick) {
          marker.addListener('click', () => onPinClick(p))
        }
        markersRef.current.push(marker)
      }

      // bounds fit
      if (pinned.length > 1) {
        const bounds = new google.maps.LatLngBounds()
        pinned.forEach((p) => bounds.extend({ lat: p.lat as number, lng: p.lng as number }))
        mapRef.current.fitBounds(bounds, 64)
      } else if (pinned.length === 1) {
        mapRef.current.setCenter({ lat: pinned[0].lat as number, lng: pinned[0].lng as number })
      }
    })()
    return () => {
      cancelled = true
    }
    // pinned 의존 — JSON 비교 회피 위해 length + name 키만 의존
  }, [status, pinned.length, pinned.map((p) => `${p.name}:${p.lat},${p.lng}`).join('|')])

  // 상태별 렌더링
  if (status === 'no-key') {
    return (
      <div
        className="rounded-2xl p-6 text-xs text-center"
        style={{ backgroundColor: '#F0EBE0', color: '#7A7567' }}
      >
        {t('ledger.place.mapsUnavailable', {
          defaultValue: '지도 기능은 관리자가 API 키를 설정한 후 사용할 수 있어요.',
        })}
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div
        className="rounded-2xl p-6 text-xs text-center"
        style={{ backgroundColor: '#F0EBE0', color: '#7A7567' }}
      >
        {t('ledger.place.mapsUnavailable', {
          defaultValue: '지도 기능을 일시 사용할 수 없어요.',
        })}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className={rounded ? 'rounded-2xl overflow-hidden' : ''}
      aria-label="Google Maps"
    />
  )
}
