export const dynamic = 'force-dynamic';
import { ScheduleClient } from '../editions/200th-schedule/ScheduleClient';
import { getWebsiteCmsContent } from '@/lib/actions/websiteCmsActions';
import { PUBLIC_SCHEDULE_PATH } from '@/lib/website-cms';


export default async function SchedulePage() {
  const cms = await getWebsiteCmsContent();
  return <ScheduleClient pageCms={cms.pages.schedule} />;
}

export const metadata = {
  alternates: { canonical: PUBLIC_SCHEDULE_PATH },
};
