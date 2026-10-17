import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { checkAI, onAIUnavailable } from '../ai/client';
import { findBudgetAlert } from '../logic/engine';
import { DEFAULT_MEMORY, effectiveMemories, profileFromMemories } from '../logic/memory';
import { uid } from '../logic/util';
import { connectCloud, diffDocs, docsJson, docsToData, mergeData } from './sync';

// Everything is stored on the device (AsyncStorage → localStorage on web).
// On claude.ai it is also synced to the viewer's private space (./sync), so
// the same plans show on every device they sign in on.
const STORAGE_KEY = 'eventmaster:v1';

const AppStateContext = createContext(null);

const DEFAULT_SETTINGS = { ai: true };
const EMPTY = { events: [], memory: DEFAULT_MEMORY, savedIdeas: [], settings: DEFAULT_SETTINGS, deletedIds: [], metaUpdatedAt: '' };
const SYNC_DELAY = 1200;
const now = () => new Date().toISOString();

// Fill in defaults for data that came from storage or another device.
function normalise(d) {
  return {
    events: Array.isArray(d.events) ? d.events : [],
    memory: { ...DEFAULT_MEMORY, ...(d.memory || {}) },
    savedIdeas: Array.isArray(d.savedIdeas) ? d.savedIdeas : [],
    settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) },
    deletedIds: Array.isArray(d.deletedIds) ? d.deletedIds : [],
    metaUpdatedAt: d.metaUpdatedAt || '',
  };
}

export function AppStateProvider({ children }) {
  const [data, setData] = useState(EMPTY);
  const [draft, setDraftState] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(false);
  const saveTimer = useRef(null);
  // 'off' (not on claude.ai / signed out), 'connecting', 'synced', 'saving', 'error'
  const [cloud, setCloud] = useState('off');
  const cloudRef = useRef(null);
  const synced = useRef(null); // what the cloud last held: { docId: json }
  const syncTimer = useRef(null);
  const writing = useRef(false);
  const dataRef = useRef(data);

  // Budget alerts: whenever the events change (from any screen), check whether
  // a plan just reached or went over its budget. Done during render (React's
  // "adjust state when data changes" pattern) so no change can slip past.
  const [seenEvents, setSeenEvents] = useState(data.events);
  const [budgetAlert, setBudgetAlert] = useState(null);
  if (seenEvents !== data.events) {
    const alert = hydrated ? findBudgetAlert(seenEvents, data.events) : null;
    setSeenEvents(data.events);
    if (alert) setBudgetAlert(alert);
  }

  useEffect(() => {
    let alive = true;
    checkAI().then((ok) => alive && setAiAvailable(ok));
    const off = onAIUnavailable(() => alive && setAiAvailable(false));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!alive || !raw) return;
        setData(normalise(JSON.parse(raw)));
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

  // Cloud sync: connect once the device copy has loaded, then merge every
  // snapshot from the cloud into the local data.
  useEffect(() => {
    if (!hydrated) return undefined;
    let alive = true;
    let unsubscribe = null;
    connectCloud().then((conn) => {
      if (!alive || !conn) return;
      cloudRef.current = conn;
      setCloud('connecting');
      unsubscribe = conn.subscribe(
        (docs) => {
          if (!alive) return;
          synced.current = docsJson(docs);
          setData((local) => {
            const merged = mergeData(local, docsToData(docs));
            return merged === local ? local : normalise(merged);
          });
          setCloud((c) => (c === 'saving' ? c : 'synced'));
        },
        () => alive && setCloud('error'),
      );
    });
    return () => {
      alive = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [hydrated]);

  // Push local changes to the cloud shortly after they happen.
  useEffect(() => {
    dataRef.current = data;
    if (!hydrated || !cloudRef.current || !synced.current) return undefined;
    const push = async () => {
      if (writing.current) {
        syncTimer.current = setTimeout(push, SYNC_DELAY);
        return;
      }
      const diff = diffDocs(synced.current, dataRef.current);
      if (!diff.sets.length && !diff.deletes.length) return;
      writing.current = true;
      setCloud('saving');
      try {
        await cloudRef.current.write(diff, (id, json) => {
          if (json === undefined) delete synced.current[id];
          else synced.current[id] = json;
        });
        setCloud('synced');
      } catch {
        setCloud('error');
      } finally {
        writing.current = false;
      }
    };
    clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(push, SYNC_DELAY);
    return () => clearTimeout(syncTimer.current);
  }, [data, hydrated, cloud]);

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
        setData((s) => ({ ...s, events: s.events.map((e) => (e.id === id ? { ...fn(e), updatedAt: now() } : e)) })),
      // Remember deleted ids so the delete reaches the user's other devices.
      deleteEvent: (id) =>
        setData((s) => ({ ...s, events: s.events.filter((e) => e.id !== id), deletedIds: [...s.deletedIds.filter((x) => x !== id), id] })),
      saveParty: (id) =>
        setData((s) => {
          const t = now();
          return { ...s, events: s.events.map((e) => (e.id === id ? { ...e, status: 'saved', savedAt: t, updatedAt: t } : e)) };
        }),
      setMemory: (fn) => setData((s) => ({ ...s, memory: fn(s.memory), metaUpdatedAt: now() })),
      // kind: 'product' | 'idea' | 'ai' (AI ideas carry their content in `data`)
      toggleSavedIdea: (kind, refId, data) =>
        setData((s) => {
          const exists = s.savedIdeas.some((x) => x.kind === kind && x.refId === refId);
          const entry = { id: uid('idea'), kind, refId, savedAt: new Date().toISOString(), ...(data ? { data } : {}) };
          return {
            ...s,
            metaUpdatedAt: now(),
            savedIdeas: exists ? s.savedIdeas.filter((x) => !(x.kind === kind && x.refId === refId)) : [...s.savedIdeas, entry],
          };
        }),
      dismissBudgetAlert: () => setBudgetAlert(null),
      // Undo: put the event back exactly as it was before the change.
      // The restored copy gets a fresh timestamp so other devices take it too.
      restoreEvent: (previous) =>
        setData((s) => ({ ...s, events: s.events.map((e) => (e.id === previous.id ? { ...previous, updatedAt: now() } : e)) })),
      setSettings: (patch) => setData((s) => ({ ...s, settings: { ...s.settings, ...patch }, metaUpdatedAt: now() })),
    }),
    [setDraft],
  );

  const value = useMemo(
    () => ({ ...data, draft, hydrated, aiAvailable, budgetAlert, cloud, ...actions }),
    [data, draft, hydrated, aiAvailable, budgetAlert, cloud, actions],
  );
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
