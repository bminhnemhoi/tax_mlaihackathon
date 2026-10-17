/**
 * Lô dựng sẵn cho buổi trình bày local: đi đúng đường của màn hình Lô hóa đơn và luật chốt lô;
 * lô tuần 2 đã chốt, lô cuối tháng còn mở chờ Kế toán trưởng trả lời nhóm và chốt.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDatabase, runIsolated } from '../../lib/server/db';
import { switchRole } from '../../lib/server/auth';
import { getBatch, listBatches } from '../../services/batchService';
import { seedDemoBatches } from '../../services/demo/demoBatchPreset';

test('lô dựng sẵn: lô tuần 2 đã chốt (5 hóa đơn vào sổ), lô cuối tháng 25 file (24 dòng, file trùng được gộp) còn mở, có nhóm câu hỏi và file lỗi; chạy lại không tạo thêm', async () => {
  await runIsolated(async () => {
    const ktt = switchRole('CHIEF_ACCOUNTANT')!.user;
    switchRole('ACCOUNTANT');
    const { batches } = await seedDemoBatches();
    assert.equal(batches.length, 2);
    const [week2, month] = batches.map(id => getBatch(id, ktt));
    assert.equal(week2.batch.status, 'SIGNED_OFF');
    assert.equal((getDatabase().prepare("SELECT COUNT(*) n FROM audit_events WHERE event_type='INVOICE_POSTED_BY_BATCH'").get() as { n: number }).n, 5);
    assert.equal(month.batch.status, 'OPEN');
    // 25 file: file trùng nội dung với hóa đơn đã có được gộp (không tạo dòng thứ hai), như khi tải trên màn hình Lô hóa đơn.
    assert.equal(month.items.length, 24, JSON.stringify(month.summary));
    assert.ok(month.summary.MACHINE_APPROVED >= 8, JSON.stringify(month.summary));
    assert.ok(month.summary.NEEDS_HUMAN >= 8, JSON.stringify(month.summary));
    assert.ok(month.summary.ERROR >= 1, 'file không phải hóa đơn hiện là lỗi');
    assert.ok(month.groups.some(g => g.invoiceIds.length >= 2), 'có nhóm câu hỏi giống nhau để trả lời một lần');
    assert.deepEqual(await seedDemoBatches(), { batches: [] });
    assert.equal(listBatches().length, 2);
  });
});
