import type { ReactElement } from 'react';

/** Visual feedback only; its owner supplies the actual processing state. */
export function InvoiceScanOverlay(): ReactElement {
  return <div aria-hidden="true" className="invoice-scan-overlay pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
    <div className="invoice-scan-beam absolute inset-0"><div className="invoice-scan-light" /></div>
  </div>;
}
