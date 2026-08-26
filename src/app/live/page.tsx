import { LiveClient } from './LiveClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export default async function LiveMatchesPage() {
  const cms = await getWebsiteCmsContent();
  return <LiveClient shortName={cms.site.shortName} editionLabel={cms.site.editionLabel} />;
}
