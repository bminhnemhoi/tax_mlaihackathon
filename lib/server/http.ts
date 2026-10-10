import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class RequestError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function requestErrorResponse(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === 'AUTH_REQUIRED')
    return NextResponse.json({ error: 'Vui lòng đăng nhập.' }, { status: 401 });
  if (error instanceof RequestError)
    return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError || error instanceof ZodError)
    return NextResponse.json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, { status: 400 });
  console.error(fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
