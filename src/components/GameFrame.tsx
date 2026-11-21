import { useCallback, useEffect, useRef, useState } from 'react';
import { gameFrameRef, installBridge } from '@/lib/bridge';
import { buildSrcdoc, fallbackUrl, fetchOnlineHtml } from '@/lib/launch';
import { assetKey, getAsset, getOnlineCache, setOnlineCache } from '@/lib/storage';
import type { GameSource, Instance } from '@/lib/types';

interface GameFrameProps {
  instance: Instance;
  source: GameSource;
  /** 该实例启用的插件 id → 源码 映射 */
  pluginSources: Record<string, string>;
  onLog: (level: 'info' | 'warn' | 'error' | 'success', message: string, detail?: unknown) => void;
  onExit: () => void;
}

interface LaunchResult {
  src?: string;
  srcdoc?: string;
}

/**
 * 游戏 iframe 容器。
 * 负责：按来源加载游戏 HTML → 注入 bootstrap → 挂 postMessage 监听 → 提供退出控制。
 */
export function GameFrame({ instance, source, pluginSources, onLog, onExit }: GameFrameProps) {
  const [result, setResult] = useState<LaunchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const prepare = useCallback(async () => {
    setError(null);
    setResult(null);
    try {
      let html: string | null = null;
      if (source.mode === 'local') {
        html = await getAsset(assetKey.localGame());
        if (!html) {
          setError('本地游戏 HTML 未找到，请在设置中重新导入');
          return;
        }
      } else {
        // 在线模式：优先用缓存秒开，后台静默刷新
        const cached = await getOnlineCache(source.onlineUrl).catch(() => null);
        const fresh = cached && Date.now() - cached.cachedAt < 24 * 60 * 60 * 1000;
        if (fresh) {
          html = cached.html;
          onLogRef.current('info', '使用已缓存的游戏（后台检查更新）');
          // 后台刷新，不阻塞启动
          void fetchOnlineHtml(source.onlineUrl)
            .then((text) => setOnlineCache(source.onlineUrl, text))
            .catch(() => {});
        } else {
          try {
            html = await fetchOnlineHtml(source.onlineUrl);
            await setOnlineCache(source.onlineUrl, html).catch(() => {});
          } catch (e) {
            if (cached) {
              // 网络失败但有旧缓存：仍用缓存启动
              html = cached.html;
              onLogRef.current('warn', '网络不可用，使用离线缓存启动');
            } else {
              // 无缓存：降级为直接外链（无存档隔离）
              onLogRef.current('warn', `在线注入失败，降级为直接启动：${e instanceof Error ? e.message : e}`);
              setResult({ src: fallbackUrl(source, instance) });
              return;
            }
          }
        }
      }

      // 把插件源码挂到 iframe 全局，供 bootstrap 注入时读取
      // 通过 srcdoc 内联一个预设脚本
      const withPlugins = injectPluginSources(html, pluginSources);
      setResult({ srcdoc: buildSrcdoc(withPlugins, instance) });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [source, instance, pluginSources]);

  useEffect(() => {
    void prepare();
  }, [prepare]);

  // 安装命令桥（双向通信）
  useEffect(() => {
    return installBridge();
  }, []);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-destructive">启动失败：{error}</p>
        <button onClick={onExit} className="text-sm text-primary underline underline-offset-4">返回启动器</button>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-black">
      <iframe
        ref={(el) => {
          iframeRef.current = el;
          gameFrameRef.current = el;
        }}
        title="Minecraft Web"
        src={result?.src}
        srcDoc={result?.srcdoc}
        className="h-full w-full border-0"
        allow="fullscreen; gamepad; autoplay"
        sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads"
      />
      {!result && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white/80">
          正在准备游戏…
        </div>
      )}
    </div>
  );
}

/**
 * 把插件源码以 window.__launcherPluginSource 形式注入到 HTML 头部，
 * bootstrap 的插件加载逻辑会读取它。
 */
function injectPluginSources(html: string, sources: Record<string, string>): string {
  const entries = Object.entries(sources);
  if (entries.length === 0) return html;
  const script = `<script>window.__launcherPluginSource=${JSON.stringify(sources)};<\/script>`;
  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch) {
    const idx = headMatch.index! + headMatch[0].length;
    return html.slice(0, idx) + '\n' + script + '\n' + html.slice(idx);
  }
  return script + '\n' + html;
}
