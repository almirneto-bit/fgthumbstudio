import { createDefaultFields, type ThumbFields } from './thumbTemplate';

export type ThumbProject = {
  id: string;
  name: string;
  fields: ThumbFields;
  createdAt: number;
  updatedAt: number;
};

const DB_NAME = 'fg-thumb-studio';
const DB_VERSION = 1;
const STORE_NAME = 'projects';
export const ACTIVE_PROJECT_KEY = 'fg-thumb-studio-active-project';

function makeId() {
  const browserCrypto = globalThis.crypto;
  if (browserCrypto?.randomUUID) return `thumb-${browserCrypto.randomUUID()}`;

  if (browserCrypto?.getRandomValues) {
    const bytes = new Uint32Array(4);
    browserCrypto.getRandomValues(bytes);
    return `thumb-${Array.from(bytes, (value) => value.toString(16).padStart(8, '0')).join('')}`;
  }

  return `thumb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createProject(): ThumbProject {
  const now = Date.now();
  return {
    id: makeId(),
    name: `Thumb ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(now)}`,
    fields: createDefaultFields(),
    createdAt: now,
    updatedAt: now,
  };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('O histórico local não está disponível neste navegador.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Não foi possível abrir o histórico local.'));
    request.onblocked = () => reject(new Error('O histórico local está temporariamente bloqueado.'));
  });
}

export async function listProjects(): Promise<ThumbProject[]> {
  const db = await openDb();
  try {
    const projects = await new Promise<ThumbProject[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as ThumbProject[]);
      request.onerror = () => reject(request.error);
    });
    return projects.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);
  } finally {
    db.close();
  }
}

export async function getProject(id: string): Promise<ThumbProject | null> {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as ThumbProject | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

export async function saveProject(project: ThumbProject): Promise<ThumbProject[]> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const request = transaction.objectStore(STORE_NAME).put(project);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('O salvamento local foi interrompido.'));
    });

    const projects = await new Promise<ThumbProject[]>((resolve, reject) => {
      const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as ThumbProject[]);
      request.onerror = () => reject(request.error);
    });
    const ordered = projects.sort((a, b) => b.updatedAt - a.updatedAt);
    const stale = ordered.slice(5);
    if (stale.length) {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        stale.forEach((item) => store.delete(item.id));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error('A limpeza do histórico foi interrompida.'));
      });
    }
    return ordered.slice(0, 5);
  } finally {
    db.close();
  }
}
