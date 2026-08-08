/**
 * Upload team poster images to Supabase Storage
 * 
 * Instructions:
 * 1. Save your poster images inside: scripts/posters/
 *    with these exact filenames:
 *      - plywood-pioneers.jpg
 *      - pocket-dynamos.jpg
 *      - vanilla-falcons.jpg
 *      - ebony-overlords.jpg
 *      - supernova-queen.jpg
 *      - vintage-strikers.jpg
 *      - boric-speedsters.jpg
 *      - lumen-pillar.jpg
 *
 * 2. Run: node scripts/upload-posters.mjs
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = 'https://otvbywtuyvufxxvlizqp.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90dmJ5d3R1eXZ1Znh4dmxpenFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjA3ODk0NywiZXhwIjoyMTAxNjU0OTQ3fQ.WUg--SXP1DAvSXJqinDzorRNkJTGciNnBoK1_80NHB0';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BUCKET = 'images';
const FOLDER = 'edition-posters';
const POSTERS_DIR = path.join(__dirname, 'posters');

const FILES = [
  'plywood-pioneers.jpg',
  'pocket-dynamos.jpg',
  'vanilla-falcons.jpg',
  'ebony-overlords.jpg',
  'supernova-queen.jpg',
  'vintage-strikers.jpg',
  'boric-speedsters.jpg',
  'lumen-pillar.jpg',
];

async function uploadPosters() {
  console.log(`\n📂 Reading from: ${POSTERS_DIR}\n`);

  if (!fs.existsSync(POSTERS_DIR)) {
    console.error(`❌ Folder not found: ${POSTERS_DIR}`);
    console.error(`   Create it and place your poster images inside.`);
    process.exit(1);
  }

  let successCount = 0;
  let failCount = 0;

  for (const filename of FILES) {
    const filePath = path.join(POSTERS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Skipping (not found): ${filename}`);
      failCount++;
      continue;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `${FOLDER}/${filename}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, fileBuffer, {
        contentType: 'image/jpeg',
        upsert: true, // overwrite if already exists
      });

    if (error) {
      console.error(`❌ Failed: ${filename} — ${error.message}`);
      failCount++;
    } else {
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
      console.log(`✅ Uploaded: ${filename}`);
      console.log(`   URL: ${publicUrl}`);
      successCount++;
    }
  }

  console.log(`\n🎉 Done! ${successCount} uploaded, ${failCount} skipped/failed.\n`);
}

uploadPosters();
