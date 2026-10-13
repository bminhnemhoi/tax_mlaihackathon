import type { ReactElement } from 'react';
import type { InvoiceInput } from '@/lib/schemas';
import { formatVND, formatDate } from '@/lib/utils';

/** A presentation of extracted fields, never a replacement for the source. */
export function InvoiceDataSummary({invoice}:{invoice:InvoiceInput}):ReactElement {
  return <div className="mx-auto w-full max-w-2xl p-5 text-sm">
          {/* Header */}
          <div className="text-center border-b border-slate-200 pb-4 mb-4">
            <h2 className="text-xl font-medium text-slate-950 uppercase tracking-tight">
              Thông tin hóa đơn
            </h2>
            <div className="text-xs font-numeric font-medium text-slate-500 mt-1">
              Số: <strong className="text-slate-950 text-sm font-medium">{invoice.invoiceNumber}</strong> · Ngày: {formatDate(invoice.invoiceDate)}
            </div>
          </div>

          {/* Supplier Info - Rõ ràng, Chữ to */}
          <div className="space-y-2 text-sm border-b border-slate-200 pb-4 mb-4">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Đơn vị bán:</span>
              <span className="font-medium text-slate-950 uppercase text-right">{invoice.supplierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Mã số thuế:</span>
              <span className="font-numeric font-medium text-slate-950">{invoice.supplierTaxCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Thanh toán:</span>
              <span className="font-medium text-slate-800">
                {invoice.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : invoice.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chưa xác định'}
              </span>
            </div>
          </div>

          {/* Item details table */}
          <div className="mb-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 font-medium text-slate-700 uppercase">
                  <th className="p-2 w-8 text-center">#</th>
                  <th className="p-2">Hàng hóa / Dịch vụ</th>
                  <th className="p-2 w-12 text-center">SL</th>
                  <th className="p-2 w-24 text-right">Đơn giá</th>
                  <th className="p-2 w-28 text-right">Thành tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {invoice.items && invoice.items.length > 0 ? (
                  invoice.items.map((item, idx) => (
                    <tr key={idx} className={item.flaggedReason ? 'bg-amber-50/70 font-semibold' : ''}>
                      <td className="p-2 text-center font-numeric text-slate-500">{item.lineNumber || idx + 1}</td>
                      <td className="p-2 font-medium text-slate-900">
                        <div>{item.itemName}</div>
                        {item.flaggedReason && (
                          <span className="inline-block mt-0.5 text-[10px] text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                            {item.flaggedReason}
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-center font-numeric font-semibold">{item.quantity}</td>
                      <td className="p-2 text-right font-numeric font-semibold">{formatVND(item.unitPrice)}</td>
                      <td className="p-2 text-right font-numeric font-medium text-slate-950">{formatVND(item.amount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="p-2 text-center font-numeric text-slate-500">1</td>
                    <td className="p-2 font-medium text-slate-900">{invoice.itemName || 'Hàng hóa / Dịch vụ chung'}</td>
                    <td className="p-2 text-center font-numeric font-semibold">1</td>
                    <td className="p-2 text-right font-numeric font-semibold">{formatVND(invoice.totalAmount - (invoice.taxAmount || 0))}</td>
                    <td className="p-2 text-right font-numeric font-medium text-slate-950">{formatVND(invoice.totalAmount - (invoice.taxAmount || 0))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Totals Section - To, Rõ, Đậm số tiền */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 font-semibold">
              <span>Tiền chưa thuế:</span>
              <span className="font-numeric font-medium text-slate-900">
                {formatVND(invoice.totalAmount - (invoice.taxAmount || 0))}
              </span>
            </div>
            <div className="flex justify-between text-slate-600 font-semibold">
              <span>Thuế GTGT ({invoice.taxRate === undefined ? 'chưa rõ' : invoice.taxRate+'%'}):</span>
              <span className="font-numeric font-medium text-slate-900">{formatVND(invoice.taxAmount || 0)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-medium text-slate-950">
              <span>TỔNG THANH TOÁN:</span>
              <span className="font-numeric text-lg text-slate-950 font-semibold">{formatVND(invoice.totalAmount)}</span>
            </div>
          </div>

  </div>;
}
