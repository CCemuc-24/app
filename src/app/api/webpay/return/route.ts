import { NextRequest, NextResponse } from 'next/server';

// Why a Route Handler (and not a Server Action): Transbank Webpay returns the
// browser to our configured returnUrl via an HTTP POST carrying token_ws in a
// form body (and re-issues a GET on some abort paths). A Server Action is not an
// addressable URL an external system can POST a form to, nor a valid target for a
// top-level browser navigation/redirect. This handler is a thin shim: it reads the
// params and redirects into the App Router; all DB work happens in the
// confirmPurchase server action invoked from /confirmation.

const ABORT_MESSAGE = 'Error en la compra';

// Fall back to the request origin when NEXT_PUBLIC_BASE_URL is unset, so the
// live Webpay return never 500s on `new URL('/confirmation', '')`.
function baseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
}

function redirectToConfirmation(base: string, purchaseId: string, tokenWs: string): NextResponse {
  const url = new URL('/confirmation', base);
  url.searchParams.set('purchaseId', purchaseId);
  url.searchParams.set('token_ws', tokenWs);
  // 303 See Other so the browser issues a GET to /confirmation after the POST return.
  return NextResponse.redirect(url, 303);
}

function redirectToError(base: string, purchaseId: string | null): NextResponse {
  const url = new URL('/error', base);
  url.searchParams.set('message', ABORT_MESSAGE);
  if (purchaseId) url.searchParams.set('purchaseId', purchaseId);
  // 303 See Other for the /error redirect as well.
  return NextResponse.redirect(url, 303);
}

function decide(base: string, params: URLSearchParams): NextResponse {
  const purchaseId = params.get('purchaseId');
  const tokenWs = params.get('token_ws');

  // Transbank abort signals: TBK_* params present, or no token at all.
  const aborted =
    params.has('TBK_TOKEN') || params.has('TBK_ORDEN_COMPRA') || params.has('TBK_ID_SESION');

  if (aborted || !tokenWs) {
    return redirectToError(base, purchaseId);
  }
  return redirectToConfirmation(base, purchaseId ?? '', tokenWs);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const form = await req.formData().catch(() => null);
  if (form) {
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string') params.set(key, value);
    }
  }
  return decide(baseUrl(req), params);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return decide(baseUrl(req), new URLSearchParams(req.nextUrl.searchParams));
}
