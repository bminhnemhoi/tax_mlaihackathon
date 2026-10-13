/** Experimental OCR entity extraction. Values require printed labels/positions, never tax inference. */
export interface ReceiptOcrLine {text:string;confidence:number;bbox:{x:number;y:number;w:number;h:number};alternative?:string}
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();
function cleanSupplierHeaderCandidate(value:string):string {
 let candidate=value.trim();
 // Vision occasionally mistakes a logo fragment or a stray receipt-edge
 // glyph for a one-letter prefix (for example "R VinCommerce").
 candidate=candidate.replace(/^\s*[A-Z]\s+(?=[\p{L}])/u,'');
 // Keep the merchant name while removing a branch's printed location tail.
 candidate=candidate.replace(/\s+\d{1,5}\s+[^,]{2,},\s*(?:phường|phuong|quận|quan|huyện|huyen|xã|xa|tp\.?|tỉnh|tinh|ward|district|city)\b.*$/i,'');
 candidate=candidate.replace(/\s+(?:tp\.?|thành\s+phố|thanh\s+pho|quận|quan|huyện|huyen|phường|phuong|xã|xa|tỉnh|tinh|ward|district|province|city|hn|hcm)\b.*$/i,'');
 candidate=candidate.replace(/[\s,;:.-]+$/,'').trim();
 return candidate.length>=4?candidate:'';
}

function sellerCandidateScore(value:string):number {
 const candidate=cleanSupplierHeaderCandidate(value);
 if(!candidate)return Number.NEGATIVE_INFINITY;
 const t=norm(candidate);
 const words=t.split(/\s+/).filter(Boolean);
 let score=8-Math.min(words.length,8);
 if(words.length<=3)score+=3;
 if(/cong ty|\bcty\b|\btnhh\b|\bjsc\b|\bltd\b|\bcompany\b|\bcorporation\b/.test(t))score+=12;
 if(/\btttm\b|\bmall\b|\bhotline\b|\bwebsite\b|\bemail\b|www\.|@|\bdu an\b|\bkhu\b|\btang\b/.test(t))score-=8;
 if(/\d/.test(candidate))score-=6;
 if(candidate.length<7)score-=2;
 return score;
}
export function parseReceiptEntities(lines:ReceiptOcrLine[]) {
 const invoice:Record<string,unknown>={}, evidence:Record<string,ReceiptOcrLine[]>={};
 // Join horizontally adjacent observations on the same baseline; retain source boxes.
 const rows:{text:string;lines:ReceiptOcrLine[];y:number;h:number}[]=[];
 // OCR lines use a normalized top-left origin. Apple Vision boxes are
 // converted from its bottom-left origin at the OCR adapter boundary.
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
 let currentTaxParty:'supplier'|'buyer'='supplier';
 for(let rowIndex=0;rowIndex<rows.length;rowIndex++){const row=rows[rowIndex];const t=norm(row.text);
  if(/\b(?:nguoi ban|ben ban|seller|supplier)\b/.test(t))currentTaxParty='supplier';
  else if(/\b(?:nguoi mua|ben mua|buyer|customer|ten khach hang)\b/.test(t))currentTaxParty='buyer';
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
  const tax=t.match(/(?:(?:ma|ha)\s*so\s*thue|\bmst)\s*[:：]?\s*(\d{12}|\d{10}(?:-?\d{3})?)(?!\d)/);
  const taxField=/ben mua|nguoi mua|buyer|customer/.test(t)||currentTaxParty==='buyer'?'buyerTaxCode':'supplierTaxCode';
  if(tax)put(taxField,tax[1],row);
  else if(/^(?:(?:ma|ha)\s*so\s*thue|\bmst)(?:\s+(?:(?:ben|nguoi)\s+)?(?:ban|mua|seller|buyer))?\s*[:：-]?$/i.test(t)){
   // Some invoice layouts put the tax identifier on the next OCR line after
   // its label. Accept only an isolated 10/12/13 digit continuation directly
   // below that label; never promote a nearby amount or invoice number to MST.
   const continuation=rows.slice(rowIndex+1,rowIndex+3).find(next=>{
    const raw=next.text.trim();
    const digits=raw.replace(/\D/g,'');
    return /^[\d\s.-]+$/.test(raw)&&[10,12,13].includes(digits.length);
   });
   if(continuation)put(taxField,continuation.text.replace(/\s+/g,''),continuation);
  }
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
  if(!/^\s*(?:hoa\s*don|bill|receipt)\b/.test(norm(r.text)))return undefined;
  // Invoice-title rows often end in the printed invoice identifier; that value
  // must never be guessed as the supplier name (e.g. "Số hóa đơn: HD12345").
  if(/(?:so\s*(?:hoa\s*don|hd)|hoa\s*don\s*so|invoice\s*(?:number|no\.?|#)|bill\s*(?:number|no\.?|#)|receipt\s*(?:number|no\.?|#))/i.test(norm(r.text)))return undefined;
  const parts=r.text.split(/[-–—:]/).map(s=>s.trim()).filter(Boolean);const suffix=parts[parts.length-1];
  return suffix && suffix!==r.text && suffix.length>=4 && /[a-zA-ZÀ-ỹ]/.test(suffix) && suffix.replace(/\D/g,'').length<7 ? {...r,text:suffix.replace(/\b(\w+)\s+\1\b/gi,'$1')} : undefined;
 }).filter(Boolean) as typeof head;
 const fallbackSeller=head.filter(r=>{
   const t=norm(r.text).trim();
   const digitsOnly=t.replace(/\D/g,'');
   return /[a-zA-ZÀ-ỹ]/.test(r.text) && r.text.trim().length>=4 &&
    !/^\s*(?:số|so|tầng|tang|dự án|du an|khu|phường|phuong|quận|quan|huyện|huyen|xã|xa|tỉnh|tinh|p\.?\s|q\.?\s|cn\s*\d)/i.test(r.text) &&
    !/(hoa\s*don|invoice|bill|receipt|phieu\s*(?:thanh\s*toan)?|hotline|dia\s*chi|d\s*\/\s*c|tel|phone|sdt|ngay|date|time|gio\s*vao|\bhd\b|so\s*(?:hd|hoa\s*don|tien)|tong\s*(?:tien|cong)|t(?:ien|len)\s*(?:mat|mt)|ban\s*:|dat\s*hang|sinh\s*to|cung\s*cap|diem\s*su\s*dung|cam\s*on|hen\s*gap|khach\s*hang|loyalty|thanh\s*vien|will\s*be\s*issued|\b(?:esc|tab|caps|shift|ctrl|alt|f\d)\b)/.test(t) &&
    digitsOnly.length<7 && !/\d{1,2}[/.-]\d{1,2}[/.-]\d{4}/.test(t);
  }).sort((a,b)=>sellerCandidateScore(b.text)-sellerCandidateScore(a.text));
 const seller=directSeller || titleSuffix[0] || fallbackSeller[0];
 if(seller)put('supplierName',cleanSupplierHeaderCandidate(seller.text),seller);
 const buyerHeading=head.findIndex(r=>/nguoi mua|buyer|ten nguoi mua/.test(norm(r.text)));
 const sellerHeader=buyerHeading>=0?head.slice(0,buyerHeading):head;
 const addressRowIndex=sellerHeader.findIndex(r=>/(?:dia\s*chi|d\s*\/\s*c|address)\s*[:：-]?/i.test(norm(r.text)));
 if(addressRowIndex>=0){
  const addressRows=[sellerHeader[addressRowIndex]];
  const addressParts=[sellerHeader[addressRowIndex].text.replace(/^.*?(?:địa\s*chỉ|dia\s*chi|d\s*\/\s*c|address)\s*[:：-]?\s*/i,'').trim()].filter(Boolean);
  for(const next of sellerHeader.slice(addressRowIndex+1,addressRowIndex+4)){
   const nextText=next.text.trim();
   const nextLabel=norm(nextText);
   if(!nextText || /^(?:(?:ma|ha)\s*so\s*thue|\bmst\b|so\s*(?:hoa\s*don|hd)\b|hoa\s*don|ngay|ngy|date|tel|phone|sdt|hotline|fax|email|buyer|ben\s*mua|nguoi\s*mua)\b/.test(nextLabel))break;
   const standaloneHouseNumber=/^\d{1,4}[a-z]?$/i.test(nextText);
   if((!/[a-zA-ZÀ-ỹ]/.test(nextText) && !standaloneHouseNumber) || /(?:tong\s*(?:tien|cong)|total|\bhd\s*[:#])/i.test(nextLabel))break;
   addressRows.push(next);
   addressParts.push(nextText);
   if(addressParts.join(' ').length>=180)break;
  }
  const address=addressParts.join(' ').replace(/\s+/g,' ').trim();
  if(address.length>=8){
   invoice.supplierAddress=address;
   evidence.supplierAddress=addressRows.flatMap(r=>r.lines);
  }
 }
 // Retail receipts often print a branch address in the header without an
 // "Address" label. Use a short header block only when it has one clear
 // address start; receipts that list several branches (for example CN1/CN2)
 // stay unresolved instead of borrowing an arbitrary location.
 if(invoice.supplierAddress===undefined && !sellerHeader.some(r=>/^\s*cn\s*\d+\b/i.test(norm(r.text)))){
  const addressStart=sellerHeader.findIndex(r=>(r===seller && /\d{1,5}\s+[^,]{2,},\s*(?:phường|phuong|quận|quan|huyện|huyen|xã|xa|tp\.?|tỉnh|tinh)\b/i.test(r.text))
    || /^\s*(?:so\b|tang\b|address\b|dia\s*chi\b|\d{1,5}\b|street\b|road\b|duong\b|pho\b)/i.test(norm(r.text)));
  if(addressStart>=0){
   const addressRows:Array<{row:typeof rows[number];text:string}>=[];
   for(const candidate of sellerHeader.slice(addressStart,addressStart+6)){
    let text=candidate.text.trim();
    if(candidate===seller){
     const supplierName=String(invoice.supplierName||'').trim();
     const nameIndex=supplierName?text.toLowerCase().indexOf(supplierName.toLowerCase()):-1;
     if(nameIndex<0)continue;
     text=`${text.slice(0,nameIndex)} ${text.slice(nameIndex+supplierName.length)}`.trim();
     if(!/\d|phường|phuong|quận|quan|huyện|huyen|xã|xa|tp\.?|hcm/i.test(text))continue;
    }
    text=text.replace(/^\s*[A-Z]\s+(?=\d)/,'').replace(/\s+(?:email|website|www\.|tel\b|phone\b|hotline\b|fax\b).*$/i,'').trim();
    const t=norm(text);
    if(/^(?:hoa\s*don|bill|receipt|ngay|ngy|date|mst|ma\s*so\s*thue|email|website|www\.|tel\b|phone\b|hotline\b|fax\b)/i.test(t)
      || /^\d{2,4}[.-]\d{5,}/.test(text))break;
    if(/^\s*[A-Z]\s*$/i.test(text))continue;
    if(/^(?:ma|ha)\s*so\s*thue/i.test(t))break;
    addressRows.push({row:candidate,text});
   }
   const address=addressRows.map(r=>r.text).join(' ').replace(/\s+/g,' ').trim();
   if(address.length>=8){
    invoice.supplierAddress=address;
    evidence.supplierAddress=addressRows.flatMap(r=>r.row.lines);
   }
  }
 }
 // Item region bounded by column labels and totals. Include readable descriptions, exclude numeric-only rows.
 const table=rows.findIndex(r=>/mat hang|ten hang|don gia/.test(norm(r.text)));
 if(table>=0){const end=rows.findIndex((r,i)=>i>table && /tong\s*tien|tong\s*cong|cong\s*tien\s*hang/.test(norm(r.text)));
  const itemRows=rows.slice(table+1,end>=0?end:table+12).filter(r=>/[a-zA-ZÀ-ỹ]/.test(r.text) && !/^\s*(vat\s*\d|km\b)/i.test(norm(r.text)));
  if(itemRows.length){invoice.itemName=itemRows.map(r=>r.text).join('; ');evidence.itemName=itemRows.flatMap(r=>r.lines);}
 }
 const uncertainFields=Object.keys(evidence).filter(k=>evidence[k].some(l=>l.confidence<0.8));
 // Keep bounded, seller-only context for online identity search. A receipt may
 // list several branches and a public website while omitting the issuing
 // branch; preserve those as search clues, never as a selected invoice address.
 const supplierSearchContext=sellerHeader
  .filter(row=>row===seller
   || /^\s*(?:cn\s*\d+|chi\s*nh[aá]nh|branch|store|c[uử]a\s*h[aà]ng)\b/i.test(row.text)
   || /\b(?:www\.)?[a-z\d-]+\.(?:com(?:\.vn)?|vn|net|org)\b/i.test(row.text)
   || /(?:địa\s*chỉ|dia\s*chi|address|mã\s*số\s*thuế|ma\s*so\s*thue|\bmst\b)/i.test(row.text))
  .filter(row=>!/(?:tel\s*:|phone\s*:|hotline|sdt\s*:|email\s*:|@)/i.test(row.text))
  .map(row=>(row===seller ? row.text.replace(/^\s*[A-Z]\s+(?=[\p{L}])/u,'') : row.text).trim())
  .filter((text,index,all)=>Boolean(text)&&all.indexOf(text)===index)
  .slice(0,12)
  .join('\n')
  .slice(0,1200);
 return {invoice,evidence,uncertainFields,rows:rows.map(r=>r.text),supplierSearchContext:supplierSearchContext||undefined};
}
