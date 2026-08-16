import type { Draft } from "./types";

const DB_NAME = "storyverse-recovery";
const STORE = "drafts";
const KEY = "current";

function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest) {
  const db = await database();
  return new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = action(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveRecoveryDraft(draft: Draft) { await transact("readwrite", store => store.put(draft, KEY)); }
export async function loadRecoveryDraft() { return await transact("readonly", store => store.get(KEY)) as Draft | undefined; }
export async function clearRecoveryDraft() { await transact("readwrite", store => store.delete(KEY)); }
