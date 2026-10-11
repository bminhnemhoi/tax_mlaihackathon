"""Preview stale demo files; --apply --offline is required to delete them."""
import argparse,json,re,shutil,time
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('runtime',type=Path)
p.add_argument('--days',type=int,default=7)
p.add_argument('--apply',action='store_true')
p.add_argument('--offline',action='store_true')
a=p.parse_args()
if a.days<1:p.error('Keep at least one day')
if a.apply and not a.offline:p.error('Stop the app first; deletion requires --offline')
root=a.runtime.resolve();cutoff=time.time()-a.days*86400;removed=[]
for db in (root/'demo').glob('*.sqlite'):
 sid=db.stem
 if not re.fullmatch(r'[a-f0-9-]{36}',sid):continue
 files=[db,Path(str(db)+'-wal'),Path(str(db)+'-shm')]
 artifacts=root/'artifacts'/sid
 candidates=[f for f in files if f.exists()]
 if artifacts.exists():candidates.extend(f for f in artifacts.rglob('*') if f.is_file())
 if not candidates or any(f.is_symlink() or f.stat().st_mtime>=cutoff for f in candidates):continue
 removed.append({'session':sid,'bytes':sum(f.stat().st_size for f in candidates),'files':len(candidates)})
 if a.apply:
  for f in files:
   if f.exists():f.unlink()
  if artifacts.is_dir() and not artifacts.is_symlink():shutil.rmtree(artifacts)
print(json.dumps({'mode':'DELETE' if a.apply else 'PREVIEW','days':a.days,'sessions':removed},indent=2))
