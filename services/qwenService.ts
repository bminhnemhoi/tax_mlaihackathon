import { QWEN_API_CONFIG } from '@/lib/constants';
import { InvoiceInput, ActionOptionSchema, RiskGroup } from '@/lib/schemas';
import { z } from 'zod';

export const QwenQuestionResultSchema = z.object({
  flaggedReason: z.string().min(5),
  plainExplanation: z.string().min(10),
  sopClause: z.string().min(3),
  actionableQuestion: z.string().min(10),
  options: z.tuple([ActionOptionSchema, ActionOptionSchema]),
  requiresCFO: z.boolean()
});

export type QwenQuestionResult = z.infer<typeof QwenQuestionResultSchema>;

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
 * Gọi Qwen Model (qwen-plus-character) để thực hiện suy luận thuế, thẩm định rủi ro
 */
export async function callQwenChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string = QWEN_API_CONFIG.MODEL,
  timeoutMs = 25000
): Promise<string> {
  const url = QWEN_API_CONFIG.ENDPOINT;
  const apiKey = QWEN_API_CONFIG.API_KEY;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.1
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[Qwen API] Lỗi HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('[Qwen API] Không nhận được nội dung phản hồi từ mô hình');
  }

  return content;
}

/**
 * Actionable Question Generator (Q-Gen) dùng Alibaba Cloud Qwen (qwen-plus-character)
 * Giúp KTT hoặc CFO ra phán quyết trong 3 giây đối với hóa đơn rủi ro
 */
export async function generateActionableQuestionWithQwen(
  invoice: InvoiceInput,
  riskGroup: RiskGroup,
  detectedHint?: string,
  sopClauseHint?: string
): Promise<QwenQuestionResult> {
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
      "resultingAction": "ACCEPT_WITH_DOCS"
    },
    {
      "id": "B",
      "label": "Tên ngắn trên nút bấm (dưới 35 ký tự)",
      "actionDescription": "Mô tả hành động cụ thể khi chọn nút này",
      "resultingAction": "REJECT_TAX_DEDUCTION"
    }
  ]
}
Các giá trị hợp lệ duy nhất của resultingAction gồm: 'ACCEPT_WITH_DOCS', 'REJECT_TAX_DEDUCTION', 'FORWARD_TO_CFO', 'REQUEST_SUPPLIER_REISSUE', 'ACCEPT_ADJUSTMENT', 'ACCEPT_WITH_DEFENSE_DOSSIER'.`;

  const totalAmountStr = typeof invoice.totalAmount === 'number'
    ? invoice.totalAmount.toLocaleString('vi-VN')
    : String(invoice.totalAmount || '0');

  const userPrompt = `DỮ LIỆU HÓA ĐƠN ĐẦU VÀO:
- Mã số hóa đơn: ${invoice.invoiceNumber || invoice.id}
- Ngày lập: ${invoice.invoiceDate || 'Chưa rõ'}
- Nhà cung cấp: ${invoice.supplierName} (MST: ${invoice.supplierTaxCode})
- Tổng tiền: ${totalAmountStr} VNĐ
- Phương thức thanh toán: ${invoice.paymentMethod === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}
- Phân loại rủi ro: ${riskGroup}
${detectedHint ? `- Dấu hiệu vi phạm: ${detectedHint}` : ''}
${sopClauseHint ? `- Gợi ý điều khoản: ${sopClauseHint}` : ''}

Hãy trả về duy nhất chuỗi JSON hợp lệ theo đúng cấu trúc đã chỉ định.`;

  try {
    const rawContent = await callQwenChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    const parsed = extractCleanJson(rawContent);

    // Chuẩn hóa và làm sạch options để bảo vệ Guardrail Zod
    const VALID_ACTIONS = [
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
          resultingAction: VALID_ACTIONS.includes(parsed.options[0].resultingAction)
            ? parsed.options[0].resultingAction
            : 'ACCEPT_WITH_DOCS'
        },
        {
          id: 'B',
          label: String(parsed.options[1].label || 'Từ chối khấu trừ'),
          actionDescription: String(parsed.options[1].actionDescription || parsed.options[1].label || 'Loại chi phí thuế khỏi khấu trừ'),
          resultingAction: VALID_ACTIONS.includes(parsed.options[1].resultingAction)
            ? parsed.options[1].resultingAction
            : 'REJECT_TAX_DEDUCTION'
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

    return QwenQuestionResultSchema.parse(parsed);
  } catch (err: any) {
    console.error('[Qwen Service] Q-Gen gặp sự cố:', err);
    throw err;
  }
}
