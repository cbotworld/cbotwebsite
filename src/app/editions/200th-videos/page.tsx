import * as React from 'react';
import { getPublicDaywiseVideosAction } from '@/lib/actions/youtubeActions';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import VideosClient from './VideosClient';

export const revalidate = 300; // 5 min — videos update occasionally, not every request

export async function generateMetadata() {
  const cms = await getWebsiteCmsContent();
  return {
    title: cms.pages.videos.title,
    description: cms.pages.videos.subtitle,
  };
}

export default async function VideosPage() {
  const [data, cms] = await Promise.all([
    getPublicDaywiseVideosAction(),
    getWebsiteCmsContent(),
  ]);

  return (
    <VideosClient
      initialMatches={data.matches || []}
      initialStreams={data.streams || []}
      badgeText={cms.pages.videos.badge}
    />
  );
}
