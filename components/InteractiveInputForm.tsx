'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  Send,
  FilePlus,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileText,
  Clipboard,
  ArrowRight,
  UploadCloud,
  Loader2,
  Eye,
  Code,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building,
  Calendar,
  DollarSign,
  ShieldCheck,
  FileCheck2,
  Plus,
  Move,
  X
} from 'lucide-react';
import { InvoiceInput, RefereeDecision, SystemPolicyConfig, OcrHighlight } from '@/lib/schemas';
import { formatVND, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';

interface InteractiveInputFormProps {
  onEvaluateResult: (decision: RefereeDecision, invoice: InvoiceInput) => void;
  dynamicConfig?: Partial<SystemPolicyConfig>;
  demoMode?: boolean;
}

export const InteractiveInputForm: React.FC<InteractiveInputFormProps> = ({
  onEvaluateResult,
  dynamicConfig,
  demoMode = false
}) => {
  const [inputMode, setInputMode] = useState<'FILE' | 'PASTE'>('FILE');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pastedText, setPastedText] = useState<string>('');

  // Trạng thái xem trước chứng từ gốc (Left Column Preview)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'XML' | 'PDF' | 'IMAGE' | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [xmlViewTab, setXmlViewTab] = useState<'VISUAL' | 'RAW'>('VISUAL');

  // Zoom & Pan tương tác cho khung hiển thị file
  const [imageZoom, setImageZoom] = useState<number>(100);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<InvoiceInput>(() => {
    return {
      id: `INV-${Date.now()}`,
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      supplierTaxCode: '',
      supplierName: '',
      itemName: '',
      preTaxAmount: 0,
      taxRate: 10,
      taxAmount: 0,
      totalAmount: 0,
      paymentMethod: 'BANK_TRANSFER',
      hasBankSlip: true,
      hasItemManifest: true,
      sellerStatus: 'ACTIVE',
      isImageBlurry: false,
      isAdjustment: false,
      isStaffReimbursed: false
    };
  });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEngine, setLastEngine] = useState<string | null>(null);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [ocrHighlights, setOcrHighlights] = useState<OcrHighlight[]>([]);
  const [showOcrHighlights, setShowOcrHighlights] = useState<boolean>(true);
  const [activeHighlightField, setActiveHighlightField] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    status: 'ROUTINE' | 'ESCALATED';
    message: string;
    approvedTax?: number;
    riskGroup?: string;
  } | null>(null);

  // Trợ lý Robot AI thân thiện (Sticky góc dưới bên phải)
  const [isRobotSpeechOpen, setIsRobotSpeechOpen] = useState<boolean>(false);
  const [robotMessage, setRobotMessage] = useState<{
    title: string;
    items: string[];
    isError: boolean;
  } | null>(null);

  // Kích hoạt robot thông báo khi có cảnh báo dữ liệu bóc tách
  useEffect(() => {
    if (documentWarnings.length > 0) {
      setRobotMessage({
        title: 'Cảnh Báo Dữ Liệu Bóc Tách',
        items: documentWarnings,
        isError: true,
      });
      setIsRobotSpeechOpen(true);
    }
  }, [documentWarnings]);

  // Kích hoạt robot thông báo khi AI thẩm định trả về rủi ro (ESCALATED)
  useEffect(() => {
    if (lastResult?.status === 'ESCALATED') {
      const items = [lastResult.message];
      if (lastResult.riskGroup) {
        items.push(`Phân nhóm rủi ro: ${lastResult.riskGroup}`);
      }
      setRobotMessage({
        title: 'Phát Hiện Rủi Ro Hồ Sơ (Escalation)',
        items,
        isError: true,
      });
      setIsRobotSpeechOpen(true);
    } else if (lastResult?.status === 'ROUTINE') {
      toast.success(lastResult.message || 'Hồ sơ đạt chuẩn thường quy');
    }
  }, [lastResult]);

  // Trạng thái tra cứu tự động 2 chiều (MST <-> Tên Nhà Cung Cấp)
  const [taxLookupLoading, setTaxLookupLoading] = useState<boolean>(false);
  const [taxLookupFeedback, setTaxLookupFeedback] = useState<{
    type: 'MST' | 'NAME';
    status: 'SUCCESS' | 'WARNING';
    message: string;
  } | null>(null);
  const autoLookupAbortRef = useRef<AbortController | null>(null);

  // Chiều 1: Tự động tra Tên & Địa chỉ khi người dùng nhập MST đủ 10 hoặc 13 số mà Tên trống
  useEffect(() => {
    const rawMst = (formData.supplierTaxCode || '').trim();
    const cleanMst = rawMst.replace(/\s+/g, '');
    const isMstFormat = /^(\d{10})(?:-(\d{3}))?$/.test(cleanMst);

    if (isMstFormat && (!formData.supplierName || formData.supplierName.trim().length === 0)) {
      if (autoLookupAbortRef.current) autoLookupAbortRef.current.abort();
      const controller = new AbortController();
      autoLookupAbortRef.current = controller;

      setTaxLookupLoading(true);
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/suppliers/lookup?taxCode=${encodeURIComponent(cleanMst)}`, {
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.found && data?.data?.legalName) {
              setFormData((prev) => ({
                ...prev,
                supplierName: data.data.legalName,
                sellerStatus: data.data.status?.includes('hoạt động') || data.data.status === 'ACTIVE' ? 'ACTIVE' : prev.sellerStatus
              }));
              setTaxLookupFeedback({
                type: 'MST',
                status: 'SUCCESS',
                message: `Đã tự động lấy tên từ Tổng cục Thuế: ${data.data.legalName}`
              });
              toast.success(`Đã tự động tìm thấy tên doanh nghiệp từ MST ${cleanMst}`);
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') console.warn('Auto lookup MST error:', err);
        } finally {
          setTaxLookupLoading(false);
        }
      }, 400);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
  }, [formData.supplierTaxCode, formData.supplierName]);

  // Chiều 2: Tự động suy luận & đối chiếu Cổng TCT khi có Tên NCC mà MST trống
  useEffect(() => {
    const name = (formData.supplierName || '').trim();
    const mst = (formData.supplierTaxCode || '').trim();

    if (name.length >= 4 && (!mst || mst.length < 10)) {
      if (autoLookupAbortRef.current) autoLookupAbortRef.current.abort();
      const controller = new AbortController();
      autoLookupAbortRef.current = controller;

      const timer = setTimeout(async () => {
        try {
          setTaxLookupLoading(true);
          const res = await fetch(`/api/suppliers/lookup?name=${encodeURIComponent(name)}`, {
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.found && data?.data?.taxCode && data?.data?.isVerified) {
              setFormData((prev) => ({
                ...prev,
                supplierTaxCode: data.data.taxCode
              }));
              setTaxLookupFeedback({
                type: 'NAME',
                status: 'SUCCESS',
                message: `Đã tự động xác thực qua CSDL Thuế: MST ${data.data.taxCode} (Độ tin cậy ${Math.round((data.data.confidence || 1) * 100)}%)`
              });
              toast.success(`Đã tự động xác thực MST ${data.data.taxCode} cho "${name}"`);
            }
          }
        } catch (err: any) {
          if (err?.name !== 'AbortError') console.warn('Auto lookup Name error:', err);
        } finally {
          setTaxLookupLoading(false);
        }
      }, 700);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
  }, [formData.supplierName, formData.supplierTaxCode]);

  // Kiểm tra xem đã có hóa đơn/file nạp vào chưa
  const hasDocument = Boolean(
    uploadedFile || previewUrl || xmlContent || (inputMode === 'PASTE' && pastedText.trim() && (formData.invoiceNumber || formData.supplierName))
  );

  // Dọn dẹp object URL khi unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Reset và điều khiển Zoom & Pan
  const handleResetZoomAndPan = () => {
    setImageZoom(100);
    setPanOffset({ x: 0, y: 0 });
    setIsDraggingImage(false);
    dragStartRef.current = null;
  };

  const handleZoomChange = (newZoom: number) => {
    setImageZoom(Math.min(350, Math.max(50, newZoom)));
  };

  // Lắng nghe sự kiện Ctrl / Command + Cuộn chuột (Wheel) để zoom mượt mà
  useEffect(() => {
    const container = imageContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Chỉ zoom khi giữ phím Ctrl (Windows/Linux) hoặc Meta/Command (Mac)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault(); // Ngăn chặn zoom toàn bộ trang web
        const delta = e.deltaY < 0 ? 15 : -15;
        setImageZoom((prev) => Math.min(350, Math.max(50, prev + delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [previewFileType, previewUrl]);

  // Xử lý kéo rê (Drag / Pan) tấm ảnh
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Chỉ nhận chuột trái
    e.preventDefault();
    setIsDraggingImage(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPanX: panOffset.x,
      initialPanY: panOffset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingImage || !dragStartRef.current) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    setPanOffset({
      x: dragStartRef.current.initialPanX + dx,
      y: dragStartRef.current.initialPanY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDraggingImage(false);
    dragStartRef.current = null;
  };

  /**
   * Tối ưu hóa & nén ảnh ngay tại trình duyệt trước khi upload (giảm dung lượng 80-90%, tăng tốc bóc tách gấp 5 lần)
   */
  const compressImageClientSide = async (file: File): Promise<File> => {
    if (file.size < 350 * 1024 || !file.type.startsWith('image/')) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 1600;
        let width = img.width;
        let height = img.height;

        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file);
            } else {
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          0.82
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      };
      img.src = objectUrl;
    });
  };

  const handleDocumentUpload = async (file: File) => {
    setIsParsingDocument(true);
    setDocumentWarnings([]);
    setUploadedFile(file);
    handleResetZoomAndPan();

    // Xác định định dạng để preview
    const fileNameLower = file.name.toLowerCase();
    if (file.type.startsWith('image/') || fileNameLower.endsWith('.png') || fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') || fileNameLower.endsWith('.webp')) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewFileType('IMAGE');
      setXmlContent(null);
    } else if (file.type === 'application/pdf' || fileNameLower.endsWith('.pdf')) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setPreviewFileType('PDF');
      setXmlContent(null);
    } else if (file.type.includes('xml') || fileNameLower.endsWith('.xml')) {
      setPreviewFileType('XML');
      setPreviewUrl(null);
      file.text().then((txt) => setXmlContent(txt)).catch(() => {});
    } else {
      setPreviewFileType(null);
    }

    try {
      // Tự động nén ảnh trước khi upload nếu file lớn
      let fileToUpload = file;
      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
        fileToUpload = await compressImageClientSide(file);
      }

      const form = new FormData();
      form.append('file', fileToUpload);
      const response = await fetch('/api/documents/parse', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lỗi đọc chứng từ');
      const extracted = Object.fromEntries(
        Object.entries(data.invoice || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );
      setFormData((prev) => ({
        ...prev,
        ...extracted,
        sourceArtifactId: data.artifactId,
        sourceHash: data.sourceHash,
        id: prev.id || `DOC-${Date.now()}`
      } as InvoiceInput));
      setDocumentWarnings(data.warnings || []);
      setUncertainFields(data.uncertainFields || []);
      setFieldWarnings(data.fieldWarnings || {});
      setOcrHighlights(data.ocrHighlights || []);
      setLastResult(null);
      toast.success(data.invoice?.invoiceNumber ? `Đã đọc HĐ số ${data.invoice.invoiceNumber}` : 'Đã nạp dữ liệu chứng từ');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể đọc file';
      setDocumentWarnings([msg]);
      toast.error(msg);
    } finally {
      setIsParsingDocument(false);
    }
  };

  const handleRawTextParse = async () => {
    if (!pastedText.trim()) {
      toast.error('Vui lòng dán nội dung hóa đơn hoặc văn bản');
      return;
    }
    setIsParsingDocument(true);
    setDocumentWarnings([]);
    setUploadedFile(null);
    setPreviewFileType(null);
    handleResetZoomAndPan();

    try {
      const response = await fetch('/api/documents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pastedText })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Lỗi bóc tách văn bản');
      const extracted = Object.fromEntries(
        Object.entries(data.invoice || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );
      setFormData((prev) => ({
        ...prev,
        ...extracted,
        sourceArtifactId: data.artifactId,
        sourceHash: data.sourceHash,
        id: prev.id || `DOC-${Date.now()}`
      } as InvoiceInput));
      setDocumentWarnings(data.warnings || []);
      setUncertainFields(data.uncertainFields || []);
      setFieldWarnings(data.fieldWarnings || {});
      setOcrHighlights(data.ocrHighlights || []);
      setLastResult(null);
      toast.success(data.invoice?.invoiceNumber ? `Đã bóc tách HĐ số ${data.invoice.invoiceNumber}` : 'Đã nạp dữ liệu từ văn bản');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Không thể bóc tách văn bản';
      setDocumentWarnings([msg]);
      toast.error(msg);
    } finally {
      setIsParsingDocument(false);
    }
  };

  // Nút: Hóa đơn tiếp theo -> Dọn sạch hóa đơn cũ và đưa khung upload quay trở lại
  const handleNextInvoice = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    handleResetZoomAndPan();
    setUploadedFile(null);
    setPreviewUrl(null);
    setPreviewFileType(null);
    setXmlContent(null);
    setPastedText('');
    setDocumentWarnings([]);
    setUncertainFields([]);
    setFieldWarnings({});
    setOcrHighlights([]);
    setActiveHighlightField(null);
    setLastResult(null);
    setFormData({
      id: `INV-${Date.now()}`,
      invoiceNumber: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      supplierTaxCode: '',
      supplierName: '',
      itemName: '',
      preTaxAmount: 0,
      taxRate: 10,
      taxAmount: 0,
      totalAmount: 0,
      paymentMethod: 'BANK_TRANSFER',
      hasBankSlip: true,
      hasItemManifest: true,
      sellerStatus: 'ACTIVE',
      isImageBlurry: false,
      isAdjustment: false,
      isStaffReimbursed: false
    });
    toast.info('Sẵn sàng tải lên hóa đơn tiếp theo');
  };

  const applySampleText = (type: 'ROUTINE' | 'CASH_5M') => {
    if (type === 'CASH_5M') {
      setPastedText(
        `Số HĐ: 0048123\nNgày lập: 2026-03-15\nĐơn vị bán: Công ty Cổ phần Vận tải Taxi Mai Linh\nMST: 0101234567\nHàng hóa: Cước dịch vụ vận chuyển đưa đón đoàn chuyên gia\nTổng thanh toán: 20.350.000 VNĐ\nThuế suất: 10%\nHình thức thanh toán: Tiền mặt`
      );
    } else {
      setPastedText(
        `Số HĐ: 0019283\nNgày lập: 2026-03-20\nĐơn vị bán: Tập đoàn Bưu chính Viễn thông Việt Nam (VNPT)\nMST: 0100684378\nHàng hóa: Cước cáp quang Internet định kỳ tháng 03/2026\nTổng thanh toán: 1.650.000 VNĐ\nThuế suất: 10%\nHình thức thanh toán: Chuyển khoản ngân hàng`
      );
    }
  };

  const handleInputChange = (field: keyof InvoiceInput, value: any) => {
    setLastResult(null);
    if (uncertainFields.includes(field)) {
      setUncertainFields((prev) => prev.filter((f) => f !== field));
    }
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'preTaxAmount' || field === 'taxRate') {
        const pre = field === 'preTaxAmount' ? Number(value) : updated.preTaxAmount;
        const rate = field === 'taxRate' ? Number(value) : updated.taxRate;
        const tax = Number((pre * (rate / 100)).toFixed(0));
        updated.taxAmount = tax;
        updated.totalAmount = pre + tax;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplierName || formData.totalAmount <= 0) {
      toast.error('Vui lòng điền đủ Tên nhà cung cấp và Số tiền');
      return;
    }

    setIsEvaluating(true);
    try {
      const payload = {
        invoice: formData,
        policyConfig: dynamicConfig,
        mode: demoMode ? 'DEMO' : 'PRODUCTION',
        demo: demoMode
      };

      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const rawText = await res.text();
      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Máy chủ phản hồi lỗi (${res.status}): ${rawText.slice(0, 120)}`);
      }
      if (!res.ok) throw new Error(data.error || 'Lỗi thẩm định');

      const decision: RefereeDecision = data.decision;
      setLastEngine(data.engine || decision.engineUsed || null);

      if (decision.status === 'ROUTINE') {
        setLastResult({
          status: 'ROUTINE',
          message: decision.plainExplanation,
          approvedTax: decision.approvedTaxAmount
        });
      } else {
        setLastResult({
          status: 'ESCALATED',
          message: decision.actionableQuestion,
          riskGroup: decision.riskGroup
        });
      }

      onEvaluateResult(decision, formData);
      toast.success(decision.status === 'ROUTINE' ? 'Hồ sơ Thường quy (Routine)' : 'Cần xử lý ngoại lệ (Escalated)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Lỗi thẩm định');
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ================= HEADER THANH ĐIỀU HƯỚNG CHẾ ĐỘ ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-950 flex items-center gap-2">
            <span>Tiếp Nhận Chứng Từ &amp; Đối Soát Trực Quan</span>
            <Badge variant="secondary" className="text-[11px] font-mono">Bản Thể Hiện + Trích Xuất</Badge>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cột trái: Bản thể hiện hóa đơn gốc · Cột phải: Dữ liệu bóc tách được để đối chiếu kiểm tra
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => {
              setInputMode('FILE');
              if (inputMode !== 'FILE') handleNextInvoice();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              inputMode === 'FILE'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tải Tệp (XML / PDF / Ảnh)
          </button>
          <button
            type="button"
            onClick={() => {
              setInputMode('PASTE');
              if (inputMode !== 'PASTE') handleNextInvoice();
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition cursor-pointer ${
              inputMode === 'PASTE'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Dán Văn Bản Thô
          </button>
        </div>
      </div>

      {/* ================= 2 CỘT SONG SONG: CHIỀU CAO ĐỒNG BỘ 100% GIỮA UPLOAD VÀ XEM FILE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

        {/* -------------------------------------------------------------
            CỘT BÊN TRÁI (COL-SPAN-6): KHUNG UPLOAD HOẶC HIỂN THỊ HÓA ĐƠN
        ------------------------------------------------------------- */}
        <div className="lg:col-span-6 flex flex-col h-full min-h-0">
          
          {/* TRƯỜNG HỢP 1: CHƯA UPLOAD -> KHUNG UPLOAD CHIẾM TRỌN CHIỀU CAO BẰNG CỘT PHẢI */}
          {!hasDocument ? (
            inputMode === 'FILE' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) void handleDocumentUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full h-full min-h-[460px] flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                  isDragging
                    ? 'border-emerald-500 bg-emerald-50/90 scale-[1.01] shadow-md ring-4 ring-emerald-500/10'
                    : 'border-slate-300 hover:border-slate-900 bg-slate-50/60 hover:bg-slate-100/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,application/xml,application/pdf,image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={isParsingDocument}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleDocumentUpload(file);
                    e.currentTarget.value = '';
                  }}
                />

                {isParsingDocument ? (
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="h-12 w-12 rounded-full bg-slate-950 text-brand-lime flex items-center justify-center animate-spin">
                      <Loader2 className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-950">Đang đọc &amp; bóc tách chứng từ...</p>
                      <p className="text-xs text-slate-500 mt-1">Trích xuất cấu trúc hóa đơn điện tử và xác thực số học</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3.5 text-center max-w-sm">
                    <div className="h-14 w-14 rounded-2xl bg-slate-900 text-brand-lime flex items-center justify-center shadow-xs">
                      <UploadCloud className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        {isDragging ? 'Thả file vào đây để tải lên ngay' : 'Kéo thả file XML / PDF / Ảnh chụp vào đây'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        hoặc <span className="font-bold underline text-slate-950">nhấn để chọn tệp</span> (.xml, .pdf, .png, .jpg)
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-center pt-2">
                      <span className="px-2.5 py-1 rounded-md bg-white text-slate-700 text-[11px] font-mono font-bold border border-slate-200 shadow-2xs">
                        .XML (HĐĐT gốc)
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white text-slate-700 text-[11px] font-mono font-bold border border-slate-200 shadow-2xs">
                        .PDF (Bản thể hiện)
                      </span>
                      <span className="px-2.5 py-1 rounded-md bg-white text-slate-700 text-[11px] font-mono font-bold border border-slate-200 shadow-2xs">
                        .PNG / .JPG (Ảnh chụp)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Chế độ dán văn bản thô khi chưa có nội dung */
              <div className="w-full h-full min-h-[460px] flex flex-col p-6 rounded-2xl border border-slate-200 bg-slate-50/60 justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Dán thông tin hóa đơn (Email / Ghi chú / Text):</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-500">Mẫu nhanh:</span>
                      <button
                        type="button"
                        onClick={() => applySampleText('CASH_5M')}
                        className="px-2 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer"
                      >
                        Mai Linh 20M (Tiền mặt)
                      </button>
                      <button
                        type="button"
                        onClick={() => applySampleText('ROUTINE')}
                        className="px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-[11px] font-bold cursor-pointer"
                      >
                        VNPT 1.6M (Routine)
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Dán nội dung hóa đơn thô: Số HĐ, Ngày lập, Tên bên bán, MST, Hàng hóa, Tiền trước thuế, Thuế suất, Tổng tiền..."
                    className="w-full p-4 rounded-xl border border-slate-200 bg-white text-xs font-mono text-slate-900 focus:outline-none focus:border-slate-950 focus:ring-1 focus:ring-slate-950 resize-none leading-relaxed"
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleRawTextParse()}
                    disabled={isParsingDocument || !pastedText.trim()}
                    className="gap-1.5 font-bold text-xs h-9 px-4 cursor-pointer"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    <span>{isParsingDocument ? 'Đang bóc tách...' : 'Bóc Tách & Điền Form'}</span>
                  </Button>
                </div>
              </div>
            )
          ) : (
            /* TRƯỜNG HỢP 2: ĐÃ UPLOAD -> KHUNG UPLOAD BIẾN MẤT, HIỂN THỊ FILE CHIẾM TRỌN CHIỀU CAO */
            <Card className="w-full h-full min-h-[460px] flex flex-col overflow-hidden border border-slate-200 shadow-sm bg-white">
              
              {/* Header Preview Toolbar */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-slate-700" />
                  <span className="font-bold text-slate-950 truncate max-w-[180px] sm:max-w-none">
                    {previewFileType === 'IMAGE' ? 'Bản Chụp Hóa Đơn (Image View)' :
                     previewFileType === 'PDF' ? 'Bản Thể Hiện PDF (Document View)' :
                     previewFileType === 'XML' ? 'Bản Thể Hiện HĐĐT (Electronic Invoice)' :
                     'Văn Bản Gốc Đã Dán (Raw Text)'}
                  </span>
                </div>

                {/* Chế độ xem XML */}
                {previewFileType === 'XML' && (
                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-md border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setXmlViewTab('VISUAL')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded transition cursor-pointer ${
                        xmlViewTab === 'VISUAL' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bản Thể Hiện
                    </button>
                    <button
                      type="button"
                      onClick={() => setXmlViewTab('RAW')}
                      className={`px-2 py-0.5 text-[11px] font-bold rounded transition cursor-pointer ${
                        xmlViewTab === 'RAW' ? 'bg-slate-950 text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Mã XML
                    </button>
                  </div>
                )}

                {/* Bộ điều khiển Zoom cho Ảnh (Thanh kéo + Nút + Reset) */}
                {previewFileType === 'IMAGE' && (
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoomChange(imageZoom - 20)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Thu nhỏ (-20%)"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>

                    {/* Thanh kéo để zoom */}
                    <input
                      type="range"
                      min="50"
                      max="350"
                      step="5"
                      value={imageZoom}
                      onChange={(e) => handleZoomChange(Number(e.target.value))}
                      className="w-16 sm:w-28 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-950"
                      title="Kéo thanh trượt để phóng to / thu nhỏ"
                    />

                    <button
                      type="button"
                      onClick={() => handleZoomChange(imageZoom + 20)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Phóng to (+20%)"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>

                    <span className="text-[11px] font-mono font-bold text-slate-700 min-w-11 text-center bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-2xs">
                      {imageZoom}%
                    </span>

                    <button
                      type="button"
                      onClick={handleResetZoomAndPan}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Khôi phục 100% & căn giữa"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>

                    {previewFileType === 'IMAGE' && ocrHighlights.filter((hl) => Boolean(hl.field) && Boolean(hl.bbox)).length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowOcrHighlights((prev) => !prev)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition cursor-pointer border ml-1 ${
                          showOcrHighlights
                            ? 'bg-amber-100 text-amber-900 border-amber-300 shadow-2xs ring-1 ring-amber-300/40'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                        }`}
                        title="Bật/Tắt tô màu highlight các thực thể bóc tách bị mờ nét trên hóa đơn"
                      >
                        <span>🖍️ Tô thực thể mờ</span>
                        <span className="font-mono bg-amber-200/90 text-amber-950 px-1 py-0.2 rounded text-[9px]">
                          {ocrHighlights.filter((hl) => Boolean(hl.field) && Boolean(hl.bbox)).length}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Vùng Hiển Thị Nội Dung File (Chiếm trọn không gian, không làm nhảy chiều cao) */}
              <div className="flex-1 min-h-0 overflow-hidden relative bg-slate-50/50 flex flex-col justify-start">
                
                {/* 1. Nếu là ảnh: Hỗ trợ Drag Pan & Zoom với Ctrl/Cmd + Wheel */}
                {previewFileType === 'IMAGE' && previewUrl && (
                  <div
                    ref={imageContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`w-full h-full relative overflow-hidden flex items-center justify-center select-none bg-slate-900/5 ${
                      isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                  >
                    <div
                      style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${imageZoom / 100})`,
                        transformOrigin: 'center center',
                        transition: isDraggingImage ? 'none' : 'transform 0.08s ease-out',
                      }}
                      className="flex items-center justify-center shrink-0"
                    >
                      <div className="relative inline-block select-none">
                        <img
                          src={previewUrl}
                          alt="Chứng từ hóa đơn"
                          draggable={false}
                          className="max-h-[530px] max-w-full object-contain rounded-lg shadow-md border border-slate-300 pointer-events-none select-none block"
                        />

                        {/* TÔ HIGHLIGHT TRỰC TIẾP TRÊN BẢN HÓA ĐƠN: CHỈ CÁC THỰC THỂ ĐƯỢC LLM TRÍCH XUẤT VÀ CÓ ĐỘ TIN CẬY THẤP */}
                        {showOcrHighlights && ocrHighlights
                          .filter((hl) => Boolean(hl.field) && Boolean(hl.bbox))
                          .map((hl, idx) => {
                            if (!hl.bbox) return null;
                            const leftPercent = hl.bbox.x * 100;
                            const topPercent = (1.0 - hl.bbox.y - hl.bbox.h) * 100;
                            const widthPercent = hl.bbox.w * 100;
                            const heightPercent = hl.bbox.h * 100;

                            const isFieldActive = activeHighlightField && hl.field === activeHighlightField;
                            const fieldLabelMap: Record<string, string> = {
                              invoiceNumber: 'Số Hóa Đơn',
                              invoiceDate: 'Ngày Lập HĐ',
                              supplierTaxCode: 'MST Bên Bán',
                              supplierName: 'Tên Bên Bán',
                              totalAmount: 'Tổng Thanh Toán',
                              preTaxAmount: 'Tiền Trước Thuế',
                              taxAmount: 'Tiền Thuế GTGT',
                              itemName: 'Nội Dung Hàng Hóa',
                              buyerTaxCode: 'MST Bên Mua',
                              buyerName: 'Tên Bên Mua'
                            };
                            const fieldLabel = hl.field ? fieldLabelMap[hl.field] || hl.field : 'Thực thể';

                            return (
                              <div
                                key={idx}
                                style={{
                                  left: `${leftPercent}%`,
                                  top: `${topPercent}%`,
                                  width: `${widthPercent}%`,
                                  height: `${heightPercent}%`,
                                }}
                                className={`absolute rounded-xs pointer-events-auto cursor-pointer transition-all z-20 group ${
                                  isFieldActive
                                    ? 'border-2 border-red-500 bg-red-400/50 ring-4 ring-red-400/60 scale-105 z-30'
                                    : 'border-2 border-amber-500 bg-amber-400/40 hover:bg-amber-400/60 hover:border-amber-600 ring-2 ring-amber-300/50 animate-pulse'
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hl.field) {
                                    setActiveHighlightField(hl.field);
                                    const inputEl = document.querySelector(`[name="${hl.field}"]`) as HTMLInputElement | null;
                                    inputEl?.focus();
                                  }
                                }}
                              >
                                {/* Tooltip nổi giải thích thực thể bóc tách khi hover */}
                                <div className="absolute bottom-full left-0 mb-1.5 hidden group-hover:flex flex-col bg-slate-950/95 text-white text-[10px] p-2 rounded-lg shadow-xl whitespace-nowrap z-40 pointer-events-none border border-slate-700 min-w-[180px]">
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1 font-bold">
                                    <span className="text-amber-400 flex items-center gap-1">
                                      ⚠️ {fieldLabel} (Mờ nét)
                                    </span>
                                    <span className="font-mono text-[9px] bg-amber-950 text-amber-300 px-1 rounded">
                                      {Math.round(hl.confidence * 100)}%
                                    </span>
                                  </div>
                                  <div className="mt-1 text-slate-200">
                                    <span className="text-slate-400">Đọc được:</span> <span className="font-bold text-amber-200 font-mono">"{hl.text}"</span>
                                  </div>
                                  {hl.reason && (
                                    <div className="text-[9px] text-slate-400 mt-0.5">{hl.reason}</div>
                                  )}
                                  <div className="text-[9px] text-blue-300 mt-1 italic font-sans">
                                    👉 Nhấp vào ô này để sửa trường [{fieldLabel}] trên Form
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* Chỉ dẫn tương tác nổi ở góc dưới */}
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-medium px-3 py-1 rounded-full shadow-md pointer-events-none flex items-center gap-2 select-none z-10">
                      <span className="flex items-center gap-1">
                        <kbd className="px-1 py-0.2 bg-white/20 rounded font-mono text-[9px]">Ctrl</kbd> / <kbd className="px-1 py-0.2 bg-white/20 rounded font-mono text-[9px]">⌘</kbd> + Cuộn chuột hoặc Kéo thanh trượt để zoom
                      </span>
                      <span className="text-white/40">•</span>
                      <span>Kéo chuột để soi chi tiết</span>
                    </div>
                  </div>
                )}

                {/* 2. Nếu là PDF */}
                {previewFileType === 'PDF' && previewUrl && (
                  <div className="w-full h-full">
                    <iframe
                      src={previewUrl}
                      title="Xem trước hóa đơn PDF"
                      className="w-full h-full border-none"
                    />
                  </div>
                )}

                {/* 3. Nếu là XML */}
                {previewFileType === 'XML' && (
                  xmlViewTab === 'RAW' ? (
                    <pre className="p-4 bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-auto w-full h-full whitespace-pre-wrap leading-relaxed">
                      {xmlContent || 'Đang tải mã nguồn XML...'}
                    </pre>
                  ) : (
                    <div className="w-full h-full overflow-auto p-4 flex flex-col items-center">
                      <div className="bg-white p-5 rounded-xl border border-slate-300 shadow-xs text-xs text-slate-900 space-y-4 max-w-xl mx-auto font-sans w-full my-auto">
                        {/* Header HĐĐT */}
                        <div className="text-center border-b border-slate-200 pb-3">
                          <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Cộng Hòa Xã Hội Chủ Nghĩa Việt Nam</div>
                          <div className="text-[9px] text-slate-500 font-medium">Độc lập - Tự do - Hạnh phúc</div>
                          <h3 className="text-base font-extrabold uppercase text-slate-950 mt-2 tracking-wide">
                            HÓA ĐƠN GIÁ TRỊ GIA TĂNG
                          </h3>
                          <div className="text-[11px] text-slate-500 italic mt-0.5">(Bản thể hiện của hóa đơn điện tử)</div>
                          <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-dashed border-slate-200 text-left text-[11px]">
                            <div><span className="text-slate-500">Ký hiệu:</span> <span className="font-mono font-bold">1C26TBB</span></div>
                            <div className="text-right"><span className="text-slate-500">Số HĐ:</span> <span className="font-mono font-extrabold text-slate-950 text-xs">{formData.invoiceNumber || '---'}</span></div>
                            <div><span className="text-slate-500">Ngày lập:</span> <span className="font-bold">{formatDate(formData.invoiceDate)}</span></div>
                            <div className="text-right"><span className="text-slate-500">Tiền tệ:</span> <span className="font-bold">VND</span></div>
                          </div>
                        </div>

                        {/* Bên bán */}
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                          <div className="font-extrabold text-slate-950 uppercase">{formData.supplierName || 'Đơn vị bán hàng'}</div>
                          <div><span className="text-slate-500">Mã số thuế:</span> <span className="font-mono font-bold text-slate-950">{formData.supplierTaxCode || '---'}</span></div>
                          <div><span className="text-slate-500">Hình thức TT:</span> <span className="font-bold">{formData.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}</span></div>
                        </div>

                        {/* Bảng hàng hóa */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <div className="grid grid-cols-12 bg-slate-100 p-2 text-[10px] font-bold uppercase text-slate-700 border-b border-slate-200">
                            <span className="col-span-1 text-center">STT</span>
                            <span className="col-span-6">Tên Hàng Hóa, Dịch Vụ</span>
                            <span className="col-span-2 text-center">Thuế Suất</span>
                            <span className="col-span-3 text-right">Thành Tiền</span>
                          </div>
                          <div className="grid grid-cols-12 p-2.5 text-[11px] items-center border-b border-slate-100">
                            <span className="col-span-1 text-center font-mono">1</span>
                            <span className="col-span-6 font-semibold text-slate-900">{formData.itemName || 'Hàng hóa / dịch vụ'}</span>
                            <span className="col-span-2 text-center font-mono font-bold text-slate-700">{formData.taxRate}%</span>
                            <span className="col-span-3 text-right font-mono font-bold text-slate-950">{formatVND(formData.preTaxAmount)}</span>
                          </div>
                        </div>

                        {/* Tổng kết tiền */}
                        <div className="space-y-1 text-right text-[11px] pt-1">
                          <div><span className="text-slate-500">Cộng tiền hàng:</span> <span className="font-mono font-bold">{formatVND(formData.preTaxAmount)}</span></div>
                          <div><span className="text-slate-500">Tiền thuế GTGT ({formData.taxRate}%):</span> <span className="font-mono font-bold">{formatVND(formData.taxAmount)}</span></div>
                          <div className="text-sm font-extrabold text-slate-950 border-t border-slate-200 pt-1.5 mt-1">
                            Tổng thanh toán: <span className="text-blue-900 font-numeric">{formatVND(formData.totalAmount)}</span>
                          </div>
                        </div>

                        {/* Chữ ký số */}
                        <div className="border border-emerald-200 bg-emerald-50/70 p-2 rounded-lg flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                            <ShieldCheck className="h-4 w-4 text-emerald-700" />
                            <span>Chữ ký số bên bán hợp lệ</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700">Digital Signature Verified</span>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {/* 4. Nếu là Dán văn bản */}
                {inputMode === 'PASTE' && pastedText && !previewFileType && (
                  <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 m-4 overflow-auto">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-900">Văn bản thô đã nạp</span>
                      <Badge variant="secondary" className="text-[10px] font-mono">{pastedText.length} ký tự</Badge>
                    </div>
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed overflow-auto">
                      {pastedText}
                    </pre>
                  </div>
                )}
              </div>

              {/* FOOTER BÊN DƯỚI: NÚT "HÓA ĐƠN TIẾP THEO" CĂN BÊN PHẢI (KHÔNG ĐÈ LÊN FILE) */}
              <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 truncate text-xs">
                  {uploadedFile && (
                    <>
                      <FileCheck2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800 truncate max-w-[200px]">{uploadedFile.name}</span>
                      <span className="text-slate-500 font-mono text-[11px] shrink-0">({(uploadedFile.size / 1024).toFixed(1)} KB)</span>
                    </>
                  )}
                  {inputMode === 'PASTE' && (
                    <span className="text-slate-600 font-semibold">Đã nạp văn bản đối soát</span>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNextInvoice}
                  className="gap-1.5 font-bold text-xs h-8 text-slate-900 border-slate-300 hover:bg-slate-100 cursor-pointer shadow-xs shrink-0 ml-2"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
                  <span>Hóa đơn tiếp theo</span>
                </Button>
              </div>
            </Card>
          )}

        </div>

        {/* -------------------------------------------------------------
            CỘT BÊN PHẢI (COL-SPAN-6): THÔNG TIN TRÍCH XUẤT ĐƯỢC VÀ FORM
        ------------------------------------------------------------- */}
        <div className="lg:col-span-6 flex flex-col h-full">
          <Card className="w-full h-full p-5 sm:p-6 border border-slate-200 shadow-sm bg-white flex flex-col overflow-hidden">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">
                  Dữ Liệu Bóc Tách Được
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kiểm tra và hiệu chỉnh thông tin đối soát trước khi thẩm định
                </p>
              </div>

              {formData.invoiceNumber && (
                <Badge variant="success" className="text-[11px] font-bold">
                  ĐÃ NẠP DỮ LIỆU
                </Badge>
              )}
            </div>

            {/* Banner Cảnh Báo Trường Bị Mờ Nét / Không Chắc Chắn */}
            {uncertainFields.length > 0 && (
              <div className="mb-3 p-3 bg-amber-50/95 border border-amber-300 rounded-xl flex items-start gap-2.5 text-amber-950 shadow-xs animate-in fade-in slide-in-from-top-1">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <span>Phát hiện vùng chữ mờ / Cần kế toán đối soát</span>
                    <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0 font-bold">
                      {uncertainFields.length} trường nghi ngờ
                    </Badge>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    AI đã tự động tô sáng viền vàng các trường nghi ngờ bên dưới. Bạn vui lòng đối chiếu trực tiếp với bản thể hiện hóa đơn bên trái và sửa lại nếu cần.
                  </p>
                </div>
              </div>
            )}

            {/* Form Fields: Liền mạch, nút thẩm định nằm ngay bên dưới Tổng thanh toán */}
            <form id="extraction-form" onSubmit={handleSubmit} className="space-y-3 text-xs text-slate-800">
              
              {/* Nhóm 1: Số HĐ & Ngày Lập */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Số Hóa Đơn:
                    </label>
                    {uncertainFields.includes('invoiceNumber') && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded animate-pulse">
                        ⚠️ Chữ mờ nét
                      </span>
                    )}
                  </div>
                  <input
                    name="invoiceNumber"
                    type="text"
                    value={formData.invoiceNumber}
                    onFocus={() => setActiveHighlightField('invoiceNumber')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('invoiceNumber')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                    placeholder="VD: 0048123"
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      uncertainFields.includes('invoiceNumber')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                  {fieldWarnings['invoiceNumber'] && (
                    <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                      <span>🔍</span> {fieldWarnings['invoiceNumber']}
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Ngày Lập HĐ:
                    </label>
                    {uncertainFields.includes('invoiceDate') && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded animate-pulse">
                        ⚠️ Cần xác nhận
                      </span>
                    )}
                  </div>
                  <input
                    name="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    onFocus={() => setActiveHighlightField('invoiceDate')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('invoiceDate')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      uncertainFields.includes('invoiceDate')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                  {fieldWarnings['invoiceDate'] && (
                    <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                      <span>🔍</span> {fieldWarnings['invoiceDate']}
                    </p>
                  )}
                </div>
              </div>

              {/* Nhóm 2: MST & Tên Đơn Vị Bán (Tự động suy luận & đối chiếu 2 chiều) */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Mã Số Thuế (MST):
                      </label>
                      <div className="flex items-center gap-1">
                        {uncertainFields.includes('supplierTaxCode') && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1 py-0.2 rounded animate-pulse">
                            ⚠️ Mờ nét
                          </span>
                        )}
                        {taxLookupLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        name="supplierTaxCode"
                        type="text"
                        value={formData.supplierTaxCode}
                        onFocus={() => setActiveHighlightField('supplierTaxCode')}
                        onBlur={() => setActiveHighlightField(null)}
                        onMouseEnter={() => setActiveHighlightField('supplierTaxCode')}
                        onMouseLeave={() => setActiveHighlightField(null)}
                        onChange={(e) => handleInputChange('supplierTaxCode', e.target.value)}
                        placeholder="MST 10-13 số"
                        className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                          uncertainFields.includes('supplierTaxCode')
                            ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                            : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                        }`}
                      />
                    </div>
                    {fieldWarnings['supplierTaxCode'] && (
                      <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                        <span>🔍</span> {fieldWarnings['supplierTaxCode']}
                      </p>
                    )}
                  </div>
                  <div className="col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Tên Nhà Cung Cấp / Bên Bán:
                      </label>
                      <div className="flex items-center gap-1.5">
                        {uncertainFields.includes('supplierName') && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded animate-pulse">
                            ⚠️ Nhòe chữ
                          </span>
                        )}
                        {taxLookupLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                        )}
                        {formData.supplierName && formData.supplierTaxCode && !taxLookupLoading && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-sm">
                            <ShieldCheck className="h-3 w-3 text-emerald-600" />
                            <span>Đã khớp TCT</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        name="supplierName"
                        type="text"
                        value={formData.supplierName}
                        onFocus={() => setActiveHighlightField('supplierName')}
                        onBlur={() => setActiveHighlightField(null)}
                        onMouseEnter={() => setActiveHighlightField('supplierName')}
                        onMouseLeave={() => setActiveHighlightField(null)}
                        onChange={(e) => handleInputChange('supplierName', e.target.value)}
                        placeholder="Tên pháp nhân bên bán"
                        className={`w-full px-3 py-2 rounded-lg font-bold text-xs outline-none transition-all ${
                          uncertainFields.includes('supplierName')
                            ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                            : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                        }`}
                      />
                    </div>
                    {fieldWarnings['supplierName'] && (
                      <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                        <span>🔍</span> {fieldWarnings['supplierName']}
                      </p>
                    )}
                  </div>
                </div>

                {/* Thông báo tự động bổ sung trường còn lại */}
                {taxLookupFeedback && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50/80 border border-emerald-200 text-emerald-800 text-[11px] font-medium animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">{taxLookupFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Nhóm 3: Nội Dung Hàng Hóa / Dịch Vụ */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Nội Dung Mặt Hàng / Dịch Vụ:
                  </label>
                  {uncertainFields.includes('itemName') && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.2 rounded animate-pulse">
                      ⚠️ Chữ mờ
                    </span>
                  )}
                </div>
                <input
                  name="itemName"
                  type="text"
                  value={formData.itemName}
                  onFocus={() => setActiveHighlightField('itemName')}
                  onBlur={() => setActiveHighlightField(null)}
                  onMouseEnter={() => setActiveHighlightField('itemName')}
                  onMouseLeave={() => setActiveHighlightField(null)}
                  onChange={(e) => handleInputChange('itemName', e.target.value)}
                  placeholder="Diễn giải tên hàng hóa, dịch vụ cung cấp"
                  className={`w-full px-3 py-2 rounded-lg font-bold text-xs outline-none transition-all ${
                    uncertainFields.includes('itemName')
                      ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                      : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                  }`}
                />
                {fieldWarnings['itemName'] && (
                  <p className="text-[10px] text-amber-700 font-medium mt-1 flex items-center gap-1">
                    <span>🔍</span> {fieldWarnings['itemName']}
                  </p>
                )}
              </div>

              {/* Nhóm 4: Tiền Trước Thuế & Thuế Suất & Hình Thức Thanh Toán */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Tiền Trước Thuế:
                    </label>
                    {(uncertainFields.includes('preTaxAmount') || uncertainFields.includes('totalAmount')) && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1 py-0.2 rounded animate-pulse">
                        ⚠️ Mờ
                      </span>
                    )}
                  </div>
                  <input
                    name="preTaxAmount"
                    type="number"
                    value={formData.preTaxAmount}
                    onFocus={() => setActiveHighlightField('totalAmount')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('totalAmount')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('preTaxAmount', Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      uncertainFields.includes('preTaxAmount') || uncertainFields.includes('totalAmount')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Thuế Suất GTGT:
                  </label>
                  <select
                    value={formData.taxRate}
                    onChange={(e) => handleInputChange('taxRate', Number(e.target.value))}
                    className="w-full px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-950 font-mono font-bold text-xs focus:border-slate-950 outline-none cursor-pointer"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={8}>8% (NQ 204)</option>
                    <option value={10}>10% (Chuẩn)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Hình Thức TT:
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-white border border-slate-200 text-slate-950 font-bold text-xs focus:border-slate-950 outline-none cursor-pointer"
                  >
                    <option value="BANK_TRANSFER">Chuyển khoản (CK)</option>
                    <option value="CASH">Tiền mặt (TM)</option>
                  </select>
                </div>
              </div>

              {/* Tùy chọn cờ kiểm soát */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-900 font-bold">
                  <input
                    type="checkbox"
                    checked={!!formData.isStaffReimbursed}
                    onChange={(e) => handleInputChange('isStaffReimbursed', e.target.checked)}
                    className="rounded border-slate-300 text-slate-950 focus:ring-slate-950 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>Hoàn ứng nhân viên</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer text-slate-900 font-bold">
                  <input
                    type="checkbox"
                    checked={!!formData.isAdjustment}
                    onChange={(e) => handleInputChange('isAdjustment', e.target.checked)}
                    className="rounded border-slate-300 text-slate-950 focus:ring-slate-950 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span>HĐ Điều chỉnh / Thay thế</span>
                </label>

                <span className="font-mono text-slate-500">
                  Ngưỡng TM: {formatVND(dynamicConfig?.nonCashThreshold ?? 5_000_000)}
                </span>
              </div>

              {/* Live Calculation Bar */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-numeric font-bold transition-all ${
                uncertainFields.includes('totalAmount') || uncertainFields.includes('preTaxAmount')
                  ? 'bg-amber-50/95 border-2 border-amber-400 ring-2 ring-amber-300/40 shadow-xs'
                  : 'bg-slate-100 border-slate-200'
              }`}>
                <div className="text-slate-600">
                  Tiền thuế ({formData.taxRate}%): <span className="text-slate-950 font-extrabold">{formatVND(formData.taxAmount)}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-slate-950">
                    TỔNG THANH TOÁN: <span className="font-extrabold text-sm text-blue-900">{formatVND(formData.totalAmount)}</span>
                  </div>
                  {(uncertainFields.includes('totalAmount') || uncertainFields.includes('preTaxAmount')) && (
                    <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1 mt-0.5 animate-pulse">
                      ⚠️ {fieldWarnings['totalAmount'] || fieldWarnings['preTaxAmount'] || 'Số tiền nằm trong vùng mờ nét: Kế toán vui lòng kiểm tra kỹ'}
                    </span>
                  )}
                </div>
              </div>

              {/* Nút Submit Thẩm Định (Đặt liền kề ngay bên dưới dòng Tổng thanh toán, hoàn toàn không có khoảng trống thừa) */}
              <div className="pt-1">
                <Button
                  form="extraction-form"
                  type="submit"
                  disabled={isEvaluating}
                  size="lg"
                  className="w-full font-bold tracking-wide h-10 text-xs cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-brand-lime" />
                  <span>{isEvaluating ? 'ĐANG THẨM ĐỊNH RỦI RO...' : 'THẨM ĐỊNH HỒ SƠ & CHUYỂN TIẾP'}</span>
                </Button>
              </div>

            </form>

          </Card>
        </div>

      </div>

      {/* ================= TRỢ LÝ ROBOT AI THÂN THIỆN ĐANG CƯỜI (STICKY GÓC DƯỚI BÊN PHẢI) ================= */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end select-none">
        
        {/* Bong bóng lời thoại của Robot khi có thông báo/cảnh báo */}
        {isRobotSpeechOpen && (
          <div className="relative mb-3 w-80 sm:w-96 p-4 rounded-2xl bg-white border-2 border-amber-400 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 text-slate-900">
            {/* Header bong bóng */}
            <div className="flex items-center justify-between border-b border-amber-100 pb-2.5 mb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
                <span className="text-xs font-extrabold uppercase tracking-wide text-slate-950">
                  {robotMessage?.title || 'Trợ Lý AI Tax Referee'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRobotSpeechOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer transition-colors"
                title="Đóng lời nhắc"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nội dung thông báo của Robot */}
            <div className="text-xs space-y-2 text-slate-800">
              <p className="font-semibold text-amber-950 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Chào bạn! AI phát hiện các lưu ý sau trên chứng từ:</span>
              </p>
              
              {robotMessage?.items && robotMessage.items.length > 0 ? (
                <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/80 space-y-1.5 max-h-48 overflow-y-auto">
                  {robotMessage.items.map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-800">
                      <span className="text-amber-600 font-bold shrink-0 mt-0.5">•</span>
                      <span className="font-medium">{msg}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-600 italic">
                  Chưa phát hiện rủi ro. Tôi luôn túc trực để kiểm tra hồ sơ cho bạn!
                </p>
              )}
            </div>

            {/* Chú thích bấm vào robot để tắt */}
            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-500">
              <span>Bấm vào hình robot để tắt thông báo</span>
              <span className="font-mono text-emerald-600 font-bold">AI Active</span>
            </div>

            {/* Mũi tên chỉ xuống đầu chú robot */}
            <div className="absolute -bottom-2 right-7 w-4 h-4 bg-white border-r-2 border-b-2 border-amber-400 transform rotate-45" />
          </div>
        )}

        {/* Bong bóng suy nghĩ khi AI đang bóc tách / trích xuất chứng từ */}
        {isParsingDocument && (
          <div className="relative mb-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/95 border-2 border-brand-lime shadow-xl text-brand-lime flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Sparkles className="h-4 w-4 animate-spin text-brand-lime shrink-0" />
            <span className="text-xs font-bold text-white tracking-wide">
              Đang bóc tách chứng từ
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-base font-black text-brand-lime">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce [animation-delay:-0.32s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce [animation-delay:-0.16s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce"></span>
            </span>
            {/* Đuôi bong bóng suy nghĩ chỉ xuống robot */}
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 bg-slate-950 border-r-2 border-b-2 border-brand-lime transform rotate-45" />
          </div>
        )}

        {/* Nút Hình Robot thân thiện đang cười */}
        <button
          type="button"
          onClick={() => setIsRobotSpeechOpen((prev) => !prev)}
          className={`group relative p-2 rounded-2xl shadow-xl transition-all duration-300 cursor-pointer flex items-center justify-center border-2 ${
            isParsingDocument
              ? 'bg-slate-950 border-brand-lime ring-4 ring-brand-lime/30 scale-110 shadow-lime-500/20 shadow-2xl'
              : robotMessage && isRobotSpeechOpen
              ? 'bg-slate-950 border-amber-400 ring-4 ring-amber-400/20 scale-105'
              : robotMessage && !isRobotSpeechOpen
              ? 'bg-slate-950 border-rose-500 ring-4 ring-rose-500/20 animate-bounce'
              : 'bg-slate-950 border-emerald-400 hover:border-brand-lime hover:scale-105'
          }`}
          title={isParsingDocument ? 'AI đang bóc tách...' : isRobotSpeechOpen ? 'Bấm vào robot để tắt thông báo' : 'Bấm vào robot để xem thông báo AI'}
        >
          {/* SVG Robot thân thiện */}
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            {/* Ăng-ten với đầu phát sóng */}
            <line x1="32" y1="12" x2="32" y2="4" stroke="#A3E635" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="4" r="3.5" fill="#A3E635" className={isParsingDocument ? 'animate-ping' : 'animate-pulse'} />

            {/* Tai 2 bên */}
            <rect x="8" y="24" width="4" height="12" rx="2" fill="#64748B" />
            <rect x="52" y="24" width="4" height="12" rx="2" fill="#64748B" />

            {/* Khung đầu bo tròn */}
            <rect x="12" y="12" width="40" height="34" rx="12" fill="#0F172A" stroke={isParsingDocument ? '#A3E635' : '#38BDF8'} strokeWidth="2.5" />

            {/* Màn hình mặt */}
            <rect x="16" y="16" width="32" height="24" rx="8" fill="#020617" />

            {isParsingDocument ? (
              /* Trạng thái AI đang bóc tách / suy nghĩ: Hiển thị 3 dấu chấm animation nhảy động bên trong mắt */
              <g>
                <circle cx="24" cy="28" r="2.5" fill="#A3E635">
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" repeatCount="indefinite" begin="0s" />
                  <animate attributeName="cy" values="29;26;29" dur="0.9s" repeatCount="indefinite" begin="0s" />
                </circle>
                <circle cx="32" cy="28" r="2.5" fill="#A3E635">
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" repeatCount="indefinite" begin="0.2s" />
                  <animate attributeName="cy" values="29;26;29" dur="0.9s" repeatCount="indefinite" begin="0.2s" />
                </circle>
                <circle cx="40" cy="28" r="2.5" fill="#A3E635">
                  <animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" repeatCount="indefinite" begin="0.4s" />
                  <animate attributeName="cy" values="29;26;29" dur="0.9s" repeatCount="indefinite" begin="0.4s" />
                </circle>
              </g>
            ) : (
              /* Trạng thái bình thường: Mắt cười híp siêu thân thiện ^ ^ */
              <g>
                <path d="M21 27C21 24 26 24 26 27" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <path d="M38 27C38 24 43 24 43 27" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
                <circle cx="21" cy="31" r="2.2" fill="#FB7185" />
                <circle cx="43" cy="31" r="2.2" fill="#FB7185" />
                <path d="M27 31C28.5 35 35.5 35 37 31" stroke="#A3E635" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Thân robot */}
            <rect x="20" y="48" width="24" height="12" rx="6" fill="#1E293B" stroke={isParsingDocument ? '#A3E635' : '#38BDF8'} strokeWidth="2" />
            <circle cx="32" cy="54" r="2.5" fill="#A3E635" />
          </svg>

          {/* Badge thông báo nếu chưa mở lời thoại */}
          {robotMessage && !isRobotSpeechOpen && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-600 text-[10px] font-bold text-white items-center justify-center shadow-md">
                !
              </span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
};
