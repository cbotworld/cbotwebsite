export const dynamic = 'force-dynamic';
import { ContactClient } from './ContactClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export default async function ContactPage() {
  const cms = await getWebsiteCmsContent();
  return <ContactClient founderName={cms.site.founderName} />;
}
