import { getEditions } from '@/lib/actions/tournamentActions';
import EditionsClient from './EditionsClient';

export const revalidate = 0; // Disable cache so live data is always shown

export default async function EditionsPage() {
  const res = await getEditions();
  const editions = res.success && res.editions ? res.editions : [];

  return <EditionsClient editions={editions} />;
}
