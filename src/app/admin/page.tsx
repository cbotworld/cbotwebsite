export const dynamic = 'force-dynamic';
import AdminClient from './AdminClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';


export default async function AdminPage() {
  const cms = await getWebsiteCmsContent();
  return <AdminClient editionLabel={cms.site.editionLabel} />;
}
