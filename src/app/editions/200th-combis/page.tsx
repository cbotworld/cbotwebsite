import { redirect } from 'next/navigation';
import { PUBLIC_COMBIS_PATH } from '@/lib/website-cms';

export default function Legacy200thCombisRedirect() {
  redirect(PUBLIC_COMBIS_PATH);
}
