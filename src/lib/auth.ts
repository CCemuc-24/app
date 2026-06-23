/** Thrown by assertAdmin when the supplied secret does not match ADMIN_SECRET. */
export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Server-side admin gate. Compares the caller-supplied secret against ADMIN_SECRET.
 * Returns void when authorized; throws UnauthorizedError otherwise.
 * ADMIN_SECRET is server-only and is never sent to the client.
 */
export function assertAdmin(secret: string): void {
  const expected = process.env.ADMIN_SECRET;
  if (!expected || secret !== expected) {
    throw new UnauthorizedError('Unauthorized');
  }
}
