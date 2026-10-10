'use client';

import React, { useRef, useState, useEffect, useLayoutEffect } from 'react';
import {
  Send,
  FilePlus,
  Sparkles,
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
  Highlighter,
  Building,
  Calendar,
  DollarSign,
  ShieldCheck,
  FileCheck2,
  Plus,
  Move,
  X
} from 'lucide-react';
import { InvoiceInput, RefereeDecision, SystemPolicyConfig, OcrHighlight, FieldEvidence } from '@/lib/schemas';
import { formatVND, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

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
      invoiceDate: '',
      supplierTaxCode: '',
      supplierName: '',
      itemName: '',
      preTaxAmount: 0,
      taxRate: undefined as unknown as InvoiceInput['taxRate'],
      taxAmount: 0,
      totalAmount: 0,
      paymentMethod: undefined,
      hasBankSlip: undefined,
      hasItemManifest: undefined,
      sellerStatus: 'UNKNOWN',
      isImageBlurry: false,
      isAdjustment: false,
      isStaffReimbursed: false
    };
  });

  const [isEvaluating, setIsEvaluating] = useState(false);
  const [lastEngine, setLastEngine] = useState<string | null>(null);
  const [isParsingDocument, setIsParsingDocument] = useState(false);
  const parseRequestIdRef = useRef(0);
  const extractionStartRef = useRef<{requestId:number;started:number;complete:boolean;cacheHit:boolean}|null>(null);
  const [extractionTiming,setExtractionTiming] = useState<{elapsedMs:number;cacheHit:boolean}|null>(null);
  useLayoutEffect(() => {
    const measurement=extractionStartRef.current;
    if (isParsingDocument || !measurement?.complete) return;
    // Two frames: the form commit has painted before reporting end-to-end time.
    let second=0;
    const first=requestAnimationFrame(()=>{ second=requestAnimationFrame(()=>{
      if (measurement.requestId !== parseRequestIdRef.current) return;
      setExtractionTiming({elapsedMs:Math.round(performance.now()-measurement.started),cacheHit:measurement.cacheHit});
      extractionStartRef.current=null;
    }); });
    return ()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[isParsingDocument]);

  const parseAbortRef = useRef<AbortController | null>(null);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);
  const [uncertainFields, setUncertainFields] = useState<string[]>([]);
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [fieldEvidence, setFieldEvidence] = useState<Record<string, FieldEvidence>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [ocrHighlights, setOcrHighlights] = useState<OcrHighlight[]>([]);
  const [showOcrHighlights, setShowOcrHighlights] = useState<boolean>(true);
  const [activeHighlightField, setActiveHighlightField] = useState<string | null>(null);
  const [evaluationRevision, setEvaluationRevision] = useState<number | undefined>(undefined);
  const [lastResult, setLastResult] = useState<{
    status: 'ROUTINE' | 'ESCALATED';
    message: string;
    approvedTax?: number;
    riskGroup?: string;
  } | null>(null);

  // Trợ lý Robot AI thân thiện (Có thể Drag di chuyển khắp màn hình)
  const [isRobotSpeechOpen, setIsRobotSpeechOpen] = useState<boolean>(false);
  const [robotPos, setRobotPos] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingRobot, setIsDraggingRobot] = useState<boolean>(false);
  const isDraggingRobotRef = useRef(false);
  const robotDragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0
  });
  const hasMovedRobotRef = useRef(false);

  const handleRobotPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const currentX = robotPos ? robotPos.x : rect.left;
    const currentY = robotPos ? robotPos.y : rect.top;

    isDraggingRobotRef.current = true;
    hasMovedRobotRef.current = false;
    setIsDraggingRobot(true);
    robotDragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY
    };
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
  };

  const handleRobotPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRobotRef.current) return;
    const dx = e.clientX - robotDragStartRef.current.startX;
    const dy = e.clientY - robotDragStartRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasMovedRobotRef.current = true;
    }

    if (hasMovedRobotRef.current) {
      const rawX = robotDragStartRef.current.initialX + dx;
      const rawY = robotDragStartRef.current.initialY + dy;
      const maxX = typeof window !== 'undefined' ? Math.max(10, window.innerWidth - 76) : 800;
      const maxY = typeof window !== 'undefined' ? Math.max(10, window.innerHeight - 76) : 600;
      const boundedX = Math.max(10, Math.min(maxX, rawX));
      const boundedY = Math.max(10, Math.min(maxY, rawY));
      setRobotPos({ x: boundedX, y: boundedY });
    }
  };

  const handleRobotPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRobotRef.current) return;
    isDraggingRobotRef.current = false;
    setIsDraggingRobot(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Fallback
    }
    // Nếu chỉ nhấp chuột (không di chuyển) thì mở/đóng hộp thoại
    if (!hasMovedRobotRef.current) {
      setIsRobotSpeechOpen((prev) => !prev);
    }
  };

  const [robotMessage, setRobotMessage] = useState<{
    title: string;
    items: string[];
    isError: boolean;
  } | null>(null);
  const hasFieldNoticeRef = useRef(false);

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
      setRobotMessage({ title: 'Hồ sơ đạt chuẩn thường quy', items: [lastResult.message || 'Hồ sơ đạt chuẩn thường quy'], isError: false });
      setIsRobotSpeechOpen(true);
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

  useEffect(() => {
    const fieldLabels: Record<string, string> = {
      invoiceNumber: 'Số hóa đơn', invoiceDate: 'Ngày lập hóa đơn', supplierTaxCode: 'Mã số thuế',
      supplierName: 'Nhà cung cấp', itemName: 'Hàng hóa / dịch vụ', preTaxAmount: 'Tiền trước thuế',
      taxRate: 'Thuế suất', paymentMethod: 'Hình thức thanh toán', hasBankSlip: 'Chứng từ thanh toán',
      hasItemManifest: 'Bảng kê hàng hóa', sellerStatus: 'Trạng thái mã số thuế', totalAmount: 'Tổng thanh toán',
      taxAmount: 'Tiền thuế'
    };
    const summarizeFields = (fields: string[]) => {
      const labels = [...new Set(fields.map((field) => fieldLabels[field] || field))];
      const visible = labels.slice(0, 5);
      if (labels.length > visible.length) visible.push(`và ${labels.length - visible.length} trường khác`);
      return visible.join(', ');
    };
    const items: string[] = [];
    const errorFields = Object.keys(formErrors);
    const uncertainSet = new Set([...uncertainFields, ...Object.keys(fieldWarnings)].filter((field) => !formErrors[field]));

    if (errorFields.length) {
      items.push(`Hoàn thiện ${errorFields.length} trường trước khi thẩm định: ${summarizeFields(errorFields)}.`);
    }
    if (uncertainSet.size) {
      items.push(`Đối chiếu với hóa đơn gốc: ${summarizeFields([...uncertainSet])}.`);
    }

    const coveredTaxCode = [...uncertainSet, ...errorFields].includes('supplierTaxCode');
    const coveredAmount = [...uncertainSet, ...errorFields].some((field) => ['preTaxAmount', 'totalAmount', 'taxAmount'].includes(field));
    const remainingWarnings = [...new Set(documentWarnings)].filter((warning) => {
      const text = warning.toLowerCase();
      if (text.startsWith('đã bóc tách tự động')) return false;
      if (coveredTaxCode && (text.includes('mst') || text.includes('mã số thuế'))) return false;
      if (coveredAmount && (text.includes('tổng tiền') || text.includes('tổng thanh toán') || text.includes('số tiền'))) return false;
      return true;
    });
    if (remainingWarnings.length && !errorFields.length && !uncertainSet.size) {
      items.push(remainingWarnings[0]);
    }
    const lookupIssueCovered = errorFields.includes('sellerStatus') || uncertainSet.has('supplierTaxCode') || uncertainSet.has('sellerStatus');
    if (taxLookupFeedback?.status === 'WARNING' && !lookupIssueCovered) items.push(taxLookupFeedback.message);

    if (items.length > 0) {
      hasFieldNoticeRef.current = true;
      setRobotMessage({
        title: errorFields.length ? 'Cần hoàn thiện hồ sơ' : 'Cần đối soát chứng từ',
        items: [...new Set(items)],
        isError: errorFields.length > 0 || remainingWarnings.some((w) => w.includes('⚠️') || w.toLowerCase().includes('lỗi')) || taxLookupFeedback?.status === 'WARNING',
      });
    } else if (hasFieldNoticeRef.current) {
      hasFieldNoticeRef.current = false;
      setRobotMessage(null);
    }
  }, [documentWarnings, uncertainFields, fieldWarnings, formErrors, taxLookupFeedback]);

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
    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isImage) {
      return file;
    }
    // Nếu file ảnh <= 2MB thì upload trực tiếp ngay lập tức (<1ms), không tốn thời gian chạy Canvas giải nén trên trình duyệt
    if (file.size <= 2 * 1024 * 1024) {
      return file;
    }
    return new Promise((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX_DIM = 1800; // Giữ độ phân giải sắc nét cao để AI đọc chính xác số tiền, mã số thuế và dòng hàng
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
            if (!blob || (blob.size >= file.size && width === img.width)) {
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
          0.88
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
    const fileNameLower = file.name.toLowerCase();
    const supported = file.type === 'application/pdf' || file.type.includes('xml')
      || ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)
      || /\.(xml|pdf|png|jpe?g|webp)$/i.test(file.name);
    if (!supported) {
      const message = 'Định dạng chưa được hỗ trợ. Hãy chọn file XML, PDF, PNG, JPG hoặc WEBP.';
      setDocumentWarnings([message]);
      return;
    }

    parseAbortRef.current?.abort();
    const requestId = ++parseRequestIdRef.current;
    extractionStartRef.current={requestId,started:performance.now(),complete:false,cacheHit:false};
    setExtractionTiming(null);
    const controller = new AbortController();
    parseAbortRef.current = controller;
    setIsParsingDocument(true);
    setDocumentWarnings([]);
    setFormErrors({});
    setUploadedFile(file);
    handleResetZoomAndPan();

    // Xác định định dạng để preview
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
      if (requestId !== parseRequestIdRef.current) return;

      const form = new FormData();
      form.append('file', fileToUpload);
      const response = await fetch('/api/documents/parse', { method: 'POST', body: form, signal: controller.signal });
      const data = await response.json();
      if (requestId !== parseRequestIdRef.current) return;
      if (!response.ok) throw new Error(data.error || 'Lỗi đọc chứng từ');
      extractionStartRef.current={requestId,started:extractionStartRef.current!.started,complete:true,cacheHit:Boolean(data.performance?.cacheHit)};
      const extracted = Object.fromEntries(
        Object.entries(data.invoice || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );
      setEvaluationRevision(undefined);
      setFormData(() => ({
        invoiceNumber:'',invoiceDate:'',supplierTaxCode:'',supplierName:'',itemName:'',preTaxAmount:0,taxRate:undefined as unknown as InvoiceInput['taxRate'],taxAmount:0,totalAmount:0,paymentMethod:undefined,hasBankSlip:undefined,hasItemManifest:undefined,sellerStatus:'UNKNOWN',isImageBlurry:false,isAdjustment:false,
        ...extracted,
        sourceArtifactId: data.artifactId,
        sourceHash: data.sourceHash,
        id: `DOC-${Date.now()}`
      } as InvoiceInput));
      setDocumentWarnings(data.warnings || []);
      setUncertainFields(data.uncertainFields || []);
      setFieldWarnings(data.fieldWarnings || {});
      setFieldEvidence(data.fieldEvidence || {});
      setOcrHighlights(data.ocrHighlights || []);
      setLastResult(null);
    } catch (error) {
      if (requestId !== parseRequestIdRef.current || (error instanceof Error && error.name === 'AbortError')) return;
      const msg = error instanceof Error ? error.message : 'Không thể đọc file';
      setDocumentWarnings([msg]);
      setRobotMessage({
        title: 'Lỗi Bóc Tách Chứng Từ',
        items: [msg],
        isError: true
      });
      setIsRobotSpeechOpen(true);
    } finally {
      if (requestId === parseRequestIdRef.current) setIsParsingDocument(false);
    }
  };

  const handleRawTextParse = async () => {
    if (!pastedText.trim()) {
      setRobotMessage({ title: 'Chưa có văn bản để bóc tách', items: ['Vui lòng dán nội dung hóa đơn hoặc văn bản trước.'], isError: true });
      setIsRobotSpeechOpen(true);
      return;
    }
    parseAbortRef.current?.abort();
    const requestId = ++parseRequestIdRef.current;
    extractionStartRef.current={requestId,started:performance.now(),complete:false,cacheHit:false};
    setExtractionTiming(null);
    const controller = new AbortController();
    parseAbortRef.current = controller;
    setIsParsingDocument(true);
    setDocumentWarnings([]);
    setFormErrors({});
    setUploadedFile(null);
    setPreviewFileType(null);
    handleResetZoomAndPan();

    try {
      const response = await fetch('/api/documents/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: pastedText }),
        signal: controller.signal
      });
      const data = await response.json();
      if (requestId !== parseRequestIdRef.current) return;
      if (!response.ok) throw new Error(data.error || 'Lỗi bóc tách văn bản');
      extractionStartRef.current={requestId,started:extractionStartRef.current!.started,complete:true,cacheHit:false};
      const extracted = Object.fromEntries(
        Object.entries(data.invoice || {}).filter(([, value]) => value !== undefined && value !== null && value !== '')
      );
      setEvaluationRevision(undefined);
      setFormData(() => ({
        invoiceNumber:'',invoiceDate:'',supplierTaxCode:'',supplierName:'',itemName:'',preTaxAmount:0,taxRate:undefined as unknown as InvoiceInput['taxRate'],taxAmount:0,totalAmount:0,paymentMethod:undefined,hasBankSlip:undefined,hasItemManifest:undefined,sellerStatus:'UNKNOWN',isImageBlurry:false,isAdjustment:false,
        ...extracted,
        sourceArtifactId: data.artifactId,
        sourceHash: data.sourceHash,
        id: `DOC-${Date.now()}`
      } as InvoiceInput));
      setDocumentWarnings(data.warnings || []);
      setUncertainFields(data.uncertainFields || []);
      setFieldWarnings(data.fieldWarnings || {});
      setFieldEvidence(data.fieldEvidence || {});
      setOcrHighlights(data.ocrHighlights || []);
      setLastResult(null);
    } catch (error) {
      if (requestId !== parseRequestIdRef.current || (error instanceof Error && error.name === 'AbortError')) return;
      const msg = error instanceof Error ? error.message : 'Không thể bóc tách văn bản';
      setDocumentWarnings([msg]);
    } finally {
      if (requestId === parseRequestIdRef.current) setIsParsingDocument(false);
    }
  };

  // Nút: Hóa đơn tiếp theo -> Dọn sạch hóa đơn cũ và đưa khung upload quay trở lại
  const handleNextInvoice = () => {
    setExtractionTiming(null);
    extractionStartRef.current=null;
    hasFieldNoticeRef.current = false;
    parseRequestIdRef.current += 1;
    parseAbortRef.current?.abort();
    parseAbortRef.current = null;
    autoLookupAbortRef.current?.abort();
    autoLookupAbortRef.current = null;
    setIsParsingDocument(false);
    setTaxLookupLoading(false);
    setTaxLookupFeedback(null);
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
    setFieldEvidence({});
    setFormErrors({});
    setOcrHighlights([]);
    setActiveHighlightField(null);
    setLastResult(null);
    setEvaluationRevision(undefined);
    setFormData({
      id: `INV-${Date.now()}`,
      invoiceNumber: '',
      invoiceDate: '',
      supplierTaxCode: '',
      supplierName: '',
      itemName: '',
      preTaxAmount: 0,
      taxRate: undefined as unknown as InvoiceInput['taxRate'],
      taxAmount: 0,
      totalAmount: 0,
      paymentMethod: undefined,
      hasBankSlip: undefined,
      hasItemManifest: undefined,
      sellerStatus: 'UNKNOWN',
      isImageBlurry: false,
      isAdjustment: false,
      isStaffReimbursed: false
    } as InvoiceInput);
    setRobotMessage({ title: 'Sẵn sàng tiếp nhận chứng từ', items: ['Bạn có thể tải lên hóa đơn tiếp theo.'], isError: false });
    setIsRobotSpeechOpen(true);
  };

  const changeInputMode = (nextMode: 'FILE' | 'PASTE') => {
    if (inputMode === nextMode) return;
    const hasUnsavedData = hasDocument || Boolean(
      pastedText.trim() || formData.invoiceNumber || formData.invoiceDate || formData.supplierTaxCode
      || formData.supplierName || formData.itemName || formData.totalAmount > 0
      || formData.taxRate !== undefined || formData.paymentMethod || formData.hasBankSlip !== undefined
      || formData.hasItemManifest !== undefined || formData.sellerStatus !== 'UNKNOWN'
    );
    if (hasUnsavedData && !window.confirm('Đổi cách tiếp nhận sẽ xóa dữ liệu chứng từ hiện tại. Bạn có muốn tiếp tục không?')) return;
    handleNextInvoice();
    setInputMode(nextMode);
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
    if (field === 'supplierName' || field === 'supplierTaxCode') setTaxLookupFeedback(null);
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      if (field === 'preTaxAmount' || field === 'taxRate') {
        const pre = field === 'preTaxAmount' ? Number(value) : updated.preTaxAmount;
        const rate = field === 'taxRate' ? (value === undefined ? undefined : Number(value)) : updated.taxRate;
        if (rate === undefined) {
          updated.taxAmount = 0;
          updated.totalAmount = pre;
        } else {
          const tax = Number((pre * (rate / 100)).toFixed(0));
          updated.taxAmount = tax;
          updated.totalAmount = pre + tax;
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (formData.invoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(formData.invoiceDate)) errors.invoiceDate='Ngày sai định dạng.';
    for(const field of ['preTaxAmount','taxAmount','totalAmount'] as const) if(!Number.isFinite(formData[field])) errors[field]='Số tiền sai định dạng.';
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      requestAnimationFrame(() => document.getElementById('invoice-error-summary')?.focus());
      return;
    }

    setFormErrors({});
    setIsEvaluating(true);
    try {
      const submitted:Record<string,unknown>={...formData,sourceUncertainFields:uncertainFields};
      for(const field of ['invoiceNumber','invoiceDate','supplierTaxCode','supplierName','itemName']) if(!String(submitted[field] || '').trim()) delete submitted[field];
      const payload = {
        invoice: submitted,
        expectedRevision: evaluationRevision,
        policyConfig: dynamicConfig,
        sourceUncertainFields: uncertainFields,
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
      setFormData(prev => ({...prev, id: decision.invoiceId}));
      setEvaluationRevision(data.workflow.revision);
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

      onEvaluateResult(decision, {...formData, id: decision.invoiceId});
    } catch (err) {
      setRobotMessage({ title: 'Lỗi thẩm định hồ sơ', items: [err instanceof Error ? err.message : 'Lỗi thẩm định'], isError: true });
      setIsRobotSpeechOpen(true);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2">
      {Object.keys(formErrors).length > 0 && <div id="invoice-error-summary" tabIndex={-1} role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><h3 className="font-semibold">Cần sửa dữ liệu đầu vào</h3><ul className="mt-2 list-inside list-disc">{Object.entries(formErrors).map(([field,message]) => <li key={field}><a className="underline" href={`#${field}`}>{message}</a></li>)}</ul></div>}
      {extractionTiming && <p role="status" data-testid="extraction-timing" data-elapsed-ms={extractionTiming.elapsedMs} data-cache-hit={String(extractionTiming.cacheHit)} className="text-xs text-slate-600">
        Đã điền dữ liệu sau {(extractionTiming.elapsedMs/1000).toFixed(2)} giây{extractionTiming.cacheHit ? ' · kết quả đã lưu của cùng chứng từ' : ''}. Kiểm tra các trường chưa xác minh trước khi thẩm định.
      </p>}
      {Object.keys(fieldEvidence).length > 0 && (() => {
        const fieldLabels: Record<string, string> = {
          invoiceNumber: 'Số hóa đơn', invoiceDate: 'Ngày hóa đơn', supplierTaxCode: 'MST người bán',
          supplierName: 'Tên người bán', itemName: 'Tên hàng hóa/dịch vụ', preTaxAmount: 'Tiền trước thuế',
          taxRate: 'Thuế suất', taxAmount: 'Tiền thuế', totalAmount: 'Tổng tiền'
        };
        const evidenceEntries = Object.entries(fieldEvidence).filter(([, evidence]) => evidence.status !== 'VERIFIED');
        return (
          <div role="status" aria-label="Nguồn dữ liệu bóc tách" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            <div className="font-semibold">Nguồn dữ liệu cần đối chiếu</div>
            {evidenceEntries.length === 0 ? (
              <p className="mt-1 text-emerald-800">Các trường đã đọc đều có nguồn xác minh ({Object.keys(fieldEvidence).length} trường).</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {evidenceEntries.map(([field, evidence]) => {
                  const statusLabel = evidence.status === 'ABSENT' ? 'Thiếu' : evidence.status === 'CONFLICT' ? 'Mâu thuẫn' : evidence.status === 'UNCERTAIN' ? 'Chưa xác minh' : 'Suy ra';
                  const sourceLabel = evidence.source === 'XML' ? 'XML' : evidence.source === 'PDF_TEXT' ? 'PDF có chữ' : evidence.source === 'OCR' ? 'OCR' : evidence.source === 'VLM' ? 'AI đọc ảnh' : evidence.source === 'USER' ? 'Người dùng' : 'Suy luận';
                  return <li key={field}><strong>{fieldLabels[field] || field}</strong>: {statusLabel} · nguồn {sourceLabel} · tin cậy {Math.round(evidence.confidence * 100)}%</li>;
                })}
              </ul>
            )}
            <p className="mt-1 text-amber-800">Hệ thống giữ nguyên giá trị thiếu/mâu thuẫn và sẽ chuyển tiếp khi chưa đủ bằng chứng.</p>
          </div>
        );
      })()}
      <p role="status" className="text-xs text-slate-600">{isParsingDocument ? 'Đang đọc chứng từ…' : isEvaluating ? 'Đang kiểm tra quy tắc…' : lastResult?.status === 'ROUTINE' ? 'Đã tự xử lý và tạo chứng từ nội bộ.' : lastResult?.status === 'ESCALATED' ? 'Đã dừng để xác minh / phê duyệt.' : 'Thông tin thanh toán hoặc nhà cung cấp chưa biết sẽ được chuyển tiếp để xác minh.'}</p>
      {/* ================= HEADER THANH ĐIỀU HƯỚNG CHẾ ĐỘ ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
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
            onClick={() => changeInputMode('FILE')}
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
            onClick={() => changeInputMode('PASTE')}
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
      <div className="grid grid-cols-1 xl:grid-cols-12 xl:grid-rows-1 gap-2 flex-1 min-h-0 items-stretch overflow-hidden">

        {/* -------------------------------------------------------------
            CỘT BÊN TRÁI (COL-SPAN-6): KHUNG UPLOAD HOẶC HIỂN THỊ HÓA ĐƠN
        ------------------------------------------------------------- */}
        <div className="xl:col-span-6 flex flex-col h-full min-h-0 overflow-hidden">
          
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Chọn hoặc kéo thả file chứng từ XML, PDF, PNG, JPG hoặc WEBP"
                className={`relative w-full h-full min-h-0 flex flex-col items-center justify-center p-4 sm:p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-950 ${
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
              <div className="w-full h-full min-h-0 flex flex-col p-4 rounded-2xl border border-slate-200 bg-slate-50/60 justify-between space-y-4 overflow-auto">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">Dán thông tin hóa đơn (Email / Ghi chú / Text):</span>
                    <div className="flex flex-wrap items-center gap-1.5">
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
            <Card className="w-full h-full min-h-0 flex flex-col overflow-hidden border border-slate-200 shadow-sm bg-white">
              
              {/* Header Preview Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-4 py-2.5 bg-slate-100/80 border-b border-slate-200 text-xs shrink-0">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-slate-700" />
                  <span className="font-bold text-slate-950 truncate max-w-[180px]">
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
                  <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoomChange(imageZoom - 20)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-700 cursor-pointer"
                      title="Thu nhỏ (-20%)"
                        aria-label="Thu nhỏ bản xem trước"
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
                        aria-label="Phóng to bản xem trước"
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
                        aria-label="Đặt lại bản xem trước"
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
                        <Highlighter className="h-3 w-3" aria-hidden="true" />
                        <span>Tô thực thể mờ</span>
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
                
                {/* Thanh tiến trình siêu tốc khi AI đang bóc tách */}
                {isParsingDocument && (
                  <div className="w-full h-1 bg-slate-200 overflow-hidden shrink-0 relative z-30">
                    <div className="h-full bg-gradient-to-r from-brand-lime via-emerald-400 to-sky-400 animate-pulse w-full" />
                  </div>
                )}

                {/* 1. Nếu là ảnh: Hỗ trợ Drag Pan & Zoom với Ctrl/Cmd + Wheel */}
                {previewFileType === 'IMAGE' && previewUrl && (
                  <div
                    ref={imageContainerRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className={`w-full h-full min-h-0 relative overflow-hidden flex items-center justify-center select-none bg-slate-900/5 ${
                      isDraggingImage ? 'cursor-grabbing' : 'cursor-grab'
                    }`}
                  >
                    {/* Badge nổi hiển thị trạng thái AI đang bóc tách trên nền ảnh */}
                    {isParsingDocument && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/90 text-white border border-brand-lime shadow-lg backdrop-blur-xs pointer-events-none text-xs font-bold animate-in fade-in zoom-in-95 duration-200">
                        <Sparkles className="h-3.5 w-3.5 text-brand-lime animate-spin shrink-0" />
                        <span>AI đang đọc chứng từ…</span>
                      </div>
                    )}

                    <div
                      style={{
                        transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${imageZoom / 100})`,
                        transformOrigin: 'center center',
                        transition: isDraggingImage ? 'none' : 'transform 0.08s ease-out',
                      }}
                      className="w-full h-full flex items-center justify-center p-3.5"
                    >
                      <div className="relative inline-block select-none max-w-full max-h-full">
                        <img
                          src={previewUrl}
                          alt="Chứng từ hóa đơn"
                          draggable={false}
                          className="max-w-full max-h-full w-auto h-auto object-contain rounded-lg shadow-md border border-slate-300 pointer-events-none select-none block"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain'
                          }}
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
                            return (
                              <div
                                key={idx}
                                style={{
                                  left: `${leftPercent}%`,
                                  top: `${topPercent}%`,
                                  width: `${widthPercent}%`,
                                  height: `${heightPercent}%`,
                                }}
                                className={`absolute rounded-xs pointer-events-auto cursor-pointer transition-all z-20 ${
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
                  <div className="w-full h-full min-h-0 flex-1 overflow-hidden">
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
                    <div className="w-full h-full min-h-0 overflow-auto p-4 flex flex-col items-center">
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
                            <div><span className="text-slate-500">Ký hiệu:</span> <span className="font-mono font-bold">{formData.invoiceSeries || 'Chưa đọc được'}</span></div>
                            <div className="text-right"><span className="text-slate-500">Số HĐ:</span> <span className="font-mono font-extrabold text-slate-950 text-xs">{formData.invoiceNumber || '---'}</span></div>
                            <div><span className="text-slate-500">Ngày lập:</span> <span className="font-bold">{formatDate(formData.invoiceDate)}</span></div>
                            <div className="text-right"><span className="text-slate-500">Tiền tệ:</span> <span className="font-bold">VND</span></div>
                          </div>
                        </div>

                        {/* Bên bán */}
                        <div className="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px]">
                          <div className="font-extrabold text-slate-950 uppercase">{formData.supplierName || 'Đơn vị bán hàng'}</div>
                          <div><span className="text-slate-500">Mã số thuế:</span> <span className="font-mono font-bold text-slate-950">{formData.supplierTaxCode || '---'}</span></div>
                          <div><span className="text-slate-500">Hình thức TT:</span> <span className="font-bold">{formData.paymentMethod === 'CASH' ? 'Tiền mặt' : formData.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản' : 'Chưa xác định'}</span></div>
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
                            <span className="col-span-2 text-center font-mono font-bold text-slate-700">{formData.taxRate === undefined ? '—' : `${formData.taxRate}%`}</span>
                            <span className="col-span-3 text-right font-mono font-bold text-slate-950">{formatVND(formData.preTaxAmount)}</span>
                          </div>
                        </div>

                        {/* Tổng kết tiền */}
                        <div className="space-y-1 text-right text-[11px] pt-1">
                          <div><span className="text-slate-500">Cộng tiền hàng:</span> <span className="font-mono font-bold">{formatVND(formData.preTaxAmount)}</span></div>
                          <div><span className="text-slate-500">Tiền thuế GTGT ({formData.taxRate === undefined ? 'chưa rõ' : `${formData.taxRate}%`}):</span> <span className="font-mono font-bold">{formatVND(formData.taxAmount)}</span></div>
                          <div className="text-sm font-extrabold text-slate-950 border-t border-slate-200 pt-1.5 mt-1">
                            Tổng thanh toán: <span className="text-blue-900 font-numeric">{formatVND(formData.totalAmount)}</span>
                          </div>
                        </div>

                        {/* Chữ ký số */}
                        <div className="border border-emerald-200 bg-emerald-50/70 p-2 rounded-lg flex items-center justify-between text-[11px]">
                          <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                            <ShieldCheck className="h-4 w-4 text-emerald-700" />
                            <span>Chưa xác minh chữ ký số bên bán</span>
                          </div>
                          <span className="text-[10px] font-mono text-emerald-700">Signature Unverified</span>
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
                  disabled={isParsingDocument}
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
        <div className="xl:col-span-6 flex flex-col h-full min-h-0 overflow-hidden">
          <Card className="w-full h-full min-h-0 p-3 border border-slate-200 shadow-sm bg-white flex flex-col overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 shrink-0">
              <div>
                <h3 className="text-sm font-bold text-slate-950 uppercase tracking-wide">
                  Dữ Liệu Bóc Tách Được
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kiểm tra và hiệu chỉnh thông tin đối soát trước khi thẩm định
                </p>
              </div>

              {isParsingDocument && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-lime-50 text-lime-900 border border-lime-300 text-[11px] font-bold animate-pulse">
                  <Sparkles className="h-3 w-3 text-lime-600 animate-spin" />
                  <span>Đang trích xuất...</span>
                </div>
              )}
            </div>
            {/* Form Fields: Liền mạch, nút thẩm định nằm ngay bên dưới Tổng thanh toán */}
            <form id="extraction-form" onSubmit={handleSubmit} className="space-y-2 text-xs text-slate-800">
              
              {/* Nhóm 1: Số HĐ & Ngày Lập */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="invoiceNumber" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Số Hóa Đơn:
                    </label>
                  </div>
                  <input
                    id="invoiceNumber"
                    name="invoiceNumber"
                    type="text"
                    value={formData.invoiceNumber}
                    aria-invalid={Boolean(formErrors.invoiceNumber)}
                    onFocus={() => setActiveHighlightField('invoiceNumber')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('invoiceNumber')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                    placeholder="VD: 0048123"
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      formErrors.invoiceNumber
                        ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                        : uncertainFields.includes('invoiceNumber')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="invoiceDate" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Ngày Lập HĐ:
                    </label>
                  </div>
                  <input
                    id="invoiceDate"
                    name="invoiceDate"
                    type="date"
                    value={formData.invoiceDate}
                    aria-invalid={Boolean(formErrors.invoiceDate)}
                    onFocus={() => setActiveHighlightField('invoiceDate')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('invoiceDate')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      formErrors.invoiceDate
                        ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                        : uncertainFields.includes('invoiceDate')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                </div>
              </div>

              {/* Nhóm 2: MST & Tên Đơn Vị Bán (Tự động suy luận & đối chiếu 2 chiều) */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="supplierTaxCode" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Mã Số Thuế (MST):
                      </label>
                      <div className="flex items-center gap-1">
                        {taxLookupLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        id="supplierTaxCode"
                        name="supplierTaxCode"
                        type="text"
                        value={formData.supplierTaxCode}
                        aria-invalid={Boolean(formErrors.supplierTaxCode)}
                        onFocus={() => setActiveHighlightField('supplierTaxCode')}
                        onBlur={() => setActiveHighlightField(null)}
                        onMouseEnter={() => setActiveHighlightField('supplierTaxCode')}
                        onMouseLeave={() => setActiveHighlightField(null)}
                        onChange={(e) => handleInputChange('supplierTaxCode', e.target.value)}
                        placeholder="MST 10-13 số"
                        className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                          formErrors.supplierTaxCode
                            ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                            : uncertainFields.includes('supplierTaxCode')
                            ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                            : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                        }`}
                      />
                    </div>
                  </div>
                  <div className="col-span-8">
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="supplierName" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        Tên Nhà Cung Cấp / Bên Bán:
                      </label>
                      <div className="flex items-center gap-1.5">
                        {taxLookupLoading && (
                          <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin" />
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        id="supplierName"
                        name="supplierName"
                        type="text"
                        value={formData.supplierName}
                        aria-invalid={Boolean(formErrors.supplierName)}
                        onFocus={() => setActiveHighlightField('supplierName')}
                        onBlur={() => setActiveHighlightField(null)}
                        onMouseEnter={() => setActiveHighlightField('supplierName')}
                        onMouseLeave={() => setActiveHighlightField(null)}
                        onChange={(e) => handleInputChange('supplierName', e.target.value)}
                        placeholder="Tên pháp nhân bên bán"
                        className={`w-full px-3 py-2 rounded-lg font-bold text-xs outline-none transition-all ${
                          formErrors.supplierName
                            ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                            : uncertainFields.includes('supplierName')
                            ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                            : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                        }`}
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Nhóm 3: Nội Dung Hàng Hóa / Dịch Vụ */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="itemName" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Nội Dung Mặt Hàng / Dịch Vụ:
                  </label>
                </div>
                <input
                  id="itemName"
                  name="itemName"
                  type="text"
                  value={formData.itemName}
                  aria-invalid={Boolean(formErrors.itemName)}
                  onFocus={() => setActiveHighlightField('itemName')}
                  onBlur={() => setActiveHighlightField(null)}
                  onMouseEnter={() => setActiveHighlightField('itemName')}
                  onMouseLeave={() => setActiveHighlightField(null)}
                  onChange={(e) => handleInputChange('itemName', e.target.value)}
                  placeholder="Diễn giải tên hàng hóa, dịch vụ cung cấp"
                  className={`w-full px-3 py-2 rounded-lg font-bold text-xs outline-none transition-all ${
                    formErrors.itemName
                      ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                      : uncertainFields.includes('itemName')
                      ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                      : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                  }`}
                />
              </div>

              {/* Nhóm 4: Tiền Trước Thuế & Thuế Suất & Hình Thức Thanh Toán */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="preTaxAmount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Tiền Trước Thuế:
                    </label>
                  </div>
                  <input
                    id="preTaxAmount"
                    name="preTaxAmount"
                    type="number"
                    value={formData.preTaxAmount}
                    aria-invalid={Boolean(formErrors.preTaxAmount)}
                    onFocus={() => setActiveHighlightField('totalAmount')}
                    onBlur={() => setActiveHighlightField(null)}
                    onMouseEnter={() => setActiveHighlightField('totalAmount')}
                    onMouseLeave={() => setActiveHighlightField(null)}
                    onChange={(e) => handleInputChange('preTaxAmount', Number(e.target.value))}
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold text-xs outline-none transition-all ${
                      formErrors.preTaxAmount
                        ? 'bg-rose-50 border-2 border-rose-400 ring-2 ring-rose-200 text-rose-950 focus:border-rose-600 focus:ring-rose-500'
                        : uncertainFields.includes('preTaxAmount') || uncertainFields.includes('totalAmount')
                        ? 'bg-amber-50/90 border-2 border-amber-400 ring-2 ring-amber-300/40 text-amber-950 focus:border-amber-600 focus:ring-amber-500'
                        : 'bg-white border border-slate-200 text-slate-950 focus:border-slate-950 focus:ring-1 focus:ring-slate-950'
                    }`}
                  />
                </div>

                <div>
                  <label htmlFor="taxRate" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Thuế Suất GTGT:
                  </label>
                  <select
                    id="taxRate"
                    value={formData.taxRate ?? ''}
                    aria-invalid={Boolean(formErrors.taxRate)}
                    onChange={(e) => handleInputChange('taxRate', e.target.value === '' ? undefined : Number(e.target.value))}
                    className={`w-full px-2.5 py-2 rounded-lg bg-white border text-slate-950 font-mono font-bold text-xs focus:border-slate-950 outline-none cursor-pointer ${formErrors.taxRate ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                  >
                    <option value="">Chưa xác định</option>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={8}>8% (NQ 204)</option>
                    <option value={10}>10% (Chuẩn)</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="paymentMethod" className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Hình Thức TT:
                  </label>
                  <select
                    id="paymentMethod"
                    value={formData.paymentMethod || ''}
                    aria-invalid={Boolean(formErrors.paymentMethod)}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value || undefined)}
                    className={`w-full px-2 py-2 rounded-lg bg-white border text-slate-950 font-bold text-xs focus:border-slate-950 outline-none cursor-pointer ${formErrors.paymentMethod ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                  >
                    <option value="">Chưa xác định</option>
                    <option value="BANK_TRANSFER">Chuyển khoản (CK)</option>
                    <option value="CASH">Tiền mặt (TM)</option>
                  </select>
                </div>
              </div>

              {/* Tùy chọn cờ kiểm soát */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px]">
                <label htmlFor="hasBankSlip" className="flex items-center gap-2 text-slate-900 font-bold">
                  <span>Chứng từ thanh toán</span>
                  <select
                    id="hasBankSlip"
                    value={formData.hasBankSlip === undefined ? '' : formData.hasBankSlip ? 'yes' : 'no'}
                    aria-invalid={Boolean(formErrors.hasBankSlip)}
                    onChange={(e) => handleInputChange('hasBankSlip', e.target.value === '' ? undefined : e.target.value === 'yes')}
                    className={`rounded-md border bg-white px-2 py-1.5 text-[11px] font-bold ${formErrors.hasBankSlip ? 'border-rose-400' : 'border-slate-200'}`}
                  >
                    <option value="">Chưa xác nhận</option>
                    <option value="yes">Có</option>
                    <option value="no">Không</option>
                  </select>
                </label>
                <label htmlFor="hasItemManifest" className="flex items-center gap-2 text-slate-900 font-bold">
                  <span>Bảng kê hàng hóa</span>
                  <select
                    id="hasItemManifest"
                    value={formData.hasItemManifest === undefined ? '' : formData.hasItemManifest ? 'yes' : 'no'}
                    aria-invalid={Boolean(formErrors.hasItemManifest)}
                    onChange={(e) => handleInputChange('hasItemManifest', e.target.value === '' ? undefined : e.target.value === 'yes')}
                    className={`rounded-md border bg-white px-2 py-1.5 text-[11px] font-bold ${formErrors.hasItemManifest ? 'border-rose-400' : 'border-slate-200'}`}
                  >
                    <option value="">Chưa xác nhận</option>
                    <option value="yes">Có</option>
                    <option value="no">Không</option>
                  </select>
                </label>
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

                <span className="ml-auto font-mono text-slate-500">
                  Ngưỡng TM: {formatVND(dynamicConfig?.nonCashThreshold ?? 5_000_000)}
                </span>
              </div>              <div>
                <label htmlFor="sellerStatus" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">Trạng thái mã số thuế bên bán:</label>
                <select
                  id="sellerStatus"
                  value={formData.sellerStatus}
                  aria-invalid={Boolean(formErrors.sellerStatus)}
                  onChange={(e) => handleInputChange('sellerStatus', e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-xs font-bold text-slate-950 outline-none ${formErrors.sellerStatus ? 'border-rose-400 ring-1 ring-rose-300' : 'border-slate-200'}`}
                >
                  <option value="UNKNOWN">Chưa xác minh</option>
                  <option value="ACTIVE">Đang hoạt động</option>
                  <option value="SUSPENDED">Tạm ngừng</option>
                  <option value="CLOSED">Đã đóng mã số thuế</option>
                </select>
              </div>

              {/* Live Calculation Bar */}
              <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-numeric font-bold transition-all ${
                uncertainFields.includes('totalAmount') || uncertainFields.includes('preTaxAmount')
                  ? 'bg-amber-50/95 border-2 border-amber-400 ring-2 ring-amber-300/40 shadow-xs'
                  : 'bg-slate-100 border-slate-200'
              }`}>
                <div className="text-slate-600">
                  Tiền thuế ({formData.taxRate === undefined ? 'chưa rõ' : `${formData.taxRate}%`}): <span id="taxAmount" className="text-slate-950 font-extrabold">{formatVND(formData.taxAmount)}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <div className="text-slate-950">
                    TỔNG THANH TOÁN: <span id="totalAmount" className="font-extrabold text-sm text-blue-900">{formatVND(formData.totalAmount)}</span>
                  </div>
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

      {/* ================= TRỢ LÝ ROBOT AI THÂN THIỆN ĐANG CƯỜI (DRAGGABLE TOÀN MÀN HÌNH) ================= */}
      <div
        style={
          robotPos
            ? {
                left: `${robotPos.x}px`,
                top: `${robotPos.y}px`,
                right: 'auto',
                bottom: 'auto'
              }
            : undefined
        }
        className={`fixed z-50 flex flex-col select-none touch-none ${
          robotPos ? '' : 'bottom-6 right-6'
        } ${
          robotPos && robotPos.x < 420 ? 'items-start' : 'items-end'
        }`}
      >
        {/* Bong bóng lời thoại của Robot khi có thông báo/cảnh báo */}
        {isRobotSpeechOpen && (
          <section
            className={`relative flex max-h-[70vh] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-3xl border bg-white text-slate-900 shadow-2xl animate-in fade-in duration-200 ${
              robotPos && robotPos.y < 350 ? 'order-last mt-3 mb-0' : 'order-first mb-3 mt-0'
            } ${robotMessage?.isError ? 'border-amber-200' : 'border-slate-200'}`}
            aria-label="Trợ lý Tax Referee"
            role="status"
            aria-live="polite"
          >
            <header className={`flex items-center gap-3 border-b px-4 py-3 ${robotMessage?.isError ? 'border-amber-100 bg-gradient-to-r from-amber-50 to-white' : 'border-sky-100 bg-gradient-to-r from-sky-50 to-white'}`}>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ${robotMessage?.isError ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Tax Referee AI</p>
                <h3 className="truncate text-sm font-extrabold text-slate-950">{robotMessage?.title || 'Trợ lý chứng từ'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsRobotSpeechOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-slate-800 cursor-pointer"
                aria-label="Đóng khung chat"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 space-y-3 overflow-y-auto bg-gradient-to-b from-slate-50/70 to-white p-4">
              <div className={`rounded-2xl rounded-tl-sm border p-3.5 ${robotMessage?.isError ? 'border-amber-100 bg-amber-50/80' : 'border-sky-100 bg-sky-50/70'}`}>
                <p className="mb-2 text-[11px] font-semibold text-slate-600">
                  {robotMessage?.items.length === 1 ? 'Mình có một điểm cần bạn xem:' : `Mình đã gom còn ${robotMessage?.items.length || 0} điểm cần bạn xem:`}
                </p>
              {robotMessage?.items && robotMessage.items.length > 0 ? (
                <ul className="space-y-2">
                  {robotMessage.items.map((msg, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-800">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${robotMessage.isError ? 'bg-amber-200 text-amber-900' : 'bg-sky-200 text-sky-900'}`}>{idx + 1}</span>
                      <span className="pt-0.5">{msg}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600">Chưa có mục cần xử lý.</p>
              )}
              </div>
              <p className="px-1 text-[10px] leading-relaxed text-slate-400">Đối chiếu các mục này với hóa đơn gốc trước khi thẩm định.</p>
            </div>

            <footer className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-2.5">
              <span className="text-[10px] font-medium text-slate-400">Trợ lý chứng từ</span>
              <button type="button" onClick={() => setIsRobotSpeechOpen(false)} className="rounded-xl bg-slate-950 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-slate-700 cursor-pointer">Đã xem</button>
            </footer>
          </section>
        )}

        {/* Bong bóng suy nghĩ khi AI đang bóc tách / trích xuất chứng từ */}
        {isParsingDocument && (
          <div
            className={`relative px-3.5 py-2 rounded-2xl bg-slate-950/95 border-2 border-brand-lime shadow-xl text-brand-lime flex items-center gap-2 animate-in fade-in duration-200 ${
              robotPos && robotPos.y < 350 ? 'order-last mt-2.5 mb-0' : 'order-first mb-2.5 mt-0'
            }`}
          >
            <Sparkles className="h-4 w-4 animate-spin text-brand-lime shrink-0" />
            <span className="text-xs font-bold text-white tracking-wide">
              Đang bóc tách chứng từ
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-base font-black text-brand-lime">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce [animation-delay:-0.32s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce [animation-delay:-0.16s]"></span>
              <span className="w-1.5 h-1.5 rounded-full bg-brand-lime animate-bounce"></span>
            </span>
            {/* Đuôi bong bóng suy nghĩ */}
            <div
              className={`absolute w-3 h-3 bg-slate-950 border-r-2 border-b-2 border-brand-lime transform ${
                robotPos && robotPos.y < 350 ? '-top-1.5 right-6 rotate-[225deg]' : '-bottom-1.5 right-6 rotate-45'
              }`}
            />
          </div>
        )}

        {/* Nút Hình Robot thân thiện đang cười - Hỗ trợ Drag Pan di chuyển vị trí */}
        <div
          onPointerDown={handleRobotPointerDown}
          onPointerMove={handleRobotPointerMove}
          onPointerUp={handleRobotPointerUp}
          onPointerCancel={handleRobotPointerUp}
          className={`group relative p-2 rounded-2xl shadow-xl transition-all duration-200 flex items-center justify-center border-2 select-none ${
            isDraggingRobot ? 'cursor-grabbing scale-110 shadow-2xl ring-4 ring-brand-lime/40' : 'cursor-grab hover:scale-105'
          } ${
            isParsingDocument
              ? 'bg-slate-950 border-brand-lime ring-4 ring-brand-lime/30 shadow-lime-500/20 shadow-2xl'
              : robotMessage && isRobotSpeechOpen
              ? 'bg-slate-950 border-amber-400 ring-4 ring-amber-400/20'
              : robotMessage && !isRobotSpeechOpen
              ? robotMessage.isError
                ? 'bg-slate-950 border-amber-400 ring-2 ring-amber-400/20'
                : 'bg-slate-950 border-sky-400 ring-2 ring-sky-400/20'
              : 'bg-slate-950 border-emerald-400 hover:border-brand-lime'
          }`}
          title="Bấm để mở trợ lý, giữ chuột để kéo thả robot đến vị trí bất kỳ"
        >
          {/* SVG Robot thân thiện */}
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0 pointer-events-none">
            {/* Ăng-ten với đầu phát sóng (chỉ ping khi AI đang thực sự bóc tách tài liệu) */}
            <line x1="32" y1="12" x2="32" y2="4" stroke="#A3E635" strokeWidth="3" strokeLinecap="round" />
            <circle cx="32" cy="4" r="3.5" fill="#A3E635" className={isParsingDocument ? 'animate-ping' : ''} />

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
              /* Trạng thái bình thường: Mắt cười híp siêu thân thiện ^ ^ tĩnh và êm dịu */
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

          {/* Badge thông báo tĩnh thanh lịch nếu có tin nhắn mới */}
          {robotMessage && !isRobotSpeechOpen && (
            <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-950 shadow-sm ${robotMessage.isError ? 'bg-amber-400' : 'bg-sky-400'}`} />
          )}
        </div>
      </div>
    </div>
  );
};
