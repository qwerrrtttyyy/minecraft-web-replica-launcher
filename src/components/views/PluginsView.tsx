import { Blocks, Download, FileCode2, Package, Puzzle, ShieldAlert, Trash2, Upload, Zap } from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  disablePlugin,
  enablePlugin,
  gameFrameRef,
  installPluginSource,
} from '@/lib/bridge';
import { SAMPLE_PLUGINS } from '@/lib/sample-plugins';
import { assetKey, getAsset, putAsset } from '@/lib/storage';
import type { Instance, PluginCarrier, PluginRecord } from '@/lib/types';
import { formatRelative } from '@/lib/utils';
import type { LauncherApi } from '@/hooks/useLauncher';

interface PluginsViewProps {
  api: LauncherApi;
  activeInstance: Instance | null;
  gameRunning: boolean;
  onRegisterSource: (id: string, source: string) => void;
}

/** 从 JS 源码里粗解析 manifest（用于预览），不执行代码 */
function sniffManifest(source: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  try {
    const id = source.match(/id\s*:\s*['"]([^'"]+)['"]/);
    const version = source.match(/version\s*:\s*['"]([^'"]+)['"]/);
    const desc = source.match(/description\s*:\s*['"]([^'"]+)['"]/);
    const perms = source.match(/permissions\s*:\s*\[([^\]]*)\]/);
    if (id) result.id = id[1];
    if (version) result.version = version[1];
    if (desc) result.description = desc[1];
    if (perms) {
      result.permissions = [...perms[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
    }
  } catch {
    // 解析失败就不显示预览
  }
  return result;
}

function detectCarrier(fileName: string, source: string): PluginCarrier {
  if (/\.wasm$/.test(fileName) || /carrier\s*:\s*['"]wasm/.test(source)) return 'wasm:module';
  return 'js';
}

export function PluginsView({ api, activeInstance, gameRunning, onRegisterSource }: PluginsViewProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // 安装一个示例插件
  const installSample = async (sample: (typeof SAMPLE_PLUGINS)[number]) => {
    if (api.state.plugins.some((p) => p.id === sample.id)) {
      setError(`插件「${sample.name}」已存在`);
      return;
    }
    const manifest = sniffManifest(sample.source);
    const record: PluginRecord = {
      id: sample.id,
      name: sample.name,
      version: sample.version,
      description: sample.description,
      carrier: 'js',
      enabled: false,
      fileName: `${sample.id}.js`,
      importedAt: Date.now(),
      manifest,
    };
    try {
      await putAsset(assetKey.plugin(sample.id), sample.source);
      onRegisterSource(sample.id, sample.source);
      api.addPlugin(record);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // 运行中热插拔：游戏运行时同步到游戏内
  const hotToggle = async (pluginId: string) => {
    if (!activeInstance) return;
    const willEnable = !activeInstance.pluginIds.includes(pluginId);
    api.togglePluginForInstance(activeInstance.id, pluginId);
    if (gameRunning) {
      const source = await getAsset(assetKey.plugin(pluginId));
      if (willEnable) {
        if (source) await installPluginSource(gameFrameRef.current, source);
        await enablePlugin(gameFrameRef.current, pluginId);
      } else {
        await disablePlugin(gameFrameRef.current, pluginId);
      }
    }
  };

  // 导出插件为 .js 文件
  const exportPlugin = async (plugin: PluginRecord) => {
    const source = await getAsset(assetKey.plugin(plugin.id));
    if (!source) return;
    const blob = new Blob([source], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plugin.id}.js`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setError(null);
    const source = await file.text();
    const manifest = sniffManifest(source);
    const id = typeof manifest.id === 'string' ? manifest.id : `local:${file.name.replace(/\.js$/, '')}`;
    const carrier = detectCarrier(file.name, source);

    const record: PluginRecord = {
      id,
      name: typeof manifest.id === 'string' ? manifest.id : file.name,
      version: typeof manifest.version === 'string' ? manifest.version : '—',
      description: typeof manifest.description === 'string' ? manifest.description : '本地导入的插件',
      carrier,
      enabled: false,
      fileName: file.name,
      importedAt: Date.now(),
      manifest,
    };

    try {
      await putAsset(assetKey.plugin(id), source);
      onRegisterSource(id, source);
      api.addPlugin(record);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const perms = (p: PluginRecord) => (p.manifest.permissions as string[] | undefined) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">插件</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            导入本地 JS 插件，在当前实例中启停。{activeInstance ? `当前实例：${activeInstance.name}` : ''}
          </p>
        </div>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="size-4" /> 导入插件
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".js,.wasm,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = '';
          }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          <ShieldAlert className="size-4" /> {error}
        </div>
      )}

      <Tabs defaultValue="installed">
        <TabsList>
          <TabsTrigger value="installed"><Puzzle className="mr-1 size-4" />已导入</TabsTrigger>
          <TabsTrigger value="samples"><Package className="mr-1 size-4" />示例库</TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              导入本地 JS 插件，在当前实例中启停。{gameRunning && <span className="text-primary">游戏运行中，切换会热插拔生效。</span>}
            </p>
            <Button size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> 导入插件
            </Button>
          </div>
          {api.state.plugins.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
                <Puzzle className="size-10 text-muted-foreground/50" />
                <div>
                  <p className="font-medium">还没有插件</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    导入 .js 插件文件，或从「示例库」一键安装内置插件。
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>
                    <Upload className="size-4" /> 选择文件
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {api.state.plugins.map((p) => {
                const enabledInInstance = activeInstance?.pluginIds.includes(p.id) ?? false;
                return (
                  <Card key={p.id} className="flex flex-col">
                    <CardContent className="flex flex-1 flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <FileCode2 className="size-5" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">{p.name}</h3>
                            <p className="text-xs text-muted-foreground">v{p.version}</p>
                          </div>
                        </div>
                        <Badge variant="secondary">{p.carrier}</Badge>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>

                      {perms(p).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {perms(p).map((perm) => (
                            <Badge key={perm} variant="warning" className="gap-1">
                              <ShieldAlert className="size-3" /> {perm}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <p className="mt-3 text-xs text-muted-foreground">
                        {p.fileName} · 导入于 {formatRelative(p.importedAt)}
                      </p>

                      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={enabledInInstance}
                            onCheckedChange={() => void hotToggle(p.id)}
                            disabled={!activeInstance}
                          />
                          <Label className="text-xs text-muted-foreground">
                            {enabledInInstance ? (gameRunning ? '运行中启用' : '已启用') : '未启用'}
                          </Label>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="导出插件文件"
                            onClick={() => void exportPlugin(p)}
                          >
                            <Download className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            title="移除插件"
                            onClick={() => {
                              if (confirm(`移除插件「${p.name}」？`)) api.deletePlugin(p.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="samples" className="space-y-4">
          <p className="text-sm text-muted-foreground">
            内置示例插件，点击即可安装到插件库，再在「已导入」中启用。源码可导出二次开发。
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {SAMPLE_PLUGINS.map((s) => {
              const installed = api.state.plugins.some((p) => p.id === s.id);
              return (
                <Card key={s.id} className="flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{s.name}</CardTitle>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.id} · v{s.version}</p>
                      </div>
                      <Badge variant={s.category === '示例' ? 'outline' : 'secondary'}>{s.category}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col pt-0">
                    <CardDescription className="flex-1">{s.description}</CardDescription>
                    <div className="mt-4">
                      <Button
                        className="w-full"
                        variant={installed ? 'outline' : 'default'}
                        disabled={installed}
                        onClick={() => void installSample(s)}
                      >
                        {installed ? '已安装' : <><Zap className="size-4" /> 一键安装</>}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Blocks className="size-5 shrink-0 text-primary" />
          <span>插件仅在启动游戏时注入，运行中可通过游戏内 API 热插拔。WASM 载体需在设置中开启实验性内容。</span>
        </CardContent>
      </Card>
    </div>
  );
}
