'use client';
import type { ReactElement } from 'react';
import { ScreenState } from '@/components/workspace/ScreenState';
export default function WorkspaceError({reset}:{error:Error;reset:()=>void}):ReactElement {
  return <main className="workspace-content"><ScreenState error title="Không thể mở màn hình" description="Thử tải lại màn hình này." onRetry={reset}/></main>;
}
