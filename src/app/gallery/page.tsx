'use client';

import * as React from 'react';
import { MOCK_GALLERY } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Image, Camera, Play, Trophy } from 'lucide-react';

export default function GalleryPage() {
  const [filter, setFilter] = React.useState('ALL');

  const items = MOCK_GALLERY.filter((item) => filter === 'ALL' || item.category === filter);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <Badge variant="carrom" className="mb-2">Media & Highlights</Badge>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Official Photo & Video Gallery</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Moments captured from final table shots, trophy presentations, and anniversary meetups.
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {['ALL', 'FINALS', 'CEREMONY', 'BOARD_ACTION', 'COMMUNITY'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filter === cat ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-muted hover:bg-muted/80 text-muted-foreground'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden border-border group hover:border-amber-500/50 transition-all">
            <div className="relative h-56 w-full overflow-hidden bg-slate-950">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
              <div className="absolute top-3 left-3">
                <Badge variant="carrom" className="text-[10px] font-bold">
                  {item.category.replace('_', ' ')}
                </Badge>
              </div>
              <div className="absolute bottom-3 left-3 right-3 text-white text-xs space-y-1">
                <div className="font-bold truncate">{item.title}</div>
                <div className="text-[10px] opacity-80">{item.caption}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
