/**
 * Tổng hợp kết quả thử nghiệm với người dùng thực tế (5 ca U1–U5 + bảng câu hỏi).
 * `npx tsx scripts/qa/evaluate-user-study.ts docs/evidence/user-study/responses.json > docs/evidence/user-study/report.md`
 *
 * Nhãn của người dùng (ghi trước khi xem kết quả hệ thống) là nhãn độc lập: đa số theo ca dùng làm chuẩn để tính
 * tỉ lệ bỏ sót / chuyển tiếp thừa. Script từ chối dữ liệu rỗng hoặc không định danh để không thể sinh số liệu giả.
 */
import fs from 'node:fs';
import { getActivePolicy, getDatabase, runIsolated } from '../../lib/server/db';
import { evaluateWorkflow } from '../../services/workflowService';
import { demoCompanyTaxCode } from '../../data/verification/challengeCases';
import { userStudyCases } from '../../data/verification/userStudyCases';
import { wilson95 } from '../../services/feedbackService';

type Decision = { decision: 'AUTO' | 'ESCALATE' | null; group: string | null; seconds: number | null; note?: string };
type Participant = {
  id: string; name: string; title: string; organization: string; consent: 'NAME_AND_TITLE' | 'TITLE_ONLY' | 'NONE';
  yearsExperience: number | null; invoicesPerMonth: number | null;
  baseline: { minutesPerInvoice: number | null; percentAskOthers: number | null; askChannel?: string };
  decisions: Record<string, Decision>; answeredInOneReply: Record<string, boolean | null>;
  likert: Record<string, number | null>; q9WillRecheck?: string; learningMinutes: number | null; quotes: Record<string, string>;
};
const accountant = { id: 'study-accountant', role: 'ACCOUNTANT' as const, email: 's@test', displayName: 'User study' };
const pct = (k: number, n: number) => n ? `${k}/${n} (${Math.round(100 * k / n)}%)` : 'chưa có';
const ci = (k: number, n: number) => { const w = wilson95(k, n); return w.rate === null ? 'chưa có' : `${pct(k, n)}, KTC 95%: ${Math.round(100 * (w.low as number))}–${Math.round(100 * (w.high as number))}%`; };
const mean = (xs: Array<number | null | undefined>) => { const v = xs.filter((x): x is number => typeof x === 'number'); return v.length ? `${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)} (n=${v.length})` : 'chưa có'; };
const who = (p: Participant) => p.consent === 'NAME_AND_TITLE' ? `${p.name} — ${p.title}${p.organization ? `, ${p.organization}` : ''}` : p.consent === 'TITLE_ONLY' ? `${p.title}${p.organization ? `, ${p.organization}` : ''} (không công bố tên)` : `Người dùng ${p.id} (không công bố danh tính)`;

async function systemDecisions() {
  const out: Record<string, { status: string; group: string | null }> = {};
  for (const c of userStudyCases) {
    out[c.id] = await runIsolated(async () => {
      const db = getDatabase(), policy = getActivePolicy();
      policy.config.companyTaxCode = demoCompanyTaxCode;
      db.prepare('UPDATE policy_versions SET payload_json=? WHERE version=?').run(JSON.stringify(policy), policy.version);
      const r = await evaluateWorkflow({ ...c.invoice, id: c.id }, accountant, { forceLocalOnly: true });
      return { status: r.decision.status, group: r.decision.status === 'ESCALATED' ? r.decision.riskGroup : null };
    });
  }
  return out;
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Usage: evaluate-user-study.ts <responses.json>');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { studyDate: string; participants: Participant[] };
  const participants = data.participants.filter(p => Object.values(p.decisions || {}).some(d => d?.decision));
  if (!participants.length) throw new Error('Chưa có câu trả lời nào của người dùng. Không sinh báo cáo từ dữ liệu rỗng.');
  for (const p of participants) {
    if (!p.title?.trim()) throw new Error(`${p.id}: thiếu chức danh thực tế — thể lệ yêu cầu chức danh của người tham gia.`);
    if (p.consent === 'NAME_AND_TITLE' && !p.name?.trim()) throw new Error(`${p.id}: đồng ý công bố tên nhưng chưa có tên.`);
  }
  const system = await systemDecisions();
  const lines: string[] = [];
  lines.push(`# Kết quả thử nghiệm người dùng — ${data.studyDate}`, '', `Số người tham gia có câu trả lời: **${participants.length}**. Dữ liệu ca là tổng hợp; quyết định do người dùng tự ghi **trước** khi xem kết quả hệ thống.`, '');
  lines.push('## Người tham gia', '', ...participants.map(p => `- ${who(p)} · ${p.yearsExperience ?? '?'} năm kinh nghiệm · ~${p.invoicesPerMonth ?? '?'} hóa đơn/tháng`), '');

  // Đồng thuận người–máy
  let agreeStatus = 0, agreeGroup = 0, totalDecisions = 0, groupComparable = 0;
  const rows: string[] = ['| Ca | Hệ thống | ' + participants.map(p => p.id).join(' | ') + ' | Đa số người dùng |', '|---|---|' + participants.map(() => '---|').join('') + '---|'];
  const majority: Record<string, 'AUTO' | 'ESCALATE' | null> = {};
  for (const c of userStudyCases) {
    const s = system[c.id];
    const votes = participants.map(p => p.decisions[c.id]?.decision || null);
    const esc = votes.filter(v => v === 'ESCALATE').length, auto = votes.filter(v => v === 'AUTO').length;
    majority[c.id] = esc > auto ? 'ESCALATE' : auto > esc ? 'AUTO' : null;
    for (const p of participants) {
      const d = p.decisions[c.id];
      if (!d?.decision) continue;
      totalDecisions++;
      const sameStatus = (d.decision === 'ESCALATE') === (s.status === 'ESCALATED');
      if (sameStatus) agreeStatus++;
      if (sameStatus && d.decision === 'ESCALATE' && d.group) { groupComparable++; if (d.group === s.group) agreeGroup++; }
    }
    rows.push(`| ${c.id} ${c.summary} | ${s.status === 'ESCALATED' ? `Chuyển tiếp · ${s.group}` : 'Tự xử lý'} | ${participants.map(p => { const d = p.decisions[c.id]; return d?.decision ? `${d.decision === 'ESCALATE' ? 'Hỏi' : 'Tự duyệt'}${d.group ? ` · ${d.group}` : ''}` : '—'; }).join(' | ')} | ${majority[c.id] ?? 'hòa/chưa có'} |`);
  }
  lines.push('## Đồng thuận người – máy', '', ...rows, '', `- Cùng quyết định tự duyệt/phải hỏi: **${pct(agreeStatus, totalDecisions)}**`, `- Cùng nhóm dừng (trong các ca cả hai cùng chuyển tiếp và người dùng ghi nhóm): **${pct(agreeGroup, groupComparable)}**`, '');

  // Lấy đa số người dùng làm chuẩn
  const labelled = userStudyCases.filter(c => majority[c.id]);
  const needEsc = labelled.filter(c => majority[c.id] === 'ESCALATE'), routine = labelled.filter(c => majority[c.id] === 'AUTO');
  const missed = needEsc.filter(c => system[c.id].status === 'ROUTINE'), unnecessary = routine.filter(c => system[c.id].status === 'ESCALATED');
  lines.push('## Độ chính xác theo nhãn của người dùng (đa số theo ca)', '', `- Bỏ sót (người dùng cho là phải hỏi, hệ thống tự duyệt): **${ci(missed.length, needEsc.length)}**${missed.length ? ` — ${missed.map(c => c.id).join(', ')}` : ''}`,
    `- Chuyển tiếp thừa (người dùng cho là tự duyệt được, hệ thống vẫn hỏi): **${ci(unnecessary.length, routine.length)}**${unnecessary.length ? ` — ${unnecessary.map(c => c.id).join(', ')}` : ''}`, '- Mẫu rất nhỏ (5 ca); khoảng tin cậy rộng là kết quả trung thực, không phải ước lượng độ chính xác tổng quát.', '');

  // Ca kiểm tra tin máy quá mức
  const trap = userStudyCases.find(c => c.designedAs.trap)!;
  const caught = participants.filter(p => p.decisions[trap.id]?.decision === 'ESCALATE');
  lines.push('## Ca kiểm tra "tin máy quá mức"', '', `Ca ${trap.id} (${trap.summary}) — hệ thống **${system[trap.id].status === 'ROUTINE' ? 'tự duyệt' : 'chuyển tiếp'}**. Người dùng tự đánh dấu cần hỏi: **${pct(caught.length, participants.length)}**.`, '');

  // Câu hỏi chuyển tiếp & thang đo
  const oneReply = participants.flatMap(p => Object.values(p.answeredInOneReply || {})).filter(v => v !== null && v !== undefined);
  lines.push('## Chất lượng câu hỏi, niềm tin, gánh nặng', '',
    `- Trả lời câu hỏi chuyển tiếp trong một lần, không mở lại chứng từ: **${pct(oneReply.filter(Boolean).length, oneReply.length)}**`,
    `- Q4 trả lời ngay trong một lần (1–5): ${mean(participants.map(p => p.likert.q4))} · Q5 đúng người: ${mean(participants.map(p => p.likert.q5))} · Q6 ba nhóm dễ hiểu: ${mean(participants.map(p => p.likert.q6))}`,
    `- Q8 tin ca tự xử lý (1–5): ${mean(participants.map(p => p.likert.q8))} · Q9 sẽ tự kiểm tra lại: ${participants.map(p => p.q9WillRecheck || '—').join(', ')}`,
    `- Q12 áp lực cuối tháng (5 = nhiều): ${mean(participants.map(p => p.likert.q12))} · Q13 cảnh báo quá nhiều: ${mean(participants.map(p => p.likert.q13))} · Q16 giảm trao đổi trực tiếp: ${mean(participants.map(p => p.likert.q16))}`,
    `- Thời gian làm quen (phút): ${mean(participants.map(p => p.learningMinutes))}`, '');
  lines.push('## Trước / sau (người dùng tự báo cách làm hiện tại)', '',
    `- Hiện tại: ${mean(participants.map(p => p.baseline.minutesPerInvoice))} phút/hóa đơn; ${mean(participants.map(p => p.baseline.percentAskOthers))}% hóa đơn phải hỏi người khác`,
    `- Với Tax Referee: thời gian người dùng cần cho mỗi ca ${mean(participants.flatMap(p => Object.values(p.decisions).map(d => d?.seconds)))} giây (tự ước tính trong buổi thử)`, '');

  // Trích dẫn nguyên văn
  const labels: Record<string, string> = { q7: 'Câu hỏi chung chung/thừa/sai', q10: 'Không đồng ý với hệ thống', q11: 'Việc mới phát sinh', q15: 'Khó hiểu nhất', q17: 'Muốn gặp trực tiếp khi', q18: 'Một thay đổi muốn sửa ngay', q19: 'Lý do chưa dám dùng thật', q20: 'Nhận xét khác' };
  lines.push('## Trích dẫn nguyên văn (theo phạm vi đồng ý)', '');
  for (const p of participants) for (const [key, text] of Object.entries(p.quotes || {})) if (text?.trim()) lines.push(`- **${labels[key] || key}** — "${text.trim()}" — ${who(p)}`);
  lines.push('', `_Sinh bởi scripts/qa/evaluate-user-study.ts từ ${file}; hệ thống chạy tất định trên commit hiện tại._`);
  console.log(lines.join('\n'));
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
