import { Box, Clock, Layers, Sparkles, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BUILTIN_VERSIONS } from '@/lib/defaults';
import type { GameVersion } from '@/lib/types';

interface LibraryViewProps {
  onUseVersion: (v: GameVersion) => void;
}

export function LibraryView({ onUseVersion }: LibraryViewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">游戏库</h1>
        <p className="mt-1 text-sm text-muted-foreground">选择一个版本，创建实例开始游玩。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {BUILTIN_VERSIONS.map((v) => (
          <Card key={v.id} className="group relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <div className={`h-1.5 w-full ${v.channel === 'release' ? 'bg-brand-500' : 'bg-amber-500'}`} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {v.channel === 'release' ? <Box className="size-5" /> : <Sparkles className="size-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{v.label}</h3>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="size-3" /> {v.releasedAt}
                    </p>
                  </div>
                </div>
                <Badge variant={v.channel === 'release' ? 'success' : 'warning'}>
                  {v.channel === 'release' ? '正式版' : '快照'}
                </Badge>
              </div>

              <p className="mt-4 min-h-10 text-sm text-muted-foreground">{v.description}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {v.tags.map((t) => (
                  <Badge key={t} variant="outline" className="gap-1">
                    <Tag className="size-3" /> {t}
                  </Badge>
                ))}
              </div>

              <Button className="mt-5 w-full" onClick={() => onUseVersion(v)}>
                <Layers className="size-4" /> 用此版本创建实例
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
          <Sparkles className="size-5 shrink-0 text-primary" />
          <span>更多版本可通过 GitHub Releases 拉取（计划中）。当前内置版本对应在线试玩地址。</span>
        </CardContent>
      </Card>
    </div>
  );
}
