import {getDatabase,isSandbox} from './db';

export class ArtifactQuotaError extends Error {}
export function assertArtifactCapacity(byteSize:number) {
  const maxBytes=isSandbox()?100*1024*1024:1024*1024*1024;
  const maxFiles=isSandbox()?100:10_000;
  const usage=getDatabase().prepare('SELECT COUNT(*) files,COALESCE(SUM(byte_size),0) bytes FROM document_artifacts').get() as {files:number;bytes:number};
  if(byteSize>15*1024*1024 || usage.files>=maxFiles || usage.bytes+byteSize>maxBytes)
    throw new ArtifactQuotaError('Đã đạt giới hạn lưu chứng từ của phiên. Mở phiên demo mới hoặc liên hệ quản trị để lưu trữ hồ sơ.');
}
