'use client';

import * as React from 'react';
import { Globe, Heart, ImageIcon, Loader2, Plus, Save, Trash2, Video, Star, Award, LayoutTemplate } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ImageUploader } from '@/components/ui/image-uploader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  updateWebsiteHeroCms,
  updateWebsiteSponsorsCms,
  updateWebsiteSpecialSponsorsCms,
  updateWebsiteGoldSponsorsCms,
  updateWebsiteLegacyCms,
  updateWebsiteFooterCms,
} from '@/lib/actions/websiteCmsActions';
import {
  extractYoutubeId,
  newCmsId,
  sponsorInitials,
  type EliteSponsor,
  type HeroStat,
  type LegacyYoutubeVideo,
  type NamedSponsor,
  type SpecialSponsor,
  type SpecialThanksChip,
  type WebsiteCmsContent,
} from '@/lib/website-cms';

type Props = {
  initialCms: WebsiteCmsContent;
  currentEditionId?: string | null;
};

export default function WebsiteCmsPanel({ initialCms, currentEditionId }: Props) {
  const [hero, setHero] = React.useState(initialCms.hero);
  const [sponsors, setSponsors] = React.useState(initialCms.sponsors);
  const [specialSponsors, setSpecialSponsors] = React.useState(initialCms.specialSponsors);
  const [goldSponsors, setGoldSponsors] = React.useState(initialCms.goldSponsors);
  const [legacy, setLegacy] = React.useState(initialCms.legacy);
  const [footer, setFooter] = React.useState(initialCms.footer);
  const [savingHero, setSavingHero] = React.useState(false);
  const [savingSponsors, setSavingSponsors] = React.useState(false);
  const [savingSpecial, setSavingSpecial] = React.useState(false);
  const [savingGold, setSavingGold] = React.useState(false);
  const [savingLegacy, setSavingLegacy] = React.useState(false);
  const [savingFooter, setSavingFooter] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setHero(initialCms.hero);
    setSponsors(initialCms.sponsors);
    setSpecialSponsors(initialCms.specialSponsors);
    setGoldSponsors(initialCms.goldSponsors);
    setLegacy(initialCms.legacy);
    setFooter(initialCms.footer);
  }, [initialCms]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3500);
  };

  const updateStat = (index: number, patch: Partial<HeroStat>) => {
    setHero((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const saveHero = async () => {
    setSavingHero(true);
    const res = await updateWebsiteHeroCms(hero, currentEditionId || undefined);
    setSavingHero(false);
    showMessage(res.success ? 'Hero section saved. Homepage will update within an hour or on next visit.' : res.error || 'Save failed');
  };

  const saveSponsors = async () => {
    setSavingSponsors(true);
    const res = await updateWebsiteSponsorsCms(sponsors);
    setSavingSponsors(false);
    showMessage(res.success ? 'Elite sponsors saved.' : res.error || 'Save failed');
  };

  const saveSpecialSponsors = async () => {
    setSavingSpecial(true);
    const res = await updateWebsiteSpecialSponsorsCms(specialSponsors);
    setSavingSpecial(false);
    showMessage(res.success ? 'Special sponsors saved.' : res.error || 'Save failed');
  };

  const saveGoldSponsors = async () => {
    setSavingGold(true);
    const res = await updateWebsiteGoldSponsorsCms(goldSponsors);
    setSavingGold(false);
    showMessage(res.success ? 'Gold sponsors saved.' : res.error || 'Save failed');
  };

  const saveLegacy = async () => {
    setSavingLegacy(true);
    const res = await updateWebsiteLegacyCms(legacy);
    setSavingLegacy(false);
    showMessage(res.success ? 'Legacy videos saved.' : res.error || 'Save failed');
  };

  const saveFooter = async () => {
    setSavingFooter(true);
    const res = await updateWebsiteFooterCms(footer);
    setSavingFooter(false);
    showMessage(res.success ? 'Footer saved.' : res.error || 'Save failed');
  };

  const addEliteSponsor = () => {
    const next: EliteSponsor = {
      id: newCmsId('sponsor'),
      name: 'New Sponsor',
      logoUrl: '',
      layout: 'rect',
      accent: 'emerald',
      sortOrder: sponsors.eliteSponsors.length,
    };
    setSponsors((prev) => ({
      ...prev,
      eliteSponsors: [...prev.eliteSponsors, next],
    }));
  };

  const updateEliteSponsor = (id: string, patch: Partial<EliteSponsor>) => {
    setSponsors((prev) => ({
      ...prev,
      eliteSponsors: prev.eliteSponsors.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeEliteSponsor = (id: string) => {
    setSponsors((prev) => ({
      ...prev,
      eliteSponsors: prev.eliteSponsors.filter((s) => s.id !== id),
    }));
  };

  const addSpecialThanks = () => {
    const next: SpecialThanksChip = {
      id: newCmsId('thanks'),
      text: 'Special Thank you to ',
      sortOrder: sponsors.specialThanks.length,
    };
    setSponsors((prev) => ({
      ...prev,
      specialThanks: [...prev.specialThanks, next],
    }));
  };

  const updateSpecialThanks = (id: string, text: string) => {
    setSponsors((prev) => ({
      ...prev,
      specialThanks: prev.specialThanks.map((c) => (c.id === id ? { ...c, text } : c)),
    }));
  };

  const removeSpecialThanks = (id: string) => {
    setSponsors((prev) => ({
      ...prev,
      specialThanks: prev.specialThanks.filter((c) => c.id !== id),
    }));
  };

  const addSpecialSponsor = () => {
    const next: SpecialSponsor = {
      id: newCmsId('special'),
      name: 'New Sponsor',
      imageUrl: '',
      accent: 'emerald',
      sortOrder: specialSponsors.sponsors.length,
    };
    setSpecialSponsors((prev) => ({
      ...prev,
      sponsors: [...prev.sponsors, next],
    }));
  };

  const updateSpecialSponsor = (id: string, patch: Partial<SpecialSponsor>) => {
    setSpecialSponsors((prev) => ({
      ...prev,
      sponsors: prev.sponsors.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeSpecialSponsor = (id: string) => {
    setSpecialSponsors((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((s) => s.id !== id),
    }));
  };

  const addGoldSponsor = () => {
    const next: NamedSponsor = {
      id: newCmsId('gold'),
      name: 'New Sponsor',
      imageUrl: '',
      sortOrder: goldSponsors.sponsors.length,
    };
    setGoldSponsors((prev) => ({
      ...prev,
      sponsors: [...prev.sponsors, next],
    }));
  };

  const updateGoldSponsor = (id: string, patch: Partial<NamedSponsor>) => {
    setGoldSponsors((prev) => ({
      ...prev,
      sponsors: prev.sponsors.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  };

  const removeGoldSponsor = (id: string) => {
    setGoldSponsors((prev) => ({
      ...prev,
      sponsors: prev.sponsors.filter((s) => s.id !== id),
    }));
  };

  const addLegacyVideo = () => {
    const next: LegacyYoutubeVideo = {
      id: newCmsId('video'),
      youtubeId: '',
      title: 'New Video',
      label: 'Label',
      sortOrder: legacy.videos.length,
    };
    setLegacy((prev) => ({
      ...prev,
      videos: [...prev.videos, next],
    }));
  };

  const updateLegacyVideo = (id: string, patch: Partial<LegacyYoutubeVideo>) => {
    setLegacy((prev) => ({
      ...prev,
      videos: prev.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  };

  const removeLegacyVideo = (id: string) => {
    setLegacy((prev) => ({
      ...prev,
      videos: prev.videos.filter((v) => v.id !== id),
    }));
  };

  const SectionHeaderFields = ({
    values,
    onChange,
  }: {
    values: { sectionBadge: string; sectionTitle: string; sectionDescription: string };
    onChange: (patch: Partial<{ sectionBadge: string; sectionTitle: string; sectionDescription: string }>) => void;
  }) => (
    <div className="space-y-3">
      <Input value={values.sectionBadge} onChange={(e) => onChange({ sectionBadge: e.target.value })} placeholder="Section badge" />
      <Input value={values.sectionTitle} onChange={(e) => onChange({ sectionTitle: e.target.value })} placeholder="Section title" />
      <Input value={values.sectionDescription} onChange={(e) => onChange({ sectionDescription: e.target.value })} placeholder="Section description" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2">
            <Globe className="h-5 w-5 text-amber-500" /> Website CMS
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Edit homepage hero, sponsors, legacy videos, and footer. Team logos still come from Teams tab. Sponsor images are optional — initials show when empty.
          </p>
        </div>
        {message && (
          <Badge variant="carrom" className="text-xs font-bold px-3 py-1.5">
            {message}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="hero" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-card border border-border rounded-2xl">
          <TabsTrigger value="hero" className="text-xs font-bold gap-1.5 px-3 py-2">
            <ImageIcon className="h-3.5 w-3.5" /> Hero Section
          </TabsTrigger>
          <TabsTrigger value="sponsors" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Heart className="h-3.5 w-3.5" /> Elite Sponsors
          </TabsTrigger>
          <TabsTrigger value="special" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Star className="h-3.5 w-3.5" /> Special Sponsors
          </TabsTrigger>
          <TabsTrigger value="gold" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Award className="h-3.5 w-3.5" /> Gold Sponsors
          </TabsTrigger>
          <TabsTrigger value="legacy" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Video className="h-3.5 w-3.5" /> Legacy / YouTube
          </TabsTrigger>
          <TabsTrigger value="footer" className="text-xs font-bold gap-1.5 px-3 py-2">
            <LayoutTemplate className="h-3.5 w-3.5" /> Footer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="space-y-4">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Hero text & stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Top badge</label>
                  <Input value={hero.badgeText} onChange={(e) => setHero({ ...hero, badgeText: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Current edition badge</label>
                  <Input value={hero.currentEditionBadge} onChange={(e) => setHero({ ...hero, currentEditionBadge: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Headline line 1</label>
                  <Input value={hero.headlineLine1} onChange={(e) => setHero({ ...hero, headlineLine1: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Headline line 2</label>
                  <Input value={hero.headlineLine2} onChange={(e) => setHero({ ...hero, headlineLine2: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Headline accent (gold line)</label>
                  <Input value={hero.headlineAccent} onChange={(e) => setHero({ ...hero, headlineAccent: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold block mb-1">Description paragraph</label>
                  <Input value={hero.description} onChange={(e) => setHero({ ...hero, description: e.target.value })} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-xs font-black text-amber-500 uppercase tracking-wider">Stats row (4 boxes)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {hero.stats.map((stat, index) => (
                    <div key={index} className="rounded-xl border border-border/60 p-3 space-y-2 bg-muted/20">
                      <div className="text-[10px] font-bold text-muted-foreground">Stat {index + 1}</div>
                      <Input value={stat.value} placeholder="Value" onChange={(e) => updateStat(index, { value: e.target.value })} />
                      <Input value={stat.label} placeholder="Label" onChange={(e) => updateStat(index, { label: e.target.value })} />
                      <select
                        className="w-full h-9 rounded-md border border-border bg-background px-2 text-xs"
                        value={stat.color}
                        onChange={(e) => updateStat(index, { color: e.target.value as HeroStat['color'] })}
                      >
                        <option value="amber">Amber</option>
                        <option value="foreground">White</option>
                        <option value="pink">Pink</option>
                        <option value="emerald">Green</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Tournament images & CTA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader
                label="Hero background image (optional blur behind text)"
                value={hero.bannerImage}
                onChange={(url) => setHero({ ...hero, bannerImage: url })}
                bucket="images"
                placeholder="Upload background or paste URL"
              />
              <ImageUploader
                label="Tournament poster image (main card)"
                value={hero.posterUrl}
                onChange={(url) => setHero({ ...hero, posterUrl: url })}
                bucket="images"
                placeholder="Upload poster or paste URL"
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Schedule button text</label>
                  <Input value={hero.ctaButtonText} onChange={(e) => setHero({ ...hero, ctaButtonText: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Schedule button link</label>
                  <Input value={hero.ctaButtonLink} onChange={(e) => setHero({ ...hero, ctaButtonLink: e.target.value })} />
                </div>
              </div>
              <Button variant="carrom" onClick={saveHero} disabled={savingHero} className="font-black gap-2">
                {savingHero ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Hero Section
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sponsors" className="space-y-4">
          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Section header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={sponsors.sectionBadge} onChange={(e) => setSponsors({ ...sponsors, sectionBadge: e.target.value })} placeholder="Section badge" />
              <Input value={sponsors.sectionTitle} onChange={(e) => setSponsors({ ...sponsors, sectionTitle: e.target.value })} placeholder="Section title" />
              <Input value={sponsors.sectionDescription} onChange={(e) => setSponsors({ ...sponsors, sectionDescription: e.target.value })} placeholder="Section description" />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">Special thanks chips</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addSpecialThanks} className="gap-1 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add chip
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {sponsors.specialThanks.map((chip) => (
                <div key={chip.id} className="flex gap-2">
                  <Input value={chip.text} onChange={(e) => updateSpecialThanks(chip.id, e.target.value)} placeholder="Special Thank you to …" />
                  <Button type="button" variant="outline" size="icon" onClick={() => removeSpecialThanks(chip.id)}>
                    <Trash2 className="h-4 w-4 text-rose-400" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">Elite sponsors</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addEliteSponsor} className="gap-1 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add sponsor
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {sponsors.eliteSponsors.map((sponsor) => (
                <div key={sponsor.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-emerald-400 uppercase tracking-wider">{sponsor.name || 'New sponsor'}</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEliteSponsor(sponsor.id)} className="text-rose-400 gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Input value={sponsor.name} onChange={(e) => updateEliteSponsor(sponsor.id, { name: e.target.value })} placeholder="Sponsor name" />
                    <Input value={sponsor.websiteUrl || ''} onChange={(e) => updateEliteSponsor(sponsor.id, { websiteUrl: e.target.value })} placeholder="Website URL (optional)" />
                  </div>
                  <ImageUploader
                    label="Sponsor logo"
                    value={sponsor.logoUrl}
                    onChange={(url) => updateEliteSponsor(sponsor.id, { logoUrl: url })}
                    bucket="images"
                  />
                  <ImageUploader
                    label="Poster for popup (optional — e.g. Neelamani)"
                    value={sponsor.posterUrl || ''}
                    onChange={(url) => updateEliteSponsor(sponsor.id, { posterUrl: url })}
                    bucket="images"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                      value={sponsor.layout}
                      onChange={(e) => updateEliteSponsor(sponsor.id, { layout: e.target.value as EliteSponsor['layout'] })}
                    >
                      <option value="round">Round logo</option>
                      <option value="rect">Rectangle logo</option>
                    </select>
                    <select
                      className="h-9 rounded-md border border-border bg-background px-2 text-xs"
                      value={sponsor.accent}
                      onChange={(e) => updateEliteSponsor(sponsor.id, { accent: e.target.value as EliteSponsor['accent'] })}
                    >
                      <option value="emerald">Green accent</option>
                      <option value="rose">Red accent</option>
                      <option value="sky">Blue accent</option>
                      <option value="amber">Gold accent</option>
                    </select>
                  </div>
                </div>
              ))}
              <Button variant="carrom" onClick={saveSponsors} disabled={savingSponsors} className="font-black gap-2">
                {savingSponsors ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Elite Sponsors
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="special" className="space-y-4">
          <Card className="border-emerald-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Section header</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionHeaderFields
                values={specialSponsors}
                onChange={(patch) => setSpecialSponsors((prev) => ({ ...prev, ...patch }))}
              />
            </CardContent>
          </Card>

          <Card className="border-emerald-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">Special sponsors</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addSpecialSponsor} className="gap-1 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add sponsor
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {specialSponsors.sponsors.map((sponsor) => (
                <div key={sponsor.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-emerald-400 uppercase tracking-wider">
                      {sponsor.name || 'New sponsor'}
                      {!sponsor.imageUrl && (
                        <span className="ml-2 text-amber-400 normal-case">({sponsorInitials(sponsor.name)})</span>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeSpecialSponsor(sponsor.id)} className="text-rose-400 gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <Input value={sponsor.name} onChange={(e) => updateSpecialSponsor(sponsor.id, { name: e.target.value })} placeholder="Sponsor name" />
                  <ImageUploader
                    label="Photo (optional — initials show if empty)"
                    value={sponsor.imageUrl || ''}
                    onChange={(url) => updateSpecialSponsor(sponsor.id, { imageUrl: url })}
                    bucket="images"
                  />
                  <select
                    className="h-9 rounded-md border border-border bg-background px-2 text-xs w-full"
                    value={sponsor.accent}
                    onChange={(e) => updateSpecialSponsor(sponsor.id, { accent: e.target.value as SpecialSponsor['accent'] })}
                  >
                    <option value="emerald">Green accent</option>
                    <option value="teal">Teal accent</option>
                  </select>
                </div>
              ))}
              <Button variant="carrom" onClick={saveSpecialSponsors} disabled={savingSpecial} className="font-black gap-2">
                {savingSpecial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Special Sponsors
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gold" className="space-y-4">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Section header</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionHeaderFields
                values={goldSponsors}
                onChange={(patch) => setGoldSponsors((prev) => ({ ...prev, ...patch }))}
              />
            </CardContent>
          </Card>

          <Card className="border-amber-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">Gold sponsors</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addGoldSponsor} className="gap-1 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add sponsor
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {goldSponsors.sponsors.map((sponsor) => (
                <div key={sponsor.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-amber-400 uppercase tracking-wider">
                      {sponsor.name || 'New sponsor'}
                      {!sponsor.imageUrl && (
                        <span className="ml-2 text-amber-300 normal-case">({sponsorInitials(sponsor.name)})</span>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeGoldSponsor(sponsor.id)} className="text-rose-400 gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <Input value={sponsor.name} onChange={(e) => updateGoldSponsor(sponsor.id, { name: e.target.value })} placeholder="Sponsor name" />
                  <ImageUploader
                    label="Logo (optional — initials show if empty)"
                    value={sponsor.imageUrl || ''}
                    onChange={(url) => updateGoldSponsor(sponsor.id, { imageUrl: url })}
                    bucket="images"
                  />
                </div>
              ))}
              <Button variant="carrom" onClick={saveGoldSponsors} disabled={savingGold} className="font-black gap-2">
                {savingGold ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Gold Sponsors
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="legacy" className="space-y-4">
          <Card className="border-sky-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">The Legacy Since 2020 — section header</CardTitle>
            </CardHeader>
            <CardContent>
              <SectionHeaderFields
                values={legacy}
                onChange={(patch) => setLegacy((prev) => ({ ...prev, ...patch }))}
              />
            </CardContent>
          </Card>

          <Card className="border-sky-500/30">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">YouTube videos</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={addLegacyVideo} className="gap-1 text-xs font-bold">
                <Plus className="h-3.5 w-3.5" /> Add video
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              {legacy.videos.map((video) => (
                <div key={video.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-sky-400 uppercase tracking-wider">{video.label || 'Video'}</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLegacyVideo(video.id)} className="text-rose-400 gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <Input
                    value={video.youtubeId}
                    onChange={(e) => updateLegacyVideo(video.id, { youtubeId: extractYoutubeId(e.target.value) })}
                    placeholder="YouTube URL or video ID"
                  />
                  <Input value={video.title} onChange={(e) => updateLegacyVideo(video.id, { title: e.target.value })} placeholder="Video title (accessibility)" />
                  <Input value={video.label} onChange={(e) => updateLegacyVideo(video.id, { label: e.target.value })} placeholder="Tab label (short)" />
                </div>
              ))}
              <Button variant="carrom" onClick={saveLegacy} disabled={savingLegacy} className="font-black gap-2">
                {savingLegacy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Legacy Videos
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-black">Brand & governance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={footer.brandDescription} onChange={(e) => setFooter({ ...footer, brandDescription: e.target.value })} placeholder="Brand description" />
              <Input value={footer.governanceHeading} onChange={(e) => setFooter({ ...footer, governanceHeading: e.target.value })} placeholder="Governance heading" />
              <Input value={footer.governanceText} onChange={(e) => setFooter({ ...footer, governanceText: e.target.value })} placeholder="Governance text" />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-black">Footer elite sponsor link</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={footer.footerSponsorLabel} onChange={(e) => setFooter({ ...footer, footerSponsorLabel: e.target.value })} placeholder="Sponsor label" />
              <Input value={footer.footerSponsorName} onChange={(e) => setFooter({ ...footer, footerSponsorName: e.target.value })} placeholder="Sponsor name" />
              <Input value={footer.footerSponsorLink} onChange={(e) => setFooter({ ...footer, footerSponsorLink: e.target.value })} placeholder="Link (e.g. /#sponsors)" />
              <ImageUploader
                label="Sponsor logo"
                value={footer.footerSponsorLogoUrl}
                onChange={(url) => setFooter({ ...footer, footerSponsorLogoUrl: url })}
                bucket="images"
              />
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base font-black">Copyright & developer credit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={footer.copyrightText} onChange={(e) => setFooter({ ...footer, copyrightText: e.target.value })} placeholder="Copyright line" />
              <Input value={footer.developerCredit} onChange={(e) => setFooter({ ...footer, developerCredit: e.target.value })} placeholder="Developer credit text" />
              <Input value={footer.developerUrl} onChange={(e) => setFooter({ ...footer, developerUrl: e.target.value })} placeholder="Developer website URL" />
              <ImageUploader
                label="Developer logo"
                value={footer.developerLogoUrl}
                onChange={(url) => setFooter({ ...footer, developerLogoUrl: url })}
                bucket="images"
              />
              <Button variant="carrom" onClick={saveFooter} disabled={savingFooter} className="font-black gap-2">
                {savingFooter ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Footer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
