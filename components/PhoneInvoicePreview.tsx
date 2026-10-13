'use client';
import type { ReactElement } from 'react';
import { InvoiceImageViewer } from '@/components/InvoiceImageViewer';

/** The same contained image and scan effect as the desktop viewer. */
export function PhoneInvoicePreview({src,busy}:{src:string;busy:boolean}):ReactElement {
  return <InvoiceImageViewer src={src} busy={busy} toolbar={false} alt="Ảnh hóa đơn đã chụp" className="overflow-hidden rounded-xl"/>;
}
