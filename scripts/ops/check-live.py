"""Kiểm bản live sau deploy trong một lệnh (UTF-8 an toàn; curl trên Git Bash Windows làm hỏng JSON tiếng Việt).

    python scripts/ops/check-live.py                       # mặc định: bản live Hostinger
    python scripts/ops/check-live.py --expect-commit abc1234
    python scripts/ops/check-live.py --base http://127.0.0.1:3000 --no-probes

Kiểm: /api/health (status, commit, HMAC, cảnh báo) · /api/verify?mode=judge (9/9, commit) · /api/security/probes
(tạo phiên demo rồi chạy phép thử /trust; giới hạn 10 lần/10 phút mỗi phiên). Thoát mã 1 nếu có mục đỏ.
"""
import argparse
import http.cookiejar
import json
import sys
import urllib.request

DEFAULT_BASE = 'https://limegreen-salamander-517622.hostingersite.com'


def main() -> int:
    parser = argparse.ArgumentParser(description='Kiểm bản live sau deploy')
    parser.add_argument('--base', default=DEFAULT_BASE)
    parser.add_argument('--expect-commit', default='', help='7+ ký tự đầu của commit phải đang chạy')
    parser.add_argument('--no-probes', action='store_true', help='bỏ qua phép thử /trust (tiết kiệm giới hạn tần suất)')
    args = parser.parse_args()
    sys.stdout.reconfigure(encoding='utf-8')
    base = args.base.rstrip('/')
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    failures: list[str] = []

    def call(path: str, method: str = 'GET', body: dict | None = None, timeout: int = 90) -> dict:
        data = json.dumps(body).encode('utf-8') if body is not None else None
        req = urllib.request.Request(base + path, data=data, method=method, headers={'Content-Type': 'application/json', 'User-Agent': 'tax-referee-live-check'})
        with opener.open(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))

    def check(ok: bool, label: str) -> None:
        print(('ĐẠT  ' if ok else 'ĐỎ   ') + label)
        if not ok:
            failures.append(label)

    try:
        health = call('/api/health')
        commit = str(health.get('commit', ''))
        audit = health.get('audit') or {}
        check(health.get('status') == 'ok', f"health: status={health.get('status')}")
        check(commit not in ('', 'unknown'), f'health: commit={commit[:12]}')
        if args.expect_commit:
            check(commit.startswith(args.expect_commit), f'health: commit khớp {args.expect_commit}')
        check(audit.get('hmac') is True, f"health: HMAC={audit.get('hmac')} keySource={audit.get('keySource')}")
        check(not health.get('warnings'), f"health: warnings={health.get('warnings')}")
    except Exception as error:  # noqa: BLE001 — báo lỗi mạng như một mục đỏ
        check(False, f'health: không gọi được ({error})')

    try:
        verify = call('/api/verify?mode=judge')
        summary = verify.get('summary', verify)
        passed, total = summary.get('passedCases'), summary.get('totalCases')
        check(passed == total and total == 9, f'verify: {passed}/{total} ca đúng kỳ vọng · commit {str(summary.get("commit", ""))[:7]}')
    except Exception as error:  # noqa: BLE001
        check(False, f'verify: không gọi được ({error})')

    if not args.no_probes:
        try:
            call('/api/demo/session', 'POST', {})
            probes = call('/api/security/probes', 'POST', {}, timeout=120)
            s = probes.get('summary', {})
            check(s.get('total', 0) > 0 and s.get('passed') == s.get('total'), f"trust: {s.get('passed')}/{s.get('total')} phép thử đạt ({s.get('ms')} ms)")
            for r in probes.get('results', []):
                if not r.get('pass'):
                    print(f"      ✗ {r.get('id')} {r.get('attack')}: {r.get('observed')}")
        except Exception as error:  # noqa: BLE001
            check(False, f'trust: không chạy được ({error})')

    print('\n' + ('TẤT CẢ ĐẠT' if not failures else f'{len(failures)} MỤC ĐỎ — cân nhắc revert merge commit'))
    return 0 if not failures else 1


if __name__ == '__main__':
    sys.exit(main())
