'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, ImagePlus, LoaderCircle, ScanLine, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

interface CapturePhonePageProps { sessionId: string; token: string; demoId: string }

const MAX_BYTES = 15 * 1024 * 1024;
const supported = ['image/jpeg', 'image/png', 'image/webp'];

export function CapturePhonePage({ sessionId, token, demoId }: CapturePhonePageProps) {
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
      const suffix = demoId ? `?demo=${encodeURIComponent(demoId)}` : '';
      const request = fetch(`/api/capture-sessions/upload${suffix}`, { method: 'POST', body: form, cache: 'no-store' })
        .then(async (response) => ({ response, body: await response.json() }))
        .catch((error: unknown) => ({ error }));
      const scanFloor = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? Promise.resolve()
        : new Promise<void>((resolve) => window.setTimeout(resolve, 1200));
      const [result] = await Promise.all([request, scanFloor]);
      if ('error' in result) throw result.error;
      const { response, body } = result;
      if (!response.ok) {
        if (response.status === 422) throw new Error('Ảnh chưa giống hóa đơn. Hãy chụp lại.');
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
    return <main className="grid h-[100dvh] place-items-center overflow-hidden bg-[#f4f7f4] px-5 text-slate-900"><section className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm"><ScanLine className="mx-auto h-8 w-8 text-emerald-800" /><h1 className="mt-4 text-lg font-semibold">Liên kết không hợp lệ</h1><p className="mt-2 text-sm text-slate-600">Hãy tạo mã QR mới trên laptop.</p></section></main>;
  }

  return (
    <main className="h-[100dvh] overflow-hidden bg-[#f4f7f4] px-3.5 pb-[max(.35rem,env(safe-area-inset-bottom))] pt-[max(.65rem,env(safe-area-inset-top))] text-slate-900">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
        <header className="flex shrink-0 items-center gap-2.5 border-b border-[#dce5de] pb-2">
          <div className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#183b2d] text-white"><ScanLine className="h-4 w-4" /></div>
          <div><p className="text-sm font-semibold tracking-tight">Tax Referee</p><p className="text-xs text-slate-500">Chụp chứng từ</p></div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col pt-2.5">
          <div className="shrink-0">
            <h1 className="text-xl font-semibold leading-6 tracking-tight">Chụp hóa đơn</h1>
            <p className="mt-0.5 text-[13px] leading-5 text-slate-600">Chụp rõ, thẳng và đủ sáng.</p>
          </div>

          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { chooseFile(event.target.files?.[0]); event.currentTarget.value = ''; }} />

          {previewUrl ? (
            <div className="mt-2.5 min-h-0 flex-1 overflow-hidden rounded-2xl bg-white p-1.5 shadow-sm ring-1 ring-slate-200">
              <div className="flex h-full min-h-0 flex-col">
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-[#17211d]">
                  <img src={previewUrl} alt="Ảnh hóa đơn đã chụp" className="block h-full w-full object-contain" />
                  {busy && <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl ring-1 ring-inset ring-white/35">
                    <div className="absolute inset-0 bg-emerald-950/[0.04]" />
                    <div className="phone-invoice-scan-beam absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(16,185,129,0.02)_47%,rgba(167,243,208,0.24)_49.2%,rgba(255,255,255,0.1)_50%,rgba(167,243,208,0.24)_50.8%,rgba(16,185,129,0.02)_53%,transparent_100%)]" />
                    <span className="phone-invoice-scan-glint absolute left-[18%] top-[25%] h-1.5 w-1.5 rotate-45 rounded-[1px] bg-white shadow-[0_0_8px_2px_rgba(167,243,208,0.65)]" />
                    <span className="phone-invoice-scan-glint absolute right-[20%] top-[58%] h-1 w-1 rotate-45 rounded-[1px] bg-emerald-50 shadow-[0_0_7px_2px_rgba(167,243,208,0.55)] [animation-delay:500ms]" />
                    <div className="absolute inset-2.5 rounded-lg border border-white/20" />
                    <span className="absolute left-2.5 top-2.5 h-4 w-4 rounded-tl-md border-l-2 border-t-2 border-emerald-100/90" />
                    <span className="absolute right-2.5 top-2.5 h-4 w-4 rounded-tr-md border-r-2 border-t-2 border-emerald-100/90" />
                    <span className="absolute bottom-2.5 left-2.5 h-4 w-4 rounded-bl-md border-b-2 border-l-2 border-emerald-100/90" />
                    <span className="absolute bottom-2.5 right-2.5 h-4 w-4 rounded-br-md border-b-2 border-r-2 border-emerald-100/90" />
                    <span className="sr-only" role="status">Đang xử lý ảnh hóa đơn</span>
                  </div>}
                </div>
                {file && <p className="shrink-0 truncate px-2 pt-1.5 text-[11px] leading-4 text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
              </div>
            </div>
          ) : (
            <div className="mt-2.5 grid min-h-0 flex-1 place-items-center rounded-2xl border border-dashed border-[#b9c9bd] bg-white/70 px-5 text-center">
              <div><span className="mx-auto grid h-12 w-12 place-items-center rounded-[14px] bg-[#e8f0ea] text-[#23543e]"><Camera className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium">Ảnh sẽ gửi vào laptop đang mở</p><p className="mt-1 text-xs text-slate-500">JPG, PNG hoặc WEBP · tối đa 15 MB</p></div>
            </div>
          )}

          {sent ? (
            <div className="mt-2 flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2">
              <Check className="h-4 w-4 shrink-0 text-emerald-800" />
              <div className="min-w-0 flex-1"><p className="text-xs font-semibold leading-4 text-emerald-900">Đã gửi ảnh</p><p className="truncate text-[11px] leading-4 text-emerald-800">Đang đọc trên laptop</p></div>
              <button type="button" onClick={retryPhoto} aria-label="Chụp ảnh tiếp theo" className="flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#183b2d] px-2.5 text-xs font-semibold text-white transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><Camera className="h-3.5 w-3.5" /><span>Chụp tiếp</span></button>
            </div>
          ) : (
            <div className="mt-2 grid shrink-0 gap-1.5">
              {!previewUrl ? (
                <>
                  <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#183b2d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#214b39] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><Camera className="h-4 w-4" />Chụp ảnh</button>
                  <button type="button" onClick={() => galleryRef.current?.click()} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"><ImagePlus className="h-4 w-4" />Chọn ảnh có sẵn</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => void upload()} disabled={busy || !file} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#183b2d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#214b39] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{busy ? 'Đang gửi ảnh' : 'Gửi ảnh'}
                  </button>
                  <button type="button" onClick={retryPhoto} disabled={busy} className="flex min-h-9 items-center justify-center gap-2 rounded-xl px-4 text-xs font-medium text-slate-600 transition-colors hover:bg-white active:scale-[0.99] disabled:opacity-50"><Camera className="h-3.5 w-3.5" />Chụp ảnh mới</button>
                </>
              )}
            </div>
          )}
        </section>
      </div>
      <Toaster position="top-left" offset={{ top: 'max(env(safe-area-inset-top), 12px)', left: 12 }} mobileOffset={{ top: 'max(env(safe-area-inset-top), 12px)', left: 12 }} />
    </main>
  );
}
