import type { InvoiceInput, RefereeDecision } from '@/lib/schemas';

export type WorkspaceInvoice = {
  id: string;
  revision?: number;
  taxHold?: boolean;
  internalVoucherId?:string|null;
  allowedActions?: { approve?:boolean; requestInformation?:boolean; savePrecedent?:boolean; pause?:boolean; resume?:boolean; taxHold?:boolean; undo?:boolean; blockedReason?:string|null; undoTarget?:{eventType:string;targetStatus:string}|null };
  review?: {unresolvedFields?:string[]};
  invoiceNumber: string;
  invoiceDate: string;
  supplierTaxCode: string;
  supplierName: string;
  itemName: string;
  totalAmount: number;
  taxAmount: number;
  status: string;
  invoice: InvoiceInput;
  decision: RefereeDecision | null;
  evaluationId: string | null;
  policyVersion: string | null;
  legalVersion: string | null;
  updatedAt: string;
  createdAt?: string;
  evaluatedAt?: string|null;
  dossierReady?: boolean;
  resolution: { role: string; option: string; action: string; accepted: boolean; resolvedAt: string } | null;
  latestAudit?: { eventType: string; actorId: string; payload: Record<string, unknown>; at: string } | null;
};
