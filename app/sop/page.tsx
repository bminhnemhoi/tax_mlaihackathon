import Link from 'next/link';
import type { ReactElement } from 'react';
import { DEFAULT_POLICY_CONFIG } from '@/lib/constants';
import { SystemPolicyConfigSchema } from '@/lib/schemas';
import { executablePolicySummary, policyRuleMatrix } from '@/data/policyContract';
import { PolicyRuleReference } from '@/components/PolicyRuleReference';

export default function SopPage():ReactElement {
  const config=SystemPolicyConfigSchema.parse(DEFAULT_POLICY_CONFIG);
  return <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
    <Link href="/verify" className="text-sm text-muted-foreground hover:text-foreground">← Về Verify</Link>
    <header><h1 className="text-3xl font-semibold tracking-tight">Quy trình xử lý hóa đơn</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Cấu hình mặc định dùng trong Verify. Mỗi hồ sơ lưu riêng phiên bản quy chế đã áp dụng.</p></header>
    <nav className="flex gap-5 text-sm" aria-label="Mục lục SOP"><a href="#overview" className="underline underline-offset-4">Tóm tắt</a><a href="#rules" className="underline underline-offset-4">Quy tắc</a></nav>
    <section id="overview" className="space-y-4 rounded-2xl border bg-card p-5 sm:p-6"><h2 className="text-xl font-semibold">Phân luồng theo vấn đề</h2><dl className="grid gap-5 sm:grid-cols-2"><div><dt className="text-sm font-semibold">Thường quy</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">Đủ dữ kiện, không có phát hiện: tự xử lý theo SOP.</dd></div><div><dt className="text-sm font-semibold">Thông tin chưa rõ</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">Kế toán trưởng đối chiếu và bổ sung bằng chứng.</dd></div><div><dt className="text-sm font-semibold">Ngoài chính sách</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">Làm rõ, bổ sung hoặc quyết định phương án xử lý.</dd></div><div><dt className="text-sm font-semibold">Vượt thẩm quyền</dt><dd className="mt-1 text-sm leading-6 text-muted-foreground">Chuyển CFO; các vấn đề dữ liệu và luật định vẫn được giữ.</dd></div></dl><details className="border-t pt-4"><summary className="cursor-pointer text-sm font-medium">Toàn bộ mô tả thực thi</summary><div className="mt-4 whitespace-pre-line text-sm leading-7">{executablePolicySummary(config)}</div></details></section>
    <PolicyRuleReference rules={policyRuleMatrix(config)}/>
  </main>;
}
