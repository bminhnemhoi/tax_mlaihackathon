import type { HTMLAttributes, ReactElement } from 'react';
import { cn } from '@/lib/utils';

/** Page presentation retains the dialog's business content without a portal. */
export function PagePanel({className,...props}:HTMLAttributes<HTMLDivElement>):ReactElement {
  return <div className={cn('flex min-h-[480px] w-full flex-col overflow-hidden rounded-2xl border bg-card',className)} {...props}/>;
}
