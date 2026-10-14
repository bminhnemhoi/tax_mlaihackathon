import { CapturePhonePage } from '@/components/CapturePhonePage';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Chụp hóa đơn · Tax Referee', referrer: 'no-referrer' };

export default async function CapturePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <CapturePhonePage sessionId={id} token={query.token || ''} />;
}
