import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('assertAdmin', () => {
  const ORIGINAL = { ...process.env };
  beforeEach(() => {
    process.env.ADMIN_SECRET = 'top-secret';
  });
  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it('does not throw when the secret matches ADMIN_SECRET', async () => {
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin(process.env.ADMIN_SECRET!)).not.toThrow();
  });

  it('throws UnauthorizedError when the secret does not match', async () => {
    const { assertAdmin, UnauthorizedError } = await import('./auth');
    expect(() => assertAdmin('wrong')).toThrow();
    expect(() => assertAdmin('wrong')).toThrow(UnauthorizedError);
  });

  it('throws for an empty secret', async () => {
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin('')).toThrow();
  });

  it('throws when ADMIN_SECRET env is unset (never auth-by-default)', async () => {
    delete process.env.ADMIN_SECRET;
    const { assertAdmin } = await import('./auth');
    expect(() => assertAdmin('')).toThrow();
    expect(() => assertAdmin('anything')).toThrow();
  });
});
