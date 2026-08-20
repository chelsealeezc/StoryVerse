import type { StoryDraft } from "../types/domain";

const DB_NAME = "storyverse-recovery-v2";
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

export async function saveRecoveryDraft(draft: StoryDraft) {
  await transact("readwrite", (store) => store.put(draft, KEY));
}
export async function loadRecoveryDraft() {
  return (await transact("readonly", (store) => store.get(KEY))) as StoryDraft | undefined;
}
export async function clearRecoveryDraft() {
  await transact("readwrite", (store) => store.delete(KEY));
}
