import axios, { AxiosError, AxiosInstance } from 'axios'

const BASE = import.meta.env.VITE_API_BASE_URL || ''

export const api: AxiosInstance = axios.create({
  baseURL: BASE,
  timeout: 30000,
})

const ACCESS_KEY = 'atm_access'
const REFRESH_KEY = 'atm_refresh'

export const tokenStore = {
  get access() { return localStorage.getItem(ACCESS_KEY) },
  get refresh() { return localStorage.getItem(REFRESH_KEY) },
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

api.interceptors.request.use((cfg) => {
  const t = tokenStore.access
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

let refreshing: Promise<string | null> | null = null
async function tryRefresh(): Promise<string | null> {
  const rt = tokenStore.refresh
  if (!rt) return null
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const r = await axios.post(`${BASE}/auth/refresh`, { refresh_token: rt })
        tokenStore.set(r.data.access_token, r.data.refresh_token)
        return r.data.access_token as string
      } catch {
        tokenStore.clear()
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as any
    if (err.response?.status === 401 && !original?._retry) {
      original._retry = true
      const newAccess = await tryRefresh()
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`
        return api(original)
      }
    }
    return Promise.reject(err)
  },
)

// ===== Types =====
export interface User {
  id: number
  email: string
  display_name: string | null
  monthly_income: number
  monthly_budget: number
  is_admin?: boolean
}

export interface AdminStats {
  users_total: number
  entries_total: number
  planned_total: number
  reflections_total: number
  entries_amount_total: number
  entries_by_category: Record<string, number>
  recent_signups_7d: number
}

export interface AdminUserRow {
  id: number
  email: string
  display_name: string | null
  monthly_income: number
  monthly_budget: number
  is_admin: boolean
  created_at: string
  entries_count: number
  planned_count: number
  reflections_count: number
}

export interface AdminActionResult {
  ok: boolean
  message: string | null
}

export interface AdminEntrySummary {
  id: number
  description: string
  amount: number
  category: string
  date: string
  place_name: string | null
}

export interface AdminUserDetail {
  id: number
  email: string
  display_name: string | null
  monthly_income: number
  monthly_budget: number
  is_admin: boolean
  auth_provider: string
  created_at: string
  deleted_at: string | null
  entries_count: number
  planned_count: number
  reflections_count: number
  photos_count: number
  entries_amount_total: number
  entries_by_category: Record<string, number>
  recent_entries: AdminEntrySummary[]
}

export type AnnouncementLevel = 'info' | 'warning' | 'critical'

export interface Announcement {
  id: number
  title: string
  body: string
  level: AnnouncementLevel
  active: boolean
  starts_at: string | null
  ends_at: string | null
  created_by_email: string | null
  created_at: string
  updated_at: string
}

export interface AnnouncementCreate {
  title: string
  body: string
  level?: AnnouncementLevel
  active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface AnnouncementUpdate {
  title?: string
  body?: string
  level?: AnnouncementLevel
  active?: boolean
  starts_at?: string | null
  ends_at?: string | null
}

export interface AdminAuditRow {
  id: number
  admin_email: string
  action: string
  target_user_id: number | null
  target_email: string | null
  payload: string | null
  created_at: string
}

export type AdminUserSort =
  | 'created_at_desc'
  | 'created_at_asc'
  | 'email'
  | 'entries_desc'

export interface AdminUserListParams {
  q?: string
  sort?: AdminUserSort
  has_data?: boolean
  limit?: number
  offset?: number
}

export interface TokenPair {
  access_token: string
  refresh_token: string
  token_type: string
}

export interface EntryPhoto { id: number; url: string }

export interface Entry {
  id: number
  description: string
  amount: number
  category: string
  date: string
  place_name: string | null
  place_lat: number | null
  place_lng: number | null
  place_address: string | null
  rating: number | null
  review: string | null
  mood: string | null
  photos: EntryPhoto[]
}

export interface Planned {
  id: number
  description: string
  amount: number
  category: string
  date: string
  type: string
  note: string | null
}

export interface Reflection {
  id: number
  month: string
  type: 'regret' | 'praise' | 'goal' | 'insight'
  text: string
}

export interface ParsedItem {
  kind: 'spent' | 'planned'
  description: string
  amount: number
  category: string
  date: string
  place_name: string | null
}

// ===== Auth =====
export const authApi = {
  signup: (email: string, password: string, display_name?: string) =>
    api.post<TokenPair>('/auth/signup', { email, password, display_name }),
  login: (email: string, password: string) =>
    api.post<TokenPair>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
  updateMe: (patch: Partial<Pick<User, 'display_name' | 'monthly_income' | 'monthly_budget'>>) =>
    api.patch<User>('/auth/me', patch),
}

// ===== Entries =====
export const entriesApi = {
  list: (month?: string) => api.get<Entry[]>('/entries', { params: month ? { month } : {} }),
  create: (body: Partial<Entry>) => api.post<Entry>('/entries', body),
  update: (id: number, patch: Partial<Entry>) => api.patch<Entry>(`/entries/${id}`, patch),
  remove: (id: number) => api.delete(`/entries/${id}`),
  uploadPhoto: (id: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post<EntryPhoto>(`/entries/${id}/photos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  removePhoto: (entryId: number, photoId: number) =>
    api.delete(`/entries/${entryId}/photos/${photoId}`),
}

// ===== Planned =====
export const plannedApi = {
  list: () => api.get<Planned[]>('/planned'),
  create: (body: Partial<Planned>) => api.post<Planned>('/planned', body),
  update: (id: number, patch: Partial<Planned>) => api.patch<Planned>(`/planned/${id}`, patch),
  remove: (id: number) => api.delete(`/planned/${id}`),
}

// ===== Reflections =====
export const reflectionsApi = {
  list: (month?: string) =>
    api.get<Reflection[]>('/reflections', { params: month ? { month } : {} }),
  create: (body: Pick<Reflection, 'month' | 'type' | 'text'>) =>
    api.post<Reflection>('/reflections', body),
  remove: (id: number) => api.delete(`/reflections/${id}`),
}

// ===== AI =====
export interface ParseInput {
  text?: string
  image?: { data: string; media_type: string }
}
export const aiApi = {
  parse: (body: ParseInput) =>
    api.post<{ items: ParsedItem[] }>('/ai/parse', body),
  insight: (month: string, current: any, previous: any) =>
    api.post<{ summary: string; praise: string; concern: string; suggestion: string }>(
      '/ai/insight-from-stats',
      { month, current, previous },
    ),
}

// ===== Geocode =====
export interface GeocodeResult {
  name: string | null
  lat: number
  lng: number
  address: string | null
  type: string | null
  distance_km?: number
}

export interface GeocodeSearchResponse {
  results: GeocodeResult[]
  user_lat: number | null
  user_lng: number | null
}

export const geocodeApi = {
  /**
   * 장소 검색. lat/lng 가 있으면 사용자 위치 주변 우선 + 거리순 정렬.
   * 결과는 항상 배열(있으면 1~limit개, 없으면 빈 배열). **임의 폴백 좌표 미부여.**
   */
  search: (q: string, lat?: number, lng?: number, limit = 5) =>
    api.get<GeocodeSearchResponse>('/geocode', {
      params: { q, lat, lng, limit },
    }),
}

// ===== Admin =====
export const adminApi = {
  me: () => api.get<{ id: number; email: string; display_name: string | null; is_admin: boolean; support_email: string }>('/admin/me'),
  stats: () => api.get<AdminStats>('/admin/stats'),
  users: (params: AdminUserListParams = {}) =>
    api.get<AdminUserRow[]>('/admin/users', {
      params: {
        q: params.q || undefined,
        sort: params.sort || 'created_at_desc',
        has_data: params.has_data || undefined,
        limit: params.limit ?? 100,
        offset: params.offset ?? 0,
      },
    }),
  userDetail: (userId: number) =>
    api.get<AdminUserDetail>(`/admin/users/${userId}`),
  audit: (limit = 50, action?: string) =>
    api.get<AdminAuditRow[]>('/admin/audit', {
      params: { limit, action: action || undefined },
    }),
  exportUsersCsv: () =>
    api.get<Blob>('/admin/export/users.csv', { responseType: 'blob' }),
  resetPassword: (userId: number, newPassword: string) =>
    api.post<AdminActionResult>(`/admin/users/${userId}/reset-password`, {
      new_password: newPassword,
    }),
  setAdmin: (userId: number, isAdmin: boolean) =>
    api.patch<AdminActionResult>(`/admin/users/${userId}/admin`, { is_admin: isAdmin }),
  softDelete: (userId: number) =>
    api.delete<AdminActionResult>(`/admin/users/${userId}`),
  // Announcements (admin)
  listAnnouncements: () => api.get<Announcement[]>('/admin/announcements'),
  createAnnouncement: (body: AnnouncementCreate) =>
    api.post<Announcement>('/admin/announcements', body),
  updateAnnouncement: (id: number, patch: AnnouncementUpdate) =>
    api.patch<Announcement>(`/admin/announcements/${id}`, patch),
  deleteAnnouncement: (id: number) =>
    api.delete<AdminActionResult>(`/admin/announcements/${id}`),
}

// ===== Announcements (public) =====
export const announcementsApi = {
  active: () => api.get<Announcement[]>('/announcements/active'),
}

// ===== Constants =====
export const SUPPORT_EMAIL = 'master@aitrend.kr'
