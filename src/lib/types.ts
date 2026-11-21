/** 启动器核心数据模型 */

export type ThemeMode = 'light' | 'dark' | 'system';

/** 本地账户（无真实认证，程序化头像） */
export interface LocalAccount {
  nickname: string;
  /** 头像背景色（HSL 色相 0-360），由昵称派生或用户指定 */
  avatarHue: number;
}

/** 网格化线程配置 */
export type MesherThreads = 'auto' | 'main' | 1 | 2 | 4;

/** 画质档位 */
export type QualityMode = 'auto' | 'high' | 'balanced' | 'power-saver';

/** 启动参数：映射游戏的 URL 调试参数 */
export interface LaunchFlags {
  /** ?wasm=0 关闭 WASM 后端；true 表示允许（不加参数或 wasm=1） */
  wasm: boolean;
  /** ?greedy=0 关闭贪心网格合并 */
  greedy: boolean;
  /** ?workers=N 覆盖 Worker 数量（1-8），null 表示自动 */
  workers: number | null;
  /** ?mesher=main 强制主线程网格化 */
  mesherMain: boolean;
  /** ?aa=off|msaa|ssaa 抗锯齿档位 */
  aa: 'off' | 'msaa' | 'ssaa';
  /** ?emerge=0 关闭自发光通道合并 */
  mergeEmissive: boolean;
  /** 用户自定义的额外 URL 参数（覆盖/补充上面的预设） */
  customParams: Record<string, string>;
}

/** 游戏来源 */
export type GameSourceMode = 'online' | 'local';

export interface GameSource {
  mode: GameSourceMode;
  /** 在线模式下的游戏 HTML URL */
  onlineUrl: string;
  /** 本地模式下缓存的 HTML 文件名（内容存 IndexedDB） */
  localFileName?: string;
}

/** 插件载体 */
export type PluginCarrier = 'js' | 'wasm:module' | 'wasm:host';

/** 插件记录：原件存 IndexedDB，此处存元数据 */
export interface PluginRecord {
  id: string;
  name: string;
  version: string;
  description: string;
  carrier: PluginCarrier;
  /** 是否按实例启用（全局库里仅标记，实际启用由实例的 pluginIds 决定） */
  enabled: boolean;
  /** 用户导入的文件名 */
  fileName: string;
  /** 导入时间 */
  importedAt: number;
  /** 解析出的 manifest JSON（用于预览权限/依赖） */
  manifest: Record<string, unknown>;
}

/** 游戏实例：一个独立的游戏配置 */
export interface Instance {
  id: string;
  name: string;
  /** 版本 id，指向版本源中的某一项 */
  versionId: string;
  /** 存档隔离 key（注入 bootstrap 用作存储前缀） */
  saveKey: string;
  /** 世界种子；null 表示随机 */
  seed: number | null;
  /** 初始游戏模式 */
  mode: 'survival' | 'creative';
  flags: LaunchFlags;
  /** 游戏设置快照 JSON（settings.exportOptions 的输出），null 表示用默认 */
  settingsSnapshot: string | null;
  /** 该实例启用的插件 id 列表 */
  pluginIds: string[];
  createdAt: number;
  lastPlayed: number;
}

/** 启动器全局配置 */
export interface LauncherConfig {
  account: LocalAccount;
  theme: ThemeMode;
  gameSource: GameSource;
  /** 当前激活的实例 id */
  activeInstanceId: string | null;
  /** 默认实例 id（PLAY 快捷启动） */
  defaultInstanceId: string | null;
  /** 显示诊断日志面板 */
  showConsole: boolean;
}

/** 版本源条目 */
export interface GameVersion {
  id: string;
  label: string;
  channel: 'release' | 'snapshot';
  description: string;
  /** 该版本对应的在线 URL（可覆盖全局 gameSource.onlineUrl） */
  url?: string;
  /** 版本特性标签 */
  tags: string[];
  releasedAt: string;
}

/** 诊断日志条目 */
export interface ConsoleEntry {
  id: string;
  time: number;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  /** 可选的诊断报告详情 */
  detail?: unknown;
}

/** 启动器完整状态（持久化根对象） */
export interface LauncherState {
  config: LauncherConfig;
  instances: Instance[];
  plugins: PluginRecord[];
}
