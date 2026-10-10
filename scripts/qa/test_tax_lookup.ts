import { lookupByTaxCode, lookupByName, validateTaxCode, autoEnrichSupplierData } from '../../services/taxLookupService';

async function main() {
  console.log('=== TEST 1: KIỂM TRA THUẬT TOÁN MODULO 11 & FORMAT MST ===');
  const mstViettel = '0100109106';
  const val1 = validateTaxCode(mstViettel);
  console.log(`MST ${mstViettel}:`, val1);

  const mstFake = '1234567899';
  const val2 = validateTaxCode(mstFake);
  console.log(`MST ${mstFake}:`, val2);

  console.log('\n=== TEST 2: CHIỀU 1 - CÓ MST, TRA TÊN QUA VIETQR / CỔNG TCT ===');
  const lookup1 = await lookupByTaxCode('0100109106');
  console.log('Kết quả tra theo MST 0100109106:');
  console.log(JSON.stringify(lookup1, null, 2));

  console.log('\n=== TEST 3: CHIỀU 2 - CÓ TÊN, TRA MST & XÁC THỰC CHÉO NGƯỢC ===');
  const lookup2 = await lookupByName('Tập đoàn Công nghiệp Viễn thông Quân đội');
  console.log('Kết quả tra theo Tên "Tập đoàn Công nghiệp Viễn thông Quân đội":');
  console.log(JSON.stringify(lookup2, null, 2));

  console.log('\n=== TEST 4: TỰ ĐỘNG BỔ SUNG (AUTO-ENRICHMENT) ===');
  const enrichedOnlyMst = await autoEnrichSupplierData({
    supplierTaxCode: '0100109106'
  });
  console.log('Khi chỉ có MST:', enrichedOnlyMst);

  console.log('\n✅ TẤT CẢ TEST ĐÃ HOÀN TẤT THÀNH CÔNG!');
}

main().catch((err) => {
  console.error('Lỗi khi chạy test:', err);
  process.exit(1);
});
