import { prisma } from '@/lib/prisma';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const revalidate = 0;

export default async function PatternsPage() {
  const patterns = await prisma.boardPattern.findMany({
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">CBOT Library</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Board Patterns</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Browse the official Carrom board patterns and scoring rules.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {patterns.map((pattern) => (
          <Card key={pattern.id} className="overflow-hidden border-border hover:border-amber-500/60 transition-all">
            <div className="relative h-44 w-full bg-slate-950">
              <img
                src={pattern.diagramUrl || ''}
                alt={pattern.name}
                className="h-full w-full object-cover opacity-80 hover:scale-105 transition-transform"
              />
              <div className="absolute top-3 right-3">
                <Badge variant={
                  pattern.difficulty === 'EASY' ? 'success' :
                  pattern.difficulty === 'MEDIUM' ? 'warning' :
                  pattern.difficulty === 'HARD' ? 'destructive' : 'carrom'
                }>
                  {pattern.difficulty}
                </Badge>
              </div>
            </div>
            <CardHeader className="p-5">
              <CardTitle className="text-xl">{pattern.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{pattern.objective}</p>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-2 bg-muted/50 rounded p-2 text-center">
                <div>
                  <div className="text-muted-foreground">Base</div>
                  <div className="font-bold">{pattern.basePoints}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Queen Bonus</div>
                  <div className="font-bold text-pink-500">+{pattern.queenBonus}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Penalty</div>
                  <div className="font-bold text-rose-500">{pattern.penaltyPoints}</div>
                </div>
              </div>
              <div className="space-y-1">
                <div><span className="font-bold text-emerald-500">Valid:</span> {pattern.validCoins}</div>
                <div><span className="font-bold text-rose-500">Invalid:</span> {pattern.invalidCoins}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
