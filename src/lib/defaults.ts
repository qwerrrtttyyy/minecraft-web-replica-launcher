import type {
  GameVersion,
  Instance,
  LaunchFlags,
  LauncherConfig,
  LauncherState,
} from './types';
import { hueFromString, uid } from './utils';

export const DEFAULT_FLAGS: LaunchFlags = {
  wasm: false,
  greedy: true,
  workers: null,
  mesherMain: false,
  aa: 'off',
  mergeEmissive: true,
  customParams: {},
};

export const DEFAULT_ONLINE_URL = 'https://qwerrrtttyyy.github.io/minecraft-web-replica/';

export const DEFAULT_CONFIG: LauncherConfig = {
  account: { nickname: '玩家', avatarHue: hueFromString('玩家') },
  theme: 'system',
  gameSource: {
    mode: 'online',
    onlineUrl: DEFAULT_ONLINE_URL,
  },
  activeInstanceId: null,
  defaultInstanceId: null,
  showConsole: true,
};

/** 内置版本源（后续可由 GitHub Releases 覆盖） */
export const BUILTIN_VERSIONS: GameVersion[] = [
  {
    id: 'v1',
    label: 'v1 · 正式版',
    channel: 'release',
    description: '稳定正式版，含生存模式、合成系统、插件架构与完整光照。',
    tags: ['稳定', '生存模式', '合成'],
    releasedAt: '2025-01-01',
  },
  {
    id: '1.6.0',
    label: '1.6.0 · 快照',
    channel: 'snapshot',
    description: '新增高级与开发者设置、画质档位、网格化线程调节、设置导入导出。',
    tags: ['快照', '开发者设置', 'WASM'],
    releasedAt: '2025-02-01',
  },
  {
    id: '1.5.0',
    label: '1.5.0 · 快照',
    channel: 'snapshot',
    description: '实验性 WASM 内核、插件三载体、独立设置页。',
    tags: ['快照', 'WASM', '插件'],
    releasedAt: '2025-01-15',
  },
];

/** 创建一个新实例 */
export function createInstance(partial: Partial<Instance> = {}): Instance {
  const name = partial.name ?? '新世界';
  return {
    id: uid(),
    name,
    versionId: partial.versionId ?? 'v1',
    saveKey: partial.saveKey ?? `world-${uid().slice(0, 8)}`,
    seed: partial.seed ?? null,
    mode: partial.mode ?? 'survival',
    flags: { ...DEFAULT_FLAGS, ...partial.flags },
    settingsSnapshot: partial.settingsSnapshot ?? null,
    pluginIds: partial.pluginIds ?? [],
    createdAt: partial.createdAt ?? Date.now(),
    lastPlayed: partial.lastPlayed ?? 0,
  };
}

/** 创建默认"新世界"实例 */
export function createDefaultInstance(): Instance {
  const inst = createInstance({ name: '我的世界' });
  return inst;
}

/** 创建完整默认状态 */
export function createDefaultState(): LauncherState {
  const inst = createDefaultInstance();
  return {
    config: {
      ...DEFAULT_CONFIG,
      account: { ...DEFAULT_CONFIG.account },
      gameSource: { ...DEFAULT_CONFIG.gameSource },
      activeInstanceId: inst.id,
      defaultInstanceId: inst.id,
    },
    instances: [inst],
    plugins: [],
  };
}
