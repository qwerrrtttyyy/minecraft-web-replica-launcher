import { ArrowLeft, Maximize2, Minimize2, Play, Square } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/GameFrame';
import { Sidebar, type ViewKey } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { DevView } from '@/components/views/DevView';
import { InstancesView } from '@/components/views/InstancesView';
import { LibraryView } from '@/components/views/LibraryView';
import { PluginsView } from '@/components/views/PluginsView';
import { SettingsView } from '@/components/views/SettingsView';
import { Button } from '@/components/ui/button';
import { useLauncher } from '@/hooks/useLauncher';
import { getAsset } from '@/lib/storage';
import type { GameVersion, Instance } from '@/lib/types';
import { assetKey } from '@/lib/storage';

export default function App() {
  const api = useLauncher();
  const [view, setView] = useState<ViewKey>('library');
  const [presetVersionId, setPresetVersionId] = useState<string | undefined>();
  const [runningInstance, setRunningInstance] = useState<Instance | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [runPanel, setRunPanel] = useState<'game' | 'dev'>('game');
  const [pluginSources, setPluginSources] = useState<Record<string, string>>({});

  const { activeInstance } = api;

  // 预加载当前实例启用插件的源码
  useEffect(() => {
    if (!activeInstance || activeInstance.pluginIds.length === 0) {
      setPluginSources({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const sources: Record<string, string> = {};
      for (const id of activeInstance.pluginIds) {
        const src = await getAsset(assetKey.plugin(id));
        if (src) sources[id] = src;
      }
      if (!cancelled) setPluginSources(sources);
    })();
    return () => { cancelled = true; };
  }, [activeInstance?.pluginIds]);

  const handlePlay = (inst: Instance) => {
    api.setActiveInstance(inst.id);
    api.touchPlayed(inst.id);
    api.log('info', `启动实例「${inst.name}」…`);
    setRunPanel('game');
    setRunningInstance(inst);
  };

  const handleUseVersion = (v: GameVersion) => {
    setPresetVersionId(v.id);
    setView('instances');
  };

  // 游戏运行中：全屏视图，可在「游戏 / 开发者」间切换（iframe 常驻保持游戏运行）
  if (runningInstance) {
    return (
      <div className="flex h-full w-full flex-col bg-black">
        <div className="flex h-12 shrink-0 items-center justify-between gap-2 bg-zinc-900 px-3 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/10 hover:text-white"
              onClick={() => setRunningInstance(null)}
            >
              <ArrowLeft className="size-4" /> 退出
            </Button>
            <div className="flex rounded-lg bg-white/10 p-0.5">
              {(['game', 'dev'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setRunPanel(k)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    runPanel === k ? 'bg-white/20 text-white' : 'text-white/60 hover:text-white'
                  }`}
                >
                  {k === 'game' ? '游戏' : '开发者'}
                </button>
              ))}
            </div>
            <span className="hidden truncate text-white/60 sm:inline">{runningInstance.name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10 hover:text-white"
              title={fullscreen ? '退出全屏' : '全屏'}
              onClick={() => setFullscreen((f) => !f)}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-red-400 hover:bg-white/10 hover:text-red-300"
              title="停止"
              onClick={() => setRunningInstance(null)}
            >
              <Square className="size-4" />
            </Button>
          </div>
        </div>
        <div className="relative flex-1 overflow-hidden">
          {/* iframe 常驻挂载：切到开发者面板时游戏继续运行 */}
          <div className={runPanel === 'game' ? 'h-full w-full' : 'h-0 w-0 overflow-hidden'}>
            <GameFrame
              instance={runningInstance}
              source={api.state.config.gameSource}
              pluginSources={pluginSources}
              onLog={api.log}
              onExit={() => setRunningInstance(null)}
            />
          </div>
          {runPanel === 'dev' && (
            <div className="h-full overflow-y-auto bg-background px-4 py-6 sm:px-6">
              <DevView
                activeInstance={runningInstance}
                gameRunning
                logs={api.logs}
                onLog={api.log}
                onUpdateInstance={api.updateInstance}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // 启动器主界面
  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      <Sidebar view={view} onViewChange={setView} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          account={api.state.config.account}
          onOpenSettings={() => setView('settings')}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            {view === 'library' && <LibraryView onUseVersion={handleUseVersion} />}
            {view === 'instances' && (
              <InstancesView
                api={api}
                onPlay={handlePlay}
                presetVersionId={presetVersionId}
                onPresetConsumed={() => setPresetVersionId(undefined)}
              />
            )}
            {view === 'plugins' && (
              <PluginsView
                api={api}
                activeInstance={activeInstance}
                gameRunning={false}
                onRegisterSource={(id, source) => setPluginSources((s) => ({ ...s, [id]: source }))}
              />
            )}
            {view === 'dev' && (
              <DevView
                activeInstance={activeInstance}
                gameRunning={false}
                logs={api.logs}
                onLog={api.log}
                onUpdateInstance={api.updateInstance}
              />
            )}
            {view === 'settings' && (
              <SettingsView api={api} activeInstance={activeInstance} logs={api.logs} />
            )}
          </div>
        </main>

        {/* 底部启动栏 */}
        <footer className="flex shrink-0 items-center gap-4 border-t border-border bg-card/80 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0 flex-1">
            {activeInstance ? (
              <>
                <p className="truncate text-sm font-medium">{activeInstance.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {activeInstance.mode === 'survival' ? '生存' : '创造'} · {activeInstance.saveKey}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">请先创建一个实例</p>
            )}
          </div>
          <Button
            variant="play"
            size="play"
            disabled={!activeInstance}
            onClick={() => activeInstance && handlePlay(activeInstance)}
          >
            <Play className="size-5 fill-current" /> 游玩
          </Button>
        </footer>
      </div>
    </div>
  );
}
