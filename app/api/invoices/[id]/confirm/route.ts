import {NextResponse} from 'next/server';
export async function POST() {return NextResponse.json({error:'Ca thường quy được xử lý tự động. Dùng luồng bổ sung dữ liệu và đánh giá lại cho hồ sơ cũ.'},{status:410});}
