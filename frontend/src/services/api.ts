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
  full_name?: string | null
  display_name: string | null
  monthly_income: number
  monthly_budget: number
  // 지역화 (백엔드 기본값 KR/KRW/ko)
  country_code: string
  currency_code: string
  locale: string
  is_admin?: boolean
  subscription_tier?: 'free' | 'paid'
  subscription_expires_at?: string | null
  allow_location_metadata?: boolean
  last_geo_city?: string | null
  last_geo_region?: string | null
  last_geo_country?: string | null
}

export interface SignupExtras {
  country_code?: string
  currency_code?: string
  locale?: string
}

export interface GeoResult {
  enabled: boolean
  ip?: string | null
  country?: string | null
  region?: string | null
  city?: string | null
  lat?: number | null
  lng?: number | null
  cached?: boolean
}

export interface BillingStatus {
  tier: 'free' | 'paid'
  active: boolean
  free_trial_ends_at: string
  paid_until: string | null
  days_remaining: number
  price_usd_monthly: number
  price_krw_monthly: number
  provider: 'toss' | 'none'
  toss_configured: boolean
  toss_client_key: string | null
  customer_key: string | null
  subscription_status: string | null
  card_brand: string | null
  card_last4: string | null
  last_billing_error: string | null
  beta_free_mode: boolean
  // Lemon Squeezy (MoR — 글로벌 카드/페이팔)
  lemonsqueezy_configured: boolean
  lemonsqueezy_subscription_id: string | null
  lemonsqueezy_renews_at: string | null
  lemonsqueezy_variant_id: string | null
}

export interface LemonSqueezyCheckoutOut {
  url: string
  plan: 'monthly' | 'yearly'
  expires_at_iso: string | null
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

export interface AIUsageBucket {
  label: string
  calls: number
  errors: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

export interface AIUsageModelRow {
  model: string
  calls: number
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
}

export interface AIUsageSummary {
  today: AIUsageBucket
  last_7d: AIUsageBucket
  last_30d: AIUsageBucket
  by_model: AIUsageModelRow[]
  recent_errors: string[]
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

export type Recurrence = 'none' | 'monthly' | 'weekly' | 'yearly'

export interface Planned {
  id: number
  description: string
  amount: number
  category: string
  date: string
  type: string
  note: string | null
  recurrence: Recurrence
  recurrence_day: number | null
  recurrence_until: string | null
  /** true 면 backend 가 반복 규칙으로부터 동적 생성한 가상 occurrence (DB row 아님). 클릭 시 원본 규칙 편집으로 안내. */
  is_recurring_instance?: boolean
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
  recurrence?: Recurrence
  recurrence_day?: number | null
}

export interface SimpleResult {
  ok: boolean
  message: string | null
}

// ===== Auth =====
export const authApi = {
  signup: (email: string, password: string, display_name?: string, extras?: SignupExtras) =>
    api.post<TokenPair>('/auth/signup', { email, password, display_name, ...(extras || {}) }),
  login: (email: string, password: string) =>
    api.post<TokenPair>('/auth/login', { email, password }),
  me: () => api.get<User>('/auth/me'),
  updateMe: (
    patch: Partial<
      Pick<
        User,
        | 'full_name'
        | 'display_name'
        | 'monthly_income'
        | 'monthly_budget'
        | 'allow_location_metadata'
        | 'country_code'
        | 'currency_code'
        | 'locale'
      >
    >,
  ) => api.patch<User>('/auth/me', patch),
  changePassword: (current_password: string, new_password: string) =>
    api.post<SimpleResult>('/auth/change-password', { current_password, new_password }),
  exportMyData: () =>
    api.get<Blob>('/auth/me/export', { responseType: 'blob' }),
  deleteMe: () => api.delete<SimpleResult>('/auth/me'),
  requestPasswordReset: (email: string) =>
    api.post<SimpleResult>('/auth/password-reset/request', { email }),
  confirmPasswordReset: (token: string, new_password: string) =>
    api.post<SimpleResult>('/auth/password-reset/confirm', { token, new_password }),
  googleLogin: (id_token: string) =>
    api.post<TokenPair & { user: User }>('/auth/google', { id_token }),
}

// ===== Push Notifications (FCM) =====
export const pushApi = {
  registerToken: (token: string, platform: 'android' | 'ios' | 'web' = 'android', device_info?: string) =>
    api.post<{ ok: boolean; id: number; platform: string }>('/me/push-token', {
      token,
      platform,
      device_info,
    }),
  deleteToken: (token: string) =>
    api.delete<SimpleResult>('/me/push-token', { data: { token } }),
}

// ===== Me (마이페이지 전용) =====
export const meApi = {
  geo: () => api.get<GeoResult>('/me/geo'),
  billing: () => api.get<BillingStatus>('/me/billing'),
  upgrade: () => api.post<BillingStatus>('/me/billing/upgrade'),
  cancel: () => api.post<BillingStatus>('/me/billing/cancel'),
  tossConfirm: (authKey: string, customerKey: string) =>
    api.post<BillingStatus>('/me/billing/toss/confirm', {
      auth_key: authKey,
      customer_key: customerKey,
    }),
  tossCancel: () => api.post<BillingStatus>('/me/billing/toss/cancel'),
  lemonSqueezyCheckoutUrl: (plan: 'monthly' | 'yearly') =>
    api.get<LemonSqueezyCheckoutOut>('/me/billing/lemonsqueezy/checkout-url', {
      params: { plan },
    }),
  exportXlsx: (params: { period: 'monthly'; month: string } | { period: 'annual'; year: string }) =>
    api.get<Blob>('/me/export.xlsx', { params, responseType: 'blob' }),
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
  /**
   * @param month YYYY-MM. 지정 시 그 달의 일회성 + 모든 반복 occurrence (가상) 반환.
   * @param includeRules true 면 반복 규칙 마스터 (recurrence!='none') 만 반환 — 반복 지출 관리 페이지용.
   */
  list: (params?: { month?: string; includeRules?: boolean }) =>
    api.get<Planned[]>('/planned', {
      params: {
        month: params?.month,
        include_rules: params?.includeRules ? 1 : undefined,
      },
    }),
  create: (body: Partial<Planned>) => api.post<Planned>('/planned', body),
  createBatch: (rows: Partial<Planned>[]) => api.post<Planned[]>('/planned/batch', rows),
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
export interface ParseApiResponse {
  items: ParsedItem[]
  /** AI 가 의도는 파악했지만 정보 부족 시 사용자에게 안내할 follow-up (locale-aware). */
  follow_up?: string | null
}
export const aiApi = {
  parse: (body: ParseInput) =>
    api.post<ParseApiResponse>('/ai/parse', body),
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
  // GDPR
  exportUser: (userId: number) =>
    api.get<Blob>(`/admin/users/${userId}/export`, { responseType: 'blob' }),
  hardDelete: (userId: number, confirmEmail: string) =>
    api.delete<AdminActionResult>(`/admin/users/${userId}/hard`, {
      params: { confirm: confirmEmail },
    }),
  // Announcements (admin)
  listAnnouncements: () => api.get<Announcement[]>('/admin/announcements'),
  createAnnouncement: (body: AnnouncementCreate) =>
    api.post<Announcement>('/admin/announcements', body),
  updateAnnouncement: (id: number, patch: AnnouncementUpdate) =>
    api.patch<Announcement>(`/admin/announcements/${id}`, patch),
  deleteAnnouncement: (id: number) =>
    api.delete<AdminActionResult>(`/admin/announcements/${id}`),
  // AI usage
  aiUsageSummary: () => api.get<AIUsageSummary>('/admin/ai-usage/summary'),
}

// ===== Announcements (public) =====
export const announcementsApi = {
  active: () => api.get<Announcement[]>('/announcements/active'),
}

// ===== Constants =====
export const SUPPORT_EMAIL = 'master@aitrend.kr'
