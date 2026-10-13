import Link from 'next/link';
import type { ReactElement } from 'react';
export default function WorkspaceNotFound():ReactElement {
  return <main className="mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center gap-4 px-6"><h1 className="text-2xl font-semibold">Không tìm thấy trang</h1><p className="text-sm text-muted-foreground">Đường dẫn này không có trong workspace.</p><Link href="/workspace/inbox" className="text-sm font-medium underline">Về Thẩm định</Link></main>;
}
