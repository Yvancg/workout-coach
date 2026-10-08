const DB_NAME = "workout-coach";
const DB_VERSION = 1;
const STORE_NAME = "sync-outbox";

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
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

export function createOperationId(prefix = "sync") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function enqueueSyncOperation(operation) {
  const db = await openDb();
  if (!db) return null;
  const record = {
    ...operation,
    id: operation.id || createOperationId(operation.type || "sync"),
    createdAt: operation.createdAt || Date.now(),
    attempts: operation.attempts || 0,
  };
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(record);
  await transactionDone(tx);
  db.close();
  return record.id;
}

export async function removeSyncOperation(id) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  await transactionDone(tx);
  db.close();
}

export async function listSyncOperations() {
  const db = await openDb();
  if (!db) return [];
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const records = await requestResult(store.getAll());
  await transactionDone(tx);
  db.close();
  return records.sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateSyncOperation(record) {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).put(record);
  await transactionDone(tx);
  db.close();
}

export async function clearSyncOutbox() {
  const db = await openDb();
  if (!db) return;
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await transactionDone(tx);
  db.close();
}

function belongsToOwner(operation, owner = {}) {
  if (owner.ownerId) return operation.ownerId === owner.ownerId;
  if (owner.ownerEmail) return !operation.ownerId && operation.ownerEmail === owner.ownerEmail;
  return false;
}

export async function flushSyncOutbox(sendOperation, owner = {}) {
  const allOperations = await listSyncOperations();
  const operations = allOperations.filter((operation) => belongsToOwner(operation, owner));
  let synced = 0;
  let pending = operations.length;

  for (const operation of operations) {
    try {
      await sendOperation(operation);
      await removeSyncOperation(operation.id);
      synced += 1;
      pending -= 1;
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) throw error;
      await updateSyncOperation({
        ...operation,
        attempts: (operation.attempts || 0) + 1,
        lastAttemptAt: Date.now(),
        lastError: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  return { synced, pending };
}
