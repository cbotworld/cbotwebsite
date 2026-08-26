import { getPublicStandings } from '@/lib/actions/playerScoreActions';
import { PUBLIC_STANDINGS_PATH } from '@/lib/website-cms';
import StandingsClient from './StandingsClient';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const payload = await getPublicStandings();
  return <StandingsClient payload={payload} />;
}

export const metadata = {
  title: 'Standings',
  alternates: { canonical: PUBLIC_STANDINGS_PATH },
};
