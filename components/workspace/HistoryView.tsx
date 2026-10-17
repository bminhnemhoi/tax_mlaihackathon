'use client';
import type { ReactElement } from 'react';

export type WorkspaceViewUser = { id: string; email: string; displayName: string; role: 'ACCOUNTANT' | 'CHIEF_ACCOUNTANT' | 'CFO' };

/** Lịch sử của tôi: khung màn hình, nội dung được bổ sung theo từng lát. */
export function HistoryView({ user }: { user: WorkspaceViewUser }): ReactElement {
  return <section className="rounded-xl border p-5 text-sm text-muted-foreground" aria-label="Lịch sử của tôi" data-user-role={user.role}>Lịch sử duyệt của bạn đang được xây dựng.</section>;
}
