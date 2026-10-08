const DB_NAME = "workout-coach-state";
const DB_VERSION = 1;
const STORE_NAME = "state";

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function readStateBackup(key) {
  const db = await openDb();
  if (!db) return null;

  try {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(key);
    const result = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    await transactionDone(transaction);
    return result;
  } finally {
    db.close();
  }
}

export async function writeStateBackup(key, value, savedAt = Date.now()) {
  const db = await openDb();
  if (!db) return false;

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const current = request.result;
        if (!current || Number(current.savedAt || 0) <= savedAt) {
          store.put({ key, value, savedAt });
        }
        resolve();
      };
      request.onerror = () => reject(request.error);
    });

    await transactionDone(transaction);
    return true;
  } finally {
    db.close();
  }
}

export async function clearStateBackup(key) {
  const db = await openDb();
  if (!db) return;

  try {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(key);
    await transactionDone(transaction);
  } finally {
    db.close();
  }
}
