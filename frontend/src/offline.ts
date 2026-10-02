// Offline support: local cache of GET responses + a persistent queue of
// write actions (sales, collections, returns, customers) synced in order.
import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

import { api } from "@/src/api";
import { queryClient } from "@/src/query-client";
import { storage } from "@/src/utils/storage";

export type QItem = { id: string; path: string; body: any; label: string; error?: string; created_at: string };

const Q_KEY = "offline_queue";
const F_KEY = "offline_failed";
const IDX_KEY = "offline_cache_index";

let queue: QItem[] = [];
let failed: QItem[] = [];
let loaded: Promise<void> | null = null;
let syncing = false;
let online = true;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

const parse = (raw: unknown, fb: any) => {
  try {
    return raw ? JSON.parse(String(raw)) : fb;
  } catch {
    return fb;
  }
};

function load() {
  if (!loaded) {
    loaded = (async () => {
      queue = parse(await storage.getItem(Q_KEY, null), []);
      failed = parse(await storage.getItem(F_KEY, null), []);
      notify();
    })();
  }
  return loaded;
}

async function save() {
  await storage.setItem(Q_KEY, JSON.stringify(queue));
  await storage.setItem(F_KEY, JSON.stringify(failed));
  notify();
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
export const pendingCount = () => queue.length;

// ---------------- Cache ----------------
export async function readCache<T = any>(path: string): Promise<T | null> {
  return parse(await storage.getItem(`cache:${path}`, null), null);
}

export async function writeCache(path: string, data: unknown) {
  await storage.setItem(`cache:${path}`, JSON.stringify(data));
  const idx: string[] = parse(await storage.getItem(IDX_KEY, null), []);
  if (!idx.includes(path)) await storage.setItem(IDX_KEY, JSON.stringify([...idx, path]));
}

export async function updateCached<T = any>(path: string, fn: (cur: T) => T) {
  const cur = (queryClient.getQueryData<T>([path]) ?? (await readCache<T>(path))) as T | null;
  if (cur == null) return;
  const next = fn(cur);
  queryClient.setQueryData([path], next);
  await writeCache(path, next);
}

export async function clearOffline() {
  const idx: string[] = parse(await storage.getItem(IDX_KEY, null), []);
  for (const p of idx) await storage.removeItem(`cache:${p}`);
  await storage.removeItem(IDX_KEY);
  queue = [];
  failed = [];
  await save();
}

// ---------------- Queue ----------------
export async function enqueue(item: Omit<QItem, "created_at">) {
  await load();
  queue.push({ ...item, created_at: new Date().toISOString() });
  await save();
  syncQueue();
}

export async function syncQueue() {
  await load();
  if (syncing || !queue.length) return;
  syncing = true;
  notify();
  let synced = 0;
  try {
    while (queue.length) {
      const it = queue[0];
      try {
        await api(it.path, { method: "POST", body: it.body });
        synced++;
        online = true;
      } catch (e: any) {
        if (e.offline) {
          online = false;
          break;
        }
        failed.push({ ...it, error: e.message });
      }
      queue.shift();
      await save();
    }
  } finally {
    syncing = false;
    notify();
  }
  if (synced && !queue.length) queryClient.invalidateQueries();
}

export async function discardFailed(id: string) {
  failed = failed.filter((f) => f.id !== id);
  await save();
}

export function startSyncLoop() {
  load();
  const unsub = NetInfo.addEventListener((s) => {
    const next = !!s.isConnected && s.isInternetReachable !== false;
    if (next !== online) {
      online = next;
      notify();
    }
    if (next) syncQueue();
  });
  const t = setInterval(syncQueue, 30000);
  return () => {
    unsub();
    clearInterval(t);
  };
}

export function useSyncState() {
  const [, force] = useState(0);
  useEffect(() => {
    load();
    const f = () => force((n) => n + 1);
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  }, []);
  return { pending: queue, failed, online, syncing };
}
