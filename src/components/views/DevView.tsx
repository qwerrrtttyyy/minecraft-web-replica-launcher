import {
  Activity,
  Bug,
  Download,
  FileCode2,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Terminal,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  callApi,
  execCode,
  gameFrameRef,
  getStatus,
  runDiagnostics,
  type GameStatus,
} from '@/lib/bridge';
import type { ConsoleEntry, Instance } from '@/lib/types';
import { formatTime } from '@/lib/utils';

interface DevViewProps {
  activeInstance: Instance | null;
  gameRunning: boolean;
  logs: ConsoleEntry[];
  onLog: (level: ConsoleEntry['level'], message: string, detail?: unknown) => void;
  onUpdateInstance: (id: string, patch: Partial<Instance>) => void;
}

/** 常用 CraftAPI 快捷调用 */
const API_PRESETS: { label: string; path: string; hint: string }[] = [
  { label: '玩家位置', path: 'player.position', hint: '返回 {x,y,z}' },
  { label: '种子', path: 'world.seed', hint: '世界种子' },
  { label: '时间文本', path: 'time.text', hint: '当前时刻' },
  { label: '设为白天', path: 'time.set', hint: '参数 [0.25]' },
  { label: '设为夜晚', path: 'time.set', hint: '参数 [0.75]' },
  { label: '切换创造', path: 'survival.setMode', hint: '参数 ["creative"]' },
  { label: '切换生存', path: 'survival.setMode', hint: '参数 ["survival"]' },
  { label: '回满血', path: 'survival.heal', hint: '参数 [20]' },
  { label: '导出存档', path: 'save.export', hint: '返回存档 JSON' },
  { label: '导出设置', path: 'settings.exportOptions', hint: '返回设置 JSON' },
  { label: '插件列表', path: 'plugins.list', hint: '已注册插件' },
  { label: 'WASM 状态', path: 'wasm.status', hint: '实验性功能状态' },
];

export function DevView({ activeInstance, gameRunning, logs, onLog, onUpdateInstance }: DevViewProps) {
  const [status, setStatus] = useState<GameStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [apiPath, setApiPath] = useState('player.position');
  const [apiArgs, setApiArgs] = useState('');
  const [apiResult, setApiResult] = useState<string>('');
  const [jsCode, setJsCode] = useState('CraftAPI.player.position()');
  const [jsResult, setJsResult] = useState<string>('');
  const [diagReport, setDiagReport] = useState<unknown>(null);
  const [paramKey, setParamKey] = useState('');
  const [paramVal, setParamVal] = useState('');
  const [customParams, setCustomParams] = useState<Record<string, string>>(
    activeInstance?.flags.customParams ?? {},
  );
  const timerRef = useRef<number | null>(null);

  // 自定义参数同步到实例
  const syncParams = useCallback((next: Record<string, string>) => {
    setCustomParams(next);
    if (activeInstance) {
      onUpdateInstance(activeInstance.id, {
        flags: { ...activeInstance.flags, customParams: next },
      });
    }
    onLog('info', `自定义参数已更新（${Object.keys(next).length} 项）`);
  }, [activeInstance, onUpdateInstance, onLog]);

  // 轮询运行时状态
  useEffect(() => {
    if (!polling || !gameRunning) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      return;
    }
    const tick = async () => {
      const r = await getStatus(gameFrameRef.current);
      if (r.ok) setStatus(r.value as GameStatus);
    };
    void tick();
    timerRef.current = window.setInterval(() => void tick(), 1500);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [polling, gameRunning]);

  const handleApiCall = useCallback(async () => {
    if (!gameRunning) {
      setApiResult('游戏未运行');
      return;
    }
    let args: unknown[] = [];
    try {
      args = apiArgs.trim() ? JSON.parse(apiArgs) : [];
    } catch {
      setApiResult('参数必须是 JSON 数组，如 ["creative"]');
      return;
    }
    const r = await callApi(gameFrameRef.current, apiPath, args);
    setApiResult(r.ok ? JSON.stringify(r.value, null, 2) : `错误: ${r.error}`);
    onLog(r.ok ? 'success' : 'error', `CraftAPI.${apiPath} → ${r.ok ? 'OK' : r.error}`);
  }, [apiPath, apiArgs, gameRunning, onLog]);

  const handleExec = useCallback(async () => {
    if (!gameRunning) {
      setJsResult('游戏未运行');
      return;
    }
    const r = await execCode(gameFrameRef.current, jsCode);
    setJsResult(r.ok ? JSON.stringify(r.value, null, 2) : `错误: ${r.error}`);
    onLog(r.ok ? 'success' : 'error', `执行 JS → ${r.ok ? 'OK' : r.error}`);
  }, [jsCode, gameRunning, onLog]);

  const handleDiag = useCallback(async () => {
    if (!gameRunning) {
      setDiagReport({ error: '游戏未运行' });
      return;
    }
    setDiagReport({ loading: true });
    const r = await runDiagnostics(gameFrameRef.current);
    setDiagReport(r.ok ? r.value : { error: r.error });
    onLog(r.ok ? 'info' : 'error', '运行时诊断已完成');
  }, [gameRunning, onLog]);

  const handleExportConfig = () => {
    if (!activeInstance) return;
    const blob = new Blob([JSON.stringify(activeInstance, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mc-launcher-instance-${activeInstance.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
    onLog('info', `已导出实例配置：${activeInstance.name}`);
  };

  const handleImportConfig = (file: File) => {
    if (!activeInstance) return;
    void file.text().then((text) => {
      try {
        const data = JSON.parse(text) as Partial<Instance>;
        const { id: _id, createdAt: _c, ...patch } = data;
        onUpdateInstance(activeInstance.id, patch);
        onLog('success', '实例配置已导入');
      } catch (e) {
        onLog('error', `导入失败：${e instanceof Error ? e.message : e}`);
      }
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wrench className="size-6 text-primary" /> 开发者设置
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          运行时调试、CraftAPI 调用、诊断与实例配置管理。
          {gameRunning ? <span className="text-primary"> 游戏运行中。</span> : <span className="text-amber-500"> 游戏未运行，需先启动实例。</span>}
        </p>
      </div>

      {/* 运行时状态监控 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="size-4 text-primary" /> 运行时状态
              </CardTitle>
              <CardDescription>实时采集游戏内玩家、世界与性能数据</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant={polling ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setPolling((p) => !p)}
                disabled={!gameRunning}
              >
                {polling ? '停止监控' : '开始监控'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void (async () => {
                  const r = await getStatus(gameFrameRef.current);
                  if (r.ok) setStatus(r.value as GameStatus);
                })()}
                disabled={!gameRunning}
              >
                <RefreshCw className="size-4" /> 刷新
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!status ? (
            <p className="text-sm text-muted-foreground">点击"开始监控"或"刷新"获取状态。</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <StatusCell label="玩家坐标" value={status.player ? `${status.player.x.toFixed(1)}, ${status.player.y.toFixed(1)}, ${status.player.z.toFixed(1)}` : '—'} />
              <StatusCell label="群系" value={status.biome ?? '—'} />
              <StatusCell label="种子" value={status.seed != null ? String(status.seed) : '—'} />
              <StatusCell label="时刻" value={status.time ?? '—'} />
              <StatusCell label="生命" value={status.health != null ? `${status.health}/20` : '—'} />
              <StatusCell label="饥饿" value={status.hunger != null ? `${status.hunger}/20` : '—'} />
              <StatusCell label="模式" value={status.mode ?? '—'} />
              <StatusCell label="实体数" value={status.entities != null ? String(status.entities) : '—'} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* CraftAPI 调用面板 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Terminal className="size-4 text-primary" /> CraftAPI 调用
          </CardTitle>
          <CardDescription>直接调用游戏内公开 API，实时查看返回值</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {API_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setApiPath(p.path);
                  setApiResult('');
                }}
                title={p.hint}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <Separator />
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label>API 路径</Label>
              <Input value={apiPath} onChange={(e) => setApiPath(e.target.value)} placeholder="player.position" />
            </div>
            <div className="space-y-1.5">
              <Label>参数（JSON 数组）</Label>
              <Input value={apiArgs} onChange={(e) => setApiArgs(e.target.value)} placeholder='["creative"]' />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void handleApiCall()} disabled={!gameRunning}>
                <Play className="size-4" /> 调用
              </Button>
            </div>
          </div>
          {apiResult && (
            <pre className="max-h-40 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-emerald-300">
              {apiResult}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* JS 执行器 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode2 className="size-4 text-primary" /> JS 执行器
          </CardTitle>
          <CardDescription>在游戏上下文执行任意 JS，可访问 window.CraftAPI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={jsCode}
            onChange={(e) => setJsCode(e.target.value)}
            rows={4}
            spellCheck={false}
            className="w-full rounded-lg border border-input bg-background p-3 font-mono text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="CraftAPI.world.biomeAt(0, 0)"
          />
          <div className="flex gap-2">
            <Button onClick={() => void handleExec()} disabled={!gameRunning}>
              <Play className="size-4" /> 执行
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setJsCode('({ seed: CraftAPI.world.seed(), mode: CraftAPI.survival.mode(), pos: CraftAPI.player.position() })');
                setJsResult('');
              }}
            >
              填入示例
            </Button>
          </div>
          {jsResult && (
            <pre className="max-h-48 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-amber-200">
              {jsResult}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* 自定义 URL 参数 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4 text-primary" /> 自定义 URL 参数
          </CardTitle>
          <CardDescription>追加到游戏 URL 的额外参数，用于实验性调试开关</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {Object.entries(customParams).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1 rounded-md border bg-muted/30 px-2 py-1 text-xs">
                <code className="text-primary">{k}={v}</code>
                <button
                  className="ml-1 text-destructive hover:text-destructive/80"
                  onClick={() => {
                    const next = { ...customParams };
                    delete next[k];
                    syncParams(next);
                  }}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
            {Object.keys(customParams).length === 0 && (
              <p className="text-xs text-muted-foreground">暂无自定义参数</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="参数名，如 emerge"
              value={paramKey}
              onChange={(e) => setParamKey(e.target.value)}
              className="max-w-40"
            />
            <Input
              placeholder="值，如 0"
              value={paramVal}
              onChange={(e) => setParamVal(e.target.value)}
              className="max-w-32"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!paramKey.trim()}
              onClick={() => {
                syncParams({ ...customParams, [paramKey.trim()]: paramVal });
                setParamKey('');
                setParamVal('');
              }}
            >
              <Plus className="size-4" /> 添加
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 运行时诊断 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bug className="size-4 text-primary" /> 运行时诊断
              </CardTitle>
              <CardDescription>调用游戏的 diagnostics.run()，检查存档/插件/Worker/光照等状态</CardDescription>
            </div>
            <Button onClick={() => void handleDiag()} disabled={!gameRunning}>
              <Activity className="size-4" /> 运行诊断
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!diagReport ? (
            <p className="text-sm text-muted-foreground">尚未运行诊断。</p>
          ) : (
            <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-200">
              {JSON.stringify(diagReport, null, 2)}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* 实例配置管理 */}
      {activeInstance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-primary" /> 实例配置
            </CardTitle>
            <CardDescription>
              导入/导出当前实例的完整配置（含启动参数、插件集、设置快照）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportConfig}>
                <Download className="size-4" /> 导出配置 JSON
              </Button>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-sm shadow-sm transition-colors hover:bg-accent">
                <Download className="size-4 rotate-180" /> 导入配置
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImportConfig(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <Badge variant="secondary">{activeInstance.name}</Badge>
              <Badge variant="outline">{activeInstance.saveKey}</Badge>
              <Badge variant="outline">种子 {activeInstance.seed ?? '随机'}</Badge>
              <Badge variant="outline">{activeInstance.pluginIds.length} 插件</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 日志区 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ScrollText className="size-4 text-primary" /> 诊断日志
            </CardTitle>
            <Badge variant="secondary">{logs.length} 条</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-72 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-zinc-500">暂无日志。</p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex gap-2 py-0.5">
                  <span className="shrink-0 text-zinc-500">{formatTime(entry.time)}</span>
                  <span
                    className={
                      entry.level === 'error' ? 'text-red-400'
                        : entry.level === 'warn' ? 'text-amber-400'
                          : entry.level === 'success' ? 'text-emerald-400'
                            : 'text-zinc-300'
                    }
                  >
                    [{entry.level.toUpperCase()}] {entry.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-mono text-sm">{value}</p>
    </div>
  );
}
