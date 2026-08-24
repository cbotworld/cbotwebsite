import { Navbar } from '@/components/layout/Navbar';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function NavbarWithCms() {
  const cms = await getWebsiteCmsContent();
  return (
    <Navbar
      editionButtonLabel={cms.nav.editionButtonLabel}
      editionButtonHref={cms.nav.editionButtonHref}
    />
  );
}
