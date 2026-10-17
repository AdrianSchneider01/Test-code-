import { dataToDocs, diffDocs, docsJson, docsToData, mergeData } from '../src/state/sync';

const ev = (id, updatedAt, extra = {}) => ({ id, createdAt: '2026-10-01T00:00:00.000Z', updatedAt, name: id, ...extra });
const base = (o = {}) => ({ events: [], memory: { enabled: true }, savedIdeas: [], settings: { ai: true }, deletedIds: [], metaUpdatedAt: '', ...o });
const asDocs = (data) => Object.entries(dataToDocs(data)).map(([id, body]) => ({ id, body }));

describe('cloud sync', () => {
  test('docs round-trip back to the same data', () => {
    const data = base({ events: [ev('a', '1')], metaUpdatedAt: '5', savedIdeas: [{ id: 'x' }] });
    const back = docsToData(asDocs(data));
    expect(back.events).toEqual(data.events);
    expect(back.savedIdeas).toEqual(data.savedIdeas);
    expect(back.hasMeta).toBe(true);
  });

  test('the newest copy of each event wins', () => {
    const local = base({ events: [ev('a', '2026-10-02', { name: 'new' }), ev('b', '2026-10-01')] });
    const remote = docsToData(asDocs(base({ events: [ev('a', '2026-10-01', { name: 'old' }), ev('c', '2026-10-03')] })));
    const merged = mergeData(local, remote);
    expect(merged.events.map((e) => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(merged.events.find((e) => e.id === 'a').name).toBe('new');
  });

  test('a delete on one device removes the event everywhere', () => {
    const local = base({ events: [ev('a', '2026-10-05')] });
    const remote = docsToData(asDocs(base({ deletedIds: ['a'] })));
    const merged = mergeData(local, remote);
    expect(merged.events).toEqual([]);
    expect(merged.deletedIds).toEqual(['a']);
  });

  test('newer memory/settings from the cloud replace older local ones, not newer', () => {
    const local = base({ settings: { ai: true }, metaUpdatedAt: '2026-10-01' });
    const newer = docsToData(asDocs(base({ settings: { ai: false }, metaUpdatedAt: '2026-10-02' })));
    expect(mergeData(local, newer).settings.ai).toBe(false);
    const older = docsToData(asDocs(base({ settings: { ai: false }, metaUpdatedAt: '2026-09-30' })));
    expect(mergeData(local, older).settings.ai).toBe(true);
  });

  test('nothing new from the cloud keeps the same object (no re-render)', () => {
    const local = base({ events: [ev('a', '1')] });
    expect(mergeData(local, docsToData(asDocs(local)))).toBe(local);
  });

  test('diff writes only what changed and deletes removed events', () => {
    const before = base({ events: [ev('a', '1'), ev('b', '1')] });
    const store = docsJson(asDocs(before));
    expect(diffDocs(store, before)).toEqual({ sets: [], deletes: [] });
    const after = { ...before, events: [{ ...ev('a', '2'), name: 'changed' }], deletedIds: ['b'] };
    const diff = diffDocs(store, after);
    expect(diff.sets.map((s) => s.id).sort()).toEqual(['a', 'meta']);
    expect(diff.deletes).toEqual(['b']);
  });

  test('an empty cloud gets everything from this device', () => {
    const data = base({ events: [ev('a', '1')] });
    const diff = diffDocs({}, data);
    expect(diff.sets.map((s) => s.id).sort()).toEqual(['a', 'meta']);
  });
});
