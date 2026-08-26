'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Trophy, Crown, Shield, Heart, Award, History, CheckCircle2 } from 'lucide-react';
import { MOCK_USERS } from '@/lib/mock-data';
import { DEFAULT_WEBSITE_CMS, type WebsitePageHeading } from '@/lib/website-cms';

export function AboutClient({
  pageCms = DEFAULT_WEBSITE_CMS.pages.about,
  shortName = DEFAULT_WEBSITE_CMS.site.shortName,
}: {
  pageCms?: WebsitePageHeading;
  shortName?: string;
}) {
  const founder = MOCK_USERS[0]; // Balu Master

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <Badge variant="carrom" className="px-4 py-1 font-bold">
          {pageCms.badge}
        </Badge>
        <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
          {pageCms.title}
        </h1>
        {pageCms.subtitle ? (
          <p className="text-muted-foreground text-base leading-relaxed">
            {pageCms.subtitle}
          </p>
        ) : null}
        <p className="text-muted-foreground text-base leading-relaxed">
          {shortName} was born out of a passion for Carrom excellence. What began as an 8-team online championship organized by Balu Master during August 2020 has grown into the World's foremost digital Carrom ecosystem with 200+ official editions.
        </p>
      </div>

      {/* Founder Spotlight Card */}
      <Card className="relative overflow-hidden border-amber-500/30 bg-card p-8 shadow-2xl">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <Avatar src={founder.image} fallback={founder.name || 'BM'} size="xl" className="ring-4 ring-amber-500/40 shrink-0 h-28 w-28 text-2xl" />
          <div className="space-y-3 text-center md:text-left">
            <Badge variant="carrom" className="text-xs">Founder & Tournament Director</Badge>
            <h2 className="text-2xl font-black">{founder.name}</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              "{founder.bio}"
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-bold text-amber-500">
              <span>🏆 20+ Years Carrom Experience</span>
              <span>•</span>
              <span>👑 188 Career Queen Covers</span>
              <span>•</span>
              <span>⭐ 200+ Editions Directed</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Mission & Core Principles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <Card className="p-6 space-y-3 border-border">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Trophy className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold">Competitive Integrity</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            All {shortName} matches enforce standardized referee score audits and mandatory 60fps video proof for queen cover strikes.
          </p>
        </Card>

        <Card className="p-6 space-y-3 border-border">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-bold">
            <Shield className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold">Role-Based Automation</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Organizers, Captains, and Players operate in specialized dashboards with automated bracket trees and live updates.
          </p>
        </Card>

        <Card className="p-6 space-y-3 border-border">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold">
            <Award className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-bold">Global Community</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Connecting over 450 registered competitors and 32 teams worldwide through regular weekend blitzes and major cups.
          </p>
        </Card>
      </div>

    </div>
  );
}
