import { WhatsAppButton } from '@/components/ui/WhatsAppButton';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export async function WhatsAppButtonWithCms() {
  const { site } = await getWebsiteCmsContent();
  return (
    <WhatsAppButton
      phoneNumber={site.whatsappNumber}
      message={site.whatsappMessage}
      contactName={site.founderName}
    />
  );
}
