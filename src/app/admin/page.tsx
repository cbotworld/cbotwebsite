import AdminClient from './AdminClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export const revalidate = 0;

export default async function AdminPage() {
  const cms = await getWebsiteCmsContent();
  return <AdminClient editionLabel={cms.site.editionLabel} />;
}
