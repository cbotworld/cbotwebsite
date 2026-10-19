const { PrismaClient } = require('@prisma/client');

function getUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('connection_limit', '1');
    parsed.searchParams.set('pool_timeout', '10');
    return parsed.toString();
  } catch {
    return url;
  }
}

const prisma = new PrismaClient({
  datasources: { db: { url: getUrl() } }
});

const DEFAULT_GOLD_SPONSORS = [
  { id: 'scrapplique', name: 'Scrapplique Galore', imageUrl: '/sponsors/scrapplique-galore-logo.png', sortOrder: 0 },
  { id: 'packiya', name: 'Packiya', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795824910_1790795823505.jpg', sortOrder: 1 },
  { id: 'abhijit', name: 'Abhijit', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795840683_1790795839348.jpg', sortOrder: 2 },
  { id: 'manoj', name: 'Manoj PS', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795849464_1790795848128.jpg', sortOrder: 3 },
  { id: 'mahesh', name: 'Mahesh TN', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795858215_1790795856845.jpg', sortOrder: 4 },
  { id: 'kumar', name: 'Kumar A', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795865143_1790795863837.jpg', sortOrder: 5 },
  { id: 'ramesh', name: 'Ramesh', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795971551_1790795970213.jpg', sortOrder: 6 },
  { id: 'vinod', name: 'Vinod', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795982093_1790795980759.jpg', sortOrder: 7 },
  { id: 'din', name: 'Din', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795990573_1790795989118.jpg', sortOrder: 8 },
  { id: 'krishnamurthy', name: 'Krishnamurthy', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796005960_1790796004653.jpg', sortOrder: 9 },
  { id: 'rakesh', name: 'Rakesh', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796044944_1790796043631.jpg', sortOrder: 10 },
  { id: 'srivishnu', name: 'Srivishnu', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796057028_1790796055724.jpg', sortOrder: 11 },
  { id: 'neela', name: 'Neela', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796066141_1790796064841.jpg', sortOrder: 12 },
  { id: 'lalit', name: 'Lalit', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796084595_1790796083275.jpg', sortOrder: 13 },
  { id: 'lalit-friends', name: 'Lalit Friends', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796097164_1790796095826.jpg', sortOrder: 14 },
  { id: 'umesh', name: 'UMESH N', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796127470_1790796126160.jpg', sortOrder: 15 },
  { id: 'roopa', name: 'Roopa', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796138035_1790796136745.jpg', sortOrder: 16 },
  { id: 'praveen', name: 'Praveen', imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790796147486_1790796146147.jpg', sortOrder: 17 },
];

const SPECIAL_SPONSORS = [
  {
    id: 'ak-chari',
    name: 'AK Chari',
    imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795632534_1790795631130.jpg',
    accent: 'teal',
    sortOrder: 0,
  },
  {
    id: 'sridevi',
    name: 'Sridevi',
    imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795639152_1790795637783.jpg',
    accent: 'emerald',
    sortOrder: 1,
  },
  {
    id: 'srikranthi',
    name: 'Srikranthi',
    imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795643664_1790795642341.jpg',
    accent: 'emerald',
    sortOrder: 2,
  },
  {
    id: 'mahati',
    name: 'Mahati',
    imageUrl: 'https://www.cbotworld.com/api/storage/teams/1790795648152_1790795646821.jpg',
    accent: 'teal',
    sortOrder: 3,
  },
];

const LEGACY_VIDEOS = [
  { id: 'v1', youtubeId: '_VRKmVVM-00', title: '200th Edition Launch Video', label: '200th Launch', sortOrder: 0 },
  { id: 'v2', youtubeId: 'mFV8W5HdJ3A', title: 'CBOT Intro', label: 'CBOT Intro', sortOrder: 1 },
  { id: 'v3', youtubeId: 'szimIRoO0jI', title: '25th Edition Closing Video', label: '25th Closing', sortOrder: 2 },
  { id: 'v4', youtubeId: '9i3_S7JpN74', title: '50th Edition Closing Video', label: '50th Closing', sortOrder: 3 },
  { id: 'v5', youtubeId: 'eMnF5vIAlPw', title: '100th Centenary Closing Video', label: '100th Centenary', sortOrder: 4 },
  { id: 'v6', youtubeId: '_VRKmVVM-00', title: '200th Edition Closing Video', label: '200th Closing', sortOrder: 5 },
];

async function main() {
  const existing = await prisma.systemSetting.findFirst({
    where: { key: { in: ['website_cms', 'website_cms_content'] } }
  });

  let cmsData = existing ? JSON.parse(existing.value) : {};

  cmsData.specialSponsors = {
    sectionBadge: '🌟 Special Sponsor',
    sectionTitle: '360° Support to CBOT',
    sectionDescription: 'Thank you for your incredible 360-degree support to the CBOT community.',
    sponsors: SPECIAL_SPONSORS,
  };

  cmsData.goldSponsors = {
    sectionBadge: '🥇 Gold Sponsors',
    sectionTitle: 'Our Gold Sponsors',
    sectionDescription: 'Proud supporters powering CBOT Edition 204. Thank you for your generous contributions!',
    sponsors: DEFAULT_GOLD_SPONSORS,
  };

  cmsData.legacy = {
    sectionBadge: 'CBOT - Carrom Balu Online Tournament',
    sectionTitle: 'The Legacy Since 2020',
    sectionDescription:
      'With a thought of 1 tournament, CBOT continued with back-to-back non-stop editions driven by huge response and demand - crossing 50th, 100th, and 150th edition milestones to reach the monumental 200th edition with support from sponsors, players, and brands.',
    videos: LEGACY_VIDEOS,
  };

  for (const k of ['website_cms', 'website_cms_content']) {
    await prisma.systemSetting.upsert({
      where: { key: k },
      create: {
        key: k,
        value: JSON.stringify(cmsData),
      },
      update: {
        value: JSON.stringify(cmsData),
      },
    });
  }

  console.log('Successfully synced key website_cms and website_cms_content into database!');
}

main().finally(() => prisma.$disconnect());
