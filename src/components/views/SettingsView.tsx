import {
  Download,
  FileJson,
  FolderOpen,
  Globe,
  HardDrive,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { assetKey, deleteAsset, putAsset } from '@/lib/storage';
import { DEFAULT_ONLINE_URL } from '@/lib/defaults';
import type { ConsoleEntry, Instance, ThemeMode } from '@/lib/types';
import { formatTime } from '@/lib/utils';
import type { LauncherApi } from '@/hooks/useLauncher';

interface SettingsViewProps {
  api: LauncherApi;
  activeInstance: Instance | null;
  logs: ConsoleEntry[];
}

export function SettingsView({ api, activeInstance, logs }: SettingsViewProps) {
  const localFileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState(api.state.config.account.nickname);
  const [onlineUrl, setOnlineUrl] = useState(api.state.config.gameSource.onlineUrl);
  const [status, setStatus] = useState<string | null>(null);

  const { config } = api.state;

  const showStatus = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 3000);
  };

  const handleLocalFile = async (file: File) => {
    const text = await file.text();
    await putAsset(assetKey.localGame(), text);
    api.updateConfig({
      gameSource: { mode: 'local', onlineUrl, localFileName: file.name },
    });
    showStatus(`已导入本地游戏：${file.name}`);
  };

  const handleImportSettings = async (file: File) => {
    if (!activeInstance) { showStatus('请先选择一个实例'); return; }
    const text = await file.text();
    api.updateInstance(activeInstance.id, { settingsSnapshot: text });
    showStatus(`已为「${activeInstance.name}」保存设置快照`);
  };

  const handleExportSettings = () => {
    if (!activeInstance?.settingsSnapshot) { showStatus('该实例尚无设置快照'); return; }
    const blob = new Blob([activeInstance.settingsSnapshot], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mc-launcher-settings-${activeInstance.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">启动器外观、游戏来源与实例设置管理。</p>
      </div>

      {status && (
        <div className="rounded-lg border border-primary/50 bg-primary/10 p-3 text-sm text-primary">{status}</div>
      )}

      {/* 账户 */}
      <Card>
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div
            className="flex size-10 items-center justify-center rounded-full text-lg font-bold text-white"
            style={{ backgroundColor: `hsl(${config.account.avatarHue}, 45%, 45%)` }}
          >
            {config.account.nickname.slice(0, 1).toUpperCase() || 'P'}
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">本地账户</CardTitle>
            <CardDescription>无需登录，昵称仅在本机保存</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="nickname">昵称</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => {
                api.setNickname(nickname.trim() || '玩家');
                showStatus('昵称已保存');
              }}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* 外观 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">外观</CardTitle>
          <CardDescription>主题模式</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>主题</Label>
            <Select value={config.theme} onValueChange={(v) => api.setTheme(v as ThemeMode)}>
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system"><span className="flex items-center gap-2"><HardDrive className="size-4" />跟随系统</span></SelectItem>
                <SelectItem value="light"><span className="flex items-center gap-2"><Sun className="size-4" />浅色</span></SelectItem>
                <SelectItem value="dark"><span className="flex items-center gap-2"><Moon className="size-4" />深色</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 游戏来源 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">游戏来源</CardTitle>
          <CardDescription>选择在线加载或本地 HTML 文件</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>来源模式</Label>
            <Select
              value={config.gameSource.mode}
              onValueChange={(v) => api.updateConfig({
                gameSource: { ...config.gameSource, mode: v as 'online' | 'local' },
              })}
            >
              <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online"><span className="flex items-center gap-2"><Globe className="size-4" />在线 URL</span></SelectItem>
                <SelectItem value="local"><span className="flex items-center gap-2"><FolderOpen className="size-4" />本地文件</span></SelectItem>
              </SelectContent>
            </Select>
          </div>

          {config.gameSource.mode === 'online' ? (
            <div className="space-y-2">
              <Label htmlFor="online-url">游戏地址</Label>
              <div className="flex gap-2">
                <Input
                  id="online-url"
                  value={onlineUrl}
                  onChange={(e) => setOnlineUrl(e.target.value)}
                  onBlur={() => {
                    api.updateConfig({ gameSource: { ...config.gameSource, onlineUrl } });
                    showStatus('游戏地址已保存');
                  }}
                />
                <Button
                  variant="outline"
                  size="icon"
                  title="恢复默认"
                  onClick={() => {
                    setOnlineUrl(DEFAULT_ONLINE_URL);
                    api.updateConfig({ gameSource: { ...config.gameSource, onlineUrl: DEFAULT_ONLINE_URL } });
                  }}
                >
                  <RotateCcw className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                注入存档隔离需要跨域可读取该 HTML；若浏览器拦截，将自动降级为直接启动。
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>本地游戏文件</Label>
              {config.gameSource.localFileName ? (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3">
                  <FileJson className="size-5 text-primary" />
                  <span className="flex-1 truncate text-sm">{config.gameSource.localFileName}</span>
                  <Badge variant="success">已加载</Badge>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">尚未导入本地 HTML 文件。</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => localFileRef.current?.click()}>
                  <Upload className="size-4" /> {config.gameSource.localFileName ? '更换文件' : '选择 HTML 文件'}
                </Button>
                {config.gameSource.localFileName && (
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      await deleteAsset(assetKey.localGame());
                      api.updateConfig({
                        gameSource: { ...config.gameSource, localFileName: undefined },
                      });
                      showStatus('已清除本地游戏文件');
                    }}
                  >
                    <Trash2 className="size-4" /> 清除
                  </Button>
                )}
              </div>
              <input
                ref={localFileRef}
                type="file"
                accept=".html,.htm"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleLocalFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 设置快照 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">游戏设置快照</CardTitle>
          <CardDescription>
            当前实例：{activeInstance?.name ?? '无'}。启动时自动应用到游戏。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => importRef.current?.click()} disabled={!activeInstance}>
              <Download className="size-4" /> 导入设置 JSON
            </Button>
            <Button variant="outline" onClick={handleExportSettings} disabled={!activeInstance?.settingsSnapshot}>
              <Upload className="size-4" /> 导出设置
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              disabled={!activeInstance?.settingsSnapshot}
              onClick={() => {
                if (!activeInstance) return;
                api.updateInstance(activeInstance.id, { settingsSnapshot: null });
                showStatus('已清除设置快照');
              }}
            >
              <Trash2 className="size-4" /> 清除
            </Button>
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleImportSettings(f);
                e.target.value = '';
              }}
            />
          </div>
          {activeInstance?.settingsSnapshot && (
            <p className="mt-3 text-xs text-muted-foreground">已保存快照（{activeInstance.settingsSnapshot.length} 字符）</p>
          )}
        </CardContent>
      </Card>

      {/* 诊断日志 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">诊断日志</CardTitle>
              <CardDescription>来自游戏内 API 与启动器的运行信息</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={api.clearLogs}>清空</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-zinc-500">暂无日志。启动游戏后会显示运行状态。</p>
            ) : (
              logs.map((entry) => (
                <div key={entry.id} className="flex gap-2 py-0.5">
                  <span className="shrink-0 text-zinc-500">{formatTime(entry.time)}</span>
                  <span className={
                    entry.level === 'error' ? 'text-red-400'
                      : entry.level === 'warn' ? 'text-amber-400'
                        : entry.level === 'success' ? 'text-emerald-400'
                          : 'text-zinc-300'
                  }>
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
