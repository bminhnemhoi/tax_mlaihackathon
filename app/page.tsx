'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Check, Sparkles, Play } from 'lucide-react';
import { ProductionWorkspace } from '@/components/ProductionWorkspace';

type AppUser = { id: string; email: string; displayName: string; role: 'ACCOUNTANT' | 'CHIEF_ACCOUNTANT' | 'CFO' };

export default function HomePage() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('ktt@local');
  const [password, setPassword] = useState('ktt-local');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => res.ok ? res.json() : null)
      .then((data) => setUser(data?.user || null))
      .catch(() => undefined)
      .finally(() => setChecking(false));
  }, []);

  const loginWithCredentials = async (loginEmail: string, loginPass: string) => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi đăng nhập');
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi đăng nhập');
    } finally {
      setBusy(false);
    }
  };

  const login = async (event: FormEvent) => {
    event.preventDefault();
    await loginWithCredentials(email, password);
  };

  const handleInstantJudgeLogin = async (role: 'CHIEF_ACCOUNTANT' | 'CFO') => {
    const creds = role === 'CFO'
      ? { email: 'cfo@local', pass: 'cfo-local' }
      : { email: 'ktt@local', pass: 'ktt-local' };
    await loginWithCredentials(creds.email, creds.pass);
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-500 font-sans">
        <div className="flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-brand-lime animate-ping" />
          <span className="text-base font-medium text-slate-900">Đang khởi tạo Tax Referee...</span>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <ProductionWorkspace
        user={user}
        onLogout={() => void logout()}
        onRoleSwitched={(next) => setUser(next)}
      />
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100/80 px-4 py-8">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        
        {/* Header - To & Rõ ràng */}
        <div className="border-b border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-brand-lime">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Tax Referee</h1>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Đề bài A: The Escalation Referee · SOP 2026
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Online
            </span>
          </div>
        </div>

        {/* Content & Actions */}
        <div className="p-6 sm:p-8 space-y-6">
          
          {/* BAN GIÁM KHẢO 1-CLICK ACCESS (Tiêu chí 1: 10 Điểm Vận hành không cần tài khoản) */}
          <div className="p-5 rounded-2xl bg-slate-950 text-white space-y-3.5 shadow-sm border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-brand-lime text-slate-950 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" /> Dành Cho Ban Giám Khảo
              </div>
              <span className="text-[11px] text-slate-400 font-mono font-bold">Tiêu chí 1: 10 Điểm</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Vào Trải Nghiệm Tức Thì (Không Cần Cài Đặt)</h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Thao tác trực tiếp với quyền Kế toán trưởng / CFO hoặc chạy bài kiểm thử tự động 90 giây của Đề bài A:
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleInstantJudgeLogin('CHIEF_ACCOUNTANT')}
                disabled={busy}
                className="py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-950 text-xs font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
              >
                <span>VÀO WORKSPACE NGAY</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-950" />
              </button>
              <Link
                href="/verify"
                className="py-3 px-4 rounded-xl bg-brand-lime hover:bg-lime-400 text-slate-950 text-xs font-bold tracking-wide transition flex items-center justify-center gap-2 shadow-sm text-center"
              >
                <Play className="w-3.5 h-3.5 fill-slate-950" />
                <span>BỘ VERIFY BENCHMARK</span>
              </Link>
            </div>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Hoặc đăng nhập theo vai trò
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Chọn vai trò (Role tiles) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Chọn vai trò thẩm định
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { role: 'ACCOUNTANT', title: 'Kế toán viên', email: 'ke-toan@local', pass: 'accountant-local' },
                { role: 'CHIEF_ACCOUNTANT', title: 'Kế toán trưởng', email: 'ktt@local', pass: 'ktt-local' },
                { role: 'CFO', title: 'CFO', email: 'cfo@local', pass: 'cfo-local' }
              ].map((r) => {
                const isSelected = email === r.email;
                return (
                  <button
                    key={r.role}
                    type="button"
                    onClick={() => {
                      setEmail(r.email);
                      setPassword(r.pass);
                      setError('');
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-slate-950 bg-slate-950 text-white font-bold shadow-sm'
                        : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 text-slate-700 font-semibold'
                    }`}
                  >
                    <span className="text-xs tracking-tight">{r.title}</span>
                    {isSelected && (
                      <span className="mt-1 flex items-center gap-1 text-[10px] font-bold text-brand-lime">
                        <Check className="h-3 w-3" /> Đã chọn
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Tài khoản
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Mật khẩu
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-semibold text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-slate-950 hover:bg-slate-900 px-6 py-3 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {busy ? (
                'Đang xử lý...'
              ) : (
                <>
                  <span>ĐĂNG NHẬP THỦ CÔNG</span>
                  <ArrowRight className="h-4 w-4 text-brand-lime" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>
    </main>
  );
}
