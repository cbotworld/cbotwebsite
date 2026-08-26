import { Navbar } from '@/components/layout/Navbar';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function NavbarWithCms() {
  const cms = await getWebsiteCmsContent();
  return (
    <Navbar
      editionButtonLabel={cms.nav.editionButtonLabel}
      editionButtonHref={cms.nav.editionButtonHref}
      combisLabel={cms.nav.combisLabel}
      combisHref={cms.nav.combisHref}
      scheduleLabel={cms.nav.scheduleLabel}
      scheduleHref={cms.nav.scheduleHref}
      brandName={cms.site.brandName}
      brandTagline={cms.site.brandTagline}
    />
  );
}
