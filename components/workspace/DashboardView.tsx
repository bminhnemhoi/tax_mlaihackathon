'use client';
import type { ReactElement } from 'react';

export type WorkspaceViewUser = { id: string; email: string; displayName: string; role: 'ACCOUNTANT' | 'CHIEF_ACCOUNTANT' | 'CFO' };

/** Tổng quan: khung màn hình, nội dung được bổ sung theo từng lát. */
export function DashboardView({ user }: { user: WorkspaceViewUser }): ReactElement {
  return <section className="rounded-xl border p-5 text-sm text-muted-foreground" aria-label="Tổng quan" data-user-role={user.role}>Dashboard cho Kế toán trưởng và CFO đang được xây dựng.</section>;
}
