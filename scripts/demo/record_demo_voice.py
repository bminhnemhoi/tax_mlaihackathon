"""Video demo ~1 phút có GIỌNG ĐỌC NAM (edge-tts vi-VN-NamMinhNeural), giải thích đủ tính năng, không đọc số liệu.

Chạy khi server local đang chạy (bản build mới nhất, dữ liệu sạch):
  python scripts/demo/record_demo_voice.py --base http://127.0.0.1:3060
Kết quả: docs/submission/video/Tax-Referee-demo-1-phut.mp4 (ghi đè bản không tiếng).
Cách đồng bộ: tạo giọng từng đoạn trước → mỗi bước trên màn hình giữ ít nhất bằng độ dài đoạn đọc → ghi mốc thời gian
từng bước → ghép tiếng đúng mốc bằng ffmpeg (adelay).
"""
from __future__ import annotations

import argparse
import asyncio
import glob
import os
import shutil
import subprocess
import sys
import tempfile
import time

import edge_tts
from playwright.sync_api import Page, sync_playwright

ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', '..'))
VIDEO_DIR = os.path.join(ROOT, 'docs', 'submission', 'video')
DATA = os.path.join(ROOT, 'data', 'demo-batch')
VOICE = 'vi-VN-NamMinhNeural'

LINES = {
    'intro': 'Đây là Tax Referee, trợ lý kiểm hóa đơn đầu vào. Quy tắc quyết định, AI chỉ đọc chứng từ, còn con người giữ quyền ký.',
    'upload': 'Cuối tháng, kế toán kéo cả lô hóa đơn vào. Máy đọc hết, xếp theo người bán, ngày và số hóa đơn, rồi kiểm từng tờ.',
    'explain': 'Tờ nào ổn, máy đề xuất duyệt và kèm phiếu giải trình: đạt những điều kiện nào, vì sao được khấu trừ.',
    'stop': 'Tờ nào có vấn đề, máy dừng lại, tô đỏ đúng chỗ, rồi hỏi đúng người có quyền bằng một câu có sẵn hai lựa chọn.',
    'group': 'Kế toán trưởng trả lời một lần cho cả nhóm hóa đơn cùng câu hỏi. Mỗi tờ vẫn được kiểm quyền và ghi nhật ký riêng.',
    'signoff': 'Máy không tự ghi sổ. Kế toán trưởng xem tổng hợp, rồi ký chốt lô.',
    'dashboard': 'Sếp chỉ cần một màn hình để biết hóa đơn nào máy đã xử lý, hóa đơn nào đang chờ ai quyết.',
    'history': 'Mỗi người xem lại được lịch sử duyệt của chính mình.',
    'channels': 'Hóa đơn gửi qua Gmail hay Zalo đều được nhận về. Hệ thống biết ai gửi, và chặn email giả danh nhân viên.',
    'privacy': 'Dữ liệu đi đâu cũng nói rõ. Hóa đơn điện tử không bao giờ đi qua AI.',
    'outro': 'Tax Referee. Máy kiểm nhanh, người quyết đúng chỗ.',
}


async def synth_all(out_dir: str) -> dict[str, tuple[str, float]]:
    result: dict[str, tuple[str, float]] = {}
    for key, text in LINES.items():
        path = os.path.join(out_dir, f'{key}.mp3')
        await edge_tts.Communicate(text, VOICE, rate='+8%').save(path)
        dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())
        result[key] = (path, dur)
    return result


def caption(page: Page, text: str) -> None:
    page.evaluate("""(t) => {
      let el = document.getElementById('demo-caption');
      if (!el) { el = document.createElement('div'); el.id = 'demo-caption';
        Object.assign(el.style, { position: 'fixed', left: '50%', bottom: '22px', transform: 'translateX(-50%)', zIndex: 99999,
          background: 'rgba(15,23,42,.9)', color: '#fff', padding: '10px 18px', borderRadius: '12px', font: '600 18px system-ui, sans-serif',
          maxWidth: '86%', textAlign: 'center' });
        document.body.appendChild(el); }
      el.textContent = t; }""", text)


def main() -> None:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://127.0.0.1:3060')
    args = ap.parse_args()
    tmp = tempfile.mkdtemp(prefix='tr-voice-')
    audio = asyncio.run(synth_all(tmp))
    print('giọng đọc tổng', round(sum(d for _, d in audio.values()), 1), 'giây', flush=True)
    files = sorted(glob.glob(os.path.join(DATA, '*.xml')))
    marks: list[tuple[str, float]] = []
    os.makedirs(VIDEO_DIR, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1366, 'height': 768}, record_video_dir=tmp, record_video_size={'width': 1366, 'height': 768}, locale='vi-VN')
        page = ctx.new_page()
        page.on('dialog', lambda d: d.accept())
        page.set_default_timeout(180_000)
        t0 = time.monotonic()

        def step(key: str, action=None, settle: float = 0.0) -> None:
            start = time.monotonic()
            marks.append((key, start - t0))
            caption(page, LINES[key])
            if action:
                action()
            elapsed = time.monotonic() - start
            time.sleep(max(0.0, audio[key][1] + 0.35 - elapsed) + settle)

        page.goto(args.base + '/')
        step('intro')
        page.select_option('#demo-role', 'ACCOUNTANT')
        page.get_by_role('button', name='② Mở hộp chuyển tiếp — demo riêng').click()
        page.wait_for_url('**/workspace/**')
        page.goto(args.base + '/workspace/batches')

        def upload() -> None:
            page.set_input_files('input[type=file]', files)
            page.wait_for_selector('section[aria-label^="Lô "]', timeout=240_000)
        step('upload', upload)
        page.wait_for_timeout(400)

        def explain() -> None:
            page.get_by_text('HĐ 0000107').first.click()
            page.get_by_text('HĐ 0000107').first.scroll_into_view_if_needed()
        step('explain', explain)

        def stop() -> None:
            row = page.get_by_text('HĐ 0000117').first
            row.scroll_into_view_if_needed()
        step('stop', stop)

        page.select_option('#workspace-role', 'CHIEF_ACCOUNTANT')
        page.wait_for_timeout(1200)
        page.goto(args.base + '/workspace/batches')
        page.locator('section[aria-label="Danh sách lô"] button').first.click()
        page.wait_for_selector('text=Trả lời chung', timeout=60_000)

        def group() -> None:
            card = page.locator('div', has_text='ủy nhiệm chi').filter(has=page.get_by_role('button', name='Áp dụng cho 3 hóa đơn')).last
            card.scroll_into_view_if_needed()
            card.get_by_text('A:', exact=False).first.click()
            card.get_by_placeholder('Lý do (ít nhất 8 ký tự)').fill('Đã đối chiếu ủy nhiệm chi trên sao kê ngân hàng')
            card.get_by_role('button', name='Áp dụng cho 3 hóa đơn').click()
            page.wait_for_timeout(1500)
        step('group', group)

        def signoff() -> None:
            note = page.get_by_placeholder('Ghi chú khi chốt (ít nhất 8 ký tự)')
            note.scroll_into_view_if_needed()
            note.fill('Chốt lô cuối tháng sau khi xem phiếu giải trình')
            page.get_by_role('button', name='Chốt ').last.click()
            page.wait_for_timeout(1500)
        step('signoff', signoff)

        step('dashboard', lambda: (page.goto(args.base + '/workspace/dashboard'), page.wait_for_timeout(1200)))
        step('history', lambda: (page.goto(args.base + '/workspace/history'), page.wait_for_timeout(800)))
        step('channels', lambda: (page.goto(args.base + '/workspace/channels'), page.wait_for_timeout(800)))
        step('privacy', lambda: (page.goto(args.base + '/privacy'), page.wait_for_timeout(600)))
        step('outro', lambda: page.goto(args.base + '/'), settle=0.6)

        video_path = page.video.path() if page.video else None
        ctx.close()
        browser.close()
    if not video_path:
        sys.exit('Không có video')
    inputs = ['-i', video_path]
    filters = []
    for i, (key, at) in enumerate(marks, start=1):
        inputs += ['-i', audio[key][0]]
        ms = int(at * 1000)
        filters.append(f'[{i}:a]adelay={ms}|{ms}[a{i}]')
    mix = ''.join(f'[a{i}]' for i in range(1, len(marks) + 1)) + f'amix=inputs={len(marks)}:normalize=0[aout]'
    out = os.path.join(VIDEO_DIR, 'Tax-Referee-demo-1-phut.mp4')
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(filters + [mix]), '-map', '0:v', '-map', '[aout]',
           '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]
    subprocess.run(cmd, check=True)
    dur = subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).decode().strip()
    print('video', out, dur, 'giây', flush=True)
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    main()
