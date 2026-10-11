import Link from 'next/link';
import {DEFAULT_POLICY_CONFIG} from '@/lib/constants';
import {SystemPolicyConfigSchema} from '@/lib/schemas';
import {executablePolicySummary,implementedPolicyRules} from '@/data/policyContract';

export default function SopPage(){
 const config=SystemPolicyConfigSchema.parse(DEFAULT_POLICY_CONFIG);
 return <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 text-slate-900">
  <Link href="/verify" className="font-semibold underline">← Về Verify</Link>
  <h1 className="text-3xl font-bold">Quy trình xử lý và phân luồng Đề A</h1>
  <p className="text-sm text-slate-600">Bản tóm tắt cấu hình mặc định dùng trong Verify. Workspace nội bộ có policy riêng; mỗi lần đánh giá lưu snapshot policy và mã băm trong audit.</p>
  <section className="whitespace-pre-line rounded-xl border bg-white p-6 text-sm leading-7" aria-label="Tóm tắt SOP">{executablePolicySummary(config)}</section>
  <h2 className="text-xl font-semibold">Quy tắc đã triển khai và điều khoản tương ứng</h2>
  <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><caption className="sr-only">Ánh xạ quy tắc và điều khoản SOP</caption><thead><tr><th className="p-3">Quy tắc</th><th className="p-3">Nội dung</th><th className="p-3">Điều khoản</th></tr></thead><tbody>{implementedPolicyRules(config).map(r=><tr key={r.id} className="border-t"><th scope="row" className="break-all p-3 font-mono text-xs">{r.id}</th><td className="p-3">{r.label}</td><td className="p-3">{r.clause}</td></tr>)}</tbody></table></div>
 </main>;
}
