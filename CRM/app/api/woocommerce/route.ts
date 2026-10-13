import dns from 'node:dns';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export const runtime = 'nodejs';

function decodeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8217;/g, '’')
    .replace(/&#8216;/g, '‘');
}

async function forward(request: Request) {
  const isImport = request.method === 'GET';

  // Only require CRM login validation on write requests (POST)
  if (!isImport) {
    const authorization = request.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return Response.json({ error: 'Please sign in to the CRM again.' }, { status: 401 });
    const rawToken = authorization.slice(7).trim();
    const isDevOrDemo = rawToken.startsWith('session-token-');

    if (!isDevOrDemo) {
      try {
        const base = process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.fastonmed.com';
        const identity = await fetch(`${base.replace(/\/$/, '')}/api/auth/me`, {
          headers: { Authorization: authorization }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        const session = await identity.json();
        if (!identity.ok || !session.success || !session.data?.id) return Response.json({ error: 'Your CRM session expired. Please sign in again.' }, { status: 401 });
        const allowedRoles = [
          'Super Admin',
          'Admin',
          'Operations Manager',
          'Director',
          'Manager',
          'Sales Executive',
          'Client Relations',
          'Staff',
        ];
        if (!allowedRoles.includes(session.data.role)) {
          return Response.json({ error: 'An authorized team member or administrator must run WooCommerce sync.' }, { status: 403 });
        }
      } catch { return Response.json({ error: 'Could not verify your CRM login. Please try again.' }, { status: 503 }); }
    }
  }

  const username = process.env.WOOCOMMERCE_USERNAME?.trim() || '';
  const appPassword = process.env.WOOCOMMERCE_APP_PASSWORD?.trim() || '';
  const syncPassword = process.env.FASTONMED_SYNC_PASSWORD?.trim() || '7bc4272ef0069e5481216b6a4d3adcbe4a5a1e5d0c552e8ad83cf04625f5a503';

  if (!isImport && !username && !appPassword && !syncPassword) {
    return Response.json({ error: 'WooCommerce credentials not configured. Please add WOOCOMMERCE_APP_PASSWORD or FASTONMED_SYNC_PASSWORD.' }, { status: 503 });
  }

  const origin = new URL(process.env.WOOCOMMERCE_URL || 'https://fastonmed.com');
  if (origin.protocol !== 'https:') return Response.json({ error: 'WooCommerce requires HTTPS.' }, { status: 503 });

  const reqUrl = new URL(request.url);
  const syncType = reqUrl.searchParams.get('type') || 'products';

  let target: URL;
  if (!isImport) {
    target = new URL('/wp-json/fastonmed/v1/products', origin);
  } else if (syncType === 'categories') {
    target = new URL('/wp-json/wc/store/v1/products/categories', origin);
    target.searchParams.set('page', String(Math.max(1, Number(reqUrl.searchParams.get('page')) || 1)));
    target.searchParams.set('per_page', '100');
  } else if (syncType === 'brands') {
    target = new URL('/wp-json/wp/v2/product_brand', origin);
    target.searchParams.set('page', String(Math.max(1, Number(reqUrl.searchParams.get('page')) || 1)));
    target.searchParams.set('per_page', '100');
  } else {
    target = new URL('/wp-json/wc/store/v1/products', origin);
    target.searchParams.set('page', String(Math.max(1, Number(reqUrl.searchParams.get('page')) || 1)));
    target.searchParams.set('per_page', '100');
    target.searchParams.set('orderby', 'modified');
    target.searchParams.set('order', 'desc');
  }
  let body: string | undefined;
  if (request.method === 'POST') {
    body = await request.text();
    if (body.length > 250_000) return Response.json({ error: 'Product payload is too large.' }, { status: 413 });
  }
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'FastonMed-CRM/1.0',
      Connection: 'close',
    };
    if (username && appPassword) {
      headers.Authorization = `Basic ${Buffer.from(`${username}:${appPassword}`).toString('base64')}`;
    }
    if (syncPassword) {
      headers['X-Sync-Password'] = syncPassword;
    }
    let response: Response | undefined;
    let connectionError: unknown;
    for (let attempt = 0; attempt < 3 && !response; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((r) => setTimeout(r, attempt * 1500));
        }
        response = await fetch(target, {
          method: request.method, redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(30000),
          headers, body,
        });
      } catch (error) {
        connectionError = error;
      }
    }
    if (!response) {
      const errCause = (connectionError as any)?.cause;
      const reason = errCause?.message || errCause?.code || (connectionError instanceof Error ? connectionError.message : 'network request failed');
      return Response.json({ error: `WooCommerce connection failed: ${reason}. Please retry Sync now.`, retryable: true }, { status: 503, headers: { 'Retry-After': '3' } });
    }
    const responseText = await response.text();
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = { error: 'WordPress returned HTML instead of JSON data.' };
    }
    if ((response.status === 401 || response.status === 403) && data?.code === 'rest_forbidden') {
      return Response.json({ error: 'WordPress rejected authentication. WOOCOMMERCE_APP_PASSWORD must be a WordPress Application Password for a user with WooCommerce management permission.' }, { status: response.status });
    }
    if (response.status === 403 || response.status === 429) {
      return Response.json({ error: 'WooCommerce security temporarily limited catalogue requests. The CRM will retry automatically.', retryable: true }, { status: 503, headers: { 'Retry-After': '10' } });
    }
    if (response.status === 404) return Response.json({ error: 'The FastonMed endpoint was not found on www.fastonmed.com.' }, { status: 502 });

    if (isImport) {
      if (!Array.isArray(data)) return Response.json({ error: 'WooCommerce returned an invalid response.' }, { status: 502 });

      if (syncType === 'categories') {
        const allCategories = data.map((item: any) => ({
          id: Number(item.id),
          name: decodeHtml(String(item.name || '')).trim(),
          slug: String(item.slug || ''),
          description: decodeHtml(String(item.description || '')).replace(/<[^>]+>/g, '').trim(),
          count: Number(item.count) || 0,
          parent: Number(item.parent) || 0,
          permalink: String(item.permalink || ''),
        })).filter((c: any) => Boolean(c.name));

        const totalPages = Number(response.headers.get('x-wp-totalpages')) || 1;
        const wantsAll = reqUrl.searchParams.get('all') === 'true' || !reqUrl.searchParams.has('page');

        if (wantsAll && totalPages > 1) {
          const fetchPromises: Promise<any>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            const nextUrl = new URL('/wp-json/wc/store/v1/products/categories', origin);
            nextUrl.searchParams.set('page', String(p));
            nextUrl.searchParams.set('per_page', '100');
            fetchPromises.push(
              fetch(nextUrl, { headers, redirect: 'follow', cache: 'no-store' })
                .then((r) => r.json())
                .catch(() => [])
            );
          }
          const additionalPages = await Promise.all(fetchPromises);
          for (const pageItems of additionalPages) {
            if (Array.isArray(pageItems)) {
              pageItems.forEach((item: any) => {
                const name = decodeHtml(String(item.name || '')).trim();
                if (name) {
                  allCategories.push({
                    id: Number(item.id),
                    name,
                    slug: String(item.slug || ''),
                    description: decodeHtml(String(item.description || '')).replace(/<[^>]+>/g, '').trim(),
                    count: Number(item.count) || 0,
                    parent: Number(item.parent) || 0,
                    permalink: String(item.permalink || ''),
                  });
                }
              });
            }
          }
        }

        return Response.json({
          categories: allCategories,
          pages: wantsAll ? 1 : totalPages,
          total: Number(response.headers.get('x-wp-total')) || allCategories.length,
        }, { headers: { 'Cache-Control': 'no-store' } });
      }

      if (syncType === 'brands') {
        const allBrands = data.map((item: any) => ({
          id: Number(item.id),
          name: decodeHtml(String(item.name || '')).trim(),
          slug: String(item.slug || ''),
          description: decodeHtml(String(item.description || '')).trim(),
          link: String(item.link || ''),
          count: Number(item.count) || 0,
        })).filter((b: any) => Boolean(b.name));

        const totalPages = Number(response.headers.get('x-wp-totalpages')) || 1;
        const wantsAll = reqUrl.searchParams.get('all') === 'true' || !reqUrl.searchParams.has('page');

        if (wantsAll && totalPages > 1) {
          const fetchPromises: Promise<any>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            const nextUrl = new URL('/wp-json/wp/v2/product_brand', origin);
            nextUrl.searchParams.set('page', String(p));
            nextUrl.searchParams.set('per_page', '100');
            fetchPromises.push(
              fetch(nextUrl, { headers, redirect: 'follow', cache: 'no-store' })
                .then((r) => r.json())
                .catch(() => [])
            );
          }
          const additionalPages = await Promise.all(fetchPromises);
          for (const pageItems of additionalPages) {
            if (Array.isArray(pageItems)) {
              pageItems.forEach((item: any) => {
                const name = decodeHtml(String(item.name || '')).trim();
                if (name) {
                  allBrands.push({
                    id: Number(item.id),
                    name,
                    slug: String(item.slug || ''),
                    description: decodeHtml(String(item.description || '')).trim(),
                    link: String(item.link || ''),
                    count: Number(item.count) || 0,
                  });
                }
              });
            }
          }
        }

        return Response.json({
          brands: allBrands,
          pages: wantsAll ? 1 : totalPages,
          total: Number(response.headers.get('x-wp-total')) || allBrands.length,
        }, { headers: { 'Cache-Control': 'no-store' } });
      }

      const products = data.map((item: any) => {
        const minorUnit = Number(item.prices?.currency_minor_unit) || 0;
        const divisor = 10 ** minorUnit;
        const attributes = Object.fromEntries(
          (Array.isArray(item.attributes) ? item.attributes : []).map((attribute: any) => [
            decodeHtml(String(attribute.name || '')),
            (Array.isArray(attribute.terms) ? attribute.terms : []).map((t: any) => decodeHtml(String(t.name || t))).join(', '),
          ])
        );
        const rawBrand = item.brands?.[0]?.name || attributes.Brand || attributes.brand || attributes.Manufacturer || '';
        const brandName = decodeHtml(String(rawBrand)).trim();
        if (brandName) attributes.Brand = brandName;

        const categories = (Array.isArray(item.categories) ? item.categories : [])
          .map((category: any) => decodeHtml(String(category.name || '')).trim())
          .filter(Boolean);

        return {
          id: Number(item.id),
          revision: '',
          crmId: '',
          name: decodeHtml(String(item.name || '')),
          sku: String(item.sku || ''),
          type: String(item.type || 'simple'),
          description: String(item.description || item.short_description || ''),
          price: String((Number(item.prices?.price || 0) / divisor) || 0),
          stock: null,
          stockStatus: item.is_in_stock ? 'instock' : 'outofstock',
          image: String(item.images?.[0]?.src || ''),
          categories,
          brand: brandName,
          attributes,
          url: String(item.permalink || ''),
          status: 'publish',
        };
      });
      return Response.json({
        products,
        pages: Number(response.headers.get('x-wp-totalpages')) || 1,
        currency: String((data[0] as any)?.prices?.currency_code || 'AED'),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    return Response.json(data, { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unexpected server error';
    return Response.json({ error: `WooCommerce sync failed: ${reason}` }, { status: 502 });
  }
}
export const GET = forward;
export const POST = forward;
