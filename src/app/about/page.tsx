import { AboutClient } from './AboutClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export default async function AboutPage() {
  const cms = await getWebsiteCmsContent();
  return <AboutClient pageCms={cms.pages.about} shortName={cms.site.shortName} />;
}
