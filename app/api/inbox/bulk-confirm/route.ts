import {NextResponse} from 'next/server';
export async function POST() {return NextResponse.json({error:'Ca thường quy được xử lý tự động; không cần duyệt hàng loạt.'},{status:410});}
