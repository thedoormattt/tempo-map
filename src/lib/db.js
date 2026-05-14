// ─── db.js ───────────────────────────────────────────────────────────────────
// IndexedDB wrapper for Tempo Map history.
//
// Schema
// ──────
// Store: "analyses"
//   keyPath: "id" (auto-increment)
//   Fields:
//     id          — auto-increment integer
//     filename    — original filename
//     analysedAt  — ISO timestamp
//     duration    — seconds
//     sampleRate  — Hz
//     channels    — 1 or 2
//     modalBpm    — integer
//     overallKey  — { label, root, mode, confidence }
//     bpmCurve    — [{ t, bpm }]
//     keyCurve    — [{ t, label, root, mode, confidence }]
//
// ─── AUDIO STORAGE (not yet enabled) ────────────────────────────────────────
// When you're ready to store audio files, add a second store:
//
//   Store: "audio"
//     keyPath: "analysisId" (foreign key to analyses.id)
//     Fields:
//       analysisId  — matches analyses.id
//       arrayBuffer — raw audio bytes (ArrayBuffer)
//
// Steps to enable:
//   1. Bump DB_VERSION to 2
//   2. Add the store creation in the onupgradeneeded block below
//   3. Uncomment and use saveAudio() / getAudio() / deleteAudio()
//   4. In BPMAnalyser.js, pass the arrayBuffer to saveAudio(id, arrayBuffer)
//      after analyse() completes, and load it in restoreAnalysis()
//   5. Add a MAX_AUDIO_ENTRIES = 5 eviction policy in saveAudio()
// ─────────────────────────────────────────────────────────────────────────────

const DB_NAME = "tempo-map";
const DB_VERSION = 1;
const STORE = "analyses";
const MAX_ENTRIES = 50;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("analysedAt", "analysedAt", { unique: false });
      }
      // ── Audio store (disabled — see notes above) ──
      // if (!db.objectStoreNames.contains("audio")) {
      //   db.createObjectStore("audio", { keyPath: "analysisId" });
      // }
    };

    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function saveAnalysis(result, filename) {
  const db = await openDB();
  const record = {
    filename,
    analysedAt: new Date().toISOString(),
    duration: result.duration,
    sampleRate: result.sampleRate,
    channels: result.channels,
    overallKey: result.overallKey,
    bpmCurve: result.bpmCurve,
    keyCurve: result.keyCurve,
    modalBpm: modalBpmFromCurve(result.bpmCurve),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.add(record);
    req.onsuccess = () => {
      evictOld(db).catch(console.warn);
      resolve(req.result);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function loadHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve([...req.result].reverse());
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function loadAnalysis(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteAnalysis(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function clearHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  });
}

function modalBpmFromCurve(curve) {
  if (!curve?.length) return null;
  const bins = {};
  for (const { bpm } of curve) {
    const bin = Math.round(bpm);
    bins[bin] = (bins[bin] ?? 0) + 1;
  }
  return parseInt(
    Object.entries(bins).reduce((a, b) => (b[1] > a[1] ? b : a))[0],
  );
}

async function evictOld(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.getAllKeys();
    req.onsuccess = () => {
      const keys = req.result;
      if (keys.length > MAX_ENTRIES) {
        const toDelete = keys.slice(0, keys.length - MAX_ENTRIES);
        for (const key of toDelete) store.delete(key);
      }
      resolve();
    };
  });
}

// ─── AUDIO STORAGE (disabled) ────────────────────────────────────────────────
// Uncomment when ready — remember to bump DB_VERSION and add the store above.
//
// const MAX_AUDIO_ENTRIES = 5;
//
// export async function saveAudio(analysisId, arrayBuffer) {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx    = db.transaction(["audio", STORE], "readwrite");
//     const store = tx.objectStore("audio");
//     store.put({ analysisId, arrayBuffer });
//     const allKeys = tx.objectStore(STORE).getAllKeys();
//     allKeys.onsuccess = () => {
//       const keys = allKeys.result.slice(0, -MAX_AUDIO_ENTRIES);
//       for (const key of keys) store.delete(key);
//     };
//     tx.oncomplete = () => resolve();
//     tx.onerror    = (e) => reject(e.target.error);
//   });
// }
//
// export async function getAudio(analysisId) {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx      = db.transaction("audio", "readonly");
//     const req     = tx.objectStore("audio").get(analysisId);
//     req.onsuccess = () => resolve(req.result?.arrayBuffer ?? null);
//     req.onerror   = (e) => reject(e.target.error);
//   });
// }
//
// export async function deleteAudio(analysisId) {
//   const db = await openDB();
//   return new Promise((resolve, reject) => {
//     const tx    = db.transaction("audio", "readwrite");
//     const req   = tx.objectStore("audio").delete(analysisId);
//     req.onsuccess = () => resolve();
//     req.onerror   = (e) => reject(e.target.error);
//   });
// }
