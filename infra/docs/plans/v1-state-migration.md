# v1 State Migration Plan: Ledger.jsx → TanStack Query + Backend CRUD

**Author**: R1 Architect (Plan subagent), 2026-05-17
**Subject**: `atm-ledger/frontend/src/pages/Ledger.jsx` (1590 lines)
**Goal**: replace `SEED_ENTRIES` / `SEED_PLANNED` / `SEED_REFLECTIONS` / `DEFAULT_INCOME` / `useState`-only stores with `useQuery` / `useMutation` against existing API surface, while keeping the entire UI intact.

---

## 0. Pre-flight (Repository invariants)

| Concern | State today |
|---|---|
| QueryClient | Already mounted in `frontend/src/main.tsx` line 11 with `staleTime: 0` |
| Auth | `AuthProvider` already loads `/auth/me` and stores `user` (incl. `monthly_income`, `monthly_budget`) |
| API surface | `frontend/src/services/api.ts` already exposes `entriesApi`, `plannedApi`, `reflectionsApi`, `authApi.updateMe`, `aiApi`, `geocodeApi` |
| Routes | `Ledger.tsx` wraps `Ledger.jsx`; `App.tsx` already protects route |
| Backend shape | `place_name` / `place_lat` / `place_lng` / `place_address` (flat snake_case), `photos: {id, url}[]` |
| Frontend shape (today) | `entry.place = { name, lat, lng, address }` (nested), `entry.photos = string[]` (data URLs) |

The migration is **pure frontend** — no backend changes required.

---

## 1. Phase Breakdown

Five sequential phases. Each is shippable and independently verifiable by R5.

| Phase | Scope | Why this order | Effort |
|---|---|---|---|
| **P1** Adapter + Read-only queries | Build `mapEntryFromApi` / `mapEntryToApi`, replace `useState(SEED_ENTRIES)` etc. with `useQuery`. No writes yet. | Decouples shape mismatch first; validates mapping in isolation. | 4 h |
| **P2** Income / budget on user profile | Pull `income`, `budget` from `useAuth().user.monthly_income/_budget`; save via `authApi.updateMe` mutation. | Smallest mutation; exercises pattern end-to-end. | 1.5 h |
| **P3** Reflections + Planned mutations | Add/delete reflections, add/edit/delete planned via `useMutation` with `queryClient.invalidateQueries`. | Simplest mutations (no photos, no place nesting). | 3 h |
| **P4** Entries mutations | `handleSend`, `updateEntry`, `deleteEntry`, mood-bulk-update (line 1437), rating (line 1492), review (line 1504). Optimistic where UX demands. | Most complex; needs mapping layer + optimistic updates. | 5 h |
| **P5** Photo upload migration | Replace base64 FileReader pattern with `entriesApi.uploadPhoto`; `removePhoto` calls `entriesApi.removePhoto`. | Last because requires entry to exist in DB; depends on P4. | 2.5 h |
| **P6** SEED cleanup + onboarding | Delete `SEED_*` and `DEFAULT_INCOME`. Empty-state UI copy for new users. | After all CRUD works against real backend. | 1 h |

**Total: ~17 h** for a single Frontend Engineer agent (R3). +~3 h R4 iteration. **Realistic: 2 working days.**

**Decision on SEED data**: drop entirely (option A). Rationale: multi-tenant SaaS — seeding fake data on signup would conflict with user's real ledger. Replace with empty-state hints. Original `SEED_*` arrays can live as a temporary `__demo.ts` fixture used only in Vitest. (R5 owns this fixture file.)

---

## 2. File-by-file Change List

All changes are inside `atm-ledger/frontend/src/`. No backend edits.

### 2.1 New files to create

#### `frontend/src/services/ledgerMappers.ts` (new, ~70 lines)

Pure functions, no React. Reused by hooks and tests.

- `mapEntryFromApi(api)` — collapses flat `place_*` into nested `place` (null if `place_name` is null); maps `photos: EntryPhoto[]` to `photos: string[]` (URLs only) **plus** preserves photo IDs in parallel `photoMeta: {id, url}[]` so `removePhoto` knows the id.
- `mapEntryToApi(ui)` — flattens nested `place` → `place_name` / `place_lat` / `place_lng` / `place_address`; strips `photos`/`photoMeta` (photos go through different endpoint).
- Type exports: `UiEntry`, `UiPlace`.

#### `frontend/src/hooks/useLedgerData.ts` (new, ~120 lines)

```ts
export function useEntries() {
  return useQuery({
    queryKey: ['entries'],
    queryFn: async () => (await entriesApi.list()).data.map(mapEntryFromApi),
    enabled: !!tokenStore.access,
  })
}
export function usePlanned() { /* similar */ }
export function useReflections() { /* all, no month filter — client-side filter parity */ }

export function useCreateEntry() { /* mutation, invalidates ['entries'] */ }
export function useUpdateEntry() { /* mutation, optimistic for rating/review/mood */ }
export function useDeleteEntry() { /* mutation, optimistic */ }
export function useUploadEntryPhoto() { /* invalidates ['entries'] */ }
export function useRemoveEntryPhoto() { /* optimistic */ }

export function useCreatePlanned() {}
export function useUpdatePlanned() {}
export function useDeletePlanned() {}

export function useCreateReflection() {}
export function useDeleteReflection() { /* optimistic */ }

export function useUpdateProfile() { /* invalidates ['me'] */ }
```

Query key strategy: flat arrays (`['entries']`, `['planned']`, `['reflections']`). No month filter at query level — current code filters client-side via `entries.filter(e => e.date.startsWith(monthKey))`. One cache key + derived data (`placesMap`, `annualData`, `getMonthData`, `calendarDays`) just works.

> If list sizes exceed ~1000 entries we will move to `['entries', month]` keys. Out of scope for v1.

### 2.2 Files modified

#### `frontend/src/pages/Ledger.jsx`

Each item below is **line-anchored** with a verb.

| # | Lines | Symbol | Action |
|---|---|---|---|
| L01 | 18–90 | `SEED_ENTRIES` IIFE | REMOVE (P6). Until P6, leave in place but unreferenced. |
| L02 | 92 | `DEFAULT_INCOME` const | REMOVE in P2 |
| L03 | 94–103 | `SEED_REFLECTIONS` IIFE | REMOVE in P6 |
| L04 | 105–115 | `SEED_PLANNED` IIFE | REMOVE in P6 |
| L05 | 121 | `useState(SEED_ENTRIES)` | REPLACE → `const { data: entries = [] } = useEntries()` (P1) |
| L06 | 122 | `useState(SEED_PLANNED)` | REPLACE → `const { data: planned = [] } = usePlanned()` (P1) |
| L07 | 123 | `useState(SEED_REFLECTIONS)` | REPLACE → `const { data: reflections = [] } = useReflections()` (P1) |
| L08 | 124 | `useState(DEFAULT_INCOME)` | REPLACE in P2 — `useAuth().user?.monthly_income ?? 0`; setter → `updateProfile.mutate({monthly_income})` |
| L09 | 125 | `useState(800000)` budget | REPLACE in P2 — same as income |
| L10 | 165–172 | `getMonthData` | KEEP unchanged |
| L11 | 178–181 | `upcomingThisMonth`/`Total`/`trulyFree` | KEEP unchanged |
| L12 | 237–257 | `placesMap` IIFE | KEEP STRUCTURALLY — depends on `entries[].place` which mapper guarantees |
| L13 | 267–290 | `handlePhotoUpload` | REPLACE entirely in P5 |
| L14 | 339–379 | `handleSend` | REPLACE in P4 |
| L15 | 381 | `deleteEntry` | REPLACE → `useDeleteEntry().mutate(id)` (P4) |
| L16 | 382–394 | `updateEntry` | REPLACE in P4. Drop `selectedPlace` re-sync block — invalidation flows through `placesMap`. **BUT** see §6 R-01. |
| L17 | 396–401 | `removePhoto` | REPLACE in P5 — needs photo id, not index |
| L18 | 403–409 | `addReflection` | REPLACE → `useCreateReflection().mutate(...)` (P3) |
| L19 | 410 | `deleteReflection` | REPLACE → `useDeleteReflection().mutate(id)` (P3) |
| L20 | 584 | income `onChange` | REPLACE → `onBlur` → `updateProfile.mutate({monthly_income: ...})` (P2). Local mirror state. |
| L21 | 589 | budget input | Same as L20 |
| L22 | 1437 | mood bulk update | P4: `Promise.all(visits.map(...))` then invalidate once |
| L23 | 1492 | star rating onClick | P4: `updateEntry.mutate({id, rating})` — optimistic |
| L24 | 1504 | review onBlur | P4: `updateEntry.mutate({id, review})` |
| L25 | 1521 | `removePhoto(v.id, idx)` | P5: pass `photoMeta[idx].id` not index |
| L26 | 1528 | photo upload button | P5: file → `entriesApi.uploadPhoto(v.id, file)` directly |

#### `frontend/src/pages/Ledger.tsx` (wrapper)
No changes.

#### `frontend/src/hooks/useAuth.tsx`
No change. After P2, mutation's `onSuccess` calls `useAuth().refresh()`.

---

## 3. Mapping Table (frontend ⇄ backend)

### Entry

| Frontend (UiEntry) | Backend | Conversion |
|---|---|---|
| `id: number` | `id: int` | identity |
| `description: string` | `description: str` | identity |
| `amount: number` | `amount: int` | identity |
| `category: string` | `category: str` | identity (validated against `CATEGORIES` keys) |
| `date: 'YYYY-MM-DD'` | `date: 'YYYY-MM-DD'` | identity |
| `place: { name, lat, lng, address } \| null` | `place_name`, `place_lat`, `place_lng`, `place_address` (each nullable) | **nest on read, flatten on write** |
| `rating: 1..5 \| null` | `rating: int \| null` | identity |
| `review: string \| null` | `review: str \| null` | identity |
| `mood: 'again'\|'normal'\|'avoid' \| null` | `mood: str \| null` | identity. **Note R-04: backend comment says `never`, frontend uses `avoid`** |
| `photos: string[]` (URL list) | `photos: {id, url}[]` | derive `photos.map(p => p.url)`; keep raw as `photoMeta` |
| `photoMeta: {id, url}[]` (frontend-only) | same | preserved for delete |

```ts
const mapEntryFromApi = ({ place_name, place_lat, place_lng, place_address, photos, ...rest }) => ({
  ...rest,
  place: place_name ? { name: place_name, lat: place_lat, lng: place_lng, address: place_address } : null,
  photos: photos.map(p => p.url),
  photoMeta: photos,
})

const mapEntryToApi = ({ place, photos, photoMeta, ...rest }) => ({
  ...rest,
  ...(place
    ? { place_name: place.name, place_lat: place.lat, place_lng: place.lng, place_address: place.address }
    : { place_name: null, place_lat: null, place_lng: null, place_address: null }),
})
```

### Planned

| Frontend | Backend | Notes |
|---|---|---|
| `id: number` | `id: int` | Seeds use string IDs (`'p1'`, `'u'+Date.now()`). Disappears after P3. |
| `description`, `amount`, `category`, `date`, `type`, `note` | identical | passthrough |

### Reflection

| Frontend | Backend | Notes |
|---|---|---|
| `id: number` | `id: int` | Seeds use string IDs. Disappears post-P3. |
| `month`, `type`, `text` | identical | passthrough |
| `createdAt: string` (frontend seed only) | not exposed | DROP |

### User profile

| Frontend (component state) | Backend (`User` + `/auth/me`) |
|---|---|
| `income` | `monthly_income` |
| `budget` | `monthly_budget` |

---

## 4. Detailed Mutation Logic

### 4.1 `handleSend` rewrite (P4)

```js
const createEntry = useCreateEntry()
const createPlanned = useCreatePlanned()

const handleSend = async () => {
  if (!input.trim() && !pendingImage) return
  setMessages(prev => [...prev, { role: 'user', text: input || '영수증', image: pendingImage?.preview, time: new Date() }])
  const cur = input, curImg = pendingImage
  setInput(''); setPendingImage(null); setLoading(true)
  try {
    const parsed = await parseWithClaude(cur, curImg)
    if (!parsed?.length) {
      setMessages(prev => [...prev, { role: 'assistant', text: '다시 적어줄래?', time: new Date() }])
      return
    }
    const spentItems = parsed.filter(p => p.kind === 'spent')
    const plannedItems = parsed.filter(p => p.kind === 'planned')

    const createdEntries = []
    for (const p of spentItems) {
      let place = null
      if (p.placeName) {
        const geo = await geocodePlace(p.placeName)
        place = { name: p.placeName, ...geo }
      }
      const created = await createEntry.mutateAsync({
        description: p.description, amount: p.amount,
        category: CATEGORIES[p.category] ? p.category : '기타',
        date: p.date, place, rating: null, review: null, mood: null,
      })
      createdEntries.push(created)
    }
    for (const p of plannedItems) {
      await createPlanned.mutateAsync({
        description: p.description, amount: p.amount,
        category: CATEGORIES[p.category] ? p.category : '기타',
        date: p.date, type: 'event',
      })
    }
    const hasPlace = createdEntries.some(e => e.place)
    setMessages(prev => [...prev, {
      role: 'assistant',
      text: `기록했어 ✓ (${createdEntries.length + plannedItems.length}건)${hasPlace ? '\n📍 장소 핀 찍었어. 별점이랑 사진 남겨봐!' : ''}`,
      time: new Date(),
    }])
  } catch (err) {
    setMessages(prev => [...prev, { role: 'assistant', text: '다시 시도해줘.', time: new Date() }])
  } finally {
    setLoading(false)
  }
}
```

### 4.2 Photo upload rewrite (P5)

```js
const uploadPhoto = useUploadEntryPhoto()
const removePhotoMut = useRemoveEntryPhoto()

const handlePhotoUpload = async (e, entryId) => {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    await uploadPhoto.mutateAsync({ entryId, file })
  } catch (err) {
    toast.error('사진 업로드 실패: ' + (err.response?.data?.detail || '다시 시도해줘'))
  } finally {
    setPhotoUploadEntry(null)
  }
}

const removePhoto = (entryId, photoId /* was: photoIdx */) => {
  removePhotoMut.mutate({ entryId, photoId })
}
```

Render site at line 1521 changes from `removePhoto(v.id, idx)` to `removePhoto(v.id, v.photoMeta[idx].id)`.

### 4.3 Optimistic update pattern: rating click

```ts
export function useUpdateEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }) =>
      entriesApi.update(id, mapEntryToApi(patch)).then(r => mapEntryFromApi(r.data)),
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['entries'] })
      const prev = qc.getQueryData(['entries'])
      qc.setQueryData(['entries'], (old) =>
        old?.map(e => e.id === id ? { ...e, ...patch } : e) ?? old
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(['entries'], ctx.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: ['entries'] }),
  })
}
```

---

## 5. Optimistic Update Strategy

| Mutation | Optimistic? | Rationale |
|---|---|---|
| `useCreateEntry` (chat send) | No | Server-generated id needed; chat shows pending dots |
| `useUpdateEntry` rating | **Yes** | Star click must feel instant |
| `useUpdateEntry` review (onBlur) | **Yes** | Persist instantly |
| `useUpdateEntry` mood | **Yes** | Multi-row, UI shows active immediately |
| `useDeleteEntry` | **Yes** | Row disappears; rollback on error |
| `useCreateReflection` | No | Form clears, list re-renders fast |
| `useDeleteReflection` | **Yes** | Hover-X expects instant feedback |
| `useCreatePlanned` | No | Same as create entry |
| `useUpdatePlanned` | **Yes** | (Future) |
| `useDeletePlanned` | **Yes** | (Future) |
| `useUploadEntryPhoto` | No | Need server URL; show spinner |
| `useRemoveEntryPhoto` | **Yes** | Tile disappears on X |
| `useUpdateProfile` | No | onBlur already debounces; toast on success |

---

## 6. Risks

### R-01 [P1] `selectedPlace` is a derived snapshot held in `useState`
**Where**: lines 147–149, 282–286, 384–393, 1436–1438.
**Issue**: `selectedPlace` created from `placesMap` at click time, then mutated locally. After migration, `placesMap` recomputes from query data every render, but `selectedPlace` would point to a stale snapshot.
**Fix**: replace `useState(selectedPlace)` with `useState(selectedPlaceName)` (just the key) and derive live place via `useMemo(() => placesMap.find(p => p.name === selectedPlaceName), [placesMap, selectedPlaceName])`. Mood bulk update (line 1437) drops local `setSelectedPlace` call — invalidation flows back through `placesMap`. **This is the single most important refactor.**

### R-02 [P1] `placesMap` truthy check
**Where**: line 239 `entries.filter(e => e.place)`. After mapping, `place: null` is falsy. ✅ No change.

### R-03 [P4] String IDs from seed
**Where**: lines 99, 110–114, 362, 406. Backend always returns int ids. **None found in render code** (grep confirmed). Safe.

### R-04 [P4] `mood` value drift — `avoid` (UI) vs `never` (model comment)
Backend has no enum validation. Existing modal shows `안 갈래` for `avoid`. No P0; R4 should flag for backend cleanup later.

### R-05 [P5] Photo upload requires entry to exist first
After P4, all entries are server-side. Phase boundary clean.

### R-06 [P2] Income/budget input per-keystroke
Switch from `onChange` to `onBlur` with local mirror state.

### R-07 [P1] Empty initial state
`Math.max(...annualData.months.map(x => x.total), 1)` already handles zero. R5 must add an empty-DB test.

### R-08 [P3] Reflections endpoint accepts no `month` query param
Frontend api.ts already supports it. Choosing NO month filter to keep one cache key. Acceptable for v1 (<500 reflections per user).

### R-09 [P5] FileReader is gone — loading state needed
Add `isPending` from `useUploadEntryPhoto` and conditionally render spinner.

### R-10 [P6] Removing SEED leaves empty UI on first login
Welcome at line 119 says "6개월 데이터가 들어있어 📊" — lie for real users. R8 Designer rewrite: `"안녕! 새 가계부야. 채팅으로 적어줘 — 예: '스벅 6500원' 또는 영수증 사진"`.

---

## 7. Acceptance Criteria (for R5 Test & Eval)

### P1 Acceptance
- [ ] Network: `GET /entries`, `GET /planned`, `GET /reflections` exactly once each on load
- [ ] Empty DB: all 5 tabs render without crashing
- [ ] Calendar: current month with no events; empty-state copy visible
- [ ] `placesMap.length === 0` → 장소 탭 still renders
- [ ] Vitest: `mapEntryFromApi({place_name: null, ...})` returns `place: null`
- [ ] Vitest: full place + photos round-trip

### P2 Acceptance
- [ ] Edit income → onBlur → `PATCH /auth/me` fires
- [ ] Refresh → income persists from backend
- [ ] `useAuth().user.monthly_budget` is single source of truth for budget
- [ ] Vitest: typing does NOT trigger PATCH; only blur does

### P3 Acceptance
- [ ] Type reflection → save → `POST /reflections` → list updates without manual refresh
- [ ] X-button → `DELETE /reflections/{id}` → optimistic disappearance
- [ ] Pytest: backend filters reflections by `user_id`

### P4 Acceptance
- [ ] "스벅 6500원" → `POST /ai/parse` → `POST /entries` → appears in calendar AND places map
- [ ] Star click → optimistic update → `PATCH /entries/{id}` → 200 OK
- [ ] Review onBlur → `PATCH` with `{review: "..."}`
- [ ] Mood tag click on place with 3 visits → 3 PATCH requests → one invalidate
- [ ] Delete → `DELETE /entries/{id}` → removed from all tabs
- [ ] **Critical**: open place modal, click star, modal stays open, rating updates inside (validates R-01)

### P5 Acceptance
- [ ] Upload tile → multipart `POST /entries/{id}/photos` → gallery updates with URL (NOT base64)
- [ ] X on photo → `DELETE /entries/{id}/photos/{photo_id}` → optimistic vanish
- [ ] Reject >10MB with toast
- [ ] Reject non-image MIME with toast

### P6 Acceptance
- [ ] All `SEED_*` and `DEFAULT_INCOME` deleted
- [ ] Welcome message updated (R8 approves)
- [ ] First signup → empty ledger renders cleanly → add 1 entry → all 5 tabs reflect it
- [ ] Bundle size: Ledger.jsx ~30% smaller

### Golden-set Regression (R5)
- [ ] `tests/eval/ledger_parse.jsonl` cases pass — AI path unchanged
- [ ] E2E playwright (optional v1.1): full lifecycle test

---

## 8. Sequencing & Dependencies

```
   P1 (read) ─┬─> P2 (profile) ──┐
              ├─> P3 (reflect/planned) ──┐
              └─> P4 (entries CRUD) ─> P5 (photos) ─> P6 (cleanup)
```

P2, P3, P4 can run in parallel by separate agents (different functions in same file → coordinate to avoid merge conflicts; recommend one R3 agent sequentially).

P5 strictly waits for P4. P6 strictly waits for all earlier phases.

---

## 9. Test Plan Anchor (R5)

New test files:
- `frontend/src/services/__tests__/ledgerMappers.test.ts` — 8 cases: place null/full, photos empty/present
- `frontend/src/hooks/__tests__/useLedgerData.test.tsx` — MSW mocked endpoints, optimistic rollback on error
- `backend/tests/test_entries_integration.py` — user-isolation test: user A's PATCH on user B's entry returns 404

---

## 10. Out of Scope (deferred to v1.1+)

- Pagination of entries
- Background sync on visibility change
- Offline write queue
- Migrating Ledger.jsx → .tsx
- Backend `mood` enum constraint
- Cloudflare R2 photo storage (env-driven, no frontend impact)

---

## 11. Rollback Strategy

Each phase is a separate PR. If P4 breaks production:
1. Revert P4 only — P1/P2/P3 stay (no entry-mutation dependency)
2. UI remains read-only with profile editing
3. P5 cannot be reverted independently of P4 (hooks dependency)

`SEED_*` constants stay until P6 specifically so emergency `git revert` doesn't leave empty UI.

---

## Critical Files for Implementation
- `frontend/src/pages/Ledger.jsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/ledgerMappers.ts` (new)
- `frontend/src/hooks/useLedgerData.ts` (new)
- `frontend/src/hooks/useAuth.tsx`
