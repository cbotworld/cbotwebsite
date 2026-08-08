'use client';

import * as React from 'react';
import { MOCK_NEWS } from '@/lib/mock-data';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Newspaper, Calendar, User, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function NewsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="border-b border-border pb-6">
        <Badge variant="carrom" className="mb-2">Official Portal</Badge>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight">News, Rulebooks & Editorial</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Stay updated on edition announcements, official CBOT rule updates, and champion interviews.
        </p>
      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {MOCK_NEWS.map((article) => (
          <Card key={article.id} className="overflow-hidden border-border hover:border-amber-500/50 hover:shadow-xl transition-all flex flex-col justify-between">
            <div>
              <div className="relative h-48 w-full overflow-hidden bg-slate-950">
                <img
                  src={article.image}
                  alt={article.title}
                  className="h-full w-full object-cover opacity-85 hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="carrom" className="text-[10px] font-bold">
                    {article.category}
                  </Badge>
                </div>
              </div>

              <CardHeader className="space-y-2 p-5">
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-amber-500" /> {formatDate(article.date)}</span>
                  <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> {article.author}</span>
                </div>
                <CardTitle className="text-lg leading-snug">{article.title}</CardTitle>
                <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                  {article.excerpt}
                </CardDescription>
              </CardHeader>
            </div>

            <CardContent className="px-5 pb-5 pt-0">
              <p className="text-xs text-muted-foreground border-t border-border/50 pt-3 line-clamp-3">
                {article.content}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
