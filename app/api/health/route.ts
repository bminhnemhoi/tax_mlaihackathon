import {NextResponse} from 'next/server';
import {getDatabase} from '@/lib/server/db';
export const dynamic='force-dynamic';
export async function GET(){try{getDatabase().prepare('SELECT 1').get();return NextResponse.json({status:'ok',timestamp:new Date().toISOString()});}catch{return NextResponse.json({status:'unavailable'},{status:503});}}
