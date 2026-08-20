import { Footer } from '@/components/layout/Footer';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function FooterWithCms() {
  const cms = await getWebsiteCmsContent();
  return <Footer footerCms={cms.footer} />;
}
