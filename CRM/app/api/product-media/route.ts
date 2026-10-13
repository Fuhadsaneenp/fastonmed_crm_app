import { NextRequest, NextResponse } from 'next/server';
import { GET as getProducts } from '../products/route';

export async function GET(request: NextRequest) {
  const response = await getProducts(request);
  const data = await response.json();
  const products = Array.isArray(data) ? data : data.products || [];
  const urls = new Set<string>();
  for (const product of products) {
    for (const url of [product.image, ...(product.galleryImages || [])]) {
      if (url) urls.add(url);
    }
  }
  return NextResponse.json({ success: true, media: Array.from(urls).map(url => ({
    url, name: url.startsWith('data:') ? 'Uploaded product image' : url.split('/').pop(), category: 'library',
  })) });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ success: false, error: 'Sign in before uploading images' }, { status: 401 });
  try {
    const auth = await fetch(`${(process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.fastonmed.com').replace(/\/$/, '')}/api/auth/me`, { headers: { Authorization: authorization }, cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!auth.ok) return NextResponse.json({ success: false, error: 'Please sign in again before uploading images' }, { status: 401 });
  } catch { return NextResponse.json({ success: false, error: 'Could not verify your login. Please retry.' }, { status: 503 }); }
  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: 'Choose an image smaller than 5 MB' }, { status: 400 });
  }
  if (!process.env.MEDIA_UPLOAD_TOKEN) return NextResponse.json({ success: false, error: 'Shared cloud uploads are not configured yet' }, { status: 503 });
  const origin = (process.env.WEBSITE_CATALOG_URL || 'https://www.fastonmed.com').replace(/\/$/, '');
  try {
    const response = await fetch(`${origin}/api/admin/media`, { method: 'POST', headers: { 'x-media-upload-token': process.env.MEDIA_UPLOAD_TOKEN }, body: form, signal: AbortSignal.timeout(30000) });
    const result = await response.json();
    if (result.url?.startsWith('/')) result.url = `${origin}${result.url}`;
    return NextResponse.json(result, { status: response.status });
  } catch { return NextResponse.json({ success: false, error: 'Cloud image upload failed. Please retry; your existing image has not changed.' }, { status: 503 }); }
}
