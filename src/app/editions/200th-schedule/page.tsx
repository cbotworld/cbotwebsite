import { ScheduleClient } from './ScheduleClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export default async function BicentennialSchedulePage() {
  const cms = await getWebsiteCmsContent();
  return <ScheduleClient pageCms={cms.pages.schedule} />;
}
