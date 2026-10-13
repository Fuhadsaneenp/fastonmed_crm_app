import { NextRequest, NextResponse } from "next/server";

const LIVE_API_BASE_URL = (process.env.CRM_API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.fastonmed.com").replace(/\/$/, "");

type RouteContext = {
  params: Promise<{ path?: string[] }>;
};

async function proxyLiveApi(request: NextRequest, context: RouteContext) {
  const { path = [] } = await context.params;
  const search = request.nextUrl.search || "";
  const targetUrl = `${LIVE_API_BASE_URL}/${path.join("/")}${search}`;

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authorization = request.headers.get("authorization");

  if (contentType) headers.set("content-type", contentType);
  if (authorization) headers.set("authorization", authorization);
  headers.set("origin", "https://crm.fastonmed.com");
  headers.set("user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36");

  const method = request.method.toUpperCase();
  const body = ["GET", "HEAD"].includes(method) ? undefined : await request.text();

  try {
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      cache: "no-store",
    });

    const responseBody = await response.text();
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get("content-type");
    if (responseContentType) responseHeaders.set("content-type", responseContentType);

    return new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Could not connect to live FastonMed API",
        },
      },
      { status: 502 }
    );
  }
}

export const GET = proxyLiveApi;
export const POST = proxyLiveApi;
export const PUT = proxyLiveApi;
export const PATCH = proxyLiveApi;
export const DELETE = proxyLiveApi;
