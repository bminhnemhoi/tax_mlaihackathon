import { allowRate } from './rateLimit';

/**
 * Ngân sách gọi AI tính phí (OWASP LLM10 — tiêu thụ không giới hạn). Mỗi lần gọi Vision hoặc tra cứu có grounding tốn tiền và
 * thời gian; không có trần thì một phiên (hoặc một vòng lặp lỗi) đốt được ngân sách và làm chậm instance duy nhất.
 * Tính theo phiên/người dùng (giám khảo dùng chung NAT nên không tính theo IP), cộng một trần toàn tiến trình. Fail-closed:
 * vượt trần thì không gọi AI — người dùng nhập tay/tải XML, hoặc dữ kiện được đánh dấu "cần xác minh thủ công".
 */
const HOUR = 3_600_000;
const limit = (name: string, fallback: number) => Number(process.env[name]) > 0 ? Number(process.env[name]) : fallback;
const enforced = () => process.env.NODE_ENV !== 'test' || process.env.TAX_REFEREE_FORCE_LIMITS === '1';

export const AI_BUDGET_DEFAULTS = { visionPerUserHour: 60, visionGlobalHour: 600, groundingPerSessionHour: 60, groundingGlobalHour: 300 } as const;

export function aiBudgetConfig() {
  return {
    visionPerUserHour: limit('TAX_REFEREE_PARSE_PER_HOUR', AI_BUDGET_DEFAULTS.visionPerUserHour),
    visionGlobalHour: limit('TAX_REFEREE_VISION_GLOBAL_PER_HOUR', AI_BUDGET_DEFAULTS.visionGlobalHour),
    groundingPerSessionHour: limit('TAX_REFEREE_GROUNDING_PER_SESSION_HOUR', AI_BUDGET_DEFAULTS.groundingPerSessionHour),
    groundingGlobalHour: limit('TAX_REFEREE_GROUNDING_PER_HOUR', AI_BUDGET_DEFAULTS.groundingGlobalHour),
  };
}

/** Một lần gọi Gemini Vision (ảnh / PDF scan) của người dùng này còn trong ngân sách không. */
export function allowVisionCall(userId: string): boolean {
  if (!enforced()) return true;
  const c = aiBudgetConfig();
  return allowRate(`vision:${userId}`, c.visionPerUserHour, HOUR) && allowRate('vision:global', c.visionGlobalHour, HOUR);
}

/** Một lần tra cứu MST có grounding (Google Search qua proxy) của phiên này còn trong ngân sách không. */
export function allowGroundingCall(sessionKey: string): boolean {
  if (!enforced()) return true;
  const c = aiBudgetConfig();
  return allowRate(`grounding:${sessionKey}`, c.groundingPerSessionHour, HOUR) && allowRate('grounding:global', c.groundingGlobalHour, HOUR);
}
