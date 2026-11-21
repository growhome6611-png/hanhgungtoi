import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_ID, STORAGE_KEY, createUserStore } from '../lib/storage.mjs';

const ids = new Set(['r1', 'r2', 'r3']);
function memoryAdapter(initial = null) {
  const items = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return { writes: 0, getItem(key) { return items.get(key) ?? null; }, setItem(key, value) { this.writes += 1; items.set(key, value); } };
}
function backup(data = {}) {
  return JSON.stringify({ app: APP_ID, version: 1, data: {
    version: 1, favorites: [], notes: {}, recent: [], settings: { theme: 'system', fontSize: 18 }, ...data,
  } });
}

test('favorites, Vietnamese notes, recent and display options survive a reload', () => {
  const adapter = memoryAdapter();
  const store = createUserStore(ids, adapter);
  assert.deepEqual(store.toggleFavorite('r1'), { saved: true, persisted: true });
  const note = 'Đối chiếu trang gốc: cỏ mực, hạt mã đề.\nKhông đổi tên ghi trong sách.';
  store.setNote('r1', note);
  store.addRecent('r2');
  store.addRecent('r1');
  store.setSetting('theme', 'dark');
  store.setSetting('fontSize', 22);
  const reloaded = createUserStore(ids, adapter);
  assert.deepEqual(reloaded.state.favorites, ['r1']);
  assert.equal(reloaded.state.notes.r1, note);
  assert.deepEqual(reloaded.state.recent, ['r1', 'r2']);
  assert.deepEqual(reloaded.state.settings, { theme: 'dark', fontSize: 22 });
  assert.equal(reloaded.persistent, true);
});

test('merging preserves existing notes, appends differences, and deduplicates repeated imports', () => {
  const store = createUserStore(ids, memoryAdapter());
  store.toggleFavorite('r1');
  store.setNote('r1', 'Ghi chú ở điện thoại');
  store.setSetting('theme', 'dark');
  const imported = backup({ favorites: ['r1', 'r2'], notes: { r1: 'Ghi chú ở máy tính', r2: 'Trang 22' }, settings: { theme: 'light', fontSize: 26 } });
  assert.deepEqual(store.importBackup(imported), { favoritesAdded: 1, notesAdded: 1, notesMerged: 1, ignored: 0, persisted: true });
  assert.match(store.state.notes.r1, /^Ghi chú ở điện thoại\n\n--- Ghi chú từ bản sao lưu ---\nGhi chú ở máy tính$/);
  const first = store.state;
  assert.deepEqual(store.importBackup(imported), { favoritesAdded: 0, notesAdded: 0, notesMerged: 0, ignored: 0, persisted: true });
  assert.deepEqual(store.state, first);
  assert.deepEqual(store.state.settings, { theme: 'dark', fontSize: 18 });
  const roundTrip = store.exportBackup();
  assert.equal(store.importBackup(roundTrip).notesMerged, 0);
});

test('unknown IDs are ignored, while favorites and recent are unique', () => {
  const store = createUserStore(ids, memoryAdapter());
  const result = store.importBackup(backup({ favorites: ['r2', 'r2', 'missing'], notes: { missing: 'Không có bài', r3: 'Có bài' }, recent: ['missing', 'r2', 'r2', 'r3'] }));
  assert.equal(result.ignored, 1);
  assert.deepEqual(store.state.favorites, ['r2']);
  assert.deepEqual(store.state.notes, { r3: 'Có bài' });
  assert.deepEqual(store.state.recent, ['r2', 'r3']);
});

test('malformed or unsupported imports fail atomically without changing saved data', () => {
  const adapter = memoryAdapter();
  const store = createUserStore(ids, adapter);
  store.setNote('r1', 'Giữ nội dung gốc');
  store.toggleFavorite('r3');
  const before = store.state;
  const stored = adapter.getItem(STORAGE_KEY);
  const invalid = [
    '{broken',
    JSON.stringify({ app: APP_ID, version: 2, data: before }),
    JSON.stringify({ app: 'another-app', version: 1, data: before }),
    backup({ favorites: [123] }),
    backup({ notes: { r1: { text: 'không hợp lệ' } } }),
    backup({ notes: { missing: 1 } }),
    backup({ settings: { theme: 'dark', fontSize: '18' } }),
    backup({ settings: { theme: 'night', fontSize: 18 } }),
    '{"app":"hanh-gung-toi","version":1,"data":{"version":1,"favorites":[],"notes":{"__proto__":"polluted"},"recent":[],"settings":{"theme":"system","fontSize":18}}}',
  ];
  for (const text of invalid) {
    assert.throws(() => store.importBackup(text));
    assert.deepEqual(store.state, before);
    assert.equal(adapter.getItem(STORAGE_KEY), stored);
  }
  assert.equal({}.polluted, undefined);
});

test('oversize backups use UTF-8 byte size and leave current state intact', () => {
  const store = createUserStore(ids, memoryAdapter());
  store.setNote('r2', 'Giữ lại');
  const before = store.state;
  const large = backup({ notes: { r1: 'ắ'.repeat(400000) } });
  assert.ok(large.length < 1024 * 1024);
  assert.throws(() => store.importBackup(large), /1 MB/);
  assert.deepEqual(store.state, before);
});

test('denied storage keeps changes in memory and never overwrites unread storage', () => {
  let writes = 0;
  const adapter = { getItem() { throw new Error('denied'); }, setItem() { writes += 1; } };
  const store = createUserStore(ids, adapter);
  assert.equal(store.persistent, false);
  assert.equal(store.toggleFavorite('r1').persisted, false);
  assert.equal(store.setNote('r1', 'Dữ liệu tạm thời').persisted, false);
  assert.deepEqual(store.state.favorites, ['r1']);
  assert.equal(store.state.notes.r1, 'Dữ liệu tạm thời');
  assert.equal(writes, 0);
  assert.ok(store.error);
});

test('quota failure preserves memory and successful later writes recover persistence', () => {
  const adapter = memoryAdapter();
  const normalWrite = adapter.setItem;
  adapter.setItem = () => { throw new Error('quota'); };
  const store = createUserStore(ids, adapter);
  assert.equal(store.toggleFavorite('r2').persisted, false);
  assert.equal(store.persistent, false);
  assert.deepEqual(store.state.favorites, ['r2']);
  adapter.setItem = normalWrite;
  assert.equal(store.setNote('r2', 'Đã khôi phục').persisted, true);
  assert.equal(store.persistent, true);
  assert.equal(store.error, '');
  assert.deepEqual(createUserStore(ids, adapter).state.favorites, ['r2']);
});

test('corrupted storage stays byte-for-byte unchanged through automatic and local mutations', () => {
  const original = '{not-json: giữ nguyên dữ liệu cũ';
  const adapter = memoryAdapter(original);
  const store = createUserStore(ids, adapter);
  assert.equal(adapter.writes, 0);
  assert.equal(adapter.getItem(STORAGE_KEY), original);
  assert.equal(store.persistent, false);
  const corruptionError = store.error;
  assert.ok(corruptionError);
  assert.equal(store.addRecent('r1').persisted, false);
  assert.equal(store.toggleFavorite('r1').persisted, false);
  assert.equal(store.setSetting('theme', 'dark').persisted, false);
  assert.equal(store.setNote('r1', 'Ghi chú mới trong phiên').persisted, false);
  assert.equal(adapter.writes, 0);
  assert.equal(adapter.getItem(STORAGE_KEY), original);
  assert.equal(store.error, corruptionError);
  assert.deepEqual(store.state.recent, ['r1']);
  assert.deepEqual(store.state.favorites, ['r1']);
  assert.equal(store.state.notes.r1, 'Ghi chú mới trong phiên');
  assert.equal(store.state.settings.theme, 'dark');

  assert.throws(() => store.importBackup('{invalid'));
  assert.equal(store.addRecent('r2').persisted, false);
  assert.equal(adapter.getItem(STORAGE_KEY), original);

  const result = store.importBackup(backup({ favorites: ['r3'], notes: { r2: 'Ghi chú khôi phục' } }));
  assert.equal(result.persisted, true);
  assert.equal(store.persistent, true);
  assert.equal(store.error, '');
  const saved = JSON.parse(adapter.getItem(STORAGE_KEY));
  assert.deepEqual(saved.favorites, ['r1', 'r3']);
  assert.deepEqual(saved.notes, { r1: 'Ghi chú mới trong phiên', r2: 'Ghi chú khôi phục' });
  assert.equal(saved.settings.theme, 'dark');
  assert.equal(store.addRecent('r3').persisted, true);
});

test('a failed recovery write does not unlock the protected original storage', () => {
  const adapter = memoryAdapter('original-corrupt-bytes');
  const normalWrite = adapter.setItem;
  const store = createUserStore(ids, adapter);
  adapter.setItem = () => { throw new Error('quota'); };
  assert.equal(store.importBackup(backup({ favorites: ['r1'] })).persisted, false);
  adapter.setItem = normalWrite;
  const recoveryError = store.error;
  assert.equal(store.toggleFavorite('r2').persisted, false);
  assert.equal(store.addRecent('r2').persisted, false);
  assert.equal(adapter.getItem(STORAGE_KEY), 'original-corrupt-bytes');
  assert.equal(store.error, recoveryError);
  assert.equal(store.importBackup(backup()).persisted, true);
  assert.deepEqual(JSON.parse(adapter.getItem(STORAGE_KEY)).favorites, ['r1', 'r2']);
});

test('an explicit valid empty import can recover a corrupt persistent copy', () => {
  const adapter = memoryAdapter('not-json');
  const store = createUserStore(ids, adapter);
  assert.equal(store.importBackup(backup()).persisted, true);
  assert.equal(store.persistent, true);
  assert.equal(store.error, '');
  assert.equal(JSON.parse(adapter.getItem(STORAGE_KEY)).version, 1);
});

test('read snapshots cannot mutate internal data and invalid mutations are rejected', () => {
  const store = createUserStore(ids, memoryAdapter());
  const snapshot = store.state;
  snapshot.favorites.push('r1');
  snapshot.notes.r1 = 'Không ghi được trực tiếp';
  snapshot.settings.fontSize = 25;
  assert.deepEqual(store.state.favorites, []);
  assert.deepEqual(store.state.notes, {});
  assert.equal(store.state.settings.fontSize, 18);
  for (const action of [() => store.toggleFavorite('unknown'), () => store.setNote('r1', 5), () => store.setSetting('fontSize', 40), () => store.setSetting('__proto__', {})]) assert.throws(action);
});

test('empty imported notes do not erase existing text and clearing a note is explicit', () => {
  const store = createUserStore(ids, memoryAdapter());
  store.setNote('r1', 'Giữ ghi chú');
  store.importBackup(backup({ notes: { r1: '' } }));
  assert.equal(store.state.notes.r1, 'Giữ ghi chú');
  store.setNote('r1', '');
  assert.equal(Object.hasOwn(store.state.notes, 'r1'), false);
});

test('optional recent history cannot abort a deep link when valid data fills the exact 1 MiB limit', () => {
  const largeIds = new Set(Array.from({ length: 110 }, (_, index) => `r${String(index).padStart(3, '0')}`));
  const data = { version: 1, favorites: [], notes: {}, recent: [], settings: { theme: 'system', fontSize: 18 } };
  const encodedSize = () => new TextEncoder().encode(JSON.stringify({ app: APP_ID, version: 1, exportedAt: '2026-11-21T00:00:00.000Z', data }, null, 2)).byteLength;
  for (const id of largeIds) {
    data.notes[id] = '';
    const remaining = 1024 * 1024 - encodedSize();
    if (remaining <= 0) { delete data.notes[id]; break; }
    data.notes[id] = 'x'.repeat(Math.min(10000, remaining));
    if (remaining <= 10000) break;
  }
  assert.equal(encodedSize(), 1024 * 1024);
  const original = JSON.stringify(data);
  const adapter = memoryAdapter(original);
  const store = createUserStore(largeIds, adapter);
  assert.equal(store.persistent, true);
  assert.equal(new TextEncoder().encode(store.exportBackup()).byteLength, 1024 * 1024);
  const before = store.state;
  assert.deepEqual(store.addRecent('r000'), { persisted: false });
  assert.deepEqual(store.state, before);
  assert.equal(adapter.getItem(STORAGE_KEY), original);
  assert.equal(adapter.writes, 0);
  assert.equal(store.persistent, true);
  assert.equal(store.error, '');
});
