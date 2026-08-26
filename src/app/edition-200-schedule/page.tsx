import { ScheduleClient } from '../editions/200th-schedule/ScheduleClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';

export default async function Edition200SchedulePage() {
  const cms = await getWebsiteCmsContent();
  return <ScheduleClient pageCms={cms.pages.schedule} />;
}
