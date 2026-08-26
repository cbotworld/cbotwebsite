import { redirect } from 'next/navigation';
import { PUBLIC_SCHEDULE_PATH } from '@/lib/website-cms';

export default function LegacyTestEditionScheduleRedirect() {
  redirect(PUBLIC_SCHEDULE_PATH);
}
