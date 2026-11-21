import * as DropdownMenu from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react';
import type { LocalAccount } from '@/lib/types';
import { hueFromString } from '@/lib/utils';

interface TopBarProps {
  account: LocalAccount;
  onOpenSettings: () => void;
}

export function TopBar({ account, onOpenSettings }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur sm:px-6">
      <div className="text-sm font-medium text-muted-foreground">
        <span className="hidden sm:inline">Minecraft Web Replica</span>
      </div>

      <DropdownMenu.DropdownMenu>
        <DropdownMenu.DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-accent">
            <span
              className="flex size-7 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ backgroundColor: `hsl(${account.avatarHue || hueFromString(account.nickname)}, 45%, 45%)` }}
            >
              {account.nickname.slice(0, 1).toUpperCase() || 'P'}
            </span>
            <span className="max-w-24 truncate">{account.nickname}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </button>
        </DropdownMenu.DropdownMenuTrigger>
        <DropdownMenu.DropdownMenuContent align="end">
          <DropdownMenu.DropdownMenuLabel>本地账户</DropdownMenu.DropdownMenuLabel>
          <DropdownMenu.DropdownMenuSeparator />
          <DropdownMenu.DropdownMenuItem onSelect={onOpenSettings}>
            <UserRound /> 账户设置
          </DropdownMenu.DropdownMenuItem>
          <DropdownMenu.DropdownMenuItem onSelect={onOpenSettings}>
            <Settings /> 启动器设置
          </DropdownMenu.DropdownMenuItem>
          <DropdownMenu.DropdownMenuSeparator />
          <DropdownMenu.DropdownMenuItem disabled>
            <LogOut /> 退出（无需登录）
          </DropdownMenu.DropdownMenuItem>
        </DropdownMenu.DropdownMenuContent>
      </DropdownMenu.DropdownMenu>
    </header>
  );
}
