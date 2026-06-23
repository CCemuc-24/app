import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from './route';

const BASE = 'https://ccemuc.cl';

beforeEach(() => {
  process.env.NEXT_PUBLIC_BASE_URL = BASE;
});

function postReq(url: string, form: Record<string, string>): NextRequest {
  const body = new URLSearchParams(form).toString();
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
}

describe('Webpay return Route Handler — POST', () => {
  it('redirects to /confirmation with purchaseId + token_ws from the form body', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-1`, { token_ws: 'tok-abc' });
    const res = await POST(req);
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-1');
    expect(loc.searchParams.get('token_ws')).toBe('tok-abc');
  });

  it('reads purchaseId from the form body if not in the query', async () => {
    const req = postReq(`${BASE}/api/webpay/return`, { token_ws: 'tok-xyz', purchaseId: 'pur-2' });
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-2');
    expect(loc.searchParams.get('token_ws')).toBe('tok-xyz');
  });

  it('redirects to /error when Transbank aborts (TBK_* present)', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-3`, {
      TBK_TOKEN: 'abort',
      TBK_ORDEN_COMPRA: 'oc',
      TBK_ID_SESION: 'sid',
    });
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
    expect(loc.searchParams.get('message')).toBe('Error en la compra');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-3');
  });

  it('redirects to /error when token_ws is missing', async () => {
    const req = postReq(`${BASE}/api/webpay/return?purchaseId=pur-4`, {});
    const res = await POST(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
  });
});

describe('Webpay return Route Handler — GET', () => {
  it('redirects to /confirmation reading params from the query string', async () => {
    const req = new NextRequest(`${BASE}/api/webpay/return?purchaseId=pur-5&token_ws=tok-get`);
    const res = await GET(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/confirmation');
    expect(loc.searchParams.get('purchaseId')).toBe('pur-5');
    expect(loc.searchParams.get('token_ws')).toBe('tok-get');
  });

  it('redirects to /error on a GET abort (TBK_TOKEN present)', async () => {
    const req = new NextRequest(`${BASE}/api/webpay/return?purchaseId=pur-6&TBK_TOKEN=abort`);
    const res = await GET(req);
    const loc = new URL(res.headers.get('location')!);
    expect(loc.pathname).toBe('/error');
  });
});
