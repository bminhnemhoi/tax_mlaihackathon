'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, ScanLine, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { PhoneInvoicePreview } from '@/components/PhoneInvoicePreview';
import { BrandMark } from '@/components/BrandMark';

interface CapturePhonePageProps { sessionId: string; token: string }

const MAX_BYTES = 15 * 1024 * 1024;
const supported = ['image/jpeg', 'image/png', 'image/webp'];

export function CapturePhonePage({ sessionId, token }: CapturePhonePageProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = 'Chụp hóa đơn · Tax Referee';
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const chooseFile = (selected?: File) => {
    if (!selected) return;
    if (!supported.includes(selected.type)) {
      toast.error('Chỉ nhận ảnh JPG, PNG hoặc WEBP.');
      return;
    }
    if (selected.size > MAX_BYTES) {
      toast.error('Ảnh vượt quá giới hạn 15 MB.');
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setSent(false);
  };

  const upload = async () => {
    if (!file || !token || busy) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append('token', token);
      form.append('file', file, file.name || 'hoa-don.jpg');
      const suffix = `?session=${encodeURIComponent(sessionId)}`;
      const request = fetch(`/api/capture-sessions/upload${suffix}`, { method: 'POST', body: form, cache: 'no-store' })
        .then(async (response) => ({ response, body: await response.json() }))
        .catch((error: unknown) => ({ error }));
      const result = await request;
      if ('error' in result) throw result.error;
      const { response, body } = result;
      if (!response.ok) {
        if (response.status === 422) throw new Error(body.error || 'Ảnh chưa giống hóa đơn. Hãy chụp lại.');
        if (response.status === 410) throw new Error('Mã chụp đã hết hạn. Hãy quét mã mới.');
        throw new Error(body.error || 'Không thể gửi ảnh.');
      }
      setSent(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Mất kết nối. Hãy thử lại.';
      toast.error(message.length > 90 ? 'Không gửi được ảnh. Hãy thử lại.' : message);
    } finally {
      setBusy(false);
    }
  };

  const retryPhoto = () => {
    setFile(null);
    setSent(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl('');
    // This click is called directly from the user's tap, preserving the
    // browser's user-gesture permission to open the rear camera immediately.
    cameraRef.current?.click();
  };

  if (!token) {
    return <main className="capture-phone-shell grid place-items-center overflow-hidden bg-background text-slate-900"><section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-none"><ScanLine className="mx-auto h-8 w-8 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">Liên kết không hợp lệ</h1><p className="mt-2 text-sm text-slate-600">Hãy tạo mã QR mới trên laptop.</p></section></main>;
  }

  return (
    <main className="capture-phone-shell overflow-hidden bg-background text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
        <header className="capture-phone-header flex shrink-0 items-center gap-2.5 border-b border-border pb-2">
          <BrandMark size={32} />
          <div><p className="text-sm font-semibold tracking-tight">Tax Referee</p><p className="text-xs text-slate-500">Chụp chứng từ</p></div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col pt-2.5">
          <div className="capture-phone-copy shrink-0">
            <h1 className="text-xl font-semibold leading-6 tracking-tight">Chụp hóa đơn</h1>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600">Chụp rõ, thẳng và đủ sáng.</p>
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />

          {previewUrl ? (
            <div className="mt-2.5 min-h-0 flex-1 overflow-hidden rounded-2xl bg-white p-1.5 shadow-none ring-1 ring-slate-200">
              <div className="flex h-full min-h-0 flex-col">
                <div className="min-h-0 flex-1"><PhoneInvoicePreview src={previewUrl} busy={busy} /></div>
                {file && <p className="shrink-0 truncate px-2 pt-1.5 text-xs leading-4 text-muted-foreground">{file.name} · {file.size<1024*1024?Math.ceil(file.size/1024)+' KB':(file.size/1024/1024).toFixed(1)+' MB'}</p>}
              </div>
            </div>
          ) : (
            <div className="mt-2.5 grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-border bg-white/70 px-5 text-center">
              <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-accent/40 text-foreground"><Camera className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium">Ảnh sẽ gửi vào laptop đang mở</p><p className="mt-1 text-xs text-slate-500">JPG, PNG hoặc WEBP · tối đa 15 MB</p></div>
            </div>
          )}

          {sent ? (
            <div className="mt-2 flex min-h-[98px] shrink-0 items-center gap-2 rounded-xl border border-border bg-accent/40 px-2.5 py-2">
              <Check className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="text-sm font-medium leading-5 text-foreground">Đã gửi ảnh</p><p className="text-xs leading-4 text-muted-foreground">Kiểm tra kết quả trên laptop</p></div>
              <button type="button" onClick={retryPhoto} aria-label="Chụp ảnh tiếp theo" className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-semibold text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Camera className="h-3.5 w-3.5" /><span>Chụp tiếp</span></button>
            </div>
          ) : (
            <div className="mt-2 grid min-h-[98px] shrink-0 gap-1.5">
              {!previewUrl ? (
                <>
                  <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Camera className="h-4 w-4" />Chụp ảnh</button>
                  <button type="button" onClick={() => galleryRef.current?.click()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><ImagePlus className="h-4 w-4" />Chọn ảnh có sẵn</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => void upload()} disabled={busy || !file} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? 'Đang gửi ảnh' : 'Gửi ảnh'}
                  </button>
                  <button type="button" onClick={retryPhoto} disabled={busy} className="flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-slate-600 transition-colors hover:bg-white active:scale-[0.99] disabled:opacity-50"><Camera className="h-3.5 w-3.5" />Chụp ảnh mới</button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
