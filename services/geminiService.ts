import { GEMINI_API_CONFIG } from '@/lib/constants';
import { InvoiceInput, ActionOptionSchema, RiskGroup } from '@/lib/schemas';
import { z } from 'zod';

export const GeminiQuestionResultSchema = z.object({
  flaggedReason: z.string().min(5),
  plainExplanation: z.string().min(10),
  sopClause: z.string().min(3),
  actionableQuestion: z.string().min(10),
  options: z.tuple([ActionOptionSchema, ActionOptionSchema]),
  requiresCFO: z.boolean()
});

export type GeminiQuestionResult = z.infer<typeof GeminiQuestionResultSchema>;

function sanitizeJsonString(str: string): string {
  let inString = false;
  let escaped = false;
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '"' && !escaped) {
      inString = !inString;
      out += char;
    } else if (inString && (char === '\n' || char === '\r')) {
      out += ' ';
    } else {
      out += char;
    }
    escaped = char === '\\' && !escaped;
  }
  return out;
}

export function extractCleanJson(text: string): any {
  let clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
  const firstBrace = clean.indexOf('{');
  const lastBrace = clean.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    clean = clean.substring(firstBrace, lastBrace + 1);
  }
  clean = clean.replace(/,\s*([\]}])/g, '$1');
  clean = sanitizeJsonString(clean);
  return JSON.parse(clean);
}

/**
 * Gọi Gemini 2.5 Flash qua ShopAIKey để thực hiện chat/suy luận thuế
 */
export async function callGeminiChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = GEMINI_API_CONFIG.MODEL,
  timeoutMs = 25000
): Promise<string> {
  const url = GEMINI_API_CONFIG.ENDPOINT;
  const apiKey = GEMINI_API_CONFIG.API_KEY;
  if (!apiKey) throw new Error('Chưa cấu hình GEMINI_API_KEY để sinh câu hỏi.');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 2048,
      temperature: 0.1
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[Gemini API] Lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('[Gemini API] Không nhận được nội dung phản hồi từ mô hình');
  }

  return content;
}

/**
 * Trích xuất hóa đơn trực tiếp từ ảnh bằng Gemini 2.5 Flash Vision (không qua OCR cục bộ)
 */
export async function extractInvoiceWithGeminiVision(
  fileBase64: string,
  mimeType: string,
  fileName?: string
): Promise<Partial<InvoiceInput>> {
  const apiKey = GEMINI_API_CONFIG.API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình GEMINI_API_KEY trong .env.local để đọc ảnh hóa đơn.');
  }

  const dataUrl = `data:${mimeType};base64,${fileBase64}`;
  const prompt = `Trích xuất hóa đơn Việt Nam sang JSON:
{
  "invoiceNumber": "Số hóa đơn hoặc mã bill",
  "invoiceDate": "YYYY-MM-DD",
  "supplierTaxCode": "Mã số thuế bên bán (10 hoặc 13 số, tuyệt đối không lấy SĐT bàn hoặc mã NVBH)",
  "supplierName": "Tên bên bán/thương hiệu (giữ nguyên 100% dấu tiếng Việt)",
  "buyerTaxCode": "Mã số thuế bên mua",
  "buyerName": "Tên bên mua",
  "itemName": "Tên các mặt hàng chính",
  "totalAmount": 0,
  "preTaxAmount": 0,
  "taxRate": 0,
  "taxAmount": 0,
  "paymentMethod": "CASH hoặc BANK_TRANSFER"
}
QUY TẮC:
1. Giữ nguyên 100% dấu tiếng Việt.
2. Không nhầm lẫn số điện thoại với Mã số thuế.
3. Số tiền là số nguyên VNĐ (ví dụ: 125000).
4. Chỉ trả về một JSON duy nhất.`;

  const model = GEMINI_API_CONFIG.MODEL;

  try {
    const t0 = Date.now();
    console.log(`[Gemini Vision] Bắt đầu đọc ảnh: Model=${model}, size=${Math.round(dataUrl.length / 1024)}KB`);

    // Thử gọi qua endpoint native v1beta với thinkingBudget: 0 để đạt tốc độ tối đa (~4s)
    let rawContent = '';
    try {
      const nativeUrl = `https://api.shopaikey.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const nativeRes = await fetch(nativeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType || 'image/jpeg', data: fileBase64 } }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            thinkingConfig: { thinkingBudget: 0 }
          }
        }),
        signal: AbortSignal.timeout(25000)
      });

      if (nativeRes.ok) {
        const nativeData = await nativeRes.json();
        const finishReason = nativeData.candidates?.[0]?.finishReason;
        if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
          throw new Error('Gemini Vision trả về kết quả bị cắt; không chấp nhận dữ liệu chưa hoàn chỉnh.');
        }
        const parts = nativeData.candidates?.[0]?.content?.parts || [];
        rawContent = parts[parts.length - 1]?.text?.trim() || '';
      }
    } catch (nativeErr) {
      console.warn('[Gemini Vision] Native endpoint không phản hồi, fallback sang OpenAI format:', nativeErr);
    }

    // Fallback sang OpenAI-compatible endpoint nếu native endpoint chưa trả dữ liệu
    if (!rawContent) {
      const res = await fetch(GEMINI_API_CONFIG.ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl } }
              ]
            }
          ],
          response_format: { type: 'json_object' },
          max_tokens: 2048,
          temperature: 0.1
        }),
        signal: AbortSignal.timeout(35000)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`[Gemini Vision] Lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      const msg = data.choices?.[0]?.message;
      if (data.choices?.[0]?.finish_reason === 'length') {
        throw new Error('Gemini Vision trả về kết quả bị cắt; không chấp nhận dữ liệu chưa hoàn chỉnh.');
      }
      rawContent = msg?.content?.trim() || '';
    }

    const elapsed = Date.now() - t0;
    console.log(`[Gemini Vision] Hoàn tất trong ${elapsed}ms (${(elapsed / 1000).toFixed(2)}s)`);

    if (!rawContent) {
      throw new Error('[Gemini Vision] Không nhận được nội dung từ mô hình');
    }

    return extractCleanJson(rawContent);
  } catch (err: any) {
    console.error('[Gemini Vision Service] Trích xuất ảnh thất bại:', err);
    throw err;
  }
}

/**
 * Actionable Question Generator (Q-Gen) dùng Gemini 2.5 Flash
 * Giúp KTT hoặc CFO ra phán quyết trong 3 giây đối với hóa đơn rủi ro
 */
export async function generateActionableQuestionWithGemini(
  invoice: InvoiceInput,
  riskGroup: RiskGroup,
  detectedHint?: string,
  sopClauseHint?: string
): Promise<GeminiQuestionResult> {
  const systemPrompt = `VAI TRÒ:
Bạn là "ACTIONABLE QUESTION GENERATOR" cho hệ thống Tax Referee (MLAI Hackathon 2026).
Nhiệm vụ của bạn là hỗ trợ Kế toán trưởng (KTT) hoặc Giám đốc Tài chính (CFO) ra phán quyết trong 3 giây khi phát hiện một hóa đơn có rủi ro thuế.

CĂN CỨ PHÁP LÝ & QUY CHẾ:
- Quy chế Quản trị Thuế nội bộ: Tax-SOP-2026 v2.5.
- Nghị định 254/2026/NĐ-CP (Truy vết hóa đơn điều chỉnh/thay thế, bắt buộc mã HĐ gốc; sai tên địa chỉ nhưng đúng MST gửi Mẫu 04/SS-HĐĐT vẫn hợp lệ).
- Nghị quyết 204/2025/QH15 & Nghị định 174/2025/NĐ-CP (Quy tắc thuế suất 8% áp dụng đến 31/12/2026, danh mục loại trừ bắt buộc 10% như viễn thông, tài chính, bds, hóa chất).
- Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & NĐ 320/2025/NĐ-CP (Hóa đơn từ 5.000.000 VNĐ trở lên bắt buộc thanh toán không dùng tiền mặt).
- Điều 2.2 Tax-SOP-2026: Nhà cung cấp đóng MST: Xuất SAU ngày đóng MST = bất hợp pháp 100%; Xuất TRƯỚC ngày đóng MST = tạm dừng để KTT xác minh bộ hồ sơ thực tế.
- Điều 3.3 & Chương 4 Tax-SOP-2026: Hóa đơn điều chỉnh giảm hoặc chi phí bồi thường >= 200.000.000 VNĐ, hoặc hóa đơn làm biến động Tham số K vào Vùng Đỏ (< 0.95 hoặc > 1.35 theo CV 2392/TCT-QLRR) bắt buộc thẩm quyền CFO.

YÊU CẦU ĐẦU RA (JSON THUẦN TÚY):
Trả về JSON đúng cấu trúc sau (không markdown, không thêm text bên ngoài):
{
  "flaggedReason": "Lý do vi phạm ngắn gọn, súc tích (1 câu)",
  "plainExplanation": "Lời giải thích bằng tiếng Việt bình dân, dễ hiểu cho người không chuyên kế toán (1-2 câu)",
  "sopClause": "Điều khoản quy chế vi phạm (ví dụ: Khoản 2 Điều 14 Luật Thuế GTGT 48/2024/QH15 & Điều 1.2 Tax-SOP-2026)",
  "actionableQuestion": "Câu hỏi ĐÓNG, NGẮN GỌN, CHÍNH XÁC. BẮT BUỘC chứa: Mã hóa đơn, Tên đối tác, Số tiền VNĐ, Căn cứ luật/SOP, và hỏi KTT/CFO lựa chọn giữa 2 phương án đối ứng.",
  "requiresCFO": true/false (true nếu rủi ro thuộc Nhóm 3 EXCEED_AUTHORITY, số tiền >= 200M hoặc K-factor vào Vùng Đỏ; ngược lại false),
  "options": [
    {
      "id": "A",
      "label": "Tên ngắn trên nút bấm (dưới 35 ký tự)",
      "actionDescription": "Mô tả hành động cụ thể khi chọn nút này",
      "resultingAction": "ACCEPT_WITH_DOCS" | "REJECT_TAX_DEDUCTION" | "FORWARD_TO_CFO" | "REQUEST_SUPPLIER_REISSUE" | "ACCEPT_ADJUSTMENT" | "ACCEPT_WITH_DEFENSE_DOSSIER"
    },
    {
      "id": "B",
      "label": "Tên ngắn trên nút bấm (dưới 35 ký tự)",
      "actionDescription": "Mô tả hành động cụ thể khi chọn nút này",
      "resultingAction": "ACCEPT_WITH_DOCS" | "REJECT_TAX_DEDUCTION" | "FORWARD_TO_CFO" | "REQUEST_SUPPLIER_REISSUE" | "ACCEPT_ADJUSTMENT" | "ACCEPT_WITH_DEFENSE_DOSSIER"
    }
  ]
}`;

  const userPrompt = `THÔNG TIN HÓA ĐƠN CẦN PHÁN QUYẾT:
- Số HĐ: ${invoice.invoiceNumber || 'Chưa rõ'}
- Ngày lập: ${invoice.invoiceDate || 'Chưa rõ'}
- Bên bán: ${invoice.supplierName || 'Chưa rõ'} (MST: ${invoice.supplierTaxCode || 'Chưa rõ'})
- Trạng thái bên bán: ${invoice.sellerStatus || 'UNKNOWN'}
- Mặt hàng: ${invoice.itemName || 'Hàng hóa/dịch vụ'}
- Tiền trước thuế: ${invoice.preTaxAmount?.toLocaleString('vi-VN')} VNĐ
- Thuế suất: ${invoice.taxRate}%
- Tiền thuế: ${invoice.taxAmount?.toLocaleString('vi-VN')} VNĐ
- Tổng thanh toán: ${invoice.totalAmount?.toLocaleString('vi-VN')} VNĐ
- Hình thức thanh toán: ${invoice.paymentMethod || 'Chưa rõ'}
- Chứng từ kèm theo: Chứng từ thanh toán ngân hàng: ${invoice.hasBankSlip ? 'CÓ' : 'KHÔNG'}; Bảng kê chi tiết: ${invoice.hasItemManifest ? 'CÓ' : 'KHÔNG'}
- Nhóm rủi ro hệ thống phát hiện: ${riskGroup}
${detectedHint ? `- Chi tiết rủi ro: ${detectedHint}` : ''}
${sopClauseHint ? `- Gợi ý điều khoản: ${sopClauseHint}` : ''}

Hãy trả về duy nhất chuỗi JSON hợp lệ theo đúng cấu trúc đã chỉ định.`;

  try {
    const rawContent = await callGeminiChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const parsed = extractCleanJson(rawContent);

    const validActions = [
      'ACCEPT_WITH_DOCS',
      'REJECT_TAX_DEDUCTION',
      'FORWARD_TO_CFO',
      'REQUEST_SUPPLIER_REISSUE',
      'ACCEPT_ADJUSTMENT',
      'ACCEPT_WITH_DEFENSE_DOSSIER'
    ];

    if (Array.isArray(parsed.options) && parsed.options.length >= 2) {
      parsed.options = [
        {
          id: 'A',
          label: String(parsed.options[0].label || 'Chấp thuận có điều kiện'),
          actionDescription: String(parsed.options[0].actionDescription || parsed.options[0].label || 'Chấp nhận kèm hồ sơ giải trình'),
          resultingAction: validActions.includes(parsed.options[0].resultingAction) ? parsed.options[0].resultingAction : 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: String(parsed.options[1].label || 'Từ chối khấu trừ'),
          actionDescription: String(parsed.options[1].actionDescription || parsed.options[1].label || 'Loại chi phí thuế khỏi khấu trừ'),
          resultingAction: validActions.includes(parsed.options[1].resultingAction) ? parsed.options[1].resultingAction : 'REJECT_TAX_DEDUCTION'
        }
      ];
    } else {
      parsed.options = [
        {
          id: 'A',
          label: 'Chấp thuận kèm bổ sung chứng từ',
          actionDescription: 'Yêu cầu phòng ban cung cấp ủy nhiệm chi / biên bản trước khi quyết toán',
          resultingAction: 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: 'Loại khỏi chi phí được trừ',
          actionDescription: 'Không kê khai khấu trừ thuế GTGT để tránh bị phạt thuế',
          resultingAction: 'REJECT_TAX_DEDUCTION'
        }
      ];
    }

    parsed.requiresCFO = Boolean(parsed.requiresCFO);

    return GeminiQuestionResultSchema.parse(parsed);
  } catch (err: any) {
    console.error('[Gemini Service] Q-Gen gặp sự cố:', err);
    throw err;
  }
}
