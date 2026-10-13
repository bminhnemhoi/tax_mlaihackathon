import { SHOPAIKEY_GEMINI_API_CONFIG } from '@/lib/constants';
import { normalizeTaxCodeFormat, validateTaxCode } from '@/lib/taxCode';
import { SupplierIdentity, SupplierIdentitySource } from '@/lib/schemas';
import { extractCleanJson } from './geminiService';
import { resolveSupplierIdentity, SupplierIdentityQuery } from './supplierIdentityResolver';

const OFFICIAL_HOSTS = [
  'gdt.gov.vn',
  'tracuunnt.gdt.gov.vn',
  'dangkykinhdoanh.gov.vn'
] as const;
const GOOGLE_GROUNDING_REDIRECT_HOST = 'vertexaisearch.cloud.google.com';
const GOOGLE_GROUNDING_REDIRECT_PATH = '/grounding-api-redirect/';
const MAX_REDIRECT_HOPS = 5;

type GroundingChunk = { web?: { uri?: unknown; title?: unknown } };
type GroundingSupport = {
  segment?: { text?: unknown };
  groundingChunkIndices?: unknown;
};

function normalizeName(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function isOfficialHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'gov.vn'
    || host.endsWith('.gov.vn')
    || OFFICIAL_HOSTS.some(allowed => host === allowed || host.endsWith(`.${allowed}`));
}

function directOfficialSource(url: string, title: unknown): SupplierIdentitySource | null {
  try {
    const source = new URL(url);
    if (source.protocol !== 'https:' || !isOfficialHost(source.hostname)) return null;
    return {
      title: typeof title === 'string' && title.trim() ? title.trim() : source.hostname,
      url: source.toString()
    };
  } catch {
    return null;
  }
}

async function resolveGroundingRedirect(url: string, title: unknown): Promise<SupplierIdentitySource | null> {
  const deadline = Date.now() + 5500;
  let currentUrl: URL;
  try {
    currentUrl = new URL(url);
  } catch {
    return null;
  }
  if (currentUrl.protocol !== 'https:'
    || currentUrl.hostname.toLowerCase() !== GOOGLE_GROUNDING_REDIRECT_HOST
    || !currentUrl.pathname.startsWith(GOOGLE_GROUNDING_REDIRECT_PATH)) return null;

  for (let hop = 0; hop < MAX_REDIRECT_HOPS; hop++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return null;
    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(Math.min(3500, remaining))
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) return null;
        const destination = new URL(location, currentUrl);
        // Once Google's signed link resolves, only follow HTTPS government hosts.
        if (destination.protocol !== 'https:' || !isOfficialHost(destination.hostname)) return null;
        currentUrl = destination;
        continue;
      }
      if (!response.ok || !isOfficialHost(currentUrl.hostname)) return null;
      return {
        title: typeof title === 'string' && title.trim() ? title.trim() : currentUrl.hostname,
        url: currentUrl.toString()
      };
    } catch {
      return null;
    }
  }
  return null;
}

async function officialSource(chunk: GroundingChunk): Promise<SupplierIdentitySource | null> {
  const uri = typeof chunk.web?.uri === 'string' ? chunk.web.uri : '';
  const direct = directOfficialSource(uri, chunk.web?.title);
  if (direct) return direct;

  try {
    const parsed = new URL(uri);
    const isSearchRedirect = parsed.protocol === 'https:'
      && ['www.google.com', 'google.com'].includes(parsed.hostname.toLowerCase()) && parsed.pathname === '/url';
    const targets = (isSearchRedirect ? [parsed.searchParams.get('url'), parsed.searchParams.get('q')] : [])
      .filter((value): value is string => Boolean(value));
    for (const target of targets) {
      const source = directOfficialSource(target, chunk.web?.title);
      if (source) return source;
    }
    return resolveGroundingRedirect(uri, chunk.web?.title);
  } catch {
    return null;
  }
}

async function candidateEvidence(
  candidate: { legalName: string; taxCode: string },
  invoiceName: string,
  officialSources: Array<SupplierIdentitySource | null>,
  supports: GroundingSupport[]
): Promise<SupplierIdentitySource[]> {
  const candidateName = normalizeName(candidate.legalName);
  const invoiceNameNormalized = normalizeName(invoiceName);
  const taxDigits = digits(candidate.taxCode);
  const nameSources = new Map<string, SupplierIdentitySource>();
  const taxSources = new Map<string, SupplierIdentitySource>();
  const invoiceNameSources = new Map<string, SupplierIdentitySource>();

  for (const support of supports.slice(0, 50)) {
    const text = typeof support.segment?.text === 'string' ? support.segment.text : '';
    const normalizedText = normalizeName(text);
    const citedTaxCodes = [...text.matchAll(/\b\d{10}(?:-\d{3})?\b|\b\d{12,13}\b/g)]
      .map(match => normalizeTaxCodeFormat(match[0]));
    const indices = Array.isArray(support.groundingChunkIndices)
      ? support.groundingChunkIndices.filter((index): index is number => Number.isInteger(index) && index >= 0)
      : [];
    for (const index of indices) {
      const source = officialSources[index];
      if (!source) continue;
      if (candidateName && normalizedText.includes(candidateName)) nameSources.set(source.url, source);
      if (taxDigits.length >= 10 && citedTaxCodes.includes(candidate.taxCode)) taxSources.set(source.url, source);
      if (invoiceNameNormalized && normalizedText.includes(invoiceNameNormalized)) invoiceNameSources.set(source.url, source);
    }
  }

  const sameRecordSupported = [...nameSources.keys()].some(url => taxSources.has(url));
  const invoiceNameRelated = !invoiceNameNormalized || candidateName.includes(invoiceNameNormalized)
    || [...invoiceNameSources.keys()].some(url => taxSources.has(url));
  if (!sameRecordSupported || !invoiceNameRelated) return [];

  const sourceUrls = new Set([...nameSources.keys(), ...taxSources.keys(), ...invoiceNameSources.keys()]);
  return [...sourceUrls].map(url => nameSources.get(url) || taxSources.get(url) || invoiceNameSources.get(url)!);
}

function unavailable(message = 'Không thể truy cập dịch vụ tra cứu chính thống.') : SupplierIdentity {
  return { status: 'SOURCE_UNAVAILABLE', sources: [], message };
}

/**
 * Resolve a supplier only from ShopAIKey Gemini Search grounding citations
 * that point to Vietnamese government domains, tax authority sites or the national business registry.
 * Search output is treated as untrusted until its cited text supports both
 * the legal name and tax code.
 */
export async function searchOfficialSupplierIdentity(input: {
  supplierName?: string;
  supplierTaxCode?: string;
  address?: string;
}): Promise<SupplierIdentity> {
  const supplierName = (input.supplierName || '').trim().slice(0, 240);
  const printedTaxCode = (input.supplierTaxCode || '').trim().slice(0, 32);
  const address = (input.address || '').trim().slice(0, 320);
  if (!supplierName && !printedTaxCode) return { status: 'NOT_FOUND', sources: [], message: 'Thiếu tên hoặc MST để tra cứu.' };
  const { API_KEY, BASE_URL, MODEL } = SHOPAIKEY_GEMINI_API_CONFIG;
  if (!API_KEY) return unavailable('Chưa cấu hình SHOPAIKEY_API_KEY.');

  const searchQuery = printedTaxCode
    ? `site:gov.vn ${JSON.stringify(supplierName)} ${JSON.stringify(printedTaxCode)}`
    : `site:gov.vn ${JSON.stringify(supplierName)} mã số thuế`;
  const prompt = `Perform live Google Search using this exact query: ${searchQuery}. Find official Vietnamese government documents that connect this seller name to its legal name and tax code. If a tax number is provided, search it exactly. The seller name may be a brand or former name. Cite the official source title and result in your answer; do not rely on memory or private directories.
Seller name from invoice: ${JSON.stringify(supplierName || null)}
Seller tax code from invoice: ${JSON.stringify(printedTaxCode || null)}
Seller address clue: ${JSON.stringify(address || null)}

First state the official source title, legal company name and tax code with an actual Google Search citation. Then finish with JSON: {"decision":"MATCH|AMBIGUOUS|NO_MATCH","selectedTaxCode":string|null,"candidates":[{"legalName":string,"taxCode":string}]}. Return candidates only when official sources support both name and tax code. Never invent a tax code.`;

  try {
    const endpoint = new URL(`${BASE_URL}/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`);
    endpoint.searchParams.set('key', API_KEY);
    let candidate: {
      content?: { parts?: Array<{ text?: unknown }> };
      groundingMetadata?: { groundingChunks?: GroundingChunk[]; groundingSupports?: GroundingSupport[] };
      finishReason?: string;
    } | undefined;
    let lastError: 'network' | 'http' | null = null;
    const searchDeadline = Date.now() + 18000;
    // ShopAIKey may return a text answer without structured grounding metadata
    // on the first attempt. Retry once with a sharper search request; never
    // accept the answer unless the returned grounding citation validates.
    const alternateQuery = printedTaxCode
      ? `site:gov.vn ${JSON.stringify(printedTaxCode)}`
      : `site:gov.vn ${JSON.stringify(supplierName)} "${normalizeName(supplierName).split(' ').filter(Boolean).join(' ')}"`;
    for (const searchPrompt of [prompt, `Perform a fresh live Google Search using this exact query: ${alternateQuery}. Find an official Vietnamese government document with the seller's legal name and tax code. Cite the actual result link, then finish with JSON {"decision":"MATCH|AMBIGUOUS|NO_MATCH","selectedTaxCode":string|null,"candidates":[{"legalName":string,"taxCode":string}]}. Do not cite private directories or invent facts.`]) {
      const remaining = searchDeadline - Date.now();
      if (remaining <= 0) break;
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${API_KEY}`
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: searchPrompt }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0, maxOutputTokens: 1800 }
          }),
          signal: AbortSignal.timeout(Math.min(12000, remaining)),
          cache: 'no-store'
        });
      } catch {
        lastError = 'network';
        continue;
      }
      if (!response.ok) {
        await response.text().catch(() => '');
        lastError = 'http';
        continue;
      }
      const payload = await response.json() as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: unknown }> };
        groundingMetadata?: { groundingChunks?: GroundingChunk[]; groundingSupports?: GroundingSupport[] };
        finishReason?: string;
      }>;
      };
      candidate = payload.candidates?.[0];
      const grounding = candidate?.groundingMetadata;
      if (grounding?.groundingChunks?.length && grounding.groundingSupports?.length) break;
    }
    if (!candidate?.groundingMetadata?.groundingChunks?.length || !candidate.groundingMetadata.groundingSupports?.length) {
      if (lastError === 'network' || lastError === 'http') return unavailable('Dịch vụ tra cứu chính thống đang lỗi hoặc không phản hồi.');
      return { status: 'NOT_FOUND', sources: [], message: 'Kết quả tìm kiếm chưa có trích dẫn kiểm chứng được.' };
    }
    if (!candidate || ['MAX_TOKENS', 'LENGTH'].includes(candidate.finishReason || '')) return unavailable('Kết quả tra cứu chưa đầy đủ.');
    const rawText = (candidate.content?.parts || []).map(part => typeof part.text === 'string' ? part.text : '').join('').trim();
    const answer = extractCleanJson(rawText) as {
      decision?: unknown;
      selectedTaxCode?: unknown;
      candidates?: unknown;
    };
    const chunks = candidate.groundingMetadata?.groundingChunks || [];
    const supports = candidate.groundingMetadata?.groundingSupports || [];
    const officialSources = await Promise.all(chunks.slice(0, 12).map(chunk => officialSource(chunk)));
    const supported = await Promise.all((Array.isArray(answer.candidates) ? answer.candidates.slice(0, 10) : []).flatMap((rawCandidate) => {
      if (!rawCandidate || typeof rawCandidate !== 'object') return [];
      const row = rawCandidate as Record<string, unknown>;
      const legalName = typeof row.legalName === 'string' ? row.legalName.trim() : '';
      const rawTaxCode = typeof row.taxCode === 'string' ? row.taxCode.trim() : '';
      const taxCode = normalizeTaxCodeFormat(rawTaxCode);
      if (!legalName || !taxCode || !validateTaxCode(taxCode).isValid) return [];
      return [candidateEvidence({ legalName, taxCode }, supplierName, officialSources, supports).then(sources =>
        sources.length ? { legalName, taxCode, sources } : null
      )];
    })).then(rows => rows.filter((row): row is NonNullable<typeof row> => row !== null));

    const unique = new Map<string, (typeof supported)[number]>();
    for (const row of supported) unique.set(row.taxCode, row);
    if (unique.size > 1 || answer.decision === 'AMBIGUOUS') {
      return { status: 'AMBIGUOUS', sources: [...new Map([...unique.values()].flatMap(row => row.sources).map(source => [source.url, source])).values()], message: 'Có nhiều doanh nghiệp phù hợp trong nguồn chính thống.' };
    }
    if (unique.size !== 1 || answer.decision !== 'MATCH' || typeof answer.selectedTaxCode !== 'string') {
      return { status: 'NOT_FOUND', sources: [], message: 'Chưa tìm thấy một doanh nghiệp duy nhất có trích dẫn chính thống.' };
    }

    const resolved = [...unique.values()][0];
    const selectedTaxCode = normalizeTaxCodeFormat(answer.selectedTaxCode);
    if (selectedTaxCode !== resolved.taxCode) {
      return { status: 'NOT_FOUND', sources: resolved.sources, message: 'Lựa chọn của AI không khớp với ứng viên có bằng chứng.' };
    }
    if (printedTaxCode) {
      const printedNormalized = normalizeTaxCodeFormat(printedTaxCode);
      if (!printedNormalized || printedNormalized !== resolved.taxCode) {
        return {
          status: 'CONFLICT', legalName: resolved.legalName, supplierTaxCode: resolved.taxCode,
          sources: resolved.sources, message: 'MST in trên hóa đơn không khớp tên nhà cung cấp; đã giữ nguyên MST trên ảnh.'
        };
      }
    }
    return {
      status: 'VERIFIED', legalName: resolved.legalName, supplierTaxCode: resolved.taxCode,
      sources: resolved.sources, message: 'Tên pháp lý và MST được đối chiếu từ nguồn chính thống.'
    };
  } catch {
    return { status: 'NOT_FOUND', sources: [], message: 'Kết quả tra cứu không có đủ trích dẫn để xác minh.' };
  }
}

export async function lookupOfficialSupplierIdentity(input: SupplierIdentityQuery): Promise<SupplierIdentity> {
  return resolveSupplierIdentity(input, searchOfficialSupplierIdentity);
}
