/** Experimental OCR entity extraction. Values require printed labels/positions, never tax inference. */
export interface ReceiptOcrLine {text:string;confidence:number;bbox:{x:number;y:number;w:number;h:number}}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
export function parseReceiptEntities(lines:ReceiptOcrLine[]) {
 const invoice:Record<string,unknown>={}, evidence:Record<string,ReceiptOcrLine[]>={};
 // Join horizontally adjacent observations on the same baseline; retain source boxes.
 const rows:{text:string;lines:ReceiptOcrLine[];y:number;h:number}[]=[];
 for(const line of [...lines].sort((a,b)=>a.bbox.y-b.bbox.y||a.bbox.x-b.bbox.x)) {
  const cy=line.bbox.y+line.bbox.h/2;
  const row=rows.find(r=>Math.abs(cy-r.y)<Math.min(r.h,line.bbox.h)*0.5);
  if(row){row.lines.push(line);row.lines.sort((a,b)=>a.bbox.x-b.bbox.x);row.text=row.lines.map(l=>l.text).join(' ');}
  else rows.push({text:line.text,lines:[line],y:cy,h:line.bbox.h});
 }
 const put=(key:string,value:unknown,row:typeof rows[number])=>{if(value!==undefined){invoice[key]=value;evidence[key]=row.lines;}};
 const money=(s:string)=>{
  const tokens=s.replace(/\b\d+(?:[.,]\d+)?\s*%/g,'').match(/\d[\d.,]*(?:\s*(?:₫|VND))?/gi);
  if(!tokens?.length)return undefined;
  let rawToken=tokens[tokens.length-1];
  // Thermal receipts sometimes print a thousands group separated by a
  // literal space ("945 000"). Combine only two plain digit groups so a
  // quantity followed by a comma-formatted price is not merged accidentally.
  if(tokens.length>=2 && /^\d{1,3}$/.test(tokens[tokens.length-1]) && /^\d{1,3}$/.test(tokens[tokens.length-2]))
   rawToken=tokens[tokens.length-2]+tokens[tokens.length-1];
  let v=rawToken.replace(/[^\d.,]/g,'');
  if(/\.\d{2}$/.test(v) && v.includes(','))v=v.replace(/,/g,'');
  else if(/,\d{2}$/.test(v) && v.includes('.'))v=v.replace(/\./g,'').replace(',','.');
  else if(/\.\d{2}$/.test(v))v=v;
  else if(/,\d{2}$/.test(v))v=v.replace(',','.');
  else v=v.replace(/[.,]/g,'');
  const n=Number(v);return Number.isFinite(n)?n:undefined;
 };
 // Vietnamese receipts often print the payable amount in words below a noisy
 // numeric line.  Parse this generic number grammar as a second candidate;
 // never use it to invent an amount when no scale word is present.
 const moneyWords=(s:string):number|undefined=>{
  const tokens=norm(s).replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);
  const digits:Record<string,number>={khong:0,mot:1,hai:2,ba:3,bon:4,tu:4,nam:5,lam:5,sau:6,bay:7,tam:8,chin:9};
  const hasScale=tokens.some(t=>['nghin','nghinh','trieu','ty'].includes(t)||t.startsWith('nghin'));
  if(!hasScale)return undefined;
  let total=0;let group=0;let pending:number|undefined;let touched=false;
  for(const token of tokens){
   if(Object.prototype.hasOwnProperty.call(digits,token)){pending=digits[token];touched=true;continue;}
   if(/^tram/.test(token)||token==='trm'){
    group=(group||pending||0)*100;pending=undefined;touched=true;continue;
   }
   if(/^muoi/.test(token)||token==='moi'){
    if(pending!==undefined){group+=pending*10;pending=undefined;} else if(group>0 && group<10) group*=10;
    touched=true;continue;
   }
   if(token==='linh'||token==='le'||token==='lẻ')continue;
   if(token.startsWith('nghin')){
    group+=pending||0;pending=undefined; if(group>0)total+=group*1000; group=0; touched=true;continue;
   }
   if(token==='trieu'||token==='ty'){
    group+=pending||0;pending=undefined; const scale=token==='ty'?1_000_000_000:1_000_000;
    if(group>0)total+=group*scale; group=0; touched=true;continue;
   }
   // Ignore currency words and OCR noise, but do not allow an unrelated
   // sentence to become a number without the scale guard above.
  }
  group+=pending||0;
  const value=total+group;
  return touched && value>0 && Number.isSafeInteger(value)?value:undefined;
 };
 const candidates:{value:number;rank:number;row:typeof rows[number]}[]=[];
 let cashTotalCandidate:{value:number;row:typeof rows[number]}|undefined;
 for(let rowIndex=0;rowIndex<rows.length;rowIndex++){const row=rows[rowIndex];const t=norm(row.text);
  const number=t.match(/(?:so\s*(?:hoa\s*don|hd)|hoa\s*don\s*so|\bhd)\s*[:：]?\s*([a-z0-9_-]+)/i);
  if(number && invoice.invoiceNumber===undefined){const original=/\bhd(?=[a-z0-9])/i.test(number[0]) && !/^hd/i.test(number[1]) ? `HD${number[1]}` : row.text.slice(number.index!+number[0].length-number[1].length,number.index!+number[0].length);put('invoiceNumber',original,row);}
  if(invoice.invoiceNumber===undefined && /^(?:hd|so\s*hd|so\s*hoa\s*don)\s*[:：]?$/i.test(t)){
   const continuation=rows.slice(rowIndex+1,rowIndex+3).find(next=>/^[a-z0-9][a-z0-9_-]{1,}$/i.test(next.text.trim()));
   if(continuation)put('invoiceNumber',continuation.text.trim(),continuation);
  }
  const date=t.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})\b/);
  // OCR can drop the vowel in "ngày" (for example "ngy bán"). Keep the
  // date-label requirement so an address date is never used accidentally.
  if(date && invoice.invoiceDate===undefined && /ngay|ngy|date/.test(t))put('invoiceDate',`${date[3]}-${date[2].padStart(2,'0')}-${date[1].padStart(2,'0')}`,row);
  if(invoice.invoiceDate===undefined && /^(?:ngay|ngy|date)\s*[:：]?$/i.test(t)){
   const continuation=rows.slice(rowIndex+1,rowIndex+3).find(next=>/\b\d{1,2}[/\.\-]\d{1,2}[/\.\-]\d{4}\b/.test(next.text));
   const nextDate=continuation?.text.match(/\b(\d{1,2})[/\.\-](\d{1,2})[/\.\-](\d{4})\b/);
   if(continuation && nextDate)put('invoiceDate',`${nextDate[3]}-${nextDate[2].padStart(2,'0')}-${nextDate[1].padStart(2,'0')}`,continuation);
  }
  // "Mã số thuế" is occasionally read as "Hạ số thuế". The identifier
  // shape is still mandatory; this does not invent a missing MST.
  const tax=t.match(/(?:(?:ma|ha)\s*so\s*thue|\bmst)\s*[:：]?\s*(\d{10}(?:-\d{3})?)(?!\d)/);
  if(tax)put(/ben mua|nguoi mua|buyer/.test(t)?'buyerTaxCode':'supplierTaxCode',tax[1],row);
  const rank=/t\.?\s*cong\b|tong\s*cong\b|tong\s*(?:so\s*)?tien\s*thanh\s*toan|tong\s*thanh\s*toan|so\s*tien\b|\btotal\b/.test(t)?3:/tong\s*tien\s*phai/.test(t)?2:/t(?:ien|len)\s*(?:mat|mt)\b|tien\s*khach\s*tra/.test(t)?1:0;
  if(rank){
   const value=money(row.text);
   const wordsValue=moneyWords(row.text);
   // A damaged numeric token such as "666'6L9" may coexist with a clear
   // Vietnamese amount-in-words. Prefer the word candidate only when it is a
   // materially larger scaled amount, otherwise keep both and require
   // agreement below.
   if(wordsValue!==undefined && (value===undefined || (value<1000 && wordsValue>=1000)))
    candidates.push({value:wordsValue,rank,row});
   else if(value!==undefined)candidates.push({value,rank,row});
   else if(rank>=2){
    // Damaged thermal-receipt labels may put the total on the next OCR line.
    // Accept only a nearby numeric continuation.
    const index=rows.indexOf(row);
    for(const next of rows.slice(index+1,index+3)){
     const continuation=money(next.text);
     if(continuation!==undefined){candidates.push({value:continuation,rank,row:next});break;}
    }
   }
  }
  if(/t(?:ien|len)\s*(?:mat|mt)\b/.test(t) && (money(row.text)||0)>0){put('paymentMethod','CASH',row);cashTotalCandidate={value:money(row.text)!,row};}
  if(/phuong\s*thuc\s*thanh\s*toan.*chuyen\s*khoan|hinh\s*thuc.*(?:chuyen\s*khoan|\bck\b)/.test(t))put('paymentMethod','BANK_TRANSFER',row);
  const rate=t.match(/(?:thue\s*suat|vat|thue\s*gtgt)\s*[:：]?\s*(\d{1,2})\s*%/);
  if(rate)put('taxRate',Number(rate[1]),row);
  if(/(?:tien\s*thue|bao\s*gom\s*thue\s*gtgt)/.test(t)){const v=money(row.text);if(v!==undefined && !/\d\s*%\s*[:：]?\s*$/.test(t))put('taxAmount',v,row);}
  if(/tien\s*truoc\s*thue|cong\s*tien\s*hang/.test(t)){const v=money(row.text);if(v!==undefined)put('preTaxAmount',v,row);}
 }
 candidates.sort((a,b)=>b.rank-a.rank);
 if(candidates.length){const top=candidates.filter(c=>c.rank===candidates[0].rank);if(new Set(top.map(c=>c.value)).size===1)put('totalAmount',top[0].value,top[0].row);}
 // When a receipt prints a discount and then a cash amount, the cash line is
 // the payable total. Prefer it over the pre-discount T.CỘNG figure while
 // keeping the rule independent of a specific shop or layout.
 if(cashTotalCandidate && rows.some(r=>/giam|discount|chiet\s*khau/.test(norm(r.text))) &&
    (invoice.totalAmount===undefined || cashTotalCandidate.value<Number(invoice.totalAmount)))
  put('totalAmount',cashTotalCandidate.value,cashTotalCandidate.row);
 // Co.op receipts print the VAT amount on the "Tiền mặt" line and the
 // explicit rate on a nearby "Bao gồm thuế GTGT" line. Link those printed
 // values only when the rate is present; never derive tax from totals.
 if(invoice.taxAmount===undefined && invoice.taxRate!==undefined && rows.some(r=>/bao\s*gom\s*thue\s*gtgt/.test(norm(r.text)))){
  const taxRow=rows.find(r=>/t(?:ien|len)\s*(?:mat|mt)\b/.test(norm(r.text)) && money(r.text)!==undefined);
  if(taxRow)put('taxAmount',money(taxRow.text),taxRow);
 }
 // Company heading before the first date/table; no supplier directory
 // completion and no vendor-name allowlist. This keeps the parser useful for
 // unseen camera layouts instead of fitting the benchmark's sample brands.
 const headerEnd=rows.findIndex(r=>/\b(?:ngay|ngy|date)\b|ten\s*hang|item|description/.test(norm(r.text)));
 const head=rows.slice(0,headerEnd>0?headerEnd:Math.min(rows.length,12));
 const directSeller=head.find(r=>/cong ty|\bcty\b|\btnhh\b|\bjsc\b|\bltd\b|\bcompany\b|\bcorporation\b|don vi ban|nguoi ban|seller|supplier/i.test(norm(r.text)));
  const titleSuffix=head.map(r=>{
  if(!/(hoa\s*don|bill|receipt)/.test(norm(r.text)))return undefined;
  const parts=r.text.split(/[-–—:]/).map(s=>s.trim()).filter(Boolean);const suffix=parts[parts.length-1];
  return suffix && suffix!==r.text && suffix.length>=4 && /[a-zA-ZÀ-ỹ]/.test(suffix) && suffix.replace(/\D/g,'').length<7 ? {...r,text:suffix.replace(/\b(\w+)\s+\1\b/gi,'$1')} : undefined;
 }).filter(Boolean) as typeof head;
 const fallbackSeller=head.filter(r=>{
   const t=norm(r.text).trim();
   const digitsOnly=t.replace(/\D/g,'');
   return /[a-zA-ZÀ-ỹ]/.test(r.text) && r.text.trim().length>=4 &&
    !/(hoa\s*don|bill|receipt|phieu\s*(?:thanh\s*toan)?|hotline|dia\s*chi|d\s*\/\s*c|tel|phone|sdt|ngay|date|time|gio\s*vao|\bhd\b|so\s*(?:hd|hoa\s*don|tien)|tong\s*(?:tien|cong)|t(?:ien|len)\s*(?:mat|mt)|ban\s*:|dat\s*hang|sinh\s*to|cung\s*cap|\b(?:esc|tab|caps|shift|ctrl|alt|f\d)\b)/.test(t) &&
    digitsOnly.length<7 && !/\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(t);
  })[0];
 const seller=directSeller || titleSuffix[0] || fallbackSeller;
 if(seller)put('supplierName',seller.text,seller);
 // Item region bounded by column labels and totals. Include readable descriptions, exclude numeric-only rows.
 const table=rows.findIndex(r=>/mat hang|ten hang|don gia/.test(norm(r.text)));
 if(table>=0){const end=rows.findIndex((r,i)=>i>table && /tong\s*tien|tong\s*cong|cong\s*tien\s*hang/.test(norm(r.text)));
  const itemRows=rows.slice(table+1,end>=0?end:table+12).filter(r=>/[a-zA-ZÀ-ỹ]/.test(r.text) && !/^\s*(vat\s*\d|km\b)/i.test(norm(r.text)));
  if(itemRows.length){invoice.itemName=itemRows.map(r=>r.text).join('; ');evidence.itemName=itemRows.flatMap(r=>r.lines);}
 }
 const uncertainFields=Object.keys(evidence).filter(k=>evidence[k].some(l=>l.confidence<0.8));
 return {invoice,evidence,uncertainFields,rows:rows.map(r=>r.text)};
}
