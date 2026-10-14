"""Package the tested local build without machine-specific native modules or secrets."""
import argparse,io,subprocess,tarfile
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('output',type=Path);a=p.parse_args()
root=Path(__file__).resolve().parent.parent
build=root/'.next'/'standalone'
if not (build/'server.js').exists():p.error('Run npm run build first')
with tarfile.open(a.output,'w:gz') as archive:
 def add_tree(folder,arcroot):
  for f in folder.rglob('*'):
   if not f.is_file():continue
   rel=f.relative_to(folder)
   if any(x in {'node_modules','uploads','__pycache__'} or x.startswith('.env') for x in rel.parts) or f.name=='env.local':continue
   if folder.name=='data' and rel.parts[0]=='runtime' or 'data/runtime/' in rel.as_posix():continue
   archive.add(f,arcname=str(Path(arcroot)/rel))
 # Commit của bản đóng gói: /api/health và Verify hiển thị để chứng minh live URL chạy đúng mã nguồn công khai.
 commit=subprocess.run(['git','rev-parse','HEAD'],cwd=root,capture_output=True,text=True,check=True).stdout.strip().encode()
 for arcname in ['.git-commit','.next/standalone/.git-commit']:
  info=tarfile.TarInfo(arcname);info.size=len(commit);archive.addfile(info,io.BytesIO(commit))
 add_tree(build,'.next/standalone')
 add_tree(root/'.next/static','.next/standalone/.next/static')
 if (root/'public').exists():add_tree(root/'public','.next/standalone/public')
 for folder in ['app','components','lib','services','data','scripts','deployment']:
  add_tree(root/folder,folder)
 for name in ['package.json','package-lock.json','next.config.ts','tsconfig.json','tailwind.config.ts','postcss.config.mjs']:
  f=root/name
  if f.exists():archive.add(f,arcname=name)
print(a.output, a.output.stat().st_size)

import json
with tarfile.open(a.output) as archive:
 names=set(archive.getnames())
 manifest=json.loads((build/'.next/server/app-paths-manifest.json').read_text())
 missing=[route for route,file in manifest.items() if '.next/standalone/.next/server/'+file not in names]
 if missing:raise RuntimeError('Missing compiled routes: '+', '.join(missing))
print('All compiled page/API routes packaged.')
