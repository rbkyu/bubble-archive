/* 本地数据库：IndexedDB
   存储结构：
   artists  : { id, name, group, color, note, avatarThumb(Blob), avatarDriveId, createdAt }
   messages : { id, artistId, role, type, text, media, sentAt, createdAt, starred, syncState, driveId, demo }
   kv       : { k, v }
*/
(function (global) {
  const NAME = "bubbleArchive";
  const VER = 1;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("artists")) {
          db.createObjectStore("artists", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("messages")) {
          const s = db.createObjectStore("messages", { keyPath: "id" });
          s.createIndex("artistId", "artistId");
          s.createIndex("artistSent", ["artistId", "sentAt"]);
          s.createIndex("syncState", "syncState");
        }
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv", { keyPath: "k" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error("数据库被其他页面占用，请关闭其他窗口后重试"));
    });
    return dbp;
  }

  function tx(store, mode) {
    return open().then((db) => db.transaction(store, mode).objectStore(store));
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const DB = {
    open,

    async put(store, value) {
      const s = await tx(store, "readwrite");
      return wrap(s.put(value));
    },

    async get(store, key) {
      const s = await tx(store, "readonly");
      return wrap(s.get(key));
    },

    async del(store, key) {
      const s = await tx(store, "readwrite");
      return wrap(s.delete(key));
    },

    async all(store) {
      const s = await tx(store, "readonly");
      return wrap(s.getAll());
    },

    async byIndex(store, index, query) {
      const s = await tx(store, "readonly");
      return wrap(s.index(index).getAll(query));
    },

    async clear(store) {
      const s = await tx(store, "readwrite");
      return wrap(s.clear());
    },

    async kvGet(k, def) {
      const row = await DB.get("kv", k);
      return row === undefined ? def : row.v;
    },

    async kvSet(k, v) {
      return DB.put("kv", { k, v });
    },

    /* 群发写入，减少事务次数 */
    async putMany(store, values) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const s = t.objectStore(store);
        values.forEach((v) => s.put(v));
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },

    async delMany(store, keys) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const s = t.objectStore(store);
        keys.forEach((k) => s.delete(k));
        t.oncomplete = () => resolve(true);
        t.onerror = () => reject(t.error);
      });
    },
  };

  global.DB = DB;
})(window);
