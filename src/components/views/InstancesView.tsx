import {
  Box,
  Copy,
  Compass,
  Dices,
  Pencil,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { BUILTIN_VERSIONS } from '@/lib/defaults';
import { describeQuery, FLAG_PRESETS } from '@/lib/launch';
import type { Instance, LaunchFlags } from '@/lib/types';
import { cn, formatRelative } from '@/lib/utils';
import type { LauncherApi } from '@/hooks/useLauncher';

interface InstancesViewProps {
  api: LauncherApi;
  onPlay: (inst: Instance) => void;
  presetVersionId?: string;
  onPresetConsumed?: () => void;
}

export function InstancesView({ api, onPlay, presetVersionId, onPresetConsumed }: InstancesViewProps) {
  const { state, activeInstance } = api;
  const [editing, setEditing] = useState<Instance | 'new' | null>(null);

  // 若从游戏库点"用此版本创建实例"，自动打开新建对话框并预填版本
  useEffect(() => {
    if (presetVersionId) setEditing('new');
  }, [presetVersionId]);

  const openNew = () => setEditing('new');

  const startEdit = (inst: Instance) => setEditing(inst);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">实例</h1>
          <p className="mt-1 text-sm text-muted-foreground">每个实例拥有独立的存档、设置与启动参数。</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="size-4" /> 新建实例
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {state.instances.map((inst) => {
          const isActive = inst.id === activeInstance?.id;
          const version = BUILTIN_VERSIONS.find((v) => v.id === inst.versionId);
          return (
            <Card
              key={inst.id}
              className={cn(
                'group flex flex-col transition-all hover:shadow-md',
                isActive && 'ring-2 ring-primary/50',
              )}
            >
              <CardContent className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex size-10 items-center justify-center rounded-lg',
                      inst.mode === 'survival' ? 'bg-brand-500/15 text-brand-600' : 'bg-blue-500/15 text-blue-600',
                    )}>
                      {inst.mode === 'survival' ? <Compass className="size-5" /> : <Box className="size-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{inst.name}</h3>
                      <p className="text-xs text-muted-foreground">{version?.label ?? inst.versionId}</p>
                    </div>
                  </div>
                  {isActive && <Badge variant="success">当前</Badge>}
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                  <Badge variant="secondary">{inst.mode === 'survival' ? '生存' : '创造'}</Badge>
                  <Badge variant="outline">{inst.saveKey}</Badge>
                  {inst.seed != null && <Badge variant="outline">种子 {inst.seed}</Badge>}
                  {inst.pluginIds.length > 0 && (
                    <Badge variant="outline">{inst.pluginIds.length} 插件</Badge>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">
                  {inst.lastPlayed ? `上次游玩：${formatRelative(inst.lastPlayed)}` : '尚未游玩'}
                </p>

                <div className="mt-auto flex gap-2 pt-5">
                  <Button variant="play" size="sm" className="flex-1" onClick={() => onPlay(inst)}>
                    <Play className="size-4 fill-current" /> 游玩
                  </Button>
                  <Button variant="outline" size="icon" title="编辑" onClick={() => startEdit(inst)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="复制实例"
                    onClick={() => api.duplicateInstance(inst.id)}
                  >
                    <Copy className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    title="删除"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm(`删除实例「${inst.name}」？其存档仍会保留在存储中。`)) {
                        api.deleteInstance(inst.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <button
          onClick={openNew}
          className="flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-8" />
          <span className="text-sm font-medium">新建实例</span>
        </button>
      </div>

      {editing && (
        <InstanceDialog
          instance={editing === 'new' ? null : editing}
          presetVersionId={editing === 'new' ? presetVersionId : undefined}
          onClose={() => {
            setEditing(null);
            onPresetConsumed?.();
          }}
          onSave={(data) => {
            if (editing === 'new') {
              const inst = api.addInstance(data);
              api.setActiveInstance(inst.id);
            } else {
              api.updateInstance(editing.id, data);
            }
            setEditing(null);
            onPresetConsumed?.();
          }}
        />
      )}
    </div>
  );
}

interface InstanceDialogProps {
  instance: Instance | null;
  presetVersionId?: string;
  onClose: () => void;
  onSave: (data: Partial<Instance>) => void;
}

function InstanceDialog({ instance, presetVersionId, onClose, onSave }: InstanceDialogProps) {
  const isNew = instance === null;
  const [name, setName] = useState(instance?.name ?? '新世界');
  const [versionId, setVersionId] = useState(instance?.versionId ?? presetVersionId ?? 'v1');
  const [mode, setMode] = useState<Instance['mode']>(instance?.mode ?? 'survival');
  const [seedText, setSeedText] = useState(instance?.seed != null ? String(instance.seed) : '');
  const [flags, setFlags] = useState<LaunchFlags>(instance?.flags ?? {
    wasm: false, greedy: true, workers: null, mesherMain: false, aa: 'off', mergeEmissive: true,
    customParams: {},
  });

  const updateFlag = <K extends keyof LaunchFlags>(key: K, value: LaunchFlags[K]) => {
    setFlags((f) => ({ ...f, [key]: value }));
  };

  const handleSave = () => {
    const seed = seedText.trim() === '' ? null : (Number(seedText) || null);
    onSave({
      name: name.trim() || '未命名实例',
      versionId,
      mode,
      seed,
      flags,
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? '新建实例' : `编辑「${instance?.name}」`}</DialogTitle>
          <DialogDescription>配置世界信息与启动参数。存档按实例隔离，互不影响。</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 基本信息 */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="inst-name">实例名称</Label>
              <Input id="inst-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="我的世界" />
            </div>
            <div className="space-y-2">
              <Label>游戏版本</Label>
              <Select value={versionId} onValueChange={setVersionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUILTIN_VERSIONS.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>游戏模式</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Instance['mode'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="survival">生存模式</SelectItem>
                  <SelectItem value="creative">创造模式</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="inst-seed">世界种子（留空=随机 / 续原档）</Label>
              <div className="relative">
                <Input
                  id="inst-seed"
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  placeholder="随机"
                  className="pr-10"
                />
                <Dices
                  className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground">填入种子会创建新世界；留空则继续该实例已有存档。</p>
            </div>
          </div>

          <Separator />

          {/* 启动参数 */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              <h4 className="font-semibold">启动参数</h4>
            </div>

            {/* 预设模板 */}
            <div className="mb-4">
              <p className="mb-1.5 text-xs text-muted-foreground">快速预设</p>
              <div className="flex flex-wrap gap-1.5">
                {FLAG_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    variant="outline"
                    size="sm"
                    title={preset.description}
                    onClick={() => setFlags((f) => ({ ...f, ...preset.flags }))}
                  >
                    <Sparkles className="size-3" /> {preset.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <FlagRow label="WASM 实验内核" desc="启用 WebAssembly 计算后端" checked={flags.wasm} onChecked={(v) => updateFlag('wasm', v)} />
              <FlagRow label="贪心网格合并" desc="合并相邻面以减少绘制调用" checked={flags.greedy} onChecked={(v) => updateFlag('greedy', v)} />
              <FlagRow label="主线程网格化" desc="禁用 Worker，便于调试" checked={flags.mesherMain} onChecked={(v) => updateFlag('mesherMain', v)} />
              <FlagRow label="自发光通道合并" desc="并入不透明通道（性能）" checked={flags.mergeEmissive} onChecked={(v) => updateFlag('mergeEmissive', v)} />

              <div className="space-y-2">
                <Label>网格化线程</Label>
                <Select
                  value={flags.workers == null ? (flags.mesherMain ? 'main' : 'auto') : String(flags.workers)}
                  onValueChange={(v) => {
                    if (v === 'auto') { updateFlag('workers', null); updateFlag('mesherMain', false); }
                    else if (v === 'main') { updateFlag('mesherMain', true); }
                    else { updateFlag('workers', Number(v) as 1 | 2 | 4); updateFlag('mesherMain', false); }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自动</SelectItem>
                    <SelectItem value="main">主线程</SelectItem>
                    <SelectItem value="1">1 线程</SelectItem>
                    <SelectItem value="2">2 线程</SelectItem>
                    <SelectItem value="4">4 线程</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>抗锯齿</Label>
                <Select value={flags.aa} onValueChange={(v) => updateFlag('aa', v as LaunchFlags['aa'])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">关闭</SelectItem>
                    <SelectItem value="msaa">MSAA</SelectItem>
                    <SelectItem value="ssaa">SSAA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 启动参数预览 */}
            <div className="mt-4 rounded-lg border bg-muted/30 p-3">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">启动参数预览</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    void navigator.clipboard?.writeText(describeQuery({
                      flags, seed: seedText.trim() === '' ? null : Number(seedText) || null,
                      mode, versionId, name, saveKey: '', id: '', pluginIds: [], settingsSnapshot: null,
                      createdAt: 0, lastPlayed: 0,
                    }));
                  }}
                >
                  <Copy className="size-3" /> 复制
                </Button>
              </div>
              <code className="block break-all font-mono text-xs text-primary">
                {describeQuery({
                  flags, seed: seedText.trim() === '' ? null : Number(seedText) || null,
                  mode, versionId, name, saveKey: '', id: '', pluginIds: [], settingsSnapshot: null,
                  createdAt: 0, lastPlayed: 0,
                })}
              </code>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleSave}>{isNew ? '创建实例' : '保存更改'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FlagRow({
  label, desc, checked, onChecked,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChecked: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChecked} />
    </div>
  );
}
