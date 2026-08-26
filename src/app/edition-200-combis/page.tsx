import { redirect } from 'next/navigation';
import { PUBLIC_COMBIS_PATH } from '@/lib/website-cms';

export default function LegacyEditionCombisRedirect() {
  redirect(PUBLIC_COMBIS_PATH);
}
