import { getPublicStandings } from '@/lib/actions/playerScoreActions';
import { PUBLIC_STANDINGS_PATH } from '@/lib/website-cms';
import StandingsClient from './StandingsClient';

export const dynamic = 'force-dynamic';

export default async function StandingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ editionId?: string; edition?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const requestedEditionId = sp.editionId || sp.edition;
  const payload = JSON.parse(JSON.stringify(await getPublicStandings(requestedEditionId)));
  return <StandingsClient payload={payload} />;
}

export const metadata = {
  title: 'Standings',
  alternates: { canonical: PUBLIC_STANDINGS_PATH },
};
