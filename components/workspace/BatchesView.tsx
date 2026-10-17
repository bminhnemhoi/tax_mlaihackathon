'use client';
import type { ReactElement } from 'react';

export type WorkspaceViewUser = { id: string; email: string; displayName: string; role: 'ACCOUNTANT' | 'CHIEF_ACCOUNTANT' | 'CFO' };

/** Lô hóa đơn: khung màn hình, nội dung được bổ sung theo từng lát. */
export function BatchesView({ user }: { user: WorkspaceViewUser }): ReactElement {
  return <section className="rounded-xl border p-5 text-sm text-muted-foreground" aria-label="Lô hóa đơn" data-user-role={user.role}>Xử lý theo lô đang được xây dựng.</section>;
}
