import * as React from 'react';
import { getPublicDaywiseVideosAction } from '@/lib/actions/youtubeActions';
import VideosClient from './VideosClient';

export const revalidate = 0; // Real-time match videos

export const metadata = {
  title: 'Live & Recorded Match Videos | CBOT 200th Bicentennial Edition',
  description: 'Watch all official live streams and recorded match videos day-wise across all 20 tournament days of the CBOT 200th Edition.',
};

export default async function VideosPage() {
  const data = await getPublicDaywiseVideosAction();

  return (
    <VideosClient
      initialMatches={data.matches || []}
      initialStreams={data.streams || []}
    />
  );
}
