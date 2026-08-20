/**
 * Compress oversized base64 team/CMS images and replace with Supabase public URLs.
 * Usage: node scripts/compress-team-logos.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import sharp from 'sharp';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const prisma = new PrismaClient();
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const KNOWN_TEAM_LOGOS = {
  'plywood pioneers': 'plywood-pioneers.jpeg',
  'supernova queen': 'supernova-queen.jpeg',
  'pocket dynamos': 'pocket-dynamos.jpeg',
  'lumen pillar': 'lumen-pillar.jpeg',
  'vanilla falcons': 'vanilla-falcons.jpeg',
  'vintage strikers': 'vintage-strikers.jpeg',
  'ebony overlords': 'ebony-overlords.jpeg',
  'boric speedsters': 'boric-speedsters.jpeg',
};

function publicTeamsUrl(filename) {
  return `${supabaseUrl}/storage/v1/object/public/teams/${filename}`;
}

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function parseDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

async function compressImage(buffer, { maxEdge = 900, quality = 78 } = {}) {
  return sharp(buffer)
    .rotate()
    .resize({
      width: maxEdge,
      height: maxEdge,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

async function uploadJpeg(buffer, filename, bucket = 'teams') {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { error } = await supabase.storage.from(bucket).upload(filename, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

async function optimizeDataUrlToPublicUrl(dataUrl, filename, opts) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const before = parsed.buffer.length;
  const compressed = await compressImage(parsed.buffer, opts);
  const url = await uploadJpeg(compressed, filename);
  console.log(
    `  compressed ${(before / 1024).toFixed(0)}KB -> ${(compressed.length / 1024).toFixed(0)}KB -> ${filename}`,
  );
  return url;
}

async function migrateTeams() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in env');
  }

  const teams = await prisma.team.findMany({
    select: { id: true, name: true, logo: true },
  });

  for (const team of teams) {
    const logo = team.logo || '';
    if (!logo) continue;

    const known = KNOWN_TEAM_LOGOS[team.name.toLowerCase().trim()];
    if (known && (logo.startsWith('data:') || logo.length > 2048)) {
      const url = publicTeamsUrl(known);
      await prisma.team.update({ where: { id: team.id }, data: { logo: url } });
      console.log(`✓ ${team.name}: mapped to known CDN ${known}`);
      continue;
    }

    if (!logo.startsWith('data:') && logo.length <= 2048) {
      console.log(`· ${team.name}: already a compact URL`);
      continue;
    }

    if (!logo.startsWith('data:')) {
      console.log(`· ${team.name}: leaving non-data URL as-is`);
      continue;
    }

    const filename = `${slugify(team.name)}.jpeg`;
    try {
      const url = await optimizeDataUrlToPublicUrl(logo, filename, {
        maxEdge: team.name.toLowerCase().includes('timber') || team.name.toLowerCase().includes('woody')
          ? 1000
          : 900,
        quality: 78,
      });
      if (!url) continue;
      await prisma.team.update({ where: { id: team.id }, data: { logo: url } });
      console.log(`✓ ${team.name}: uploaded ${url}`);
    } catch (err) {
      console.error(`✗ ${team.name}: ${err.message}`);
    }
  }
}

async function migrateCms() {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'website_cms' } });
  if (!row?.value) return;

  let cms;
  try {
    cms = JSON.parse(row.value);
  } catch {
    return;
  }

  let changed = false;

  const maybeFix = async (obj, key, filename) => {
    const val = obj?.[key];
    if (typeof val !== 'string' || !val.startsWith('data:')) return;
    try {
      const url = await optimizeDataUrlToPublicUrl(val, filename, { maxEdge: 800, quality: 80 });
      if (url) {
        obj[key] = url;
        changed = true;
        console.log(`✓ CMS ${filename}`);
      }
    } catch (err) {
      console.error(`✗ CMS ${filename}: ${err.message}`);
    }
  };

  if (cms.hero) {
    await maybeFix(cms.hero, 'bannerImage', 'cms-hero-banner.jpeg');
    await maybeFix(cms.hero, 'posterUrl', 'cms-hero-poster.jpeg');
  }

  for (const [i, sponsor] of (cms.sponsors?.eliteSponsors || []).entries()) {
    await maybeFix(sponsor, 'logoUrl', `cms-elite-${i}-${slugify(sponsor.name || 'sponsor')}.jpeg`);
    await maybeFix(sponsor, 'posterUrl', `cms-elite-poster-${i}.jpeg`);
  }
  for (const [i, sponsor] of (cms.specialSponsors?.sponsors || []).entries()) {
    await maybeFix(sponsor, 'imageUrl', `cms-special-${i}-${slugify(sponsor.name || 'sponsor')}.jpeg`);
  }
  for (const [i, sponsor] of (cms.goldSponsors?.sponsors || []).entries()) {
    await maybeFix(sponsor, 'imageUrl', `cms-gold-${i}-${slugify(sponsor.name || 'sponsor')}.jpeg`);
  }
  if (cms.footer) {
    await maybeFix(cms.footer, 'footerSponsorLogoUrl', 'cms-footer-sponsor.jpeg');
  }

  if (changed) {
    await prisma.systemSetting.update({
      where: { key: 'website_cms' },
      data: { value: JSON.stringify(cms) },
    });
    console.log('✓ website_cms updated');
  } else {
    console.log('· website_cms: no oversized data URIs needing upload');
  }
}

try {
  console.log('Compressing / migrating team logos…');
  await migrateTeams();
  console.log('\nCompressing / migrating CMS images…');
  await migrateCms();
  console.log('\nDone.');
} finally {
  await prisma.$disconnect();
}
