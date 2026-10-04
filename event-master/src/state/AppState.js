import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { checkAI } from '../ai/client';
import { DEFAULT_MEMORY, effectiveMemories, profileFromMemories } from '../logic/memory';
import { uid } from '../logic/util';

// Everything is stored on the device (AsyncStorage → localStorage on web).
// A cloud backend (Supabase) can replace this layer later.
const STORAGE_KEY = 'eventmaster:v1';

const AppStateContext = createContext(null);

const DEFAULT_SETTINGS = { ai: true };
const EMPTY = { events: [], memory: DEFAULT_MEMORY, savedIdeas: [], settings: DEFAULT_SETTINGS };

export function AppStateProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [draft, setDraftState] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    checkAI().then((ok) => alive && setAiAvailable(ok));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        const parsed = JSON.parse(raw);
        setData({
          events: Array.isArray(parsed.events) ? parsed.events : [],
          memory: { ...DEFAULT_MEMORY, ...(parsed.memory || {}) },
          savedIdeas: Array.isArray(parsed.savedIdeas) ? parsed.savedIdeas : [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
        });
      })
      .catch(() => {})
      .finally(() => alive && setHydrated(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return undefined;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
    }, 250);
    return () => clearTimeout(saveTimer.current);
  }, [data, hydrated]);

  const setDraft = useCallback((patch) => {
    setDraftState((d) => (typeof patch === 'function' ? patch(d) : { ...d, ...patch }));
  }, []);

  const actions = useMemo(
    () => ({
      setDraft,
      clearDraft: () => setDraftState(null),
      startDraft: (d) => setDraftState(d),
      addEvent: (ev) => setData((s) => ({ ...s, events: [...s.events, ev] })),
      updateEvent: (id, fn) =>
        setData((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...fn(e), updatedAt: new Date().toISOString() } : e)) })),
      deleteEvent: (id) => setData((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),
      saveParty: (id) =>
        setData((s) => ({
          ...s,
          events: s.events.map((e) => (e.id === id ? { ...e, status: 'saved', savedAt: new Date().toISOString() } : e)),
        })),
      setMemory: (fn) => setData((s) => ({ ...s, memory: fn(s.memory) })),
      // kind: 'product' | 'idea' | 'ai' (AI ideas carry their content in `data`)
      toggleSavedIdea: (kind, refId, data) =>
        setData((s) => {
          const exists = s.savedIdeas.some((x) => x.kind === kind && x.refId === refId);
          const entry = { id: uid('idea'), kind, refId, savedAt: new Date().toISOString(), ...(data ? { data } : {}) };
          return {
            ...s,
            savedIdeas: exists ? s.savedIdeas.filter((x) => !(x.kind === kind && x.refId === refId)) : [...s.savedIdeas, entry],
          };
        }),
      setSettings: (patch) => setData((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
    }),
    [setDraft],
  );

  const value = useMemo(() => ({ ...data, draft, hydrated, aiAvailable, ...actions }), [data, draft, hydrated, aiAvailable, actions]);
  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

export function useEvent(id) {
  const { events } = useAppState();
  return events.find((e) => e.id === id) || null;
}

export function useMemories() {
  const { events, memory } = useAppState();
  return useMemo(() => effectiveMemories(events, memory), [events, memory]);
}

// Recommendation context for an event: memory is used only if the user turned
// it on globally AND chose "Yes, use them" for this event.
export function useRecommendationContext(event) {
  const { memory, savedIdeas } = useAppState();
  const memories = useMemories();
  return useMemo(
    () => ({
      profile: event && event.useMemory && memory.enabled ? profileFromMemories(memories) : null,
      savedProductIds: savedIdeas.filter((x) => x.kind === 'product').map((x) => x.refId),
    }),
    [event, memory.enabled, memories, savedIdeas],
  );
}

export function useIsSaved(kind, refId) {
  const { savedIdeas } = useAppState();
  return savedIdeas.some((x) => x.kind === kind && x.refId === refId);
}

// AI features run only when the server has AI configured AND the user has
// "Use AI features" switched on.
export function useAI() {
  const { aiAvailable, settings } = useAppState();
  return { available: aiAvailable, enabled: aiAvailable && settings.ai };
}
