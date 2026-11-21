import { Boxes, Folder, Info, Layers, Puzzle, Settings, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ViewKey = 'library' | 'instances' | 'plugins' | 'dev' | 'settings';

interface SidebarProps {
  view: ViewKey;
  onViewChange: (v: ViewKey) => void;
}

const NAV: { key: ViewKey; label: string; icon: typeof Layers }[] = [
  { key: 'library', label: '游戏库', icon: Layers },
  { key: 'instances', label: '实例', icon: Folder },
  { key: 'plugins', label: '插件', icon: Puzzle },
  { key: 'dev', label: '开发者', icon: Wrench },
  { key: 'settings', label: '设置', icon: Settings },
];

export function Sidebar({ view, onViewChange }: SidebarProps) {
  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-2 border-r border-sidebar-border bg-sidebar py-4 sm:w-56 sm:items-stretch sm:px-3">
      <div className="mb-4 flex items-center gap-2 px-2">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-md">
          <Boxes className="size-5" />
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-bold">MC Web</p>
          <p className="text-[10px] text-muted-foreground">启动器 v0.1</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = view === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onViewChange(item.key)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                'justify-center sm:justify-start',
                active
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
              title={item.label}
            >
              <Icon className="size-5 shrink-0" />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="hidden items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground sm:flex">
        <Info className="size-4 shrink-0" />
        <span>非官方复刻启动器</span>
      </div>
    </aside>
  );
}
