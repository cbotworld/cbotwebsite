import { prisma } from '@/lib/prisma';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Trophy, Star, Shield, Award } from 'lucide-react';

export const revalidate = 3600;

export default async function HallOfFamePage() {
  const [members, cms] = await Promise.all([
    prisma.hallOfFame.findMany({
      include: { user: true },
      orderBy: { inductionYear: 'desc' }
    }),
    getWebsiteCmsContent(),
  ]);
  const pageCms = cms.pages.hallOfFame;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="carrom" className="px-5 py-1.5 font-bold text-sm">
          <Star className="h-4 w-4 mr-1.5 inline" /> {cms.site.shortName} {pageCms.badge}
        </Badge>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-amber-500">
          {pageCms.title}
        </h1>
        <p className="text-muted-foreground md:text-lg">
          {pageCms.subtitle}
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8">
        {members.map((hof: any) => (
          <Card key={hof.id} className="overflow-hidden border-amber-500/30 bg-amber-500/5 group hover:bg-amber-500/10 transition-colors">
            <div className="h-32 bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 relative">
              <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80')] mix-blend-overlay"></div>
              <div className="absolute -bottom-12 w-full flex justify-center">
                <Avatar 
                  src={hof.user.image || undefined} 
                  fallback={hof.user.name || ''} 
                  size="xl" 
                  className="ring-4 ring-background shadow-xl"
                />
              </div>
            </div>
            
            <CardContent className="pt-16 pb-8 text-center space-y-4 px-6">
              <div>
                <h3 className="text-2xl font-black text-foreground">{hof.user.name}</h3>
                <p className="text-amber-500 font-bold text-sm mt-0.5">{hof.title}</p>
              </div>

              <div className="inline-flex items-center justify-center bg-background rounded-full px-4 py-1.5 border border-border shadow-sm">
                <Award className="h-4 w-4 text-emerald-500 mr-2" />
                <span className="text-xs font-bold">Class of {hof.inductionYear}</span>
              </div>

              <div className="pt-4 border-t border-border/50">
                <p className="text-sm text-muted-foreground font-medium leading-relaxed italic">
                  "{hof.achievement}"
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
          <Trophy className="h-12 w-12 mx-auto mb-4 text-amber-500/30" />
          <h3 className="text-xl font-bold">The Hall is Empty</h3>
          <p>No legends have been inducted yet. The legacy is waiting to be written.</p>
        </div>
      )}

    </div>
  );
}
