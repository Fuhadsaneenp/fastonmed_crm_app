import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ') || authorization.includes('session-token-')) return NextResponse.json({ success: false, error: 'Please sign in to view enquiries' }, { status: 401 });
  const origin = (process.env.WEBSITE_CATALOG_URL || 'https://www.fastonmed.com').replace(/\/$/, '');
  try {
    const response = await fetch(`${origin}/api/enquiries${request.nextUrl.search}`, {
      method: request.method,
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: request.method === 'PUT' ? await request.text() : undefined,
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    const body = await response.text();
    let payload;
    try { payload = JSON.parse(body); }
    catch { return NextResponse.json({ success: false, error: 'The website connection is temporarily unavailable. Please try again shortly.' }, { status: 503 }); }
    return NextResponse.json(payload, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Website enquiries are temporarily unavailable. Please retry.' }, { status: 503 });
  }
}
export const GET = proxy;
export const PUT = proxy;
export const DELETE = proxy;
