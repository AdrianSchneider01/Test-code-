// Sync between this device and the viewer's private space in the
// artifact's database (claude.ai only). Each signed-in person gets their own
// `data/users/<id>/` collection, which nobody else can read — not even the
// artifact's owner. One document per event, plus one "meta" document for
// memory, saved ideas and settings.
//
// Merge rule: the newest version of each event wins (by updatedAt); the
// newest meta wins; deleted events are remembered so a delete on one
// device removes the event everywhere.

const META = 'meta';
const META_KEYS = ['memory', 'savedIdeas', 'settings'];

const stamp = (e) => e.updatedAt || e.savedAt || e.createdAt || '';
const uniq = (arr) => arr.filter((v, i) => arr.indexOf(v) === i);
const clone = (v) => JSON.parse(JSON.stringify(v));

// Store documents ⇄ app data.
export function dataToDocs(data) {
  const docs = {
    [META]: {
      memory: data.memory,
      savedIdeas: data.savedIdeas,
      settings: data.settings,
      deletedIds: data.deletedIds || [],
      metaUpdatedAt: data.metaUpdatedAt || '',
    },
  };
  data.events.forEach((e) => {
    docs[e.id] = e;
  });
  return docs;
}

export function docsToData(docs) {
  const meta = docs.find((d) => d.id === META);
  const m = meta ? meta.body : {};
  return {
    events: docs.filter((d) => d.id !== META).map((d) => d.body),
    memory: m.memory,
    savedIdeas: m.savedIdeas,
    settings: m.settings,
    deletedIds: m.deletedIds || [],
    metaUpdatedAt: m.metaUpdatedAt || '',
    hasMeta: !!meta,
  };
}

// Combine this device's data with what the store holds.
export function mergeData(local, remote) {
  const deletedIds = uniq([...(local.deletedIds || []), ...(remote.deletedIds || [])]);
  const byId = new Map();
  [...local.events, ...remote.events].forEach((e) => {
    if (!e || !e.id || deletedIds.includes(e.id)) return;
    const cur = byId.get(e.id);
    if (!cur || stamp(e) > stamp(cur)) byId.set(e.id, e);
  });
  const events = [...byId.values()].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const remoteMetaWins = remote.hasMeta && (remote.metaUpdatedAt || '') > (local.metaUpdatedAt || '');
  const meta = {};
  META_KEYS.forEach((k) => {
    meta[k] = remoteMetaWins && remote[k] !== undefined ? remote[k] : local[k];
  });
  const merged = {
    ...local,
    ...meta,
    events,
    deletedIds,
    metaUpdatedAt: remoteMetaWins ? remote.metaUpdatedAt : local.metaUpdatedAt || '',
  };
  // Keep the same object when nothing changed, so React doesn't re-render.
  return JSON.stringify(merged) === JSON.stringify(local) ? local : merged;
}

// What to write so the store matches `data`, given what it last held.
export function diffDocs(storeJson, data) {
  const docs = dataToDocs(data);
  const sets = [];
  Object.keys(docs).forEach((id) => {
    const json = JSON.stringify(docs[id]);
    if (storeJson[id] !== json) sets.push({ id, body: clone(docs[id]), json });
  });
  const deletes = Object.keys(storeJson).filter((id) => !(id in docs));
  return { sets, deletes };
}

export function docsJson(docs) {
  const out = {};
  docs.forEach((d) => {
    out[d.id] = JSON.stringify(d.body);
  });
  return out;
}

// Connects to the viewer's private collection, or resolves null when this
// view can't sync (not on claude.ai, signed out, or not allowed).
export async function connectCloud() {
  const host = typeof window !== 'undefined' ? window.claude : undefined;
  if (!host || typeof host.use !== 'function') return null;
  try {
    const [db, user] = await Promise.all([host.use('db'), host.use('user')]);
    if (!db || !user) return null;
    const uid = await user.id();
    if (!uid) return null;
    const col = db.collection(`data/users/${uid}`);
    return {
      // Calls back with [{id, body}] whenever the stored data changes.
      subscribe(onDocs, onDead) {
        return col.onSnapshot(
          (snap) => {
            // Wait for a complete, confirmed view (the first pages can be partial).
            if (snap.metadata && (snap.metadata.hasPendingWrites || snap.metadata.fromCache)) return;
            onDocs(snap.docs.filter((d) => d.exists).map((d) => ({ id: d.id, body: d.data() })));
          },
          () => onDead && onDead(),
        );
      },
      // One write at a time, as the store asks.
      async write({ sets, deletes }, onWritten) {
        for (const s of sets) {
          await col.doc(s.id).set(s.body);
          onWritten(s.id, s.json);
        }
        for (const id of deletes) {
          await col.doc(id).delete();
          onWritten(id, undefined);
        }
      },
    };
  } catch {
    return null;
  }
}
