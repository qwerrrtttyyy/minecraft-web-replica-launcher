import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInstance } from '@/lib/defaults';
import { loadState, saveState } from '@/lib/storage';
import type {
  ConsoleEntry,
  Instance,
  LauncherConfig,
  LauncherState,
  PluginRecord,
  ThemeMode,
} from '@/lib/types';
import { uid } from '@/lib/utils';

const MAX_LOGS = 300;

export function useLauncher() {
  const [state, setState] = useState<LauncherState>(() => loadState());
  const [logs, setLogs] = useState<ConsoleEntry[]>([]);
  const [gameRunning, setGameRunning] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  // 持久化
  useEffect(() => {
    saveState(state);
  }, [state]);

  // 主题
  useEffect(() => {
    const apply = () => {
      const mode = state.config.theme;
      const dark = mode === 'dark' ||
        (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [state.config.theme]);

  const log = useCallback((level: ConsoleEntry['level'], message: string, detail?: unknown) => {
    setLogs((prev) => [
      ...prev.slice(-(MAX_LOGS - 1)),
      { id: uid(), time: Date.now(), level, message, detail },
    ]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  // 来自 iframe 的消息
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.__launcher !== true) return;
      if (d.type === 'log') {
        log(d.level ?? 'info', String(d.message ?? ''), d.detail);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [log]);

  // ---- 配置 ----
  const updateConfig = useCallback((patch: Partial<LauncherConfig>) => {
    setState((s) => ({ ...s, config: { ...s.config, ...patch } }));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => updateConfig({ theme }), [updateConfig]);

  const setNickname = useCallback((nickname: string) => {
    setState((s) => ({
      ...s,
      config: {
        ...s.config,
        account: { ...s.config.account, nickname, avatarHue: s.config.account.avatarHue },
      },
    }));
  }, []);

  // ---- 实例 ----
  const addInstance = useCallback((partial?: Partial<Instance>) => {
    const inst = createInstance(partial);
    setState((s) => ({ ...s, instances: [...s.instances, inst] }));
    log('success', `已创建实例「${inst.name}」`);
    return inst;
  }, [log]);

  const updateInstance = useCallback((id: string, patch: Partial<Instance>) => {
    setState((s) => ({
      ...s,
      instances: s.instances.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    }));
  }, []);

  const deleteInstance = useCallback((id: string) => {
    setState((s) => {
      const instances = s.instances.filter((i) => i.id !== id);
      const config = { ...s.config };
      if (config.activeInstanceId === id) config.activeInstanceId = instances[0]?.id ?? null;
      if (config.defaultInstanceId === id) config.defaultInstanceId = instances[0]?.id ?? null;
      return { ...s, instances, config };
    });
    log('info', '已删除实例');
  }, [log]);

  const duplicateInstance = useCallback((id: string) => {
    setState((s) => {
      const src = s.instances.find((i) => i.id === id);
      if (!src) return s;
      const copy = createInstance({
        ...src,
        id: undefined,
        name: `${src.name} 副本`,
        saveKey: `world-${uid().slice(0, 8)}`,
        seed: null, // 副本默认继续原世界？sep：保留 null 表示续原档；这里用独立 saveKey 全新世界
        createdAt: Date.now(),
        lastPlayed: 0,
      });
      return { ...s, instances: [...s.instances, copy] };
    });
    log('success', '已复制实例（新存档）');
  }, [log]);

  const setActiveInstance = useCallback((id: string) => {
    updateConfig({ activeInstanceId: id });
  }, [updateConfig]);

  const touchPlayed = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      instances: s.instances.map((i) => (i.id === id ? { ...i, lastPlayed: Date.now() } : i)),
    }));
  }, []);

  // ---- 插件 ----
  const addPlugin = useCallback((plugin: PluginRecord) => {
    setState((s) => ({ ...s, plugins: [...s.plugins, plugin] }));
    log('success', `已导入插件「${plugin.name}」`);
  }, [log]);

  const updatePlugin = useCallback((id: string, patch: Partial<PluginRecord>) => {
    setState((s) => ({
      ...s,
      plugins: s.plugins.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
  }, []);

  const deletePlugin = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      plugins: s.plugins.filter((p) => p.id !== id),
      instances: s.instances.map((i) => ({
        ...i,
        pluginIds: i.pluginIds.filter((pid) => pid !== id),
      })),
    }));
    log('info', '已移除插件');
  }, [log]);

  const togglePluginForInstance = useCallback((instanceId: string, pluginId: string) => {
    setState((s) => ({
      ...s,
      instances: s.instances.map((i) => {
        if (i.id !== instanceId) return i;
        const has = i.pluginIds.includes(pluginId);
        return {
          ...i,
          pluginIds: has ? i.pluginIds.filter((p) => p !== pluginId) : [...i.pluginIds, pluginId],
        };
      }),
    }));
  }, []);

  const activeInstance = useMemo(
    () => state.instances.find((i) => i.id === state.config.activeInstanceId) ?? state.instances[0] ?? null,
    [state.instances, state.config.activeInstanceId],
  );

  return {
    state,
    logs,
    gameRunning,
    setGameRunning,
    log,
    clearLogs,
    updateConfig,
    setTheme,
    setNickname,
    addInstance,
    updateInstance,
    deleteInstance,
    duplicateInstance,
    setActiveInstance,
    touchPlayed,
    addPlugin,
    updatePlugin,
    deletePlugin,
    togglePluginForInstance,
    activeInstance,
  };
}

export type LauncherApi = ReturnType<typeof useLauncher>;
