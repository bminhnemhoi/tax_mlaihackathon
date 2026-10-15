'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, FileCheck2, Scale, Edit3, Calendar, Save, RotateCcw, Sparkles, CheckCircle2, Clock, FileText, AlertCircle, Sliders, ShieldAlert, SlidersHorizontal, BookmarkCheck, Trash2, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { INITIAL_POLICY_METADATA, PolicyVersionMetadata } from '@/data/sopText';
import { GOVERNMENT_REGULATORY_REGISTRY, getApplicableRegulations } from '@/data/regulatoryRegistry';
import { DEFAULT_POLICY_CONFIG } from '@/lib/constants';
import { CorporatePrecedent, LegalUpdateCandidate, SystemPolicyConfig, SystemPolicyConfigSchema } from '@/lib/schemas';
import { formatVND } from '@/lib/utils';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PagePanel } from '@/components/workspace/PagePanel';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

interface PolicyViewerModalProps {
  presentation?: 'dialog' | 'page';
  isOpen: boolean;
  onClose: () => void;
  onPolicyUpdated?: (newVersion: string) => void;
  onConfigUpdated?: (config: SystemPolicyConfig) => void;
}

const DEFAULT_CONFIG: SystemPolicyConfig = DEFAULT_POLICY_CONFIG;

export const PolicyViewerModal: React.FC<PolicyViewerModalProps> = ({
  isOpen,
  onClose,
  onPolicyUpdated,
  onConfigUpdated
  , presentation = 'dialog'
}) => {
  const pathname=usePathname(); const router=useRouter(); const params=useSearchParams();
  const [activeTab, setActiveTab] = useState<'VIEW' | 'STUDIO' | 'EDIT' | 'TIMELINE' | 'LEGAL' | 'PRECEDENTS'>('STUDIO');
  useEffect(()=>{if(presentation!=='page')return;const tab=params.get('tab');setActiveTab(tab==='VIEW'||tab==='EDIT'||tab==='TIMELINE'||tab==='LEGAL'||tab==='PRECEDENTS'?tab:'STUDIO');},[params,presentation]);
  const Content=presentation==='page'?PagePanel:DialogContent;
  const [policyMetadata, setPolicyMetadata] = useState<PolicyVersionMetadata>(INITIAL_POLICY_METADATA);
  const [editableText, setEditableText] = useState<string>('');
  const [policyValidation,setPolicyValidation]=useState<{valid:boolean;errors:string[];changes:Array<{invoiceId:string;before:string;after:string;beforeRole:string;afterRole:string}>;parameterChanges:string[]}|null>(null);
  const [changeLogNote, setChangeLogNote] = useState<string>('');
  const [pendingPolicyVersion, setPendingPolicyVersion] = useState<string | null>(null);
  const [pendingDrafts, setPendingDrafts] = useState<Array<{version:string;createdByName:string|null;createdAt:string;loosening:string[]}>>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [legalUpdates, setLegalUpdates] = useState<LegalUpdateCandidate[]>([]);
  const [isSyncingLegal, setIsSyncingLegal] = useState(false);

  // Precedents State
  const [precedents, setPrecedents] = useState<CorporatePrecedent[]>([]);
  const [isLoadingPrecedents, setIsLoadingPrecedents] = useState(false);

  // Dynamic Policy Config State
  const [dynamicConfig, setDynamicConfig] = useState<SystemPolicyConfig>(DEFAULT_CONFIG);
  useEffect(()=>{setPendingPolicyVersion(null);setPolicyValidation(null);},[dynamicConfig,editableText]);

  // Inspector ngày lập hóa đơn để tra cứu pháp luật theo thời gian
  const [testDate, setTestDate] = useState<string>('2026-08-10');
  const [temporalResult, setTemporalResult] = useState(() => getApplicableRegulations('2026-08-10'));

  const loadPrecedents = async () => {
    setIsLoadingPrecedents(true);
    try {
      const response = await fetch('/api/precedents');
      const data = await response.json();
      setPrecedents(data.precedents || []);
    } catch (e) {
      console.error('Failed to load precedents:', e);
    } finally {
      setIsLoadingPrecedents(false);
    }
  };

  const handleRevokePrecedent = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi tiền lệ này? Các hóa đơn tương tự sau này sẽ phải chuyển trình duyệt thay vì tự động chấp thuận theo tiền lệ.')) {
      return;
    }
    try {
      const res = await fetch(`/api/precedents?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Đã thu hồi tiền lệ thành công.');
        void loadPrecedents();
      } else {
        toast.error('Không thể thu hồi tiền lệ.');
      }
    } catch (e) {
      toast.error('Không thể thu hồi tiền lệ.');
    }
  };

  // Load the active policy from the server. Browser storage is not authoritative.
  useEffect(() => {
    if (!isOpen) return;
    void loadLegalUpdates();
    void loadPrecedents();
    fetch('/api/policy')
      .then((response) => response.json())
      .then((data) => {
        setPendingDrafts(data.pendingDrafts || []);
        const active = data.active;
        if (active?.version) {
          setPolicyMetadata((previous) => ({ ...previous, version: active.version, releaseDate: active.effectiveFrom, text: data.executableText || active.policyText || previous.text }));
          setEditableText(data.notes || '');
        }
        const valid = SystemPolicyConfigSchema.safeParse(active?.config);
        if (valid.success) setDynamicConfig(valid.data);
      })
      .catch((error) => console.warn('Không thể tải policy server-side', error));
  }, [isOpen]);

  // Handle tra cứu ngày
  const handleDateChange = (newDate: string) => {
    setTestDate(newDate);
    setTemporalResult(getApplicableRegulations(newDate));
  };

  const loadLegalUpdates = async () => {
    const response = await fetch('/api/legal-updates');
    if (response.ok) {
      const data = await response.json();
      setLegalUpdates(data.updates || []);
    }
  };

  const handleSyncLegal = async () => {
    setIsSyncingLegal(true);
    try {
      const response = await fetch('/api/legal-updates', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể đồng bộ nguồn pháp lý');
      await loadLegalUpdates();
      if (data.errors?.length) {
        toast.warning(`Đã đồng bộ nhưng có ${data.errors.length} nguồn lỗi.`);
      } else {
        toast.success(`Đã kiểm tra nguồn pháp lý: phát hiện ${data.found || 0} bản cập nhật.`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đồng bộ nguồn pháp lý');
    } finally {
      setIsSyncingLegal(false);
    }
  };

  // Lưu cấu hình động (Dynamic Policy Studio)
  const handleSaveDynamicConfig = async () => {
    setIsSaving(true);
    try {
      if (!pendingPolicyVersion) {
        const response = await fetch('/api/policy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config: dynamicConfig, policyNotes: editableText, sourceDocumentVersions: ['TAX-SOP-2026'] })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Không thể tạo policy draft');
        setPendingPolicyVersion(data.policy.version);
        const checked=await fetch('/api/policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'validate',version:data.policy.version})});
        const validation=await checked.json();if(!checked.ok)throw new Error(validation.error);
        setPolicyValidation(validation);
        if(!validation.valid)toast.error('Bản nháp chưa đạt kiểm tra. Xem chi tiết trước khi sửa.');
        toast.info(`Đã tạo bản nháp ${data.policy.version}. Bấm lại để duyệt và áp dụng.`);
      } else {
        await publishVersion(pendingPolicyVersion);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể lưu policy');
    } finally {
      setIsSaving(false);
    }
  };

  // Công bố một bản nháp. Bản nháp làm lỏng kiểm soát cần CFO khác người soạn duyệt (nguyên tắc bốn mắt) — server quyết định.
  const publishVersion = async (version: string) => {
    const response = await fetch('/api/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'publish', version, reason: 'Đã kiểm tra cấu hình trên Policy Studio' })
    });
    const data = await response.json();
    if (response.status === 403 && data.needsSecondApprover) {
      fetch('/api/policy').then(r => r.json()).then(d => setPendingDrafts(d.pendingDrafts || [])).catch(() => undefined);
      setPendingPolicyVersion(null);
      toast.warning(`${data.error} Bản nháp ${version} đã nằm trong mục "Bản nháp chờ duyệt".`, { duration: 9000 });
      return;
    }
    if (!response.ok) throw new Error(data.error || 'Không thể publish policy');
    setPendingPolicyVersion(null);
    setPendingDrafts(drafts => drafts.filter(d => d.version !== version));
    onConfigUpdated?.(data.policy.config);
    onPolicyUpdated?.(data.policy.version);
    setDynamicConfig(data.policy.config);
    setPolicyMetadata((previous) => ({ ...previous, version: data.policy.version, releaseDate: data.policy.effectiveFrom, text: data.policy.policyText || previous.text }));
    toast.success(`Đã duyệt và áp dụng ${data.policy.version} thành công.`);
  };

  // Khôi phục cấu hình chuẩn 2026
  const handleResetDynamicConfig = () => {
    setDynamicConfig(DEFAULT_CONFIG);
    setPendingPolicyVersion(null);
    toast.info('Đã khôi phục cấu hình chuẩn 2026 (Ngưỡng 5M, KTT 200M). Bấm lưu để áp dụng.');
  };

  // Lưu văn bản quy chế mới
  const handleSavePolicyText = async () => {
    try {
      const notes=editableText+(changeLogNote.trim()?`\nGhi chú sửa đổi: ${changeLogNote.trim()}`:'');
      setChangeLogNote('');
      const response = await fetch('/api/policy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: dynamicConfig, policyNotes: notes, sourceDocumentVersions: ['TAX-SOP-2026'] })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể tạo policy draft');
      setPendingPolicyVersion(data.policy.version);
      const checked=await fetch('/api/policy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'validate',version:data.policy.version})});
      const validation=await checked.json();if(!checked.ok)throw new Error(validation.error);setPolicyValidation(validation);
      toast.success(`Đã tạo bản nháp ${data.policy.version}. Duyệt tại Policy Studio để kích hoạt.`);
      setActiveTab('VIEW');
    } catch (e) {
      toast.error('Không thể lưu quy chế mới vào bộ nhớ.');
    }
  };

  // Khôi phục quy chế văn bản chuẩn
  const handleResetPolicyText = () => {
    setEditableText('');
    setPendingPolicyVersion(null);
    toast.info('Đã khôi phục bản gốc chuẩn v2.5 vào trình soạn thảo.');
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} modal={presentation!=='page'} onOpenChange={(open) => !open && onClose()}>
      <Content className={presentation==='page'?'w-full p-0':'max-w-5xl h-[90dvh] flex flex-col p-0 overflow-hidden bg-card border text-foreground shadow-modal'}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50/80 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-slate-900 text-white rounded-xl shadow-none shrink-0">
              <Scale className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base font-semibold text-slate-900 tracking-tight whitespace-nowrap">
                  Quy chế thuế
                </DialogTitle>
                <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-medium shrink-0">
                  {policyMetadata.version} · Hiệu lực
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                Mã SOP: TAX-SOP-2026 · Ngưỡng TM: {formatVND(dynamicConfig.nonCashThreshold)} · Hạn mức KTT: {formatVND(dynamicConfig.kttApprovalLimit)}
              </p>
            </div>
          </div>

          {/* Tab Selection */}
          <Tabs value={activeTab} onValueChange={(val) => {
            const nextTab = val as typeof activeTab;
            setActiveTab(nextTab);
            if(presentation==='page'){const query=new URLSearchParams(params.toString());query.set('tab',nextTab);router.replace(pathname+'?'+query.toString(),{scroll:false});}
            if (nextTab === 'LEGAL') void loadLegalUpdates();
            if (nextTab === 'PRECEDENTS') void loadPrecedents();
          }} className="shrink-0 max-w-full">
            <TabsList className="bg-slate-100/90 border border-slate-200 h-9 p-1 flex items-center overflow-x-auto">
              <TabsTrigger value="STUDIO" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Tham số</span>
              </TabsTrigger>
              <TabsTrigger value="VIEW" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Toàn văn</span>
              </TabsTrigger>
              <TabsTrigger value="EDIT" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <Edit3 className="w-3.5 h-3.5" />
                <span>Ghi chú</span>
              </TabsTrigger>
              <TabsTrigger value="TIMELINE" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <Clock className="w-3.5 h-3.5" />
                <span>Thời điểm</span>
              </TabsTrigger>
              <TabsTrigger value="LEGAL" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Luật mới</span>
              </TabsTrigger>
              <TabsTrigger value="PRECEDENTS" className="flex items-center gap-1.5 px-3 py-1 text-xs whitespace-nowrap">
                <BookmarkCheck className="w-3.5 h-3.5" />
                <span>Tiền lệ ({precedents.length})</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Body Content by Tab */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* TAB 0: DYNAMIC POLICY STUDIO */}
          {activeTab === 'STUDIO' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-slate-800" />
                    Tham số thực thi
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Điều chỉnh tham số để tạo bản nháp kiểm tra trước khi phê duyệt áp dụng chính thức.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleResetDynamicConfig}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors border border-slate-200 shadow-none cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 text-slate-500" />
                    <span>Chuẩn 2026</span>
                  </button>
                  <button
                    onClick={handleSaveDynamicConfig}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-none transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSaving ? 'Đang lưu...' : pendingPolicyVersion ? 'Duyệt & Áp dụng' : 'Tạo bản nháp'}</span>
                  </button>
                </div>
              </div>

              {pendingDrafts.length>0&&<div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm" data-testid="pending-drafts">
                <p className="font-semibold text-amber-900">Bản nháp chờ duyệt · nguyên tắc bốn mắt</p>
                <p className="mt-1 text-xs text-amber-800">Bản nháp làm lỏng kiểm soát chỉ được công bố khi một CFO khác người soạn duyệt. Bản nháp chặt hơn hoặc trung tính thì người soạn tự công bố được.</p>
                {pendingDrafts.map(d=><div key={d.version} className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><p className="font-medium text-slate-900">{d.version}</p>
                    <p className="text-xs text-slate-600">Người soạn: {d.createdByName||'không rõ'} · {new Date(d.createdAt).toLocaleString('vi-VN')}</p>
                    <p className="mt-1 text-xs text-slate-700">{d.loosening.length?`Nới lỏng: ${d.loosening.join('; ')}`:'Không nới lỏng tham số kiểm soát.'}</p></div>
                  <button onClick={()=>{setIsSaving(true);publishVersion(d.version).catch(e=>toast.error(e instanceof Error?e.message:'Không thể công bố')).finally(()=>setIsSaving(false));}} disabled={isSaving} className="shrink-0 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60">Duyệt & áp dụng</button>
                </div>)}
              </div>}
              {/* Grid 4 Control Cards */}
              {policyValidation&&<details open className="rounded-xl border border-slate-200 p-4 text-sm"><summary className="cursor-pointer font-semibold">Kiểm tra bản nháp · {policyValidation.valid?'Đạt':'Chưa đạt'} · {policyValidation.changes.length} hồ sơ đổi kết quả</summary>
                <p className="mt-2 text-xs text-slate-600">Tham số đổi: {policyValidation.parameterChanges.join(', ')||'Không có'}.</p>
                {policyValidation.errors.map(error=><p key={error} className="mt-1 text-sm text-red-700">{error}</p>)}
                {policyValidation.changes.map(change=><p key={change.invoiceId} className="mt-2 text-xs">{change.invoiceId}: {change.before} ({change.beforeRole}) → {change.after} ({change.afterRole})</p>)}</details>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Knob 1: Non-cash Threshold */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-none">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      1. Ngưỡng TT không dùng tiền mặt
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-900 border border-slate-200 font-numeric">
                      {formatVND(dynamicConfig.nonCashThreshold)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Ngưỡng kiểm tra điều kiện thanh toán theo SOP.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[5_000_000, 10_000_000, 15_000_000, 20_000_000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDynamicConfig({ ...dynamicConfig, nonCashThreshold: amt })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-numeric transition-colors text-center cursor-pointer whitespace-nowrap ${
                          dynamicConfig.nonCashThreshold === amt
                            ? 'bg-slate-900 text-white font-semibold shadow-none'
                            : 'bg-slate-100/60 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {amt / 1_000_000}M {amt === 5_000_000 ? '(2026)' : amt === 20_000_000 ? '(Cũ)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Knob 2: Chief Accountant Approval Limit */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-none">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      2. Hạn mức Kế toán trưởng tự duyệt
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-900 border border-slate-200 font-numeric">
                      {formatVND(dynamicConfig.kttApprovalLimit)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Hóa đơn vượt quá hạn mức này sẽ tự động chuyển tiếp lên Giám đốc Tài chính (CFO):
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {[100_000_000, 200_000_000, 300_000_000, 500_000_000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setDynamicConfig({ ...dynamicConfig, kttApprovalLimit: amt })}
                        className={`py-1.5 px-2 rounded-lg text-xs font-numeric transition-colors text-center cursor-pointer whitespace-nowrap ${
                          dynamicConfig.kttApprovalLimit === amt
                            ? 'bg-slate-900 text-white font-semibold shadow-none'
                            : 'bg-slate-100/60 border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {amt / 1_000_000}M {amt === 200_000_000 ? '(SOP)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Knob 3: K-Factor Heuristic Safe Range */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-3 shadow-none">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      3. Dải an toàn hệ số K (CV 2392)
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 text-slate-900 border border-slate-200 font-numeric">
                      {dynamicConfig.kFactorSafeMin} - {dynamicConfig.kFactorSafeMax}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Biên độ an toàn nội bộ. Khi K vượt ngưỡng sẽ kích hoạt cảnh báo rủi ro Nhóm 3:
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium block mb-1">Ngưỡng tối thiểu (Min):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={dynamicConfig.kFactorSafeMin}
                        onChange={(e) => setDynamicConfig({ ...dynamicConfig, kFactorSafeMin: parseFloat(e.target.value) || 1.05 })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-numeric focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium block mb-1">Ngưỡng tối đa (Max):</label>
                      <input
                        type="number"
                        step="0.05"
                        value={dynamicConfig.kFactorSafeMax}
                        onChange={(e) => setDynamicConfig({ ...dynamicConfig, kFactorSafeMax: parseFloat(e.target.value) || 1.25 })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-numeric focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition"
                      />
                    </div>
                  </div>
                </div>

                {/* Knob 4: Staff reimbursement — informational (no exception to the cash rule) */}
                <div className="p-5 bg-white border border-slate-200 rounded-2xl space-y-2 shadow-none">
                  <span className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                    4. Nhân viên ứng tiền hộ
                  </span>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Nhân viên trả <strong>tiền mặt</strong> cho bên bán từ 5 triệu vẫn là thanh toán tiền mặt (không khấu trừ), kể cả khi công ty hoàn ứng qua ngân hàng; tách thành nhiều hóa đơn cùng ngày cũng bị gộp. Nếu nhân viên chuyển khoản/quẹt thẻ cá nhân, chọn hình thức <strong>Chuyển khoản</strong> và đính kèm chứng từ.
                  </p>
                </div>

              </div>
            </div>
          )}

          {/* TAB 1: VIEW FULL TEXT */}
          {activeTab === 'VIEW' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-slate-900">Phiên bản hiện hành: {policyMetadata.version}</span>
                  <span className="text-[11px] text-slate-500 ml-2">({policyMetadata.releaseDate})</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Căn cứ tích hợp: Luật Thuế GTGT 48/2024/QH15, Nghị quyết 204/2025/QH15, Nghị định 254/2026/NĐ-CP, Thông tư 89/2026/TT-BTC, Công văn 2392/TCT-QLRR.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Quy tắc đang thực thi
                  </span>
                </div>
              </div>

              <div className="font-numeric text-xs leading-relaxed text-slate-700 bg-slate-50/50 p-5 rounded-xl border border-slate-200 whitespace-pre-wrap">
                {policyMetadata.text}
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                <h4 className="text-[11px] font-numeric uppercase tracking-wider text-slate-500">
                  Lịch sử Sửa đổi Phiên bản
                </h4>
                <div className="space-y-1.5">
                  {policyMetadata.changeLog.map((log, idx) => (
                    <div key={idx} className="text-xs text-slate-700 font-numeric flex items-start gap-2">
                      <span className="text-slate-900">•</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: EDIT TEXT */}
          {activeTab === 'EDIT' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-medium">
                    Trình Soạn Thảo Quy Chế Văn Bản:
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    Văn bản là mô tả quy chế. Sửa nội dung không tự thay đổi quy tắc TypeScript. Các tham số thực thi chỉ có hiệu lực sau khi bộ kiểm tra nghiệp vụ đạt và policy được ban hành.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-numeric uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-900" />
                  Ghi chú bổ sung (không thay đổi quy tắc):
                </label>
                <textarea
                  value={editableText}
                  onChange={(e) => setEditableText(e.target.value)}
                  rows={14}
                  className="w-full p-4 bg-white border border-slate-200 rounded-xl font-numeric text-xs text-slate-900 leading-relaxed focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-numeric uppercase tracking-wider text-slate-500">
                  Ghi chú sửa đổi (Change Log):
                </label>
                <input
                  type="text"
                  placeholder="Ví dụ: Bổ sung điều khoản khấu trừ chi phí vé máy bay điện tử..."
                  value={changeLogNote}
                  onChange={(e) => setChangeLogNote(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleResetPolicyText}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors border border-slate-200 cursor-pointer shadow-none"
                >
                  <RotateCcw className="w-3 h-3 text-slate-500" />
                  <span>Khôi phục bản gốc</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('VIEW')}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePolicyText}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium shadow-none transition-colors cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Lưu bản mới</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEMPORAL LAW TIMELINE */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-slate-800" />
                      Tra cứu Pháp lý Theo Mốc Thời gian
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chọn ngày lập hóa đơn để tra cứu các văn bản pháp luật áp dụng tại thời điểm đó.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-numeric text-slate-700 uppercase tracking-wider">
                      Ngày lập:
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 font-numeric focus:outline-none focus:border-slate-400"
                    />
                  </div>
                </div>

                <div className="mt-3 p-3 bg-white border border-slate-200 rounded-lg space-y-1 text-xs font-numeric">
                  <div className="text-emerald-800 font-semibold">
                    ✓ {temporalResult.decreeSummary}
                  </div>
                  {temporalResult.notes.map((n, idx) => (
                    <div key={idx} className="text-slate-700">
                      • {n}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[11px] font-numeric uppercase tracking-wider text-slate-500">
                  Văn bản Quy phạm Pháp luật 2025 - 2026 ({GOVERNMENT_REGULATORY_REGISTRY.length} văn bản)
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {GOVERNMENT_REGULATORY_REGISTRY.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-2 shadow-none"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-numeric font-medium bg-slate-100 text-slate-900 border border-slate-200">
                          {doc.code}
                        </span>
                        <span className="text-[10px] font-numeric text-slate-500">
                          {doc.effectiveFrom} {doc.effectiveTo ? '-> ' + doc.effectiveTo : '(Hiện hành)'}
                        </span>
                      </div>

                      <h5 className="text-xs font-semibold text-slate-900 leading-snug">
                        {doc.title}
                      </h5>

                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {doc.summary}
                      </p>

                      <div className="pt-2 border-t border-slate-200 space-y-1">
                        <span className="text-[10px] font-numeric uppercase tracking-wider text-slate-500 block">
                          Quy chuẩn cốt lõi:
                        </span>
                        {doc.keyRules.map((rule, idx) => (
                          <div key={idx} className="text-[11px] text-slate-600 flex items-start gap-1.5">
                            <span className="text-slate-500">•</span>
                            <span>{rule}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: LEGAL UPDATES */}
          {activeTab === 'LEGAL' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-slate-900">Theo dõi cập nhật văn bản pháp luật</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Hệ thống tạo bản nháp candidate để rà soát trước khi phê duyệt áp dụng.</p>
                </div>
                <button
                  onClick={() => void handleSyncLegal()}
                  disabled={isSyncingLegal}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-medium cursor-pointer shadow-none transition-colors"
                >
                  {isSyncingLegal ? 'Đang kiểm tra...' : 'Kiểm tra nguồn pháp lý'}
                </button>
              </div>
              {legalUpdates.length === 0 ? (
                <div className="p-6 rounded-xl border border-slate-200 bg-white text-xs text-slate-500 text-center">
                  Chưa có candidate mới. Hãy cấu hình feed JSON từ nguồn chính thức rồi chạy kiểm tra.
                </div>
              ) : (
                <div className="space-y-3">
                  {legalUpdates.map((update) => (
                    <div key={update.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2 shadow-none">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-numeric text-slate-900 text-xs font-semibold">{update.documentCode}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">{update.status}</span>
                      </div>
                      <h5 className="font-semibold text-xs text-slate-900">{update.title}</h5>
                      <p className="text-xs text-slate-600">{update.summary}</p>
                      <pre className="whitespace-pre-wrap text-[11px] text-slate-700 bg-slate-50 p-3 rounded-lg max-h-40 overflow-auto border border-slate-200">{update.diff}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SỔ TIỀN LỆ DOANH NGHIỆP */}
          {activeTab === 'PRECEDENTS' && (
            <div className="space-y-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-slate-800" />
                    Sổ Tiền Lệ Doanh Nghiệp (Precedent Memory)
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                    Lưu trữ các phán quyết đặc cách từ CFO / KTT để tự động chấp thuận các hóa đơn tương tự sau này.
                  </p>
                </div>
                <button
                  onClick={() => void loadPrecedents()}
                  disabled={isLoadingPrecedents}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-xs font-medium transition-colors border border-slate-200 shrink-0 cursor-pointer shadow-none"
                >
                  <RotateCcw className={`w-3 h-3 ${isLoadingPrecedents ? 'animate-spin' : ''}`} />
                  <span>Làm mới</span>
                </button>
              </div>

              {isLoadingPrecedents ? (
                <div className="p-8 text-center text-xs text-slate-500">Đang tải sổ tiền lệ...</div>
              ) : precedents.length === 0 ? (
                <div className="p-8 rounded-2xl border border-dashed border-slate-200 bg-white text-center space-y-2">
                  <BookmarkCheck className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-900">Chưa có tiền lệ nào được thiết lập</p>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto">
                    Khi CFO hoặc KTT phê duyệt một hóa đơn ngoại lệ và tích chọn &quot;Lưu làm tiền lệ cho doanh nghiệp&quot;, tiền lệ sẽ xuất hiện ở đây.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {precedents.map((p) => (
                    <div
                      key={p.id}
                      className="p-4 rounded-xl border border-slate-200 bg-white transition space-y-3 shadow-none"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-900">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-900 flex items-center gap-2">
                              <span>MST: {p.supplierTaxCode}</span>
                              <span className="rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[10px]">
                                {p.status === 'ACTIVE' ? 'Đang hiệu lực' : 'Đã thu hồi'}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-numeric mt-0.5">
                              ID: {p.id} · Ngày: {new Date(p.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>

                        {p.status === 'ACTIVE' && (
                          <button
                            onClick={() => void handleRevokePrecedent(p.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 text-xs font-medium transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" /> Thu hồi
                          </button>
                        )}
                      </div>

                      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] uppercase font-numeric">Mô hình rủi ro</span>
                          <span className="text-slate-900 font-medium text-xs">{p.riskPattern}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] uppercase font-numeric">Phương án phê duyệt</span>
                          <span className="text-slate-900 font-semibold text-xs">{p.approvedOption}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] uppercase font-numeric">Người duyệt</span>
                          <span className="text-slate-900 font-medium text-xs">{p.approvedBy}</span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-slate-500 block text-[10px] uppercase font-numeric">Căn cứ SOP</span>
                          <span className="text-slate-900 font-numeric text-xs">{p.sopClause}</span>
                        </div>
                      </div>

                      <div className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-200 text-xs">
                        <span className="text-slate-500 font-numeric text-[10px] uppercase block mb-0.5">Lý do giải trình:</span>
                        <p className="text-slate-700 italic text-[11px]">&quot;{p.rationale}&quot;</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/80">
          <span className="text-xs text-slate-500 flex items-center gap-1.5 font-numeric">
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-700" />
            Quy tắc SOP và trạng thái đối chiếu căn cứ
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-white px-4 py-1.5 text-xs font-medium cursor-pointer shadow-none transition"
          >
            {presentation==='page'?'Về Thẩm định':'Đóng cửa sổ'}
          </button>
        </div>
      </Content>
    </Dialog>
  );
};
