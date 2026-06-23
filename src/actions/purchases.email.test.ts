import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    purchase: { findUnique: vi.fn() },
    course: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/mailer', () => ({ sendMail: vi.fn() }));

vi.mock('@/lib/webpay', () => ({
  createWebpayTransaction: vi.fn(),
  commitWebpayTransaction: vi.fn(),
}));
vi.mock('@/domain/buyOrder', () => ({ generateBuyOrder: vi.fn() }));
vi.mock('@/lib/auth', () => ({ assertAdmin: vi.fn() }));
vi.mock('@/lib/confirmationEmail', () => ({
  buildConfirmationEmailHtml: vi.fn().mockReturnValue('<html>test email</html>'),
}));

import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import { sendConfirmation } from './purchases';

const prismaMock = prisma as unknown as {
  purchase: { findUnique: ReturnType<typeof vi.fn> };
  course: { findMany: ReturnType<typeof vi.fn> };
};
const mockSendMail = sendMail as unknown as ReturnType<typeof vi.fn>;

const VALID = {
  purchaseId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'alumno@uc.cl',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendConfirmation', () => {
  it('fails Zod validation when email is malformed', async () => {
    const res = await sendConfirmation({ ...VALID, email: 'not-an-email' });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('email');
    }
    expect(prismaMock.purchase.findUnique).not.toHaveBeenCalled();
  });

  it('returns 404 when the purchase does not exist', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue(null);
    const res = await sendConfirmation(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBe('Purchase not found');
      expect(res.status).toBe(404);
    }
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('builds the HTML server-side and sends with positional args, returns ok(null)', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', coursesIds: ['c1'] });
    prismaMock.course.findMany.mockResolvedValue([
      { id: 'c1', title: 'Elec', type: 'elective', week: 1, price: 15000 },
      { id: 'core1', title: 'Base', type: 'core', week: 0, price: 0 },
    ]);
    mockSendMail.mockResolvedValue(undefined);
    const res = await sendConfirmation(VALID);
    // positional sendMail(to, subject, html) with a server-built HTML string.
    expect(mockSendMail).toHaveBeenCalledWith('alumno@uc.cl', 'Confirmación de compra', expect.any(String));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBeNull();
  });

  it('returns 500 when the mailer throws', async () => {
    prismaMock.purchase.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1', coursesIds: ['c1'] });
    prismaMock.course.findMany.mockResolvedValue([]);
    mockSendMail.mockRejectedValue(new Error('smtp down'));
    const res = await sendConfirmation(VALID);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(500);
  });
});
