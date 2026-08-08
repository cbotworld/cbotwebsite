import { createClient } from '@supabase/supabase-js';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!   // service role bypasses RLS
);

const prisma = new PrismaClient();
const BUCKET = 'images';

async function main() {
  // Read local poster file
  const localPath = path.join(process.cwd(), 'public', 'edition-poster.jpg');
  if (!fs.existsSync(localPath)) {
    console.error('❌  File not found:', localPath);
    process.exit(1);
  }
  const fileBuffer = fs.readFileSync(localPath);

  // Find current edition
  const edition = await prisma.edition.findFirst({
    where: { status: 'IN_PROGRESS' },
    orderBy: { number: 'desc' },
  }) ?? await prisma.edition.findFirst({ orderBy: { number: 'desc' } });

  if (!edition) { console.error('❌  No edition found'); process.exit(1); }

  const storagePath = `edition-posters/edition-${edition.number}.jpg`;

  console.log(`📤  Uploading to Supabase Storage bucket "${BUCKET}" → ${storagePath} ...`);

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: 'image/jpeg',
      upsert: true,          // overwrite if exists
    });

  if (uploadError) {
    console.error('❌  Upload failed:', uploadError.message);
    process.exit(1);
  }

  // Get the public URL
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;

  console.log('✅  Uploaded. Public URL:', publicUrl);

  // Update the Edition record
  const updated = await prisma.edition.update({
    where: { id: edition.id },
    data: { posterUrl: publicUrl },
  });

  console.log(`✅  DB updated: Edition #${updated.number} posterUrl → ${updated.posterUrl}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
