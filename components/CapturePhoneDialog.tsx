'use client';
import Image from 'next/image';

import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Camera, Check, Clock3, LoaderCircle, RotateCw, Smartphone } from 'lucide-react';
import { DocumentExtraction } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle
} from '@/components/ui/dialog';

type CaptureStatus = 'WAITING' | 'UPLOADED' | 'PROCESSING' | 'READY' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
type Session = { id: string; captureUrl: string; expiresAt: string };

interface CapturePhoneDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProcessingStart: (artifactId: string) => void;
  onProcessingEnd: () => void;
  onExtraction: (result: DocumentExtraction) => boolean | void;
}

const copy: Record<CaptureStatus, string> = {
  WAITING: 'Đang chờ điện thoại quét mã',
  UPLOADED: 'Đã nhận ảnh, đang chuẩn bị đọc',
  PROCESSING: 'Đang đọc hóa đơn',
  READY: 'Đã đọc xong hóa đơn',
  FAILED: 'Chưa đọc được ảnh',
  EXPIRED: 'Mã QR đã hết hạn',
  CANCELLED: 'Phiên chụp đã hủy'
};

export function CapturePhoneDialog({ open, onOpenChange, onProcessingStart, onProcessingEnd, onExtraction }: CapturePhoneDialogProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [qrImage, setQrImage] = useState('');
  const [status, setStatus] = useState<CaptureStatus>('WAITING');
  const [secondsLeft, setSecondsLeft] = useState(600);
  const processingRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const pollErrorShownRef = useRef(false);
  const failureToastShownRef = useRef(false);

  const createSession = useCallback(async () => {
    setQrImage('');
    setSession(null);
    sessionRef.current = null;
    processingRef.current = false;
    pollErrorShownRef.current = false;
    failureToastShownRef.current = false;
    setStatus('WAITING');
    const response = await fetch('/api/capture-sessions', { method: 'POST', cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Không thể tạo mã QR.');
    const next: Session = { id: body.id, captureUrl: body.captureUrl, expiresAt: body.expiresAt };
    const dataUrl = await QRCode.toDataURL(next.captureUrl, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#172b25', light: '#ffffff' }
    });
    sessionRef.current = next;
    setSession(next);
    setQrImage(dataUrl);
    setSecondsLeft(Math.max(0, Math.ceil((Date.parse(next.expiresAt) - Date.now()) / 1000)));
  }, []);

  useEffect(() => {
    if (!open) return;
    void createSession().catch(() => {
      setStatus('FAILED');
      toast.error('Không thể tạo mã QR.');
    });
  }, [open, createSession]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((Date.parse(session.expiresAt) - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [open, session]);

  useEffect(() => {
    // Keep polling while the dialog is hidden: after an upload we close the
    // QR dialog automatically, but the same 10-minute session remains active
    // so the phone can send a follow-up photo.
    if (!session) return;
    let stopped = false;
    let timer = 0;
    const poll = async () => {
      if (stopped) return;
      try {
        const response = await fetch(`/api/capture-sessions/${session.id}`, { cache: 'no-store' });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Không thể kiểm tra phiên chụp.');
        pollErrorShownRef.current = false;
        const nextStatus = body.status as CaptureStatus;
        setStatus(nextStatus);
        if (nextStatus === 'UPLOADED' && body.artifactId && !processingRef.current) {
          processingRef.current = true;
          void processArtifact(session, String(body.artifactId));
        } else if (nextStatus === 'EXPIRED') {
          toast.info('Mã QR đã hết hạn.');
        } else if (nextStatus === 'FAILED') {
          if (!failureToastShownRef.current) {
            failureToastShownRef.current = true;
            toast.error('Không đọc được ảnh. Hãy thử ảnh khác.');
          }
        }
        if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(nextStatus)) return;
      } catch (cause) {
        if (!stopped && !pollErrorShownRef.current) {
          pollErrorShownRef.current = true;
          toast.error('Mất kết nối. Đang thử lại.');
        }
      }
      if (!stopped) timer = window.setTimeout(poll, 2000);
    };
    const processArtifact = async (activeSession: Session, artifactId: string) => {
      try {
        const start = await fetch(`/api/capture-sessions/${activeSession.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'PROCESSING' })
        });
        if (!start.ok) throw new Error((await start.json()).error || 'Phiên chụp không còn hoạt động.');
        setStatus('PROCESSING');
        onProcessingStart(artifactId);
        setQrImage('');
        onOpenChange(false);
        const response = await fetch('/api/documents/parse', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ artifactId })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Không thể đọc ảnh hóa đơn.');
        const complete = await fetch(`/api/capture-sessions/${activeSession.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'READY' })
        });
        if (!complete.ok) throw new Error((await complete.json()).error || 'Không thể hoàn tất phiên chụp.');
        setStatus('READY');
        const recognized = onExtraction(result as DocumentExtraction);
        if (recognized !== false) toast.success('Đã điền dữ liệu hóa đơn.');
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'Không thể đọc ảnh hóa đơn.';
        failureToastShownRef.current = true;
        toast.error('Không đọc được ảnh. Hãy thử ảnh khác.');
        setStatus('FAILED');
        await fetch(`/api/capture-sessions/${activeSession.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'FAILED', error: message })
        }).catch(() => undefined);
      } finally {
        processingRef.current = false;
        onProcessingEnd();
      }
    };
    void poll();
    return () => { stopped = true; window.clearTimeout(timer); };
  }, [session, onProcessingStart, onProcessingEnd, onExtraction,onOpenChange]);

  const close = async (nextOpen: boolean) => {
    if (!nextOpen && sessionRef.current && status === 'WAITING' && !processingRef.current) {
      await fetch(`/api/capture-sessions/${sessionRef.current.id}`, { method: 'DELETE' }).catch(() => undefined);
      setStatus('CANCELLED');
    }
    if (!nextOpen && !processingRef.current) {
      setSession(null);
      setQrImage('');
      sessionRef.current = null;
      setStatus('CANCELLED');
    }
    onOpenChange(nextOpen);
  };

  const retry = async () => {
    try { await createSession(); }
    catch {
      setStatus('FAILED');
      toast.error('Không thể tạo mã QR.');
    }
  };

  const finished = status === 'READY';
  const retryable = ['FAILED', 'EXPIRED', 'CANCELLED'].includes(status);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { void close(nextOpen); }}>
      <DialogContent className="w-[min(calc(100vw-32px),760px)] max-w-[760px] gap-0 overflow-y-auto rounded-2xl p-0">
        <div className="grid md:grid-cols-[1fr_290px]">
          <section className="p-5 sm:p-7">
            <DialogHeader>
              <DialogTitle className="text-xl tracking-tight">Chụp hóa đơn bằng điện thoại</DialogTitle>
              <DialogDescription className="mt-2 max-w-md text-sm font-normal leading-6">
                Quét mã QR, chụp ảnh hóa đơn rồi gửi. Có thể chụp tiếp trong cùng phiên.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7 flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-800">
                {status === 'PROCESSING' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : finished ? <Check className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
              </span>
              <div>
                <p aria-live="polite" className="text-sm font-semibold text-slate-900">{copy[status]}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {status === 'WAITING' && 'Mã QR hoạt động trong 10 phút cho phiên này.'}
                  {status === 'UPLOADED' && 'Đang chuẩn bị nhận diện thông tin.'}
                  {status === 'PROCESSING' && 'Có thể mất vài giây tùy chất lượng ảnh.'}
                  {status === 'READY' && 'Ảnh đã điền vào biểu mẫu; mã vẫn nhận ảnh tiếp theo.'}
                  {status === 'FAILED' && 'Kiểm tra lại ảnh hoặc tạo mã mới để thử lại.'}
                  {status === 'EXPIRED' && 'Tạo mã mới để tiếp tục.'}
                  {status === 'CANCELLED' && 'Tạo mã mới nếu bạn muốn chụp ảnh khác.'}
                </p>
              </div>
            </div>

            {retryable && <Button type="button" onClick={() => void retry()} className="mt-5 gap-2 bg-slate-900 text-white hover:bg-slate-800"><RotateCw className="h-4 w-4" />Tạo mã mới</Button>}

            <div className="mt-8 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <Camera className="h-4 w-4 shrink-0" />
              <span>Chụp rõ toàn bộ hóa đơn, tránh bóng và nghiêng ảnh.</span>
            </div>
          </section>

          <aside className="flex flex-col items-center justify-center border-t border-slate-100 bg-muted/40 p-5 md:border-l md:border-t-0">
            {qrImage ? <Image src={qrImage} alt="Mã QR để mở camera trên điện thoại" width={224} height={224} unoptimized className="h-56 w-56 rounded-xl border border-slate-200 bg-white p-2" /> : (
              <div className="grid h-56 w-56 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <LoaderCircle className="h-6 w-6 animate-spin" />
              </div>
            )}
            {session&&qrImage&&<a href={session.captureUrl} target="_blank" rel="noopener noreferrer" className="mt-3 text-xs text-muted-foreground underline underline-offset-4">Mở trang chụp</a>}
            <div className="mt-4 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <Clock3 className="h-3.5 w-3.5" />
              {secondsLeft > 0 ? `Mã hết hạn sau ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}` : 'Mã đã hết hạn'}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
