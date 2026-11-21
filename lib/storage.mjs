export const APP_ID = 'hanh-gung-toi';
export const STORAGE_KEY = `${APP_ID}-user-v1`;

const VERSION = 1;
const MAX_BACKUP_BYTES = 1024 * 1024;
const MAX_NOTE_LENGTH = 10000;
const MAX_RECENT = 20;
const MERGE_SEPARATOR = '\n\n--- Ghi chú từ bản sao lưu ---\n';
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const THEMES = new Set(['system', 'light', 'dark']);

function freshState() {
  return { version: VERSION, favorites: [], notes: {}, recent: [], settings: { theme: 'system', fontSize: 18 } };
}

function copyState(state) {
  return {
    version: VERSION,
    favorites: [...state.favorites],
    notes: { ...state.notes },
    recent: [...state.recent],
    settings: { ...state.settings },
  };
}

function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, keys, label) {
  if (!record(value)) throw new TypeError(`${label} không đúng cấu trúc.`);
  const allowed = new Set(keys);
  if (Object.keys(value).some((key) => FORBIDDEN_KEYS.has(key) || !allowed.has(key))) {
    throw new TypeError(`${label} chứa trường không hợp lệ.`);
  }
}

function validIdShape(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 200 && !FORBIDDEN_KEYS.has(id);
}

function byteLength(text) {
  return new TextEncoder().encode(text).byteLength;
}

function validTheme(value) {
  return typeof value === 'string' && THEMES.has(value);
}

function validFontSize(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 16 && value <= 26;
}

function validateState(input, validIds, ignored = new Set()) {
  exactKeys(input, ['version', 'favorites', 'notes', 'recent', 'settings'], 'Dữ liệu sao lưu');
  if (input.version !== VERSION) throw new TypeError('Phiên bản dữ liệu chưa được hỗ trợ.');
  if (!Array.isArray(input.favorites) || !Array.isArray(input.recent)) {
    throw new TypeError('Danh sách đã lưu hoặc đã xem không hợp lệ.');
  }
  if (!record(input.notes)) throw new TypeError('Ghi chú trong bản sao lưu không hợp lệ.');
  exactKeys(input.settings, ['theme', 'fontSize'], 'Tùy chọn đọc');
  if (!validTheme(input.settings.theme) || !validFontSize(input.settings.fontSize)) {
    throw new TypeError('Tùy chọn đọc trong bản sao lưu không hợp lệ.');
  }
  const acceptId = (id) => {
    if (!validIdShape(id)) throw new TypeError('Mã bài trong bản sao lưu không hợp lệ.');
    if (!validIds.has(id)) { ignored.add(id); return false; }
    return true;
  };
  const favorites = [...new Set(input.favorites.filter(acceptId))];
  const recent = [...new Set(input.recent.filter(acceptId))].slice(0, MAX_RECENT);
  const notes = {};
  for (const [id, text] of Object.entries(input.notes)) {
    // Validate values even for unknown IDs, so malformed backups are rejected atomically.
    if (typeof text !== 'string' || text.length > MAX_NOTE_LENGTH) {
      throw new TypeError('Một ghi chú trong bản sao lưu không hợp lệ hoặc quá dài.');
    }
    if (acceptId(id) && text !== '') notes[id] = text;
  }
  return { version: VERSION, favorites, notes, recent, settings: { ...input.settings } };
}

function makeBackup(state) {
  return { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), data: copyState(state) };
}

function ensureExportable(state) {
  if (byteLength(JSON.stringify(makeBackup(state), null, 2)) > MAX_BACKUP_BYTES) {
    throw new RangeError('Dữ liệu cá nhân vượt 1 MB. Hãy rút gọn một số ghi chú trước khi lưu hoặc nhập thêm.');
  }
}

function mergeNote(existing, incoming) {
  if (existing === incoming) return existing;
  const existingParts = existing.split(MERGE_SEPARATOR);
  const added = [];
  for (const part of incoming.split(MERGE_SEPARATOR)) {
    if (part !== '' && !existingParts.includes(part) && !added.includes(part)) added.push(part);
  }
  return added.length ? existing + MERGE_SEPARATOR + added.join(MERGE_SEPARATOR) : existing;
}

/**
 * Creates a local user store. No browser API is accessed until this function runs.
 * adapter can be a localStorage-compatible { getItem, setItem } or null for memory only.
 * state is a fresh snapshot; callers mutate data through the store's methods.
 */
export function createUserStore(validIds, adapter) {
  let ids;
  try { ids = new Set(validIds); }
  catch { throw new TypeError('Cần cung cấp tập mã bài hợp lệ.'); }
  if ([...ids].some((id) => !validIdShape(id))) throw new TypeError('Tập mã bài chứa mã không hợp lệ.');

  let backing = adapter;
  let persistent = false;
  let error = '';
  let state = freshState();
  let writeLockedByCorruption = false;

  if (backing === undefined) {
    try { backing = typeof window !== 'undefined' ? window.localStorage : null; }
    catch { backing = null; }
  }
  if (!backing || typeof backing.getItem !== 'function' || typeof backing.setItem !== 'function') {
    backing = null;
    error = 'Trình duyệt chưa cho phép lưu lâu dài. Dữ liệu chỉ được giữ trong phiên này.';
  } else {
    let saved;
    try {
      saved = backing.getItem(STORAGE_KEY);
      persistent = true;
    } catch {
      // A failed read must not lead to overwriting data that we could not inspect.
      backing = null;
      error = 'Không đọc được bộ nhớ của trình duyệt. Dữ liệu đang được giữ trong phiên này.';
    }
    if (typeof saved === 'string' && saved !== '') {
      try {
        if (byteLength(saved) > MAX_BACKUP_BYTES) throw new Error('oversized');
        state = validateState(JSON.parse(saved), ids);
      } catch {
        persistent = false;
        writeLockedByCorruption = true;
        error = 'Dữ liệu đã lưu không đọc được. Bản hiện có đang được bảo vệ; các thay đổi chỉ giữ trong phiên này. Hãy nhập bản sao lưu để khôi phục.';
        // Recent-item updates happen automatically. Protect the original bytes from
        // every ordinary mutation until an explicitly validated import succeeds.
      }
    }
  }

  function requireId(id) {
    if (!validIdShape(id) || !ids.has(id)) throw new RangeError('Không tìm thấy bài này trong sách.');
  }

  function commit(next, { recoverCorruption = false } = {}) {
    ensureExportable(next);
    state = next;
    if (writeLockedByCorruption && !recoverCorruption) return false;
    if (!backing) return false;
    try {
      backing.setItem(STORAGE_KEY, JSON.stringify(state));
      writeLockedByCorruption = false;
      persistent = true;
      error = '';
      return true;
    } catch {
      persistent = false;
      error = writeLockedByCorruption
        ? 'Chưa ghi được bản khôi phục vào thiết bị. Bản dữ liệu cũ vẫn được bảo vệ; hãy xuất sao lưu và thử nhập lại khi có thể lưu.'
        : 'Chưa lưu được vào thiết bị. Dữ liệu vẫn có trong phiên này; hãy xuất sao lưu trước khi đóng.';
      return false;
    }
  }

  return {
    get state() { return copyState(state); },
    get persistent() { return persistent; },
    get error() { return error; },

    toggleFavorite(id) {
      requireId(id);
      const next = copyState(state);
      const saved = !next.favorites.includes(id);
      next.favorites = saved ? [...next.favorites, id] : next.favorites.filter((item) => item !== id);
      return { saved, persisted: commit(next) };
    },

    setNote(id, text) {
      requireId(id);
      if (typeof text !== 'string') throw new TypeError('Ghi chú phải là văn bản.');
      if (text.length > MAX_NOTE_LENGTH) throw new RangeError(`Ghi chú tối đa ${MAX_NOTE_LENGTH.toLocaleString('vi-VN')} ký tự.`);
      const next = copyState(state);
      if (text === '') delete next.notes[id];
      else next.notes[id] = text;
      return { persisted: commit(next) };
    },

    addRecent(id) {
      requireId(id);
      const next = copyState(state);
      next.recent = [id, ...next.recent.filter((item) => item !== id)].slice(0, MAX_RECENT);
      try {
        return { persisted: commit(next) };
      } catch (error) {
        // Optional history must not interrupt opening a recipe. Size validation runs
        // before commit changes memory, so a full store can retain its existing state.
        if (error instanceof RangeError) return { persisted: false };
        throw error;
      }
    },

    setSetting(key, value) {
      if ((key === 'theme' && !validTheme(value)) || (key === 'fontSize' && !validFontSize(value))) {
        throw new TypeError('Giá trị tùy chọn đọc không hợp lệ.');
      }
      if (key !== 'theme' && key !== 'fontSize') throw new TypeError('Tùy chọn đọc không hợp lệ.');
      const next = copyState(state);
      next.settings[key] = value;
      return { persisted: commit(next) };
    },

    exportBackup() {
      return JSON.stringify(makeBackup(state), null, 2);
    },

    importBackup(text) {
      if (typeof text !== 'string') throw new TypeError('Cần chọn tệp sao lưu dạng JSON.');
      if (byteLength(text) > MAX_BACKUP_BYTES) throw new RangeError('Tệp sao lưu lớn hơn 1 MB.');
      let input;
      try { input = JSON.parse(text); }
      catch { throw new TypeError('Tệp không phải bản sao lưu JSON hợp lệ.'); }
      exactKeys(input, ['app', 'version', 'exportedAt', 'data'], 'Tệp sao lưu');
      if (input.app !== APP_ID) throw new TypeError('Tệp sao lưu không thuộc ứng dụng Hành Gừng Tỏi.');
      if (input.version !== VERSION) throw new TypeError('Phiên bản tệp sao lưu chưa được hỗ trợ.');
      if (input.exportedAt !== undefined && (typeof input.exportedAt !== 'string' || !Number.isFinite(Date.parse(input.exportedAt)))) {
        throw new TypeError('Ngày của tệp sao lưu không hợp lệ.');
      }
      const ignored = new Set();
      const imported = validateState(input.data, ids, ignored);
      const next = copyState(state);
      let favoritesAdded = 0;
      let notesAdded = 0;
      let notesMerged = 0;
      for (const id of imported.favorites) {
        if (!next.favorites.includes(id)) { next.favorites.push(id); favoritesAdded += 1; }
      }
      for (const [id, incoming] of Object.entries(imported.notes)) {
        if (!Object.hasOwn(next.notes, id)) { next.notes[id] = incoming; notesAdded += 1; }
        else {
          const merged = mergeNote(next.notes[id], incoming);
          if (merged.length > MAX_NOTE_LENGTH) throw new RangeError('Một ghi chú sau khi gộp vượt 10.000 ký tự. Dữ liệu hiện tại chưa thay đổi.');
          if (merged !== next.notes[id]) { next.notes[id] = merged; notesMerged += 1; }
        }
      }
      next.recent = [...new Set([...next.recent, ...imported.recent])].slice(0, MAX_RECENT);
      // Preserve settings on this device; importing personal content should not change the display.
      // Import is an explicit user action, so also repair a corrupt/failed persistent copy
      // when the merged in-memory content happens to be unchanged.
      const persisted = commit(next, { recoverCorruption: true });
      return { favoritesAdded, notesAdded, notesMerged, ignored: ignored.size, persisted };
    },
  };
}
