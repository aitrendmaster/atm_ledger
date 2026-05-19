// Ledger 페이지의 모든 server state 를 다루는 React Query 훅.
// queryKey 전략은 평탄: ['entries'], ['planned'], ['reflections'].
// 월별 필터는 클라이언트 측 (getMonthData 등) 그대로 유지 — v1 기준 1 사용자 데이터량은 단일 캐시로 충분.

import {
  QueryKey,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import toast from 'react-hot-toast'

import {
  authApi,
  entriesApi,
  Entry,
  Planned,
  plannedApi,
  Reflection,
  reflectionsApi,
  tokenStore,
  User,
} from '../services/api'
import {
  mapEntryFromApi,
  mapEntryToApi,
  UiEntry,
} from '../services/ledgerMappers'
import { useAuth } from './useAuth'

const ENTRIES_KEY: QueryKey = ['entries']
const PLANNED_KEY: QueryKey = ['planned']
const REFLECTIONS_KEY: QueryKey = ['reflections']

// ===== Queries =====

export function useEntries() {
  return useQuery<UiEntry[]>({
    queryKey: ENTRIES_KEY,
    queryFn: async () => (await entriesApi.list()).data.map(mapEntryFromApi),
    enabled: !!tokenStore.access,
  })
}

export function usePlanned() {
  return useQuery<Planned[]>({
    queryKey: PLANNED_KEY,
    queryFn: async () => (await plannedApi.list()).data,
    enabled: !!tokenStore.access,
  })
}

export function useReflections() {
  return useQuery<Reflection[]>({
    queryKey: REFLECTIONS_KEY,
    queryFn: async () => (await reflectionsApi.list()).data,
    enabled: !!tokenStore.access,
  })
}

// ===== Entry mutations =====

export interface CreateEntryInput {
  description: string
  amount: number
  category: string
  date: string
  place?: UiEntry['place']
  rating?: number | null
  review?: string | null
  mood?: string | null
}

export function useCreateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateEntryInput) => {
      const body = mapEntryToApi({
        description: input.description,
        amount: input.amount,
        category: input.category,
        date: input.date,
        place: input.place ?? null,
        rating: input.rating ?? null,
        review: input.review ?? null,
        mood: input.mood ?? null,
      })
      const r = await entriesApi.create(body)
      return mapEntryFromApi(r.data)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTRIES_KEY })
    },
    onError: (err: any) => {
      toast.error('항목 저장 실패: ' + (err?.response?.data?.detail || '잠시 후 다시 시도'))
    },
  })
}

export interface UpdateEntryInput {
  id: number
  patch: Partial<Omit<UiEntry, 'id' | 'photos' | 'photoMeta'>>
}

export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: UpdateEntryInput) => {
      const r = await entriesApi.update(id, mapEntryToApi(patch))
      return mapEntryFromApi(r.data)
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY })
      const prev = qc.getQueryData<UiEntry[]>(ENTRIES_KEY)
      qc.setQueryData<UiEntry[]>(ENTRIES_KEY, (old) =>
        old?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev)
      toast.error('수정 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  })
}

export function useDeleteEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await entriesApi.remove(id)
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY })
      const prev = qc.getQueryData<UiEntry[]>(ENTRIES_KEY)
      qc.setQueryData<UiEntry[]>(ENTRIES_KEY, (old) => old?.filter((e) => e.id !== id) ?? old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev)
      toast.error('삭제 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  })
}

// ===== Photo mutations =====

export function useUploadEntryPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entryId, file }: { entryId: number; file: File }) => {
      const r = await entriesApi.uploadPhoto(entryId, file)
      return r.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENTRIES_KEY })
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      const code = err?.response?.status
      if (code === 413) toast.error('사진이 너무 커 (10MB 이하만)')
      else if (code === 415) toast.error('지원하지 않는 형식이야 (jpg/png/webp)')
      else toast.error('사진 업로드 실패: ' + (detail || '잠시 후 다시 시도'))
    },
  })
}

export function useRemoveEntryPhoto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ entryId, photoId }: { entryId: number; photoId: number }) => {
      await entriesApi.removePhoto(entryId, photoId)
      return { entryId, photoId }
    },
    onMutate: async ({ entryId, photoId }) => {
      await qc.cancelQueries({ queryKey: ENTRIES_KEY })
      const prev = qc.getQueryData<UiEntry[]>(ENTRIES_KEY)
      qc.setQueryData<UiEntry[]>(ENTRIES_KEY, (old) =>
        old?.map((e) =>
          e.id === entryId
            ? {
                ...e,
                photoMeta: e.photoMeta.filter((p) => p.id !== photoId),
                photos: e.photoMeta.filter((p) => p.id !== photoId).map((p) => p.url),
              }
            : e,
        ) ?? old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ENTRIES_KEY, ctx.prev)
      toast.error('사진 삭제 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ENTRIES_KEY }),
  })
}

// ===== Planned mutations =====

export interface CreatePlannedInput {
  description: string
  amount: number
  category: string
  date: string
  type?: string
  note?: string | null
}

export function useCreatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePlannedInput) => {
      const r = await plannedApi.create({ type: 'event', ...input })
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PLANNED_KEY }),
    onError: (err: any) =>
      toast.error('예정 저장 실패: ' + (err?.response?.data?.detail || '다시 시도')),
  })
}

export function useUpdatePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Partial<Planned> }) => {
      const r = await plannedApi.update(id, patch)
      return r.data
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: PLANNED_KEY })
      const prev = qc.getQueryData<Planned[]>(PLANNED_KEY)
      qc.setQueryData<Planned[]>(PLANNED_KEY, (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...patch } : p)) ?? old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(PLANNED_KEY, ctx.prev)
      toast.error('수정 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PLANNED_KEY }),
  })
}

export function useDeletePlanned() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await plannedApi.remove(id)
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: PLANNED_KEY })
      const prev = qc.getQueryData<Planned[]>(PLANNED_KEY)
      qc.setQueryData<Planned[]>(PLANNED_KEY, (old) => old?.filter((p) => p.id !== id) ?? old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(PLANNED_KEY, ctx.prev)
      toast.error('삭제 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: PLANNED_KEY }),
  })
}

// ===== Reflection mutations =====

export interface CreateReflectionInput {
  month: string
  type: Reflection['type']
  text: string
}

export function useCreateReflection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateReflectionInput) => {
      const r = await reflectionsApi.create(input)
      return r.data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: REFLECTIONS_KEY }),
    onError: (err: any) =>
      toast.error('회고 저장 실패: ' + (err?.response?.data?.detail || '다시 시도')),
  })
}

export function useDeleteReflection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      await reflectionsApi.remove(id)
      return id
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: REFLECTIONS_KEY })
      const prev = qc.getQueryData<Reflection[]>(REFLECTIONS_KEY)
      qc.setQueryData<Reflection[]>(REFLECTIONS_KEY, (old) => old?.filter((r) => r.id !== id) ?? old)
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(REFLECTIONS_KEY, ctx.prev)
      toast.error('삭제 실패 — 되돌렸어')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: REFLECTIONS_KEY }),
  })
}

// ===== Profile (income / budget) =====

export interface UpdateProfileInput {
  monthly_income?: number
  monthly_budget?: number
}

export function useUpdateProfile() {
  const { refresh } = useAuth()
  return useMutation({
    mutationFn: async (patch: UpdateProfileInput) => {
      const r = await authApi.updateMe(patch as Partial<User>)
      return r.data
    },
    onSuccess: async () => {
      await refresh()
    },
    onError: (err: any) =>
      toast.error('저장 실패: ' + (err?.response?.data?.detail || '다시 시도')),
  })
}
