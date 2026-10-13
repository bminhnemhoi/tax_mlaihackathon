import {executablePolicySummary} from './policyContract';
import {DEFAULT_POLICY_CONFIG} from '@/lib/constants';
import {SystemPolicyConfigSchema} from '@/lib/schemas';
export interface PolicyVersionMetadata {version:string;releaseDate:string;updatedBy:string;status:'ACTIVE'|'DRAFT'|'ARCHIVED';changeLog:string[];text:string;}
export const DEFAULT_TAX_SOP_2026_TEXT=executablePolicySummary(SystemPolicyConfigSchema.parse(DEFAULT_POLICY_CONFIG));
export const TAX_SOP_2026_TEXT=DEFAULT_TAX_SOP_2026_TEXT;
export const INITIAL_POLICY_METADATA:PolicyVersionMetadata={version:'referee-contract-2026-10-12',releaseDate:'2026-10-12',updatedBy:'Registry quy tắc đang thực thi',status:'ACTIVE',changeLog:['Tạo SOP từ registry và config; ghi chú tự do được lưu riêng. Nguồn pháp lý đã đối chiếu ở cấp văn bản; diễn giải điều khoản cần xác minh.'],text:DEFAULT_TAX_SOP_2026_TEXT};
