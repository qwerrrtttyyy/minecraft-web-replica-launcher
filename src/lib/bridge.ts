/** 启动器 ↔ 游戏 iframe 的命令桥 */

let seq = 0;

/** 当前游戏 iframe 引用（GameFrame 挂载时写入，其他模块读取） */
export const gameFrameRef: { current: HTMLIFrameElement | null } = { current: null };

/** 命令回执 */
interface CommandResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

const pending = new Map<string, (r: CommandResult) => void>();

/** 游戏运行时状态快照 */
export interface GameStatus {
  ready: boolean;
  time?: string;
  dayTime?: number;
  seed?: number;
  mode?: string;
  health?: number;
  hunger?: number;
  breath?: number;
  player?: { x: number; y: number; z: number; yaw?: number; pitch?: number };
  biome?: string;
  entities?: number;
  wasm?: unknown;
  plugins?: unknown;
  blocks?: number;
}

/**
 * 安装消息监听（应在 GameFrame 挂载时调用一次）。
 * 返回清理函数。
 */
export function installBridge(): () => void {
  const onMessage = (e: MessageEvent) => {
    const d = e.data;
    if (!d || d.__launcher !== true) return;
    if (d.type === 'result') {
      const cb = pending.get(d.id);
      if (cb) {
        pending.delete(d.id);
        cb({ ok: !!d.ok, value: d.value, error: d.error });
      }
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/** 向游戏发送命令并等待回执 */
export function sendCommand(
  iframe: HTMLIFrameElement | null,
  action: string,
  payload: Record<string, unknown> = {},
  timeoutMs = 8000,
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const win = iframe?.contentWindow;
    if (!win) {
      resolve({ ok: false, error: '游戏未就绪' });
      return;
    }
    const id = `cmd-${++seq}`;
    const timer = window.setTimeout(() => {
      pending.delete(id);
      resolve({ ok: false, error: '命令超时' });
    }, timeoutMs);
    pending.set(id, (r) => {
      window.clearTimeout(timer);
      resolve(r);
    });
    win.postMessage({ __launcher: true, type: 'cmd', id, action, payload }, '*');
  });
}

/** 便捷方法：执行任意 JS（开发者控制台） */
export function execCode(iframe: HTMLIFrameElement | null, code: string): Promise<CommandResult> {
  return sendCommand(iframe, 'exec', { code });
}

/** 便捷方法：调用 CraftAPI 路径 */
export function callApi(
  iframe: HTMLIFrameElement | null,
  path: string,
  args: unknown[] = [],
): Promise<CommandResult> {
  return sendCommand(iframe, 'call', { path, args });
}

/** 便捷方法：采集运行时状态 */
export function getStatus(iframe: HTMLIFrameElement | null): Promise<CommandResult> {
  return sendCommand(iframe, 'status', {});
}

/** 便捷方法：运行诊断 */
export function runDiagnostics(iframe: HTMLIFrameElement | null): Promise<CommandResult> {
  return sendCommand(iframe, 'diag', {}, 15000);
}

/** 便捷方法：安装插件源码 */
export function installPluginSource(
  iframe: HTMLIFrameElement | null,
  source: string,
): Promise<CommandResult> {
  return sendCommand(iframe, 'plugin-install', { source });
}

/** 便捷方法：启用插件 */
export function enablePlugin(iframe: HTMLIFrameElement | null, id: string): Promise<CommandResult> {
  return sendCommand(iframe, 'plugin-enable', { id });
}

/** 便捷方法：停用插件 */
export function disablePlugin(iframe: HTMLIFrameElement | null, id: string): Promise<CommandResult> {
  return sendCommand(iframe, 'plugin-disable', { id });
}

/** 便捷方法：列出游戏内插件 */
export function listGamePlugins(iframe: HTMLIFrameElement | null): Promise<CommandResult> {
  return sendCommand(iframe, 'plugin-list', {});
}

/** 便捷方法：注册 WASM 模块 */
export function registerWasmModule(
  iframe: HTMLIFrameElement | null,
  id: string,
  data: string,
): Promise<CommandResult> {
  return sendCommand(iframe, 'wasm-register', { id, data });
}

/** 便捷方法：导出游戏设置 JSON */
export async function exportGameOptions(iframe: HTMLIFrameElement | null): Promise<string | null> {
  const r = await callApi(iframe, 'settings.exportOptions');
  return r.ok && typeof r.value === 'string' ? r.value : null;
}

/** 便捷方法：导入游戏设置 JSON */
export async function importGameOptions(
  iframe: HTMLIFrameElement | null,
  json: string,
): Promise<number | null> {
  const r = await callApi(iframe, 'settings.importOptions', [json]);
  return r.ok && typeof r.value === 'number' ? r.value : null;
}
