import type { ReactElement } from 'react';
import { FileText, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScreenStateProps { title: string; description?: string; error?: boolean; onRetry?: () => void }
export function ScreenState({ title, description, error, onRetry }: ScreenStateProps): ReactElement {
  const Icon = error ? AlertCircle : FileText;
  return <section className="screen-state" role={error ? 'alert' : undefined}>
    <Icon aria-hidden="true" className="h-6 w-6 text-muted-foreground" />
    <h2 className="text-base font-semibold">{title}</h2>
    {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {onRetry && <Button variant="outline" onClick={onRetry}>Thử lại</Button>}
  </section>;
}
export function WorkspaceSkeleton(): ReactElement {
  return <div className="space-y-5" role="status" aria-label="Đang tải dữ liệu">
    <div className="h-10 w-48 rounded-lg bg-muted animate-pulse" />
    <div className="h-14 rounded-xl bg-muted animate-pulse" />
    <div className="space-y-3 rounded-2xl border bg-card p-5">{[0,1,2,3,4].map(i => <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />)}</div>
  </div>;
}
