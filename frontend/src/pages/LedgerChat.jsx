import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Camera, TrendingUp, TrendingDown, Coffee, ShoppingBag, Utensils, Car, Home, Heart, Sparkles, X, Target, Trash2, RefreshCw, MessageCircle, Calendar, MapPin, Star, ThumbsUp, ThumbsDown, Minus, BookOpen, Bell, Plane, Gift, Plus, AlertCircle, Wallet, Clock, ChevronLeft, ChevronRight, Check, Grid, List as ListIcon, Lightbulb, PenLine, Compass, BarChart3, Quote, ExternalLink, Image as ImageIcon, Upload, LogOut } from 'lucide-react';
import { aiApi, geocodeApi, meApi } from '../services/api';
import { absolutizePhotoUrl } from '../services/ledgerMappers';
import { currencySymbol, formatCurrency } from '../utils/currency';
import { useAuth } from '../hooks/useAuth';
import {
  useEntries, usePlanned, useReflections,
  useCreateEntry, useUpdateEntry, useDeleteEntry,
  useUploadEntryPhoto, useRemoveEntryPhoto,
  useCreatePlanned, useUpdatePlanned, useDeletePlanned,
  useCreateReflection, useDeleteReflection,
  useUpdateProfile,
} from '../hooks/useLedgerData';

const CATEGORIES = {
  '식비': { icon: Utensils, color: '#E07856', bg: '#FDF0EA' },
  '카페/간식': { icon: Coffee, color: '#A0633C', bg: '#F5E9DD' },
  '쇼핑': { icon: ShoppingBag, color: '#8B5A8C', bg: '#F0E6F1' },
  '교통': { icon: Car, color: '#5B7C99', bg: '#E5ECF2' },
  '주거/공과금': { icon: Home, color: '#6B8E6B', bg: '#E8EEE6' },
  '건강/뷰티': { icon: Heart, color: '#C7657B', bg: '#F8E5E9' },
  '여행/이벤트': { icon: Plane, color: '#5B7C99', bg: '#E5ECF2' },
  '경조사/선물': { icon: Gift, color: '#C7657B', bg: '#F8E5E9' },
  '기타': { icon: Sparkles, color: '#7A7567', bg: '#EFECE6' },
};

export default function ChatLedger() {
  const { t } = useTranslation();
  const { user } = useAuth();
  // 사용자 통화. 신규 사용자는 가입 시 country_code 로부터 자동 설정됨. 기본 KRW.
  const currency = user?.currency_code || 'KRW';
  const cur = currencySymbol(currency);
  // 금액 + 통화 심볼 ("10,000원" 또는 "$10,000")
  const fmtAmt = (n) => formatCurrency(Number(n) || 0, currency);

  // ===== 서버 영속 상태 (TanStack Query) =====
  const { data: entries = [] } = useEntries();
  const { data: planned = [] } = usePlanned();
  const { data: reflections = [] } = useReflections();

  // ===== Mutations =====
  const createEntry = useCreateEntry();
  const updateEntryMut = useUpdateEntry();
  const deleteEntryMut = useDeleteEntry();
  const uploadPhotoMut = useUploadEntryPhoto();
  const removePhotoMut = useRemoveEntryPhoto();
  const createPlannedMut = useCreatePlanned();
  const updatePlannedMut = useUpdatePlanned();
  const deletePlannedMut = useDeletePlanned();
  const createReflectionMut = useCreateReflection();
  const deleteReflectionMut = useDeleteReflection();
  const updateProfile = useUpdateProfile();

  // ===== income / budget — 백엔드 user 프로파일이 source of truth =====
  // 입력 중에는 로컬 미러로 즉시 반영하고 onBlur 시 서버 저장.
  const [incomeDraft, setIncomeDraft] = useState(() => user?.monthly_income ?? 0);
  const [budgetDraft, setBudgetDraft] = useState(() => user?.monthly_budget ?? 0);
  useEffect(() => { if (user) setIncomeDraft(user.monthly_income ?? 0); }, [user?.monthly_income]);
  useEffect(() => { if (user) setBudgetDraft(user.monthly_budget ?? 0); }, [user?.monthly_budget]);
  const income = incomeDraft;
  const budget = budgetDraft;

  const [messages, setMessages] = useState([
    { role: 'assistant', text: `${t('ledger.messages.welcome')}\n\n${t('ledger.messages.welcomeHint')}`, time: new Date() },
  ]);
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState(null);
  const [activeTab, setActiveTab] = useState('calendar');
  const [reflectMode, setReflectMode] = useState('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [planMode, setPlanMode] = useState('current');
  const [newReflection, setNewReflection] = useState({ type: 'regret', text: '' });
  const [aiInsight, setAiInsight] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // 캘린더 상태 — selectedDateStr 만 보관, 실제 day 데이터는 calendarDays 에서 도출 (server state invalidate 시 자동 동기화)
  const [calMonth, setCalMonth] = useState(new Date());
  const [calViewMode, setCalViewMode] = useState('grid');
  const [selectedDateStr, setSelectedDateStr] = useState(null);

  // 장소 상태 — selectedPlaceName 만 보관, 실제 place 데이터는 placesMap 에서 도출
  const [selectedPlaceName, setSelectedPlaceName] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [photoUploadEntry, setPhotoUploadEntry] = useState(null);

  // 캘린더 일자 상세 모달 안에서 항목 수정/삭제 (지출·예정 공용)
  // editingDayItem: { id, kind: 'spent' | 'planned', draft: { description, amount, category, date } } | null
  const [editingDayItem, setEditingDayItem] = useState(null);

  // 채팅 입력 사용 가이드 모달 — 최초 가입/로그인 시 자동으로 열고, 닫으면 localStorage 에 표시
  const [showInputGuide, setShowInputGuide] = useState(false);
  useEffect(() => {
    try {
      const seen = localStorage.getItem('moa_chat_guide_seen');
      if (!seen) setShowInputGuide(true);
    } catch {
      /* localStorage 차단된 환경 (시크릿 모드 등) — 무시 */
    }
  }, []);
  const dismissInputGuide = () => {
    try { localStorage.setItem('moa_chat_guide_seen', '1'); } catch {}
    setShowInputGuide(false);
  };
  // 장소 위치 검색 (모달 안)
  const [placeSearchQuery, setPlaceSearchQuery] = useState('');
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [placeSearchedOnce, setPlaceSearchedOnce] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = now.toISOString().split('T')[0];

  const getMonthData = (monthKey) => {
    const monthEntries = entries.filter(e => e.date.startsWith(monthKey));
    const byCategory = {};
    Object.keys(CATEGORIES).forEach(cat => {
      byCategory[cat] = monthEntries.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
    });
    return { total: monthEntries.reduce((s, e) => s + e.amount, 0), byCategory, entries: monthEntries };
  };

  const thisMonthData = getMonthData(thisMonth);
  const lastMonthData = getMonthData(lastMonth);
  const monthTotal = thisMonthData.total;

  const upcomingThisMonth = planned.filter(p => p.date >= todayStr && p.date.startsWith(thisMonth));
  const upcomingNextMonth = planned.filter(p => p.date.startsWith(nextMonth));
  const upcomingTotal = upcomingThisMonth.reduce((s, p) => s + p.amount, 0);
  const trulyFree = budget - monthTotal - upcomingTotal;

  const annualData = (() => {
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const md = getMonthData(key);
      months.push({ key, month: d.getMonth() + 1, year: d.getFullYear(), label: `${d.getMonth() + 1}월`, ...md, isCurrent: key === thisMonth });
    }
    const yearTotal = months.reduce((s, m) => s + m.total, 0);
    const yearAvg = Math.round(yearTotal / months.filter(m => m.total > 0).length || 0);
    const categoryYearTotals = {};
    Object.keys(CATEGORIES).forEach(cat => {
      categoryYearTotals[cat] = months.reduce((s, m) => s + (m.byCategory[cat] || 0), 0);
    });
    return { months, yearTotal, yearAvg, categoryYearTotals };
  })();

  const categoryInsights = (() => {
    const target = getMonthData(selectedMonth);
    const prevDate = new Date(selectedMonth + '-01');
    prevDate.setMonth(prevDate.getMonth() - 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    const prev = getMonthData(prevKey);
    const insights = [];
    Object.keys(CATEGORIES).forEach(cat => {
      const curr = target.byCategory[cat], prevAmount = prev.byCategory[cat];
      if (curr === 0 && prevAmount === 0) return;
      const diff = curr - prevAmount;
      const pct = prevAmount > 0 ? (diff / prevAmount) * 100 : null;
      insights.push({ category: cat, current: curr, prev: prevAmount, diff, pct });
    });
    return insights.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  })();

  const evaluateGoals = (monthKey) => {
    const monthGoals = reflections.filter(r => r.month === monthKey && r.type === 'goal');
    const targetMonth = getMonthData(monthKey);
    return monthGoals.map(g => {
      const text = g.text.toLowerCase();
      let achieved = null;
      Object.keys(CATEGORIES).forEach(cat => {
        if (text.includes(cat.toLowerCase()) || text.includes(cat.split('/')[0].toLowerCase())) {
          const amountMatch = text.match(/(\d+)만원?\s*이하/);
          if (amountMatch) {
            const limit = parseInt(amountMatch[1]) * 10000;
            achieved = targetMonth.byCategory[cat] <= limit;
          }
        }
      });
      return { ...g, achieved };
    });
  };

  // 장소별 그룹핑 — entries 가 invalidate 되면 자동 재계산.
  const placesMap = useMemo(() => {
    const map = new Map();
    entries.filter(e => e.place).forEach(e => {
      const key = e.place.name;
      if (!map.has(key)) map.set(key, {
        name: e.place.name, lat: e.place.lat, lng: e.place.lng, address: e.place.address,
        visits: [], totalSpent: 0, category: e.category,
      });
      const p = map.get(key);
      // 최신 좌표가 채워진 visit 가 있다면 그걸 그룹 좌표로 승격 (입력 순서 무관)
      if (p.lat == null && e.place.lat != null) p.lat = e.place.lat;
      if (p.lng == null && e.place.lng != null) p.lng = e.place.lng;
      if (!p.address && e.place.address) p.address = e.place.address;
      p.visits.push(e);
      p.totalSpent += e.amount;
    });
    return Array.from(map.values()).map(p => ({
      ...p,
      visitCount: p.visits.length,
      avgRating: p.visits.filter(v => v.rating).length > 0
        ? p.visits.filter(v => v.rating).reduce((s, v) => s + v.rating, 0) / p.visits.filter(v => v.rating).length : 0,
      allPhotos: p.visits.flatMap(v => v.photos || []),
      mood: p.visits[0].mood,
    })).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [entries]);

  // selectedPlace 는 placesMap 에서 매 렌더 도출. server state 가 바뀌면 자동 갱신.
  const selectedPlace = useMemo(
    () => (selectedPlaceName ? placesMap.find(p => p.name === selectedPlaceName) || null : null),
    [placesMap, selectedPlaceName],
  );

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPendingImage({ data: reader.result.split(',')[1], preview: reader.result, mediaType: file.type });
    reader.readAsDataURL(file);
  };

  const handlePhotoUpload = async (e, entryId) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadPhotoMut.mutateAsync({ entryId, file });
    } finally {
      setPhotoUploadEntry(null);
      // 같은 input 으로 같은 파일을 다시 골라도 onChange 가 다시 트리거되도록
      if (e.target) e.target.value = '';
    }
  };

  const parseWithClaude = async (userText, imageData) => {
    // 백엔드 프록시 경유. API 키는 서버에만 존재.
    const body = imageData
      ? { text: userText || '영수증 분석', image: { data: imageData.data, media_type: imageData.mediaType } }
      : { text: userText };
    const res = await aiApi.parse(body);
    // backend는 placeName 대신 place_name 으로 응답. UI 호환 위해 매핑.
    return (res.data.items || []).map(it => ({
      kind: it.kind,
      description: it.description,
      amount: it.amount,
      category: it.category,
      date: it.date,
      placeName: it.place_name,
    }));
  };

  // 사용자 위치 (Geolocation API). 첫 검색 시 권한 요청. 거부 시 null 로 남아 전국 검색.
  // geoStatus: idle | requesting | granted | denied | unsupported | ip
  //   - ip: 옵트인된 사용자의 IP 기반 추정 좌표 (정확도 ~ 도시 단위)
  //   - granted: 브라우저 Geolocation 으로 받은 정확한 좌표 (덮어쓰기 우선)
  const [userGeo, setUserGeo] = useState(null); // { lat, lng, source } | null
  const [geoStatus, setGeoStatus] = useState('idle');
  const [geoLabel, setGeoLabel] = useState(''); // "서울 ·" 같은 라벨

  // 컴포넌트 마운트 시 IP 기반 위치를 자동 fetch — 옵트인된 사용자만 lat/lng 가 채워짐.
  // 사용자가 명시적으로 "내 위치 사용" 을 누르면 navigator.geolocation 으로 더 정확한 좌표로 덮어씀.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await meApi.geo();
        if (cancelled || !res?.data?.enabled) return;
        const g = res.data;
        if (typeof g.lat === 'number' && typeof g.lng === 'number') {
          // 이미 GPS 좌표가 있으면 덮어쓰지 않음
          setUserGeo((prev) => (prev && prev.source === 'gps' ? prev : { lat: g.lat, lng: g.lng, source: 'ip' }));
          setGeoStatus((s) => (s === 'granted' ? s : 'ip'));
          setGeoLabel([g.city, g.region].filter(Boolean).join(', '));
        }
      } catch {
        /* 옵트인 안 됐거나 네트워크 오류 — 무시 */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const requestUserGeo = () => {
    if (!('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return Promise.resolve(null);
    }
    setGeoStatus('requesting');
    return new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const g = { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' };
          setUserGeo(g);
          setGeoStatus('granted');
          resolve(g);
        },
        () => {
          setGeoStatus('denied');
          resolve(null);
        },
        { timeout: 8000, maximumAge: 5 * 60 * 1000 },
      );
    });
  };

  // 수동 위치 검색 — Geolocation 있으면 주변 우선, 없으면 전국. 임의 폴백 좌표 없음.
  const searchPlaces = async (placeName) => {
    const geo = userGeo;
    try {
      const res = await geocodeApi.search(placeName, geo?.lat, geo?.lng, 5);
      return res.data.results || [];
    } catch (e) {
      return [];
    }
  };

  const generateMonthInsight = async (monthKey) => {
    setAiLoading(true); setAiInsight(null);
    try {
      const target = getMonthData(monthKey);
      const prevDate = new Date(monthKey + '-01');
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      const prev = getMonthData(prevKey);

      // 백엔드 프록시 경유. 집계는 클라이언트에서, AI 호출은 서버에서.
      const res = await aiApi.insight(monthKey,
        { total: target.total, byCategory: target.byCategory },
        { total: prev.total, byCategory: prev.byCategory },
      );
      setAiInsight(res.data);
    } catch (err) {
      setAiInsight({ summary: '인사이트를 가져오지 못했어.', praise: '', concern: '', suggestion: '' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !pendingImage) return;
    setMessages(prev => [...prev, { role: 'user', text: input || '영수증', image: pendingImage?.preview, time: new Date() }]);
    const cur = input, curImg = pendingImage;
    setInput(''); setPendingImage(null); setLoading(true);
    try {
      const parsed = await parseWithClaude(cur, curImg);
      if (!parsed || parsed.length === 0) {
        setMessages(prev => [...prev, { role: 'assistant', text: t('ledger.input.retry'), time: new Date() }]);
      } else {
        // place_name 만 저장하고 좌표는 null. 사용자가 장소 상세 모달에서 직접 검색·선택.
        const spentItems = parsed.filter(p => p.kind === 'spent');
        const plannedItems = parsed.filter(p => p.kind === 'planned');

        const createdSpent = [];
        for (const p of spentItems) {
          try {
            const created = await createEntry.mutateAsync({
              description: p.description,
              amount: p.amount,
              category: CATEGORIES[p.category] ? p.category : '기타',
              date: p.date,
              place: p.placeName
                ? { name: p.placeName, lat: null, lng: null, address: null }
                : null,
            });
            createdSpent.push(created);
          } catch {
            /* toast 는 useCreateEntry onError 가 처리 */
          }
        }
        let createdPlannedCount = 0;
        for (const p of plannedItems) {
          try {
            await createPlannedMut.mutateAsync({
              description: p.description,
              amount: p.amount,
              category: CATEGORIES[p.category] ? p.category : '기타',
              date: p.date,
              type: 'event',
            });
            createdPlannedCount += 1;
          } catch {
            /* toast 는 useCreatePlanned onError 가 처리 */
          }
        }
        const namedPlace = createdSpent.find(e => e.place);
        const placeHint = namedPlace
          ? '\n' + t('ledger.messages.placeRecognized', { name: namedPlace.place.name })
          : '';
        const totalSaved = createdSpent.length + createdPlannedCount;
        if (totalSaved > 0) {
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: t('ledger.messages.recorded', { count: totalSaved }) + placeHint,
            time: new Date(),
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            text: t('ledger.input.tryAgain'),
            time: new Date(),
          }]);
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: t('ledger.input.tryAgain'), time: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const deleteEntry = (id) => deleteEntryMut.mutate(id);
  const updateEntry = (id, updates) => updateEntryMut.mutate({ id, patch: updates });

  // photoId 기반. UI 호출처에서는 photoMeta[idx].id 를 전달.
  const removePhoto = (entryId, photoId) => removePhotoMut.mutate({ entryId, photoId });

  // 예정(planned) 항목 수정/삭제 — 백엔드 mutate
  const updatePlanned = (id, updates) => updatePlannedMut.mutate({ id, patch: updates });
  const deletePlanned = (id) => deletePlannedMut.mutate(id);

  // 캘린더 일자 모달 안에서 사용. 항목을 편집 모드로 전환한다.
  const startEditDayItem = (item, kind) => {
    setEditingDayItem({
      id: item.id,
      kind,
      draft: {
        description: item.description || '',
        amount: item.amount || 0,
        category: item.category || '기타',
        date: item.date || '',
      },
    });
  };
  const cancelEditDayItem = () => setEditingDayItem(null);
  const saveEditDayItem = () => {
    if (!editingDayItem) return;
    const { id, kind, draft } = editingDayItem;
    const cleaned = {
      description: (draft.description || '').trim() || '(이름 없음)',
      amount: Math.max(0, Number(draft.amount) || 0),
      category: CATEGORIES[draft.category] ? draft.category : '기타',
      date: draft.date,
    };
    if (kind === 'planned') {
      updatePlanned(id, cleaned);
    } else {
      updateEntry(id, cleaned);
    }
    // server state invalidate 가 calendarDays → selectedDate 도 자동 재계산해줌
    setEditingDayItem(null);
  };
  const removeDayItem = (item, kind) => {
    if (!window.confirm(t('ledger.entryEdit.deleteConfirm', { name: item.description }))) return;
    if (kind === 'planned') {
      deletePlanned(item.id);
    } else {
      deleteEntry(item.id);
    }
    if (editingDayItem?.id === item.id) setEditingDayItem(null);
  };

  const addReflection = (month, type, text) => {
    if (!text.trim()) return;
    createReflectionMut.mutate(
      { month, type, text: text.trim() },
      { onSuccess: () => setNewReflection({ type: 'regret', text: '' }) },
    );
  };
  const deleteReflection = (id) => deleteReflectionMut.mutate(id);

  const REFLECT_TYPES = {
    regret: { label: t('ledger.reflect.types.regret.label'),   icon: TrendingDown, color: '#E07856', bg: '#FDF0EA', placeholder: t('ledger.reflect.types.regret.placeholder') },
    praise: { label: t('ledger.reflect.types.praise.label'),   icon: ThumbsUp,     color: '#6B8E6B', bg: '#E8EEE6', placeholder: t('ledger.reflect.types.praise.placeholder') },
    goal:   { label: t('ledger.reflect.types.goal.label'),     icon: Target,       color: '#8B5A8C', bg: '#F0E6F1', placeholder: t('ledger.reflect.types.goal.placeholder') },
    insight:{ label: t('ledger.reflect.types.insight.label'),  icon: Lightbulb,    color: '#A0633C', bg: '#F5E9DD', placeholder: t('ledger.reflect.types.insight.placeholder') },
  };

  const monthReflections = reflections.filter(r => r.month === selectedMonth);
  const monthGoals = evaluateGoals(selectedMonth);
  const lastMonthGoals = evaluateGoals(lastMonth);

  // 캘린더 데이터 — entries/planned/calMonth 가 바뀌면 자동 재계산.
  const calendarDays = useMemo(() => {
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const lastDay = new Date(y, m + 1, 0);
    const startDow = new Date(y, m, 1).getDay();
    const days = [];
    const prevLastDay = new Date(y, m, 0).getDate();
    for (let i = startDow - 1; i >= 0; i--) days.push({ day: prevLastDay - i, otherMonth: true });
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayPlanned = planned.filter(p => p.date === dateStr);
      const dayEntries = entries.filter(e => e.date === dateStr);
      days.push({
        day: d, date: dateStr,
        isToday: dateStr === todayStr,
        isPast: dateStr < todayStr,
        otherMonth: false,
        planned: dayPlanned,
        spent: dayEntries,
        totalSpent: dayEntries.reduce((s, e) => s + e.amount, 0),
        totalPlanned: dayPlanned.reduce((s, p) => s + p.amount, 0),
      });
    }
    while (days.length % 7 !== 0) days.push({ day: 0, otherMonth: true });
    return days;
  }, [entries, planned, calMonth, todayStr]);

  // selectedDate 는 selectedDateStr 키만 보관하고 calendarDays 에서 매 렌더 도출.
  // entries/planned 가 invalidate 되면 day 합계까지 자동 동기화.
  const selectedDate = useMemo(
    () => (selectedDateStr ? calendarDays.find(d => d.date === selectedDateStr) || null : null),
    [calendarDays, selectedDateStr],
  );
  const calMonthStr = `${calMonth.getFullYear()}-${String(calMonth.getMonth() + 1).padStart(2, '0')}`;
  const calMonthEntries = entries.filter(e => e.date.startsWith(calMonthStr));
  const calMonthSpent = calMonthEntries.reduce((s, e) => s + e.amount, 0);
  const calMonthPlanned = planned.filter(p => p.date.startsWith(calMonthStr)).reduce((s, p) => s + p.amount, 0);
  const calMonthDays = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();

  const calMonthListData = (() => {
    const allItems = [
      ...calMonthEntries.map(e => ({ ...e, _type: 'spent' })),
      ...planned.filter(p => p.date.startsWith(calMonthStr)).map(p => ({ ...p, _type: 'planned' })),
    ].sort((a, b) => b.date.localeCompare(a.date));
    const grouped = {};
    allItems.forEach(item => {
      if (!grouped[item.date]) grouped[item.date] = [];
      grouped[item.date].push(item);
    });
    return Object.entries(grouped);
  })();

  const balanceSheet = (() => {
    const targetData = planMode === 'current' ? thisMonthData : { total: 0, byCategory: {} };
    const targetPlanned = planMode === 'current' ? upcomingThisMonth : upcomingNextMonth;
    return {
      totalSpent: targetData.total,
      totalPlanned: targetPlanned.reduce((s, p) => s + p.amount, 0),
      totalProjected: targetData.total + targetPlanned.reduce((s, p) => s + p.amount, 0),
    };
  })();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F5F1EA', fontFamily: "'Noto Sans KR', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&family=Caveat:wght@500;700&display=swap');
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse-soft { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -1000px 0; } 100% { background-position: 1000px 0; } }
        @keyframes pin-drop { 0% { transform: translateY(-30px) scale(0.5); opacity: 0; } 60% { transform: translateY(2px) scale(1.1); } 100% { transform: translateY(0) scale(1); opacity: 1; } }
        .msg-in { animation: fadeUp 0.3s ease-out; }
        .typing-dot { animation: pulse-soft 1.4s infinite; }
        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }
        .shimmer { background: linear-gradient(90deg, #F5F1EA 0%, #EDE6D8 50%, #F5F1EA 100%); background-size: 1000px 100%; animation: shimmer 2s linear infinite; }
        .pin { animation: pin-drop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1); transform-origin: bottom center; cursor: pointer; transition: transform 0.2s; }
        .pin:hover { transform: scale(1.15) translateY(-2px); }
        .handwritten { font-family: 'Caveat', cursive; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #D4CDC0; border-radius: 3px; }
      `}</style>

      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <header className="mb-6 lg:mb-8">
          <div className="flex items-baseline gap-3">
            <h1 className="text-3xl lg:text-4xl font-bold" style={{ color: '#2C2418' }}>{t('ledger.title')}</h1>
            <span className="handwritten text-2xl lg:text-3xl" style={{ color: '#A0633C' }}>{now.getMonth() + 1}월</span>
          </div>
          <p className="text-sm mt-1" style={{ color: '#7A7567' }}>오늘은 {now.getMonth() + 1}월 {now.getDate()}일 · 천천히, 꾸준히</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="lg:col-span-3 flex flex-col rounded-3xl overflow-hidden" style={{
            backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5',
            height: 'calc(100vh - 180px)', minHeight: '500px',
          }}>
            <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`msg-in flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] ${m.role === 'user' ? 'order-2' : ''}`}>
                    {m.image && <img src={m.image} alt="r" className="rounded-2xl mb-2 max-h-48 object-cover" />}
                    <div className="px-4 py-3 rounded-2xl text-sm lg:text-[15px] leading-relaxed whitespace-pre-wrap"
                      style={{
                        backgroundColor: m.role === 'user' ? '#2C2418' : '#F5F1EA',
                        color: m.role === 'user' ? '#FFFDF8' : '#2C2418',
                        borderBottomRightRadius: m.role === 'user' ? '6px' : '16px',
                        borderBottomLeftRadius: m.role === 'user' ? '16px' : '6px',
                      }}>{m.text}</div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start msg-in">
                  <div className="px-4 py-3 rounded-2xl flex gap-1.5" style={{ backgroundColor: '#F5F1EA' }}>
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: '#A0633C' }}></span>
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: '#A0633C' }}></span>
                    <span className="typing-dot w-2 h-2 rounded-full" style={{ backgroundColor: '#A0633C' }}></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 border-t" style={{ borderColor: '#E8E2D5' }}>
              {pendingImage && (
                <div className="mb-3 flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: '#F5F1EA' }}>
                  <img src={pendingImage.preview} alt="p" className="w-12 h-12 rounded-lg object-cover" />
                  <span className="text-sm flex-1" style={{ color: '#7A7567' }}>영수증</span>
                  <button onClick={() => setPendingImage(null)}><X size={16} style={{ color: '#7A7567' }} /></button>
                </div>
              )}
              <div className="flex items-end gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-2xl" title="영수증 사진 첨부" style={{ backgroundColor: '#F5F1EA' }}>
                  <Camera size={20} style={{ color: '#A0633C' }} />
                </button>
                <button onClick={() => setShowInputGuide(true)} className="p-3 rounded-2xl" title="이렇게 적어보세요" style={{ backgroundColor: '#F5F1EA' }}>
                  <Lightbulb size={20} style={{ color: '#A0633C' }} />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={t('ledger.input.placeholder')} rows={1}
                  className="flex-1 px-4 py-3 rounded-2xl resize-none outline-none text-sm lg:text-[15px]"
                  style={{ backgroundColor: '#F5F1EA', color: '#2C2418', maxHeight: '120px' }} />
                <button onClick={handleSend} disabled={loading || (!input.trim() && !pendingImage)}
                  className="p-3 rounded-2xl"
                  style={{ backgroundColor: (input.trim() || pendingImage) ? '#2C2418' : '#D4CDC0', color: '#FFFDF8' }}>
                  <Send size={20} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 px-1">
                <button onClick={() => setShowInputGuide(true)} className="text-[11px] flex items-center gap-1 hover:opacity-80"
                  style={{ color: '#A0633C' }}>
                  <Lightbulb size={11} /> 어떤 말이 가능해? 사용 가이드 보기
                </button>
                <span className="text-[10px]" style={{ color: '#A8A296' }}>Enter 보내기 · Shift+Enter 줄바꿈</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4 lg:space-y-5">
            <div className="rounded-3xl p-6" style={{ backgroundColor: '#2C2418', color: '#FFFDF8' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider opacity-60">이번 달 흐름</span>
                <button onClick={() => setShowBudgetEdit(!showBudgetEdit)} className="text-xs opacity-60 hover:opacity-100 flex items-center gap-1">
                  <Target size={12} /> 예산
                </button>
              </div>
              <div className="text-xs opacity-60 mb-1 flex items-center gap-1"><Wallet size={11} /> 자유롭게 쓸 수 있는 돈</div>
              <div className="text-4xl font-bold" style={{ color: trulyFree < 0 ? '#FFB18C' : '#FFFDF8' }}>
                {Math.max(0, trulyFree).toLocaleString()}<span className="text-xl opacity-60 ml-1">{cur}</span>
              </div>
              {showBudgetEdit && (
                <div className="my-3 space-y-2">
                  <div className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: 'rgba(255,253,248,0.1)' }}>
                    <span className="text-xs opacity-60 w-10">{t('ledger.balance.income')}</span>
                    <input
                      type="number"
                      value={incomeDraft}
                      onChange={(e) => setIncomeDraft(Number(e.target.value) || 0)}
                      onBlur={() => {
                        const n = Math.max(0, Number(incomeDraft) || 0);
                        if (n !== (user?.monthly_income ?? 0)) updateProfile.mutate({ monthly_income: n });
                      }}
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={{ color: '#FFFDF8' }}
                    />
                    <span className="text-xs opacity-60">{cur}</span>
                  </div>
                  <div className="flex items-center gap-2 p-2 rounded-xl" style={{ backgroundColor: 'rgba(255,253,248,0.1)' }}>
                    <span className="text-xs opacity-60 w-10">{t('ledger.stats.budget')}</span>
                    <input
                      type="number"
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(Number(e.target.value) || 0)}
                      onBlur={() => {
                        const n = Math.max(0, Number(budgetDraft) || 0);
                        if (n !== (user?.monthly_budget ?? 0)) updateProfile.mutate({ monthly_budget: n });
                      }}
                      className="flex-1 bg-transparent outline-none text-sm"
                      style={{ color: '#FFFDF8' }}
                    />
                    <span className="text-xs opacity-60">{cur}</span>
                  </div>
                </div>
              )}
              <div className="mt-5 space-y-2 text-xs">
                <div className="flex justify-between opacity-80"><span>{t('ledger.stats.budget')}</span><span className="tabular-nums">{budget.toLocaleString()} {cur}</span></div>
                <div className="flex justify-between opacity-80"><span>{t('ledger.stats.spent')}</span><span className="tabular-nums">- {monthTotal.toLocaleString()} {cur}</span></div>
                <div className="flex justify-between opacity-80">
                  <span className="flex items-center gap-1"><Clock size={10} /> {t('ledger.stats.upcoming')} ({upcomingThisMonth.length})</span>
                  <span className="tabular-nums" style={{ color: '#FFB18C' }}>- {upcomingTotal.toLocaleString()} {cur}</span>
                </div>
              </div>
              <div className="mt-4 h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: 'rgba(255,253,248,0.15)' }}>
                <div className="h-full" style={{ width: `${budget > 0 ? Math.min(100, (monthTotal / budget) * 100) : 0}%`, backgroundColor: '#A8C99A' }} />
                <div className="h-full" style={{ width: `${budget > 0 ? Math.max(0, Math.min(100 - (monthTotal / budget) * 100, (upcomingTotal / budget) * 100)) : 0}%`, backgroundColor: '#E0A856' }} />
              </div>
            </div>

            {/* 탭 — 5개 */}
            <div className="flex gap-1 p-1 rounded-2xl overflow-x-auto" style={{ backgroundColor: '#EDE6D8' }}>
              {[
                { id: 'calendar', icon: Calendar },
                { id: 'places',   icon: MapPin },
                { id: 'reflect',  icon: PenLine },
                { id: 'plan',     icon: Compass },
                { id: 'balance',  icon: BarChart3 },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex-1 py-2 px-1 rounded-xl text-[11px] lg:text-xs font-medium transition-all whitespace-nowrap flex items-center justify-center gap-1"
                  style={{
                    backgroundColor: activeTab === tab.id ? '#FFFDF8' : 'transparent',
                    color: activeTab === tab.id ? '#2C2418' : '#7A7567',
                    boxShadow: activeTab === tab.id ? '0 1px 2px rgba(44, 36, 24, 0.06)' : 'none',
                  }}>
                  <tab.icon size={11} />
                  {t(`ledger.tabs.${tab.id}`)}
                </button>
              ))}
            </div>

            {/* === 캘린더 탭 === */}
            {activeTab === 'calendar' && (
              <div className="rounded-3xl p-5 lg:p-6" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-1">
                    <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))} className="p-2 rounded-lg hover:bg-stone-50">
                      <ChevronLeft size={16} style={{ color: '#7A7567' }} />
                    </button>
                    <h3 className="text-sm font-medium px-1" style={{ color: '#2C2418' }}>
                      {calMonth.getFullYear()}년 {calMonth.getMonth() + 1}월
                    </h3>
                    <button onClick={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))} className="p-2 rounded-lg hover:bg-stone-50">
                      <ChevronRight size={16} style={{ color: '#7A7567' }} />
                    </button>
                  </div>
                  <div className="flex gap-0.5 p-0.5 rounded-lg" style={{ backgroundColor: '#F5F1EA' }}>
                    <button onClick={() => setCalViewMode('grid')} className="p-1.5 rounded-md"
                      style={{ backgroundColor: calViewMode === 'grid' ? '#FFFDF8' : 'transparent', color: calViewMode === 'grid' ? '#2C2418' : '#7A7567' }}>
                      <Grid size={13} />
                    </button>
                    <button onClick={() => setCalViewMode('list')} className="p-1.5 rounded-md"
                      style={{ backgroundColor: calViewMode === 'list' ? '#FFFDF8' : 'transparent', color: calViewMode === 'list' ? '#2C2418' : '#7A7567' }}>
                      <ListIcon size={13} />
                    </button>
                  </div>
                </div>

                {/* 약식 현황 */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F5F1EA' }}>
                    <div className="text-[10px] mb-0.5" style={{ color: '#7A7567' }}>이 달 사용</div>
                    <div className="text-base font-bold tabular-nums" style={{ color: '#2C2418' }}>
                      {(calMonthSpent / 10000).toFixed(1)}<span className="text-xs opacity-60">만</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl" style={{ backgroundColor: '#FFF8EC' }}>
                    <div className="text-[10px] mb-0.5" style={{ color: '#A0633C' }}>예정</div>
                    <div className="text-base font-bold tabular-nums" style={{ color: '#A0633C' }}>
                      {(calMonthPlanned / 10000).toFixed(1)}<span className="text-xs opacity-60">만</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl" style={{ backgroundColor: '#E8EEE6' }}>
                    <div className="text-[10px] mb-0.5" style={{ color: '#6B8E6B' }}>일평균</div>
                    <div className="text-base font-bold tabular-nums" style={{ color: '#6B8E6B' }}>
                      {calMonthSpent > 0 ? Math.round(calMonthSpent / calMonthDays / 1000) : 0}<span className="text-xs opacity-60">k</span>
                    </div>
                  </div>
                </div>

                {calViewMode === 'grid' && (
                  <>
                    <div className="grid grid-cols-7 gap-1 mb-1">
                      {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
                        <div key={d} className="text-center text-[10px] py-1" style={{ color: i === 0 ? '#E07856' : i === 6 ? '#5B7C99' : '#7A7567' }}>{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1">
                      {calendarDays.map((d, i) => {
                        if (d.otherMonth) return <div key={i} className="aspect-square" />;
                        const hasActivity = d.spent.length > 0 || d.planned.length > 0;
                        return (
                          <button key={i} onClick={() => setSelectedDateStr(d.date)}
                            className="aspect-square relative rounded-lg p-1 flex flex-col text-left transition-all hover:scale-105"
                            style={{
                              backgroundColor: d.isToday ? '#F5E9DD' : hasActivity ? '#FAF7F0' : 'transparent',
                              border: d.isToday ? '1.5px solid #A0633C' : '1px solid transparent',
                            }}>
                            <div className="text-[10px] font-medium" style={{
                              color: d.isToday ? '#A0633C' : i % 7 === 0 ? '#E07856' : i % 7 === 6 ? '#5B7C99' : '#2C2418'
                            }}>{d.day}</div>
                            {d.totalSpent > 0 && (
                              <div className="text-[8px] font-medium" style={{ color: '#2C2418' }}>
                                {Math.round(d.totalSpent / 1000)}k
                              </div>
                            )}
                            {d.totalPlanned > 0 && (
                              <div className="text-[8px] font-medium" style={{ color: '#A0633C' }}>
                                +{Math.round(d.totalPlanned / 1000)}k
                              </div>
                            )}
                            {d.planned.length > 0 && (
                              <div className="flex flex-wrap gap-0.5 mt-auto">
                                {d.planned.slice(0, 4).map((p, j) => (
                                  <div key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: CATEGORIES[p.category]?.color || '#7A7567' }} />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}

                {calViewMode === 'list' && (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {calMonthListData.length === 0 ? (
                      <div className="py-8 text-center text-sm" style={{ color: '#7A7567' }}>이 달은 아직 기록이 없어</div>
                    ) : (
                      calMonthListData.map(([date, items]) => {
                        const dt = new Date(date);
                        const dayOfWeek = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
                        const dayTotal = items.reduce((s, item) => s + item.amount, 0);
                        const isToday = date === todayStr;
                        return (
                          <div key={date}>
                            <button onClick={() => setSelectedDateStr(date)} className="w-full flex items-baseline justify-between mb-1.5 px-1 hover:opacity-80">
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base font-bold" style={{ color: isToday ? '#A0633C' : '#2C2418' }}>{dt.getDate()}</span>
                                <span className="text-xs" style={{ color: dt.getDay() === 0 ? '#E07856' : dt.getDay() === 6 ? '#5B7C99' : '#7A7567' }}>{dayOfWeek}</span>
                                {isToday && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#F5E9DD', color: '#A0633C' }}>오늘</span>}
                              </div>
                              <span className="text-xs tabular-nums" style={{ color: '#7A7567' }}>합 {dayTotal.toLocaleString()} {cur} →</span>
                            </button>
                            <div className="space-y-1">
                              {items.map(item => {
                                const Icon = CATEGORIES[item.category]?.icon || Sparkles;
                                const isPlanned = item._type === 'planned';
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => {
                                      if (item.place) setSelectedPlaceName(item.place.name);
                                    }}
                                    className="w-full flex items-center gap-2.5 py-2 px-3 rounded-xl text-left hover:opacity-80"
                                    style={{ backgroundColor: isPlanned ? '#FFF8EC' : '#FAF7F0' }}>
                                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[item.category]?.bg }}>
                                      <Icon size={12} style={{ color: CATEGORIES[item.category]?.color }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-medium truncate" style={{ color: '#2C2418' }}>{item.description}</span>
                                        {isPlanned && <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: '#F0E0B8', color: '#A0633C' }}>예정</span>}
                                        {item.place && <MapPin size={9} style={{ color: '#A0633C' }} />}
                                        {item.photos?.length > 0 && <ImageIcon size={9} style={{ color: '#8B5A8C' }} />}
                                        {item.rating && (
                                          <span className="text-[9px] flex items-center gap-0.5">
                                            <Star size={8} fill="#E0A856" stroke="#E0A856" /> {item.rating}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums" style={{ color: isPlanned ? '#A0633C' : '#2C2418' }}>
                                      {item.amount.toLocaleString()} {cur}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* === 장소 탭 === */}
            {activeTab === 'places' && (
              <div className="space-y-4">
                <div className="rounded-3xl p-5 lg:p-6" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                  <h3 className="text-sm font-medium flex items-center gap-2 mb-1" style={{ color: '#2C2418' }}>
                    <MapPin size={14} style={{ color: '#A0633C' }} /> 나의 지출 지도
                  </h3>
                  <p className="text-xs mb-4" style={{ color: '#7A7567' }}>
                    {placesMap.length}곳 · 핀이나 카드를 누르면 구글지도, 사진, 리뷰까지 보여
                  </p>

                  {placesMap.length > 0 && <SimpleMap places={placesMap} onPinClick={(p) => setSelectedPlaceName(p.name)} CATEGORIES={CATEGORIES} />}

                  <div className="mt-4 space-y-2 max-h-96 overflow-y-auto">
                    <div className="text-xs font-medium" style={{ color: '#7A7567' }}>자주 간 곳</div>
                    {placesMap.map(p => {
                      const Icon = CATEGORIES[p.category]?.icon || Sparkles;
                      return (
                        <button key={p.name} onClick={() => setSelectedPlaceName(p.name)}
                          className="w-full flex items-center gap-3 p-3 rounded-2xl text-left hover:bg-stone-50 transition-colors"
                          style={{ backgroundColor: '#FAF7F0' }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[p.category]?.bg }}>
                            <Icon size={16} style={{ color: CATEGORIES[p.category]?.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-medium truncate" style={{ color: '#2C2418' }}>{p.name}</span>
                              {p.allPhotos.length > 0 && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: '#F0E6F1', color: '#8B5A8C' }}>
                                  <ImageIcon size={9} /> {p.allPhotos.length}
                                </span>
                              )}
                              {p.mood === 'again' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#E8EEE6', color: '#6B8E6B' }}>또 갈래</span>}
                              {p.mood === 'avoid' && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#FDF0EA', color: '#E07856' }}>안 갈래</span>}
                            </div>
                            <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: '#7A7567' }}>
                              <span>{p.visitCount}회 · {p.totalSpent.toLocaleString()} {cur}</span>
                              {p.avgRating > 0 && <span className="flex items-center gap-0.5"><Star size={10} fill="#E0A856" stroke="#E0A856" />{p.avgRating.toFixed(1)}</span>}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* === 회고 탭 === */}
            {activeTab === 'reflect' && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                  {[{ id: 'monthly', label: '월간 회고' }, { id: 'annual', label: '연간 회고' }].map(m => (
                    <button key={m.id} onClick={() => setReflectMode(m.id)}
                      className="flex-1 py-2 rounded-xl text-xs lg:text-sm font-medium"
                      style={{
                        backgroundColor: reflectMode === m.id ? '#2C2418' : 'transparent',
                        color: reflectMode === m.id ? '#FFFDF8' : '#7A7567',
                      }}>{m.label}</button>
                  ))}
                </div>

                {reflectMode === 'monthly' && (
                  <>
                    <div className="flex items-center justify-between p-3 rounded-2xl" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <button onClick={() => {
                        const d = new Date(selectedMonth + '-01'); d.setMonth(d.getMonth() - 1);
                        setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                        setAiInsight(null);
                      }} className="p-1 rounded-lg hover:bg-stone-50"><ChevronLeft size={16} style={{ color: '#7A7567' }} /></button>
                      <div className="text-center">
                        <div className="text-base font-bold" style={{ color: '#2C2418' }}>
                          {selectedMonth.split('-')[0]}년 {parseInt(selectedMonth.split('-')[1])}월 회고
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#7A7567' }}>
                          총 {getMonthData(selectedMonth).total.toLocaleString()} {cur}
                        </div>
                      </div>
                      <button onClick={() => {
                        const d = new Date(selectedMonth + '-01'); d.setMonth(d.getMonth() + 1);
                        const nk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        if (nk <= thisMonth) { setSelectedMonth(nk); setAiInsight(null); }
                      }} className="p-1 rounded-lg hover:bg-stone-50"><ChevronRight size={16} style={{ color: '#7A7567' }} /></button>
                    </div>

                    <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-sm font-medium flex items-center gap-2" style={{ color: '#2C2418' }}>
                            <Sparkles size={14} style={{ color: '#A0633C' }} /> AI 코치 인사이트
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: '#7A7567' }}>객관적으로 한 달 돌아보기</p>
                        </div>
                        <button onClick={() => generateMonthInsight(selectedMonth)} disabled={aiLoading}
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{ backgroundColor: aiLoading ? '#D4CDC0' : '#2C2418', color: '#FFFDF8' }}>
                          {aiLoading ? '분석 중...' : aiInsight ? '다시 생성' : '인사이트 보기'}
                        </button>
                      </div>
                      {aiLoading && (
                        <div className="space-y-2">
                          <div className="h-12 rounded-xl shimmer"></div>
                          <div className="h-20 rounded-xl shimmer"></div>
                          <div className="h-20 rounded-xl shimmer"></div>
                          <div className="h-20 rounded-xl shimmer"></div>
                        </div>
                      )}
                      {aiInsight && !aiLoading && (
                        <div className="space-y-3">
                          <div className="p-3 rounded-2xl flex items-start gap-2" style={{ backgroundColor: '#F5F1EA' }}>
                            <Quote size={14} style={{ color: '#A0633C' }} className="flex-shrink-0 mt-0.5" />
                            <p className="text-sm" style={{ color: '#2C2418' }}>{aiInsight.summary}</p>
                          </div>
                          {aiInsight.praise && (
                            <div className="p-3 rounded-2xl" style={{ backgroundColor: '#E8EEE6' }}>
                              <div className="flex items-center gap-1.5 mb-1"><ThumbsUp size={12} style={{ color: '#6B8E6B' }} /><span className="text-xs font-medium" style={{ color: '#6B8E6B' }}>잘한 점</span></div>
                              <p className="text-sm" style={{ color: '#2C2418' }}>{aiInsight.praise}</p>
                            </div>
                          )}
                          {aiInsight.concern && (
                            <div className="p-3 rounded-2xl" style={{ backgroundColor: '#FDF0EA' }}>
                              <div className="flex items-center gap-1.5 mb-1"><AlertCircle size={12} style={{ color: '#E07856' }} /><span className="text-xs font-medium" style={{ color: '#E07856' }}>주의할 점</span></div>
                              <p className="text-sm" style={{ color: '#2C2418' }}>{aiInsight.concern}</p>
                            </div>
                          )}
                          {aiInsight.suggestion && (
                            <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F0E6F1' }}>
                              <div className="flex items-center gap-1.5 mb-1"><Lightbulb size={12} style={{ color: '#8B5A8C' }} /><span className="text-xs font-medium" style={{ color: '#8B5A8C' }}>다음달 제안</span></div>
                              <p className="text-sm" style={{ color: '#2C2418' }}>{aiInsight.suggestion}</p>
                              <button onClick={() => addReflection(selectedMonth, 'goal', aiInsight.suggestion)}
                                className="mt-2 text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                                style={{ backgroundColor: '#8B5A8C', color: '#FFFDF8' }}>
                                <Plus size={10} /> 다음달 약속에 추가
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {!aiInsight && !aiLoading && (
                        <div className="py-6 text-center text-sm" style={{ color: '#7A7567' }}>위 버튼 눌러서 분석 시작</div>
                      )}
                    </div>

                    <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <h3 className="text-sm font-medium mb-3" style={{ color: '#2C2418' }}>전월 대비 변화</h3>
                      <div className="space-y-2">
                        {categoryInsights.filter(c => c.current > 0 || c.prev > 0).slice(0, 6).map(c => {
                          const Icon = CATEGORIES[c.category].icon;
                          const isIncrease = c.diff > 0;
                          return (
                            <div key={c.category} className="flex items-center gap-3 py-2">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[c.category].bg }}>
                                <Icon size={14} style={{ color: CATEGORIES[c.category].color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <span className="text-sm font-medium" style={{ color: '#2C2418' }}>{t(`ledger.categories.${c.category}`, c.category)}</span>
                                  <span className="text-sm tabular-nums" style={{ color: '#2C2418' }}>{c.current.toLocaleString()} {cur}</span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px]" style={{ color: '#7A7567' }}>지난달 {c.prev.toLocaleString()} {cur}</span>
                                  {c.pct !== null && Math.abs(c.pct) >= 5 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{
                                      backgroundColor: isIncrease ? '#FDF0EA' : '#E8EEE6',
                                      color: isIncrease ? '#E07856' : '#6B8E6B',
                                    }}>
                                      {isIncrease ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                                      {isIncrease ? '+' : ''}{Math.round(c.pct)}%
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <h3 className="text-sm font-medium mb-1" style={{ color: '#2C2418' }}>나의 회고 노트</h3>
                      <p className="text-xs mb-3" style={{ color: '#7A7567' }}>약속을 적으면 다음달 계획 탭에 자동으로 떠</p>

                      <div className="mb-3 p-3 rounded-2xl" style={{ backgroundColor: '#F5F1EA' }}>
                        <div className="flex gap-1 mb-2 overflow-x-auto">
                          {Object.entries(REFLECT_TYPES).map(([key, info]) => (
                            <button key={key} onClick={() => setNewReflection({ ...newReflection, type: key })}
                              className="px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 whitespace-nowrap"
                              style={{
                                backgroundColor: newReflection.type === key ? info.bg : 'transparent',
                                color: newReflection.type === key ? info.color : '#7A7567',
                              }}>
                              <info.icon size={10} />{info.label}
                            </button>
                          ))}
                        </div>
                        <textarea value={newReflection.text} onChange={(e) => setNewReflection({ ...newReflection, text: e.target.value })}
                          placeholder={REFLECT_TYPES[newReflection.type].placeholder} rows={2}
                          className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none handwritten text-base"
                          style={{ backgroundColor: 'white', color: '#2C2418', border: '1px solid #E8E2D5' }} />
                        <button onClick={() => addReflection(selectedMonth, newReflection.type, newReflection.text)} disabled={!newReflection.text.trim()}
                          className="mt-2 w-full py-2 rounded-xl text-sm font-medium"
                          style={{ backgroundColor: newReflection.text.trim() ? '#2C2418' : '#D4CDC0', color: '#FFFDF8' }}>저장</button>
                      </div>

                      <div className="space-y-2">
                        {monthReflections.length === 0 ? (
                          <div className="py-6 text-center text-sm" style={{ color: '#7A7567' }}>아직 회고가 없어</div>
                        ) : (
                          monthReflections.map(r => {
                            const info = REFLECT_TYPES[r.type];
                            const Icon = info.icon;
                            const goalEval = r.type === 'goal' ? monthGoals.find(g => g.id === r.id) : null;
                            return (
                              <div key={r.id} className="p-3 rounded-2xl group relative" style={{ backgroundColor: info.bg }}>
                                <div className="flex items-start gap-2">
                                  <Icon size={14} style={{ color: info.color }} className="flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-medium" style={{ color: info.color }}>{info.label}</span>
                                      {goalEval && goalEval.achieved === true && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: 'white', color: '#6B8E6B' }}>
                                          <Check size={8} /> 달성!
                                        </span>
                                      )}
                                      {goalEval && goalEval.achieved === false && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'white', color: '#E07856' }}>미달</span>
                                      )}
                                    </div>
                                    <p className="handwritten text-base mt-0.5" style={{ color: '#2C2418' }}>"{r.text}"</p>
                                  </div>
                                  <button onClick={() => deleteReflection(r.id)} className="opacity-0 group-hover:opacity-100">
                                    <X size={12} style={{ color: '#7A7567' }} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}

                {reflectMode === 'annual' && (
                  <>
                    <div className="rounded-3xl p-6" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <h3 className="text-sm font-medium mb-1" style={{ color: '#2C2418' }}>지난 12개월 한눈에</h3>
                      <p className="text-xs mb-4" style={{ color: '#7A7567' }}>
                        총 {annualData.yearTotal.toLocaleString()} {cur} · 월평균 {annualData.yearAvg.toLocaleString()} {cur}
                      </p>
                      <div className="flex items-end gap-1 h-32 mb-3">
                        {annualData.months.map((m, i) => {
                          const max = Math.max(...annualData.months.map(x => x.total), 1);
                          const h = (m.total / max) * 100;
                          return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                              <div className="text-[8px]" style={{ color: '#7A7567' }}>{m.total > 0 ? Math.round(m.total / 10000) + '만' : ''}</div>
                              <div className="w-full rounded-t-md transition-all" style={{
                                height: `${h}%`, minHeight: m.total > 0 ? '4px' : '2px',
                                backgroundColor: m.isCurrent ? '#A0633C' : (m.total > annualData.yearAvg ? '#E07856' : '#D4CDC0'),
                              }} />
                              <div className="text-[9px]" style={{ color: m.isCurrent ? '#A0633C' : '#7A7567', fontWeight: m.isCurrent ? 500 : 400 }}>{m.label}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {(() => {
                          const sorted = [...annualData.months].filter(m => m.total > 0).sort((a, b) => b.total - a.total);
                          const max = sorted[0]; const min = sorted[sorted.length - 1];
                          return (
                            <>
                              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#FDF0EA' }}>
                                <div className="text-[10px]" style={{ color: '#E07856' }}>제일 많이 쓴 달</div>
                                <div className="text-base font-bold mt-0.5" style={{ color: '#2C2418' }}>{max.year}년 {max.month}월</div>
                                <div className="text-xs mt-0.5" style={{ color: '#7A7567' }}>{max.total.toLocaleString()} {cur}</div>
                              </div>
                              <div className="p-3 rounded-2xl" style={{ backgroundColor: '#E8EEE6' }}>
                                <div className="text-[10px]" style={{ color: '#6B8E6B' }}>가장 절약한 달</div>
                                <div className="text-base font-bold mt-0.5" style={{ color: '#2C2418' }}>{min.year}년 {min.month}월</div>
                                <div className="text-xs mt-0.5" style={{ color: '#7A7567' }}>{min.total.toLocaleString()} {cur}</div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                      <h3 className="text-sm font-medium mb-3" style={{ color: '#2C2418' }}>1년간 어디에 가장 많이 썼나</h3>
                      <div className="space-y-3">
                        {Object.entries(annualData.categoryYearTotals).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                          const Icon = CATEGORIES[cat].icon;
                          const pct = (total / annualData.yearTotal) * 100;
                          const monthly = Math.round(total / 12);
                          return (
                            <div key={cat} className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[cat].bg }}>
                                <Icon size={16} style={{ color: CATEGORIES[cat].color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm font-medium" style={{ color: '#2C2418' }}>{t(`ledger.categories.${cat}`, cat)}</span>
                                    <span className="text-[10px]" style={{ color: '#7A7567' }}>{monthly.toLocaleString()} {cur}</span>
                                  </div>
                                  <span className="text-sm font-medium tabular-nums" style={{ color: '#2C2418' }}>{total.toLocaleString()} {cur}</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden mt-1" style={{ backgroundColor: '#F5F1EA' }}>
                                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: CATEGORIES[cat].color }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* === 계획 탭 === */}
            {activeTab === 'plan' && (
              <div className="space-y-4">
                <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                  {[{ id: 'current', label: `${now.getMonth() + 1}월 계획` }, { id: 'next', label: `${now.getMonth() + 2 > 12 ? 1 : now.getMonth() + 2}월 계획` }].map(m => (
                    <button key={m.id} onClick={() => setPlanMode(m.id)}
                      className="flex-1 py-2 rounded-xl text-xs lg:text-sm font-medium"
                      style={{ backgroundColor: planMode === m.id ? '#2C2418' : 'transparent', color: planMode === m.id ? '#FFFDF8' : '#7A7567' }}>
                      {m.label}
                    </button>
                  ))}
                </div>

                {planMode === 'current' && lastMonthGoals.filter(g => g.text).length > 0 && (
                  <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '2px solid #8B5A8C' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <Target size={14} style={{ color: '#8B5A8C' }} />
                      <h3 className="text-sm font-medium" style={{ color: '#8B5A8C' }}>지난달 다짐 · 이번 달에도 지켜보자</h3>
                    </div>
                    <div className="space-y-2">
                      {lastMonthGoals.map(g => (
                        <div key={g.id} className="p-3 rounded-2xl flex items-start gap-2" style={{ backgroundColor: '#F0E6F1' }}>
                          <Quote size={12} style={{ color: '#8B5A8C' }} className="flex-shrink-0 mt-1" />
                          <p className="handwritten text-base flex-1" style={{ color: '#2C2418' }}>"{g.text}"</p>
                          {g.achieved === true && <span className="text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5" style={{ backgroundColor: '#6B8E6B', color: 'white' }}><Check size={9} /> 지난달 성공</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                  <h3 className="text-sm font-medium mb-1" style={{ color: '#2C2418' }}>{planMode === 'current' ? '이번 달' : '다음 달'} 큰 그림</h3>
                  <p className="text-xs mb-4" style={{ color: '#7A7567' }}>예상 흐름을 미리 그려보자</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F5F1EA' }}>
                      <div className="text-[10px]" style={{ color: '#7A7567' }}>현재 사용</div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: '#2C2418' }}>
                        {(planMode === 'current' ? balanceSheet.totalSpent : 0).toLocaleString()}<span className="text-xs opacity-60">{cur}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded-2xl" style={{ backgroundColor: '#FFF8EC' }}>
                      <div className="text-[10px]" style={{ color: '#A0633C' }}>예정</div>
                      <div className="text-lg font-bold tabular-nums" style={{ color: '#A0633C' }}>
                        {balanceSheet.totalPlanned.toLocaleString()}<span className="text-xs opacity-60">{cur}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl" style={{ backgroundColor: '#2C2418', color: '#FFFDF8' }}>
                    <div className="text-[10px] opacity-60 mb-1">총 예상 지출</div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">{balanceSheet.totalProjected.toLocaleString()}<span className="text-sm opacity-60">{cur}</span></span>
                      <span className="text-xs opacity-60">/ 예산 {budget.toLocaleString()} {cur}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden mt-2" style={{ backgroundColor: 'rgba(255,253,248,0.15)' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, (balanceSheet.totalProjected / budget) * 100)}%`,
                        backgroundColor: balanceSheet.totalProjected > budget ? '#FFB18C' : '#A8C99A',
                      }} />
                    </div>
                    {balanceSheet.totalProjected > budget && (
                      <div className="text-[10px] mt-2 flex items-center gap-1" style={{ color: '#FFB18C' }}>
                        <AlertCircle size={10} /> {(balanceSheet.totalProjected - budget).toLocaleString()} {cur} 초과 예상
                      </div>
                    )}
                  </div>
                </div>

                {planMode === 'next' && (
                  <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                    <h3 className="text-sm font-medium mb-1" style={{ color: '#2C2418' }}>다음 달 다짐</h3>
                    <p className="text-xs mb-3" style={{ color: '#7A7567' }}>나에게 보내는 편지</p>
                    <div className="p-3 rounded-2xl" style={{ backgroundColor: '#F0E6F1' }}>
                      <textarea value={newReflection.type === 'goal' && newReflection.text || ''}
                        onChange={(e) => setNewReflection({ type: 'goal', text: e.target.value })}
                        placeholder="예: 카페는 일주일에 2번만" rows={3}
                        className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none handwritten text-base"
                        style={{ backgroundColor: 'white', color: '#2C2418', border: '1px solid #E8E2D5' }} />
                      <button onClick={() => { addReflection(nextMonth, 'goal', newReflection.text); setNewReflection({ type: 'regret', text: '' }); }}
                        disabled={!newReflection.text?.trim()}
                        className="mt-2 w-full py-2 rounded-xl text-sm font-medium"
                        style={{ backgroundColor: newReflection.text?.trim() ? '#8B5A8C' : '#D4CDC0', color: '#FFFDF8' }}>
                        <Target size={12} className="inline mr-1" /> 다음달 약속으로 저장
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* === 대차대조표 탭 === */}
            {activeTab === 'balance' && (
              <div className="rounded-3xl p-5" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
                <h3 className="text-sm font-medium mb-1 flex items-center gap-2" style={{ color: '#2C2418' }}>
                  <BarChart3 size={14} style={{ color: '#A0633C' }} /> {now.getMonth() + 1}월 대차대조표
                </h3>
                <p className="text-xs mb-4" style={{ color: '#7A7567' }}>회계 관점에서 한 달 흐름</p>

                <div className="mb-4">
                  <div className="text-xs font-medium mb-2 pb-1 border-b" style={{ color: '#6B8E6B', borderColor: '#E8EEE6' }}>📈 수입</div>
                  <div className="flex justify-between py-2 px-3 rounded-xl" style={{ backgroundColor: '#E8EEE6' }}>
                    <span className="text-sm" style={{ color: '#2C2418' }}>월급</span>
                    <span className="text-sm font-semibold tabular-nums" style={{ color: '#6B8E6B' }}>+ {income.toLocaleString()} {cur}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs font-medium mb-2 pb-1 border-b" style={{ color: '#E07856', borderColor: '#FDF0EA' }}>📉 지출 (카테고리별)</div>
                  <div className="space-y-1">
                    {Object.entries(thisMonthData.byCategory).filter(([_, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([cat, amount]) => {
                      const Icon = CATEGORIES[cat].icon;
                      return (
                        <div key={cat} className="flex justify-between py-1.5 px-3 rounded-xl items-center" style={{ backgroundColor: '#FAF7F0' }}>
                          <div className="flex items-center gap-2"><Icon size={12} style={{ color: CATEGORIES[cat].color }} /><span className="text-sm" style={{ color: '#2C2418' }}>{t(`ledger.categories.${cat}`, cat)}</span></div>
                          <span className="text-sm tabular-nums" style={{ color: '#E07856' }}>- {amount.toLocaleString()} {cur}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 py-2 px-3 rounded-xl font-medium" style={{ backgroundColor: '#FDF0EA' }}>
                    <span className="text-sm" style={{ color: '#2C2418' }}>지출 소계</span>
                    <span className="text-sm tabular-nums" style={{ color: '#E07856' }}>- {thisMonthData.total.toLocaleString()} {cur}</span>
                  </div>
                </div>

                {upcomingTotal > 0 && (
                  <div className="mb-4">
                    <div className="text-xs font-medium mb-2 pb-1 border-b" style={{ color: '#A0633C', borderColor: '#F5E9DD' }}>⏰ 예정된 지출</div>
                    <div className="flex justify-between py-2 px-3 rounded-xl" style={{ backgroundColor: '#FFF8EC' }}>
                      <span className="text-sm" style={{ color: '#2C2418' }}>이번 달 예정 ({upcomingThisMonth.length}건)</span>
                      <span className="text-sm tabular-nums" style={{ color: '#A0633C' }}>- {upcomingTotal.toLocaleString()} {cur}</span>
                    </div>
                  </div>
                )}

                <div className="pt-3 border-t-2" style={{ borderColor: '#2C2418' }}>
                  <div className="text-xs font-medium mb-2" style={{ color: '#2C2418' }}>= 순익 (수입 - 지출 - 예정)</div>
                  <div className="p-4 rounded-2xl text-center" style={{ backgroundColor: (income - monthTotal - upcomingTotal) > 0 ? '#E8EEE6' : '#FDF0EA' }}>
                    <div className="text-3xl font-bold tabular-nums" style={{ color: (income - monthTotal - upcomingTotal) > 0 ? '#6B8E6B' : '#E07856' }}>
                      {(income - monthTotal - upcomingTotal).toLocaleString()}<span className="text-base opacity-60 ml-1">{cur}</span>
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#7A7567' }}>
                      {(income - monthTotal - upcomingTotal) > 0 ? '저축 가능 금액' : '추가 수입이 필요해'}
                    </div>
                  </div>
                  <div className="mt-3 p-3 rounded-2xl" style={{ backgroundColor: '#F5F1EA' }}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span style={{ color: '#7A7567' }}>저축률</span>
                      <span className="font-medium" style={{ color: '#2C2418' }}>
                        {income > 0 ? Math.max(0, Math.round(((income - monthTotal - upcomingTotal) / income) * 100)) : 0}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'white' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${income > 0 ? Math.max(0, Math.min(100, ((income - monthTotal - upcomingTotal) / income) * 100)) : 0}%`,
                        backgroundColor: '#6B8E6B',
                      }} />
                    </div>
                    <div className="text-[10px] mt-1.5" style={{ color: '#7A7567' }}>💡 20% 이상이면 건강한 저축률</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* === 캘린더 날짜 상세 모달 === */}
        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
            style={{ backgroundColor: 'rgba(44, 36, 24, 0.5)' }} onClick={() => setSelectedDateStr(null)}>
            <div className="w-full lg:max-w-md rounded-t-3xl lg:rounded-3xl overflow-hidden max-h-[85vh] flex flex-col"
              style={{ backgroundColor: '#FFFDF8' }} onClick={(e) => e.stopPropagation()}>
              <div className="p-5 border-b" style={{ borderColor: '#E8E2D5' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: '#2C2418' }}>
                      {selectedDate.date && new Date(selectedDate.date).getMonth() + 1}월 {selectedDate.day}일
                    </h3>
                    <div className="text-xs mt-0.5" style={{ color: '#7A7567' }}>
                      사용 {selectedDate.totalSpent.toLocaleString()} {cur} · 예정 {selectedDate.totalPlanned.toLocaleString()} {cur}
                    </div>
                  </div>
                  <button onClick={() => setSelectedDateStr(null)} className="p-2 -mr-2"><X size={20} style={{ color: '#7A7567' }} /></button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-2">
                {selectedDate.spent.length === 0 && selectedDate.planned.length === 0 ? (
                  <div className="py-8 text-center text-sm" style={{ color: '#7A7567' }}>이 날은 기록이 없어</div>
                ) : (
                  <>
                    {selectedDate.planned.map(p => {
                      const Icon = CATEGORIES[p.category]?.icon || Sparkles;
                      const isEditing = editingDayItem?.id === p.id && editingDayItem?.kind === 'planned';
                      if (isEditing) {
                        return (
                          <EntryEditCard
                            key={p.id}
                            draft={editingDayItem.draft}
                            categories={CATEGORIES}
                            bg="#FFF8EC"
                            onChange={(next) => setEditingDayItem({ ...editingDayItem, draft: next })}
                            onCancel={cancelEditDayItem}
                            onSave={saveEditDayItem}
                            t={t}
                            cur={cur}
                          />
                        );
                      }
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl group" style={{ backgroundColor: '#FFF8EC' }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[p.category]?.bg }}>
                            <Icon size={16} style={{ color: CATEGORIES[p.category]?.color }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate" style={{ color: '#2C2418' }}>{p.description}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F0E0B8', color: '#A0633C' }}>예정</span>
                            </div>
                            <div className="text-xs" style={{ color: '#7A7567' }}>{t(`ledger.categories.${p.category}`, p.category)}</div>
                          </div>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: '#A0633C' }}>{p.amount.toLocaleString()} {cur}</span>
                          <div className="flex items-center gap-1 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditDayItem(p, 'planned')} title="수정"
                              className="p-1.5 rounded-lg hover:bg-white">
                              <PenLine size={13} style={{ color: '#7A7567' }} />
                            </button>
                            <button onClick={() => removeDayItem(p, 'planned')} title="삭제"
                              className="p-1.5 rounded-lg hover:bg-white">
                              <Trash2 size={13} style={{ color: '#E07856' }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {selectedDate.spent.map(e => {
                      const Icon = CATEGORIES[e.category]?.icon || Sparkles;
                      const isEditing = editingDayItem?.id === e.id && editingDayItem?.kind === 'spent';
                      if (isEditing) {
                        return (
                          <EntryEditCard
                            key={e.id}
                            draft={editingDayItem.draft}
                            categories={CATEGORIES}
                            bg="#FAF7F0"
                            onChange={(next) => setEditingDayItem({ ...editingDayItem, draft: next })}
                            onCancel={cancelEditDayItem}
                            onSave={saveEditDayItem}
                            t={t}
                            cur={cur}
                          />
                        );
                      }
                      return (
                        <div key={e.id}
                          className="w-full flex items-start gap-3 p-3 rounded-2xl group"
                          style={{ backgroundColor: '#FAF7F0' }}>
                          <button
                            onClick={() => {
                              if (e.place) { setSelectedDateStr(null); setSelectedPlaceName(e.place.name); }
                            }}
                            className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: CATEGORIES[e.category]?.bg }}>
                              <Icon size={16} style={{ color: CATEGORIES[e.category]?.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium truncate" style={{ color: '#2C2418' }}>{e.description}</span>
                                {e.place && <MapPin size={10} style={{ color: '#A0633C' }} />}
                                {e.photos?.length > 0 && (
                                  <span className="text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5" style={{ backgroundColor: '#F0E6F1', color: '#8B5A8C' }}>
                                    <ImageIcon size={8} /> {e.photos.length}
                                  </span>
                                )}
                                {e.rating && (
                                  <span className="text-[10px] flex items-center gap-0.5">
                                    <Star size={9} fill="#E0A856" stroke="#E0A856" />{e.rating}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs" style={{ color: '#7A7567' }}>{t(`ledger.categories.${e.category}`, e.category)}{e.place && ` · ${e.place.name}`}</div>
                              {e.review && <div className="handwritten text-sm mt-1" style={{ color: '#2C2418' }}>"{e.review}"</div>}
                              {e.photos?.length > 0 && (
                                <div className="flex gap-1 mt-2">
                                  {e.photos.slice(0, 3).map((ph, j) => (
                                    <img key={j} src={ph} alt="" className="w-12 h-12 rounded-lg object-cover" />
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                          <span className="text-sm font-semibold tabular-nums" style={{ color: '#2C2418' }}>{e.amount.toLocaleString()} {cur}</span>
                          <div className="flex items-center gap-1 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditDayItem(e, 'spent')} title="수정"
                              className="p-1.5 rounded-lg hover:bg-white">
                              <PenLine size={13} style={{ color: '#7A7567' }} />
                            </button>
                            <button onClick={() => removeDayItem(e, 'spent')} title="삭제"
                              className="p-1.5 rounded-lg hover:bg-white">
                              <Trash2 size={13} style={{ color: '#E07856' }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* === 장소 상세 모달 === */}
        {selectedPlace && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4"
            style={{ backgroundColor: 'rgba(44, 36, 24, 0.5)' }}
            onClick={() => { setSelectedPlaceName(null); setEditingEntry(null); }}>
            <div className="w-full lg:max-w-2xl rounded-t-3xl lg:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
              style={{ backgroundColor: '#FFFDF8' }} onClick={(e) => e.stopPropagation()}>

              {/* 헤더 */}
              <div className="p-5 lg:p-6 border-b flex-shrink-0" style={{ borderColor: '#E8E2D5' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold truncate" style={{ color: '#2C2418' }}>{selectedPlace.name}</h3>
                    {selectedPlace.address && (
                      <div className="text-xs mt-0.5 truncate" style={{ color: '#7A7567' }}>{selectedPlace.address}</div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs flex-wrap" style={{ color: '#7A7567' }}>
                      <span>{selectedPlace.visitCount}회 방문</span>
                      <span>·</span>
                      <span>총 {selectedPlace.totalSpent.toLocaleString()} {cur}</span>
                      {selectedPlace.avgRating > 0 && (<><span>·</span><span className="flex items-center gap-0.5"><Star size={11} fill="#E0A856" stroke="#E0A856" />{selectedPlace.avgRating.toFixed(1)}</span></>)}
                    </div>
                  </div>
                  <button onClick={() => { setSelectedPlaceName(null); setEditingEntry(null); }} className="p-2 -mr-2">
                    <X size={20} style={{ color: '#7A7567' }} />
                  </button>
                </div>

                {/* 외부 지도 열기 — 좌표 있으면 좌표 기반, 없으면 이름 검색 fallback */}
                <div className="flex gap-2 mt-3">
                  <a href={
                    typeof selectedPlace.lat === 'number' && typeof selectedPlace.lng === 'number'
                      ? `https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lng}&query_place_id=${encodeURIComponent(selectedPlace.name)}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedPlace.name)}`
                  }
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium"
                    style={{ backgroundColor: '#E5ECF2', color: '#5B7C99' }}>
                    <ExternalLink size={11} /> Google 지도
                  </a>
                  <a href={`https://map.kakao.com/link/search/${encodeURIComponent(selectedPlace.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium"
                    style={{ backgroundColor: '#FFF8EC', color: '#A0633C' }}>
                    <ExternalLink size={11} /> 카카오맵
                  </a>
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(selectedPlace.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium"
                    style={{ backgroundColor: '#E8EEE6', color: '#6B8E6B' }}>
                    <ExternalLink size={11} /> 네이버
                  </a>
                </div>

                {/* Mood 태그 */}
                <div className="flex gap-2 mt-3">
                  {[
                    { id: 'again', label: '또 가고 싶음', icon: ThumbsUp, color: '#6B8E6B', bg: '#E8EEE6' },
                    { id: 'normal', label: '보통', icon: Minus, color: '#7A7567', bg: '#EFECE6' },
                    { id: 'avoid', label: '안 갈래', icon: ThumbsDown, color: '#E07856', bg: '#FDF0EA' },
                  ].map(m => {
                    const MoodIcon = m.icon;
                    const isActive = selectedPlace.mood === m.id;
                    return (
                      <button key={m.id}
                        onClick={() => {
                          // 같은 장소의 모든 방문 entry 에 mood 일괄 적용. invalidate 가 placesMap → selectedPlace 동기화.
                          selectedPlace.visits.forEach(v => updateEntry(v.id, { mood: m.id }));
                        }}
                        className="flex-1 py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium transition-all"
                        style={{
                          backgroundColor: isActive ? m.bg : '#FAF7F0',
                          color: isActive ? m.color : '#7A7567',
                          border: isActive ? `1px solid ${m.color}` : '1px solid transparent',
                        }}>
                        <MoodIcon size={12} />{m.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 위치 패널 — 좌표 있으면 임베드 지도, 없으면 위치 지정 검색 UI */}
              {typeof selectedPlace.lat === 'number' && typeof selectedPlace.lng === 'number' ? (
                <div className="flex-shrink-0 relative" style={{ height: '180px' }}>
                  <iframe
                    title={selectedPlace.name}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    src={`https://maps.google.com/maps?q=${selectedPlace.lat},${selectedPlace.lng}&z=16&output=embed`}
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      // 위치 다시 지정: 좌표 초기화 + 검색 UI 노출. 같은 장소 entry 들 좌표 일괄 null.
                      const targetName = selectedPlace.name;
                      selectedPlace.visits.forEach(v => {
                        updateEntry(v.id, {
                          place: { name: targetName, lat: null, lng: null, address: null },
                        });
                      });
                      setPlaceSearchQuery(targetName);
                      setPlaceSearchResults([]);
                      setPlaceSearchedOnce(false);
                    }}
                    className="absolute top-2 right-2 px-2.5 py-1 rounded-full text-[11px] font-medium"
                    style={{ backgroundColor: 'rgba(255,253,248,0.95)', color: '#A0633C', border: '1px solid #E8E2D5' }}
                  >
                    위치 다시 지정
                  </button>
                </div>
              ) : (
                <div className="p-4 border-b" style={{ borderColor: '#E8E2D5', backgroundColor: '#FAF7F0' }}>
                  <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: '#2C2418' }}>
                    <MapPin size={12} style={{ color: '#A0633C' }} />
                    정확한 위치를 골라줘
                    <span className="text-[10px] font-normal" style={{ color: '#7A7567' }}>
                      (AI 가 추측한 위치는 부정확할 수 있어 자동으로 핀을 찍지 않아)
                    </span>
                  </div>

                  <div className="flex gap-1.5 mb-2">
                    <input
                      type="text"
                      value={placeSearchQuery}
                      onChange={(e) => setPlaceSearchQuery(e.target.value)}
                      placeholder={selectedPlace.name + ' 근처'}
                      className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                      style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', color: '#2C2418' }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const q = (placeSearchQuery || selectedPlace.name).trim();
                          if (!q) return;
                          setPlaceSearchBusy(true);
                          setPlaceSearchedOnce(true);
                          const results = await searchPlaces(q);
                          setPlaceSearchResults(results);
                          setPlaceSearchBusy(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      disabled={placeSearchBusy}
                      onClick={async () => {
                        const q = (placeSearchQuery || selectedPlace.name).trim();
                        if (!q) return;
                        setPlaceSearchBusy(true);
                        setPlaceSearchedOnce(true);
                        const results = await searchPlaces(q);
                        setPlaceSearchResults(results);
                        setPlaceSearchBusy(false);
                      }}
                      className="px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                      style={{ backgroundColor: '#A0633C', color: 'white' }}
                    >
                      {placeSearchBusy ? '검색…' : '검색'}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] mb-2" style={{ color: '#7A7567' }}>
                    <span>
                      {geoStatus === 'granted' && userGeo && t('ledger.place.viewboxGps')}
                      {geoStatus === 'ip' && userGeo && t('ledger.place.viewboxIp', { label: geoLabel || 'IP' })}
                      {geoStatus === 'denied' && t('ledger.place.viewboxDenied')}
                      {geoStatus === 'unsupported' && t('ledger.place.viewboxUnsupported')}
                      {(geoStatus === 'idle' || geoStatus === 'requesting') && t('ledger.place.viewboxNationwide')}
                    </span>
                    {(geoStatus === 'idle' || geoStatus === 'ip' || geoStatus === 'denied') && (
                      <button
                        type="button"
                        onClick={() => requestUserGeo()}
                        className="underline"
                        style={{ color: '#A0633C' }}
                      >
                        {geoStatus === 'ip' ? '더 정확하게 (GPS)' : '내 위치 사용 (GPS)'}
                      </button>
                    )}
                  </div>

                  {placeSearchedOnce && !placeSearchBusy && placeSearchResults.length === 0 && (
                    <div className="text-xs text-center py-3" style={{ color: '#7A7567' }}>
                      검색 결과가 없어. 다른 검색어로 시도하거나 위치를 비워둬도 돼.
                    </div>
                  )}

                  {placeSearchResults.length > 0 && (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto">
                      {placeSearchResults.map((r, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            const targetName = selectedPlace.name;
                            // 같은 place.name 의 모든 visit entry 좌표 일괄 업데이트. invalidate 가 placesMap → selectedPlace 동기화.
                            selectedPlace.visits.forEach(v => {
                              updateEntry(v.id, {
                                place: { name: targetName, lat: r.lat, lng: r.lng, address: r.address },
                              });
                            });
                            setPlaceSearchResults([]);
                            setPlaceSearchQuery('');
                            setPlaceSearchedOnce(false);
                          }}
                          className="w-full text-left p-2.5 rounded-lg text-xs"
                          style={{ backgroundColor: 'white', border: '1px solid #E8E2D5' }}
                        >
                          <div className="font-medium truncate" style={{ color: '#2C2418' }}>
                            {r.name || r.address}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px]" style={{ color: '#7A7567' }}>
                            {r.address && <span className="truncate">{r.address}</span>}
                            {typeof r.distance_km === 'number' && (
                              <span style={{ color: '#A0633C' }}>· {r.distance_km}km</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 사진 갤러리 */}
              {selectedPlace.allPhotos.length > 0 && (
                <div className="p-4 border-b" style={{ borderColor: '#E8E2D5' }}>
                  <div className="text-xs font-medium mb-2 flex items-center gap-1.5" style={{ color: '#7A7567' }}>
                    <ImageIcon size={11} /> 사진 {selectedPlace.allPhotos.length}장
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedPlace.allPhotos.map((ph, i) => (
                      <img key={i} src={ph} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
                    ))}
                  </div>
                </div>
              )}

              {/* 방문 기록 + 리뷰 */}
              <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-3">
                <div className="text-xs font-medium" style={{ color: '#7A7567' }}>방문 기록 & 후기</div>
                {selectedPlace.visits.sort((a, b) => b.date.localeCompare(a.date)).map(v => (
                  <div key={v.id} className="p-3 rounded-2xl" style={{ backgroundColor: '#FAF7F0' }}>
                    <div className="flex justify-between items-baseline mb-2">
                      <div className="text-xs" style={{ color: '#7A7567' }}>{v.date}</div>
                      <div className="text-sm font-semibold tabular-nums" style={{ color: '#2C2418' }}>{v.amount.toLocaleString()} {cur}</div>
                    </div>

                    {/* 별점 */}
                    <div className="flex items-center gap-2 mb-2">
                      {[1, 2, 3, 4, 5].map(n => (
                        <button key={n} onClick={() => updateEntry(v.id, { rating: n })}>
                          <Star size={18} fill={n <= (v.rating || 0) ? '#E0A856' : 'none'} stroke={n <= (v.rating || 0) ? '#E0A856' : '#D4CDC0'} />
                        </button>
                      ))}
                      {v.rating && <span className="text-xs ml-1" style={{ color: '#7A7567' }}>{v.rating}점</span>}
                    </div>

                    {/* 리뷰 */}
                    {editingEntry === v.id ? (
                      <textarea defaultValue={v.review || ''} autoFocus rows={2}
                        className="w-full px-3 py-2 rounded-xl text-sm resize-none outline-none handwritten text-base mb-2"
                        style={{ backgroundColor: 'white', color: '#2C2418', border: '1px solid #E8E2D5' }}
                        onBlur={(e) => { updateEntry(v.id, { review: e.target.value || null }); setEditingEntry(null); }}
                        placeholder="여기 어땠어?" />
                    ) : (
                      <button onClick={() => setEditingEntry(v.id)} className="w-full text-left p-2 rounded-xl hover:bg-white mb-2">
                        {v.review ? (
                          <p className="handwritten text-base" style={{ color: '#2C2418' }}>"{v.review}"</p>
                        ) : (
                          <p className="text-xs italic" style={{ color: '#A8A296' }}>+ 한줄평 남기기</p>
                        )}
                      </button>
                    )}

                    {/* 사진 — 백엔드 photoMeta 가 진실원본. v.photos 는 표시용 URL 배열. */}
                    <div className="flex gap-1.5 flex-wrap items-center">
                      {v.photoMeta && v.photoMeta.map((meta, idx) => (
                        <div key={meta.id} className="relative group">
                          <img src={v.photos[idx]} alt="" className="w-16 h-16 rounded-lg object-cover" />
                          <button onClick={() => removePhoto(v.id, meta.id)}
                            className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ backgroundColor: '#2C2418', color: '#FFFDF8' }}>
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => { setPhotoUploadEntry(v.id); photoInputRef.current?.click(); }}
                        disabled={uploadPhotoMut.isPending}
                        className="w-16 h-16 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'white', border: '1px dashed #D4CDC0', color: '#7A7567', opacity: uploadPhotoMut.isPending ? 0.5 : 1 }}>
                        <div className="flex flex-col items-center gap-0.5">
                          <Upload size={14} />
                          <span className="text-[9px]">{uploadPhotoMut.isPending ? '업로드중…' : '사진'}</span>
                        </div>
                      </button>
                    </div>
                  </div>
                ))}
                <input ref={photoInputRef} type="file" accept="image/*"
                  onChange={(e) => photoUploadEntry && handlePhotoUpload(e, photoUploadEntry)}
                  style={{ display: 'none' }} />
              </div>
            </div>
          </div>
        )}

        {/* === 채팅 입력 사용 가이드 모달 === */}
        {showInputGuide && (
          <InputGuideModal onClose={dismissInputGuide} />
        )}
      </div>
    </div>
  );
}

function InputGuideModal({ onClose }) {
  const sections = [
    {
      title: '한 줄로 지출 기록',
      icon: PenLine,
      tips: [
        '스타벅스 6500원',
        '점심 김밥 4천원',
        '편의점에서 2,300원 썼어',
      ],
    },
    {
      title: '여러 건 한꺼번에',
      icon: ListIcon,
      tips: [
        '오늘 점심 8천원, 카페 5천5백, 택시 9천원',
        '마트 32000 + 영화 15000',
      ],
    },
    {
      title: '날짜 / 시점 명시',
      icon: Calendar,
      tips: [
        '어제 저녁에 회식 4만원',
        '지난 금요일 미용실 3만원',
        '3월 15일 친구 결혼식 10만원',
      ],
    },
    {
      title: '장소 같이 적기',
      icon: MapPin,
      tips: [
        '스타벅스 강남역점에서 커피 6500원',
        '집 근처 올리브영에서 2만원',
        '※ AI는 장소 이름만 인식하고, 정확한 위치 핀은 항목을 눌러 직접 지정해줘',
      ],
    },
    {
      title: '앞으로 나갈 돈 (예정)',
      icon: Clock,
      tips: [
        '다음주 화요일 넷플릭스 17000원 나가',
        '15일에 관리비 18만원 예정',
        '내달 5일 친구 생일선물 5만원 살 거야',
      ],
    },
    {
      title: '영수증 / 사진',
      icon: Camera,
      tips: [
        '왼쪽 📷 버튼으로 영수증 사진을 올리면 AI가 자동으로 항목·금액·날짜를 뽑아줘',
        '여러 줄 영수증도 한 번에 처리돼',
      ],
    },
    {
      title: '카테고리 힌트',
      icon: Sparkles,
      tips: [
        '"올리브영 마스크팩 1만원" → 건강/뷰티 로 자동 분류',
        '"택시 1만2천" → 교통',
        '분류가 틀렸으면 항목 옆 ✏️ 수정 버튼으로 바꿀 수 있어',
      ],
    },
  ];
  const tabs = [
    { name: '캘린더', desc: '날짜를 누르면 그날 지출·예정이 다 보여' },
    { name: '장소', desc: '자주 간 곳을 지도와 사진으로 정리' },
    { name: '회고', desc: '월말마다 잘한 점/아쉬운 점/다음 달 약속을 메모' },
    { name: '계획', desc: '다음 달까지 나갈 돈을 미리 잡기' },
    { name: '대차표', desc: '수입·지출·저축률을 한 눈에' },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-end lg:items-center justify-center p-0 lg:p-4"
      style={{ backgroundColor: 'rgba(44, 36, 24, 0.55)' }} onClick={onClose}>
      <div className="w-full lg:max-w-2xl rounded-t-3xl lg:rounded-3xl overflow-hidden max-h-[90vh] flex flex-col"
        style={{ backgroundColor: '#FFFDF8' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-5 lg:p-6 border-b flex items-start justify-between flex-shrink-0"
          style={{ borderColor: '#E8E2D5', backgroundColor: '#FFFDF8' }}>
          <div>
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#2C2418' }}>
              <Lightbulb size={18} style={{ color: '#A0633C' }} /> 채팅으로 이렇게 적어보세요
            </h3>
            <p className="text-xs mt-1" style={{ color: '#7A7567' }}>
              평소에 말하듯 자유롭게 적어도 돼. AI가 금액·카테고리·날짜·장소를 알아서 정리해줘.
            </p>
          </div>
          <button onClick={onClose} className="p-2 -mr-2 -mt-1"><X size={20} style={{ color: '#7A7567' }} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 lg:p-6 space-y-4">
          <div className="rounded-2xl p-4" style={{ backgroundColor: '#F5E9DD' }}>
            <div className="text-xs font-medium mb-1" style={{ color: '#A0633C' }}>3초 요약</div>
            <p className="text-sm leading-relaxed" style={{ color: '#2C2418' }}>
              <strong>"무엇을, 얼마, (선택) 언제·어디서"</strong> 이 정도면 충분해.<br />
              예: <span className="handwritten text-base">"오늘 스타벅스 부천역점에서 6500원 썼어"</span>
            </p>
          </div>

          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <div key={sec.title} className="rounded-2xl p-4" style={{ backgroundColor: '#FAF7F0', border: '1px solid #E8E2D5' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#F5E9DD' }}>
                    <Icon size={14} style={{ color: '#A0633C' }} />
                  </div>
                  <h4 className="text-sm font-semibold" style={{ color: '#2C2418' }}>{sec.title}</h4>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {sec.tips.map((tip, i) => (
                    <li key={i} className="text-sm flex items-start gap-2" style={{ color: '#2C2418' }}>
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: '#A0633C' }} />
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFFDF8', border: '1px solid #E8E2D5' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#E8EEE6' }}>
                <Compass size={14} style={{ color: '#6B8E6B' }} />
              </div>
              <h4 className="text-sm font-semibold" style={{ color: '#2C2418' }}>채팅 말고도 활용해 봐</h4>
            </div>
            <ul className="space-y-1.5 pl-1">
              {tabs.map((t) => (
                <li key={t.name} className="text-sm" style={{ color: '#2C2418' }}>
                  <span className="font-medium" style={{ color: '#A0633C' }}>{t.name}</span>
                  <span style={{ color: '#7A7567' }}> — {t.desc}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs mt-3" style={{ color: '#7A7567' }}>
              ✏️ 각 항목 옆의 연필/휴지통 아이콘으로 개별 항목을 수정·삭제할 수 있어.
            </p>
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: '#FDF0EA' }}>
            <div className="text-xs font-medium mb-1" style={{ color: '#E07856' }}>이런 건 안 돼</div>
            <ul className="text-xs space-y-1 pl-1" style={{ color: '#2C2418' }}>
              <li>· 금액이 없는 메시지 (예: "오늘 카페 갔어") → 얼마인지 같이 적어줘</li>
              <li>· 가계부와 무관한 질문 (예: 날씨·뉴스 검색) → 가계부 정리 전용이야</li>
              <li>· 개인 식별 정보(주민번호·카드번호 전체) → 절대 적지 마</li>
            </ul>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end flex-shrink-0" style={{ borderColor: '#E8E2D5', backgroundColor: '#FFFDF8' }}>
          <button onClick={onClose}
            className="px-5 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#2C2418', color: '#FFFDF8' }}>
            알겠어, 시작해볼게
          </button>
        </div>
      </div>
    </div>
  );
}

function EntryEditCard({ draft, categories, bg, onChange, onCancel, onSave, t, cur }) {
  const set = (patch) => onChange({ ...draft, ...patch });
  return (
    <div className="p-3 rounded-2xl space-y-2" style={{ backgroundColor: bg, border: '1px solid #E8E2D5' }}>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: '#7A7567' }}>{t('ledger.entryEdit.name')}</span>
        <input
          autoFocus
          value={draft.description}
          onChange={(e) => set({ description: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', color: '#2C2418' }}
          placeholder={t('ledger.entryEdit.namePlaceholder')}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: '#7A7567' }}>{t('ledger.entryEdit.amount')}</span>
        <input
          type="number"
          inputMode="numeric"
          value={draft.amount}
          onChange={(e) => set({ amount: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none tabular-nums"
          style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', color: '#2C2418' }}
        />
        <span className="text-xs" style={{ color: '#7A7567' }}>{cur}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium" style={{ color: '#7A7567' }}>{t('ledger.entryEdit.date')}</span>
        <input
          type="date"
          value={draft.date}
          onChange={(e) => set({ date: e.target.value })}
          className="flex-1 px-2 py-1.5 rounded-lg text-sm outline-none"
          style={{ backgroundColor: 'white', border: '1px solid #E8E2D5', color: '#2C2418' }}
        />
      </div>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-medium pt-1.5" style={{ color: '#7A7567' }}>{t('ledger.entryEdit.category')}</span>
        <div className="flex-1 flex flex-wrap gap-1">
          {Object.keys(categories).map((cat) => {
            const active = draft.category === cat;
            const info = categories[cat];
            return (
              <button
                key={cat}
                onClick={() => set({ category: cat })}
                className="text-[11px] px-2 py-1 rounded-full"
                style={{
                  backgroundColor: active ? info.bg : 'white',
                  color: active ? info.color : '#7A7567',
                  border: `1px solid ${active ? info.color : '#E8E2D5'}`,
                }}
              >
                {t(`ledger.categories.${cat}`, cat)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: 'white', color: '#7A7567', border: '1px solid #E8E2D5' }}>
          {t('ledger.entryEdit.cancel')}
        </button>
        <button onClick={onSave}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: '#2C2418', color: '#FFFDF8' }}>
          {t('ledger.entryEdit.save')}
        </button>
      </div>
    </div>
  );
}

function SimpleMap({ places, onPinClick, CATEGORIES }) {
  const SVG_W = 600, SVG_H = 320;
  // 좌표가 지정된 장소만 핀으로 표시 (사용자가 직접 위치를 선택한 곳).
  const pinned = places.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');
  if (pinned.length === 0) {
    return (
      <div className="rounded-2xl p-6 text-xs text-center" style={{ backgroundColor: '#F0EBE0', color: '#7A7567' }}>
        아직 핀으로 표시할 위치가 없어. 장소 카드를 눌러 정확한 위치를 골라줘.
      </div>
    );
  }
  const bounds = {
    minLat: Math.min(...pinned.map(p => p.lat)) - 0.005,
    maxLat: Math.max(...pinned.map(p => p.lat)) + 0.005,
    minLng: Math.min(...pinned.map(p => p.lng)) - 0.005,
    maxLng: Math.max(...pinned.map(p => p.lng)) + 0.005,
  };
  const projectX = (lng) => ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * SVG_W;
  const projectY = (lat) => SVG_H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * SVG_H;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ backgroundColor: '#F0EBE0' }}>
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full h-auto" style={{ display: 'block' }}>
        <defs>
          <pattern id="grid-mini" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#E8E2D5" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width={SVG_W} height={SVG_H} fill="url(#grid-mini)" />
        <path d="M 0 160 Q 200 140 300 180 T 600 160" stroke="#D4CDC0" strokeWidth="2" fill="none" opacity="0.4" />
        {pinned.map((p, i) => {
          const x = projectX(p.lng), y = projectY(p.lat);
          const catColor = CATEGORIES[p.category]?.color || '#7A7567';
          const size = Math.min(24, 14 + Math.sqrt(p.totalSpent / 5000));
          return (
            <g key={p.name} className="pin" style={{ animationDelay: `${i * 80}ms` }} onClick={() => onPinClick(p)}>
              <ellipse cx={x} cy={y + 2} rx={size * 0.4} ry={2} fill="rgba(44,36,24,0.2)" />
              <path
                d={`M ${x} ${y - size} C ${x - size * 0.6} ${y - size}, ${x - size * 0.6} ${y - size * 0.3}, ${x} ${y} C ${x + size * 0.6} ${y - size * 0.3}, ${x + size * 0.6} ${y - size}, ${x} ${y - size} Z`}
                fill={catColor} stroke="white" strokeWidth="2" />
              <circle cx={x} cy={y - size * 0.6} r={size * 0.25} fill="white" />
              {p.avgRating >= 4 && <circle cx={x + size * 0.5} cy={y - size + 3} r="5" fill="#E0A856" stroke="white" strokeWidth="1.5" />}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
