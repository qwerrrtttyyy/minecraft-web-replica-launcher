import type { LauncherState } from './types';
import { createDefaultState } from './defaults';

const STATE_KEY = 'mc-web-launcher-state-v1';

/** 读取启动器状态；无档或损坏时返回默认状态 */
export function loadState(): LauncherState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as LauncherState;
    // 基本结构校验：缺字段视为损坏
    if (!parsed.config || !Array.isArray(parsed.instances) || !Array.isArray(parsed.plugins)) {
      return createDefaultState();
    }
    // 与默认配置做浅合并，容忍旧版本缺字段
    const defaults = createDefaultState();
    return {
      config: {
        ...defaults.config,
        ...parsed.config,
        account: { ...defaults.config.account, ...parsed.config.account },
        gameSource: { ...defaults.config.gameSource, ...parsed.config.gameSource },
      },
      instances: parsed.instances,
      plugins: parsed.plugins,
    };
  } catch {
    return createDefaultState();
  }
}

/** 保存启动器状态 */
export function saveState(state: LauncherState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('[launcher] 保存状态失败', e);
  }
}

// ---- 插件 / 本地游戏 HTML 的 IndexedDB 存储 ----

const PLUGIN_DB = 'mc-web-launcher-assets';
const PLUGIN_STORE = 'blobs';

function openAssetDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PLUGIN_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PLUGIN_STORE)) db.createObjectStore(PLUGIN_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('资产库打开失败'));
  });
}

/** 存一个原始资产（插件源码 / 游戏 HTML 文本） */
export async function putAsset(key: string, value: string): Promise<void> {
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLUGIN_STORE, 'readwrite');
      tx.objectStore(PLUGIN_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** 读取资产；不存在返回 null */
export async function getAsset(key: string): Promise<string | null> {
  const db = await openAssetDb();
  try {
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(PLUGIN_STORE, 'readonly');
      const req = tx.objectStore(PLUGIN_STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** 删除资产 */
export async function deleteAsset(key: string): Promise<void> {
  const db = await openAssetDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PLUGIN_STORE, 'readwrite');
      tx.objectStore(PLUGIN_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const assetKey = {
  plugin: (id: string) => `plugin:${id}`,
  localGame: () => 'local-game-html',
  /** 在线游戏 HTML 缓存（避免每次启动重复下载 366KB） */
  onlineGame: (url: string) => `online-game-cache:${url}`,
};

/** 读取在线游戏 HTML 缓存；附带时间戳便于判断是否过期 */
export async function getOnlineCache(url: string): Promise<{ html: string; cachedAt: number } | null> {
  const raw = await getAsset(assetKey.onlineGame(url));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { html: string; cachedAt: number };
  } catch {
    return null;
  }
}

export async function setOnlineCache(url: string, html: string): Promise<void> {
  await putAsset(assetKey.onlineGame(url), JSON.stringify({ html, cachedAt: Date.now() }));
}
