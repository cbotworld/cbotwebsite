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
  updateWebsiteNavCms,
  updateWebsiteSiteCms,
  updateWebsitePagesCms,
  updateWebsiteSponsorsCms,
  updateWebsiteSpecialSponsorsCms,
  updateWebsiteGoldSponsorsCms,
  updateWebsiteLegacyCms,
  updateWebsiteFooterCms,
} from '@/lib/actions/websiteCmsActions';
import {
  extractYoutubeId,
  youtubeWatchUrl,
  newCmsId,
  sponsorInitials,
  type EliteSponsor,
  type HeroStat,
  type LegacyYoutubeVideo,
  type NamedSponsor,
  type SpecialSponsor,
  type SpecialThanksChip,
  type WebsiteCmsContent,
  type WebsiteNavCms,
  type WebsiteSiteCms,
  type WebsitePagesCms,
  type WebsitePageHeading,
} from '@/lib/website-cms';

type Props = {
  initialCms: WebsiteCmsContent;
  currentEditionId?: string | null;
};

const PAGE_HEADING_FIELDS: Array<{ key: keyof WebsitePagesCms; label: string }> = [
  { key: 'schedule', label: 'Match schedule page' },
  { key: 'combis', label: 'Daily combis page' },
  { key: 'videos', label: 'Videos page' },
  { key: 'fixtures', label: 'Fixtures page' },
  { key: 'about', label: 'About page' },
  { key: 'editions', label: 'Editions archive page' },
  { key: 'leaderboard', label: 'Leaderboard page' },
  { key: 'hallOfFame', label: 'Hall of Fame page' },
  { key: 'teamsPlayers', label: 'Teams & Players page' },
];

export default function WebsiteCmsPanel({ initialCms, currentEditionId }: Props) {
  const [nav, setNav] = React.useState<WebsiteNavCms>(initialCms.nav);
  const [site, setSite] = React.useState<WebsiteSiteCms>(initialCms.site);
  const [pages, setPages] = React.useState<WebsitePagesCms>(initialCms.pages);
  const [hero, setHero] = React.useState(initialCms.hero);
  const [sponsors, setSponsors] = React.useState(initialCms.sponsors);
  const [specialSponsors, setSpecialSponsors] = React.useState(initialCms.specialSponsors);
  const [goldSponsors, setGoldSponsors] = React.useState(initialCms.goldSponsors);
  const [legacy, setLegacy] = React.useState(initialCms.legacy);
  const [footer, setFooter] = React.useState(initialCms.footer);
  const [savingNav, setSavingNav] = React.useState(false);
  const [savingSite, setSavingSite] = React.useState(false);
  const [savingPages, setSavingPages] = React.useState(false);
  const [savingHero, setSavingHero] = React.useState(false);
  const [savingSponsors, setSavingSponsors] = React.useState(false);
  const [savingSpecial, setSavingSpecial] = React.useState(false);
  const [savingGold, setSavingGold] = React.useState(false);
  const [savingLegacy, setSavingLegacy] = React.useState(false);
  const [savingFooter, setSavingFooter] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  const seededRef = React.useRef(initialCms);

  // The organizer dashboard revalidates on every server action, so a fresh
  // `initialCms` object arrives constantly - including when a *different* CMS
  // section is saved. Only adopt server values for sections that still match
  // what we last seeded, otherwise unsaved typing is wiped before it is saved.
  React.useEffect(() => {
    const seeded = seededRef.current;
    if (seeded === initialCms) return;
    seededRef.current = initialCms;

    const adopt = <T,>(current: T, lastSeeded: T, incoming: T): T =>
      JSON.stringify(current) === JSON.stringify(lastSeeded) ? incoming : current;

    setNav((prev) => adopt(prev, seeded.nav, initialCms.nav));
    setSite((prev) => adopt(prev, seeded.site, initialCms.site));
    setPages((prev) => adopt(prev, seeded.pages, initialCms.pages));
    setHero((prev) => adopt(prev, seeded.hero, initialCms.hero));
    setSponsors((prev) => adopt(prev, seeded.sponsors, initialCms.sponsors));
    setSpecialSponsors((prev) => adopt(prev, seeded.specialSponsors, initialCms.specialSponsors));
    setGoldSponsors((prev) => adopt(prev, seeded.goldSponsors, initialCms.goldSponsors));
    setLegacy((prev) => adopt(prev, seeded.legacy, initialCms.legacy));
    setFooter((prev) => adopt(prev, seeded.footer, initialCms.footer));
  }, [initialCms]);

  const showMessage = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 3500);
  };

  const updatePageHeading = (key: keyof WebsitePagesCms, patch: Partial<WebsitePageHeading>) => {
    setPages((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const updateStat = (index: number, patch: Partial<HeroStat>) => {
    setHero((prev) => ({
      ...prev,
      stats: prev.stats.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  };

  const saveNav = async () => {
    setSavingNav(true);
    const res = await updateWebsiteNavCms(nav);
    setSavingNav(false);
    showMessage(res.success ? 'Navbar edition button saved. Refresh the site to see it.' : res.error || 'Save failed');
  };

  const saveSite = async () => {
    setSavingSite(true);
    const res = await updateWebsiteSiteCms(site);
    setSavingSite(false);
    showMessage(res.success ? 'Site branding saved across the whole website.' : res.error || 'Save failed');
  };

  const savePages = async () => {
    setSavingPages(true);
    const res = await updateWebsitePagesCms(pages);
    setSavingPages(false);
    showMessage(res.success ? 'Page headings saved.' : res.error || 'Save failed');
  };

  const saveHero = async () => {
    setSavingHero(true);
    const res = await updateWebsiteHeroCms(hero, currentEditionId || undefined);
    setSavingHero(false);
    showMessage(
      res.success
        ? res.warning || 'Hero section saved and live on the homepage.'
        : res.error || 'Save failed',
    );
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
            Edit site-wide branding, page headings, the navbar edition button, homepage hero, sponsors, legacy videos, and footer. Site &amp; Brand renames the edition everywhere at once. Team logos still come from the Teams tab. Sponsor images are optional — initials show when empty.
          </p>
        </div>
        {message && (
          <Badge variant="carrom" className="text-xs font-bold px-3 py-1.5">
            {message}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="site" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1.5 bg-card border border-border rounded-2xl">
          <TabsTrigger value="site" className="text-xs font-bold gap-1.5 px-3 py-2">
            <Globe className="h-3.5 w-3.5" /> Site &amp; Brand
          </TabsTrigger>
          <TabsTrigger value="pages" className="text-xs font-bold gap-1.5 px-3 py-2">
            <LayoutTemplate className="h-3.5 w-3.5" /> Page Headings
          </TabsTrigger>
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

        <TabsContent value="site" className="space-y-4">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Site-wide branding</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                These names are reused across every page, the navbar, the footer and the browser/SEO
                title. Changing the edition label here renames it everywhere at once.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Brand name (navbar &amp; footer)</label>
                  <Input value={site.brandName} onChange={(e) => setSite({ ...site, brandName: e.target.value })} placeholder="CBOT World" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Short name / abbreviation</label>
                  <Input value={site.shortName} onChange={(e) => setSite({ ...site, shortName: e.target.value })} placeholder="CBOT" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold block mb-1">Navbar tagline</label>
                  <Input value={site.brandTagline} onChange={(e) => setSite({ ...site, brandTagline: e.target.value })} placeholder="Connect Carrom Enthusiasts Worldwide" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Organization name</label>
                  <Input value={site.organizationName} onChange={(e) => setSite({ ...site, organizationName: e.target.value })} placeholder="Carrom Balu Online Tournament" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Founder name</label>
                  <Input value={site.founderName} onChange={(e) => setSite({ ...site, founderName: e.target.value })} placeholder="Carrom Balu" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Edition label</label>
                  <Input value={site.editionLabel} onChange={(e) => setSite({ ...site, editionLabel: e.target.value })} placeholder="e.g. 201st Edition" />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Edition series name</label>
                  <Input value={site.editionSeriesName} onChange={(e) => setSite({ ...site, editionSeriesName: e.target.value })} placeholder="e.g. Cornerstones of Carrom" />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-3">
                <div className="text-xs font-black uppercase tracking-widest text-amber-500">
                  Search engine &amp; sharing
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Browser / SEO title</label>
                  <Input value={site.metaTitle} onChange={(e) => setSite({ ...site, metaTitle: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">SEO description</label>
                  <Input value={site.metaDescription} onChange={(e) => setSite({ ...site, metaDescription: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">SEO keywords (comma separated)</label>
                  <Input value={site.metaKeywords} onChange={(e) => setSite({ ...site, metaKeywords: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Site URL</label>
                  <Input value={site.ogUrl} onChange={(e) => setSite({ ...site, ogUrl: e.target.value })} placeholder="https://cbot.gg" />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-3">
                <div className="text-xs font-black uppercase tracking-widest text-amber-500">
                  Floating WhatsApp button
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">WhatsApp number (no + or spaces)</label>
                    <Input value={site.whatsappNumber} onChange={(e) => setSite({ ...site, whatsappNumber: e.target.value })} placeholder="6594519986" />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Pre-filled message</label>
                    <Input value={site.whatsappMessage} onChange={(e) => setSite({ ...site, whatsappMessage: e.target.value })} />
                  </div>
                </div>
              </div>

              <Button type="button" variant="carrom" size="sm" className="font-bold" onClick={() => void saveSite()} disabled={savingSite}>
                {savingSite ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save site branding
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pages" className="space-y-4">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Page headings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                The badge, title and description shown at the top of each public page.
              </p>
              {PAGE_HEADING_FIELDS.map(({ key, label }) => (
                <div key={key} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="text-xs font-black uppercase tracking-widest text-amber-500">{label}</div>
                  <Input
                    value={pages[key].badge}
                    onChange={(e) => updatePageHeading(key, { badge: e.target.value })}
                    placeholder="Badge"
                  />
                  <Input
                    value={pages[key].title}
                    onChange={(e) => updatePageHeading(key, { title: e.target.value })}
                    placeholder="Title"
                  />
                  <Input
                    value={pages[key].subtitle}
                    onChange={(e) => updatePageHeading(key, { subtitle: e.target.value })}
                    placeholder="Description"
                  />
                </div>
              ))}
              <Button type="button" variant="carrom" size="sm" className="font-bold" onClick={() => void savePages()} disabled={savingPages}>
                {savingPages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save page headings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hero" className="space-y-4">
          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="text-base font-black">Navbar edition button</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                This is the gold pill on the top bar (currently shown as “201st Edition”). Change the label anytime without creating a new edition.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold block mb-1">Button text</label>
                  <Input
                    value={nav.editionButtonLabel}
                    onChange={(e) => setNav({ ...nav, editionButtonLabel: e.target.value })}
                    placeholder="e.g. 201st Edition"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold block mb-1">Button link</label>
                  <Input
                    value={nav.editionButtonHref}
                    onChange={(e) => setNav({ ...nav, editionButtonHref: e.target.value })}
                    placeholder="/combis"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-3">
                <div className="text-xs font-black uppercase tracking-widest text-amber-500">
                  Edition sub-navigation tabs
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1">Combis tab text</label>
                    <Input
                      value={nav.combisLabel}
                      onChange={(e) => setNav({ ...nav, combisLabel: e.target.value })}
                      placeholder="Daily Team Combis"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Combis tab link</label>
                    <Input value="/combis" readOnly className="bg-muted/40 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground mt-1">Fixed public URL: cbotworld.com/combis</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Schedule tab text</label>
                    <Input
                      value={nav.scheduleLabel}
                      onChange={(e) => setNav({ ...nav, scheduleLabel: e.target.value })}
                      placeholder="Match Schedule"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Schedule tab link</label>
                    <Input value="/schedule" readOnly className="bg-muted/40 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground mt-1">Fixed public URL: cbotworld.com/schedule</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-[10px] text-muted-foreground">
                      Teams &amp; Players is the third tab under this bar and always opens <span className="font-mono">/teams-and-players</span>.
                    </p>
                  </div>
                </div>
              </div>
              <Button type="button" variant="carrom" size="sm" className="font-bold" onClick={() => void saveNav()} disabled={savingNav}>
                {savingNav ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Save navbar button
              </Button>
            </CardContent>
          </Card>

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
              <p className="text-xs text-muted-foreground -mt-2">
                Paste a full YouTube link in the first box — for example{' '}
                <span className="font-mono text-foreground/80">https://www.youtube.com/watch?v=...</span> or{' '}
                <span className="font-mono text-foreground/80">https://youtu.be/...</span>. You do not need the short video ID.
              </p>
              {legacy.videos.map((video) => (
                <div key={video.id} className="rounded-xl border border-border/60 p-4 space-y-3 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black text-sky-400 uppercase tracking-wider">{video.label || 'Video'}</div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeLegacyVideo(video.id)} className="text-rose-400 gap-1 text-xs">
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">YouTube link</label>
                    <Input
                      value={youtubeWatchUrl(video.youtubeId)}
                      onChange={(e) => updateLegacyVideo(video.id, { youtubeId: extractYoutubeId(e.target.value) })}
                      placeholder="https://www.youtube.com/watch?v=..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Video title</label>
                    <Input value={video.title} onChange={(e) => updateLegacyVideo(video.id, { title: e.target.value })} placeholder="Shown on the homepage player" />
                  </div>
                  <div>
                    <label className="text-xs font-bold block mb-1">Tab label</label>
                    <Input value={video.label} onChange={(e) => updateLegacyVideo(video.id, { label: e.target.value })} placeholder="Short name on the video tabs" />
                  </div>
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
