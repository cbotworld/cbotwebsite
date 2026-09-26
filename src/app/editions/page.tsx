export const dynamic = 'force-dynamic';
import { getEditions } from '@/lib/actions/tournamentActions';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import EditionsClient from './EditionsClient';


export default async function EditionsPage() {
  const [res, cms] = await Promise.all([getEditions(), getWebsiteCmsContent()]);
  const editions = res.success && res.editions ? res.editions : [];

  return <EditionsClient editions={editions} pageCms={cms.pages.editions} />;
}
