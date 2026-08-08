import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const BUCKET = 'images';

  // 1. Make the bucket public
  const { error: bucketError } = await supabase.storage.updateBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  });

  if (bucketError) {
    console.error('❌ Could not update bucket:', bucketError.message);
  } else {
    console.log('✅ Bucket "images" is now PUBLIC');
  }

  // 2. Verify the public URL works
  const { data } = supabase.storage
    .from(BUCKET)
    .getPublicUrl('edition-posters/edition-205.jpg');
  console.log('🌐 Public URL:', data.publicUrl);
}

main().catch(console.error);
