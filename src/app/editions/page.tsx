import { getEditions } from '@/lib/actions/tournamentActions';
import EditionsClient from './EditionsClient';

export const revalidate = 3600;

export default async function EditionsPage() {
  const res = await getEditions();
  const editions = res.success && res.editions ? res.editions : [];

  return <EditionsClient editions={editions} />;
}
