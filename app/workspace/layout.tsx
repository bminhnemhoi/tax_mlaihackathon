import type { ReactElement, ReactNode } from 'react';
import { WorkspaceSession } from '@/components/workspace/WorkspaceSession';

export const dynamic = 'force-dynamic';
export default function WorkspaceLayout({children}:{children:ReactNode}):ReactElement {
  return <WorkspaceSession>{children}</WorkspaceSession>;
}
