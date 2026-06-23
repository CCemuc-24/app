import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { ok, fail } from '@/domain/result';

vi.mock('@/actions/purchases', () => ({
  confirmPurchase: vi.fn(),
  getPurchaseById: vi.fn(),
  sendConfirmation: vi.fn(),
}));
vi.mock('@/actions/courses', () => ({
  getCourses: vi.fn(),
  getCourseById: vi.fn(),
}));
vi.mock('@/actions/users', () => ({
  getUserById: vi.fn(),
}));

import { confirmPurchase, getPurchaseById, sendConfirmation } from '@/actions/purchases';
import { getCourses, getCourseById } from '@/actions/courses';
import { getUserById } from '@/actions/users';
import { useConfirmation } from './useConfirmation';

const purchase = { id: 'p1', userId: 'u1', buyOrder: 'bo', isPaid: true, coursesIds: ['c1'], createdAt: new Date(), updatedAt: new Date() };
const coreCourse = { id: 'core1', title: 'Base', module: 1, type: 'core', price: 0, capacity: 5, features: null, week: 0, topics: [], createdAt: new Date(), updatedAt: new Date() };
const boughtCourse = { id: 'c1', title: 'Elec', module: 2, type: 'elective', price: 15000, capacity: 5, features: null, week: 1, topics: [], createdAt: new Date(), updatedAt: new Date() };
const user = { id: 'u1', names: 'Ada', lastNames: 'L', rut: '1-9', email: 'a@b.cl', university: 'UC', carrerYear: 3, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
});

function mockSuccess() {
  vi.mocked(confirmPurchase).mockResolvedValue(ok({ purchase, transactionStatus: { status: 'AUTHORIZED' } }) as any);
  vi.mocked(getPurchaseById).mockResolvedValue(ok(purchase) as any);
  vi.mocked(getCourseById).mockResolvedValue(ok(boughtCourse) as any);
  vi.mocked(getCourses).mockResolvedValue(ok([coreCourse, boughtCourse]) as any);
  vi.mocked(getUserById).mockResolvedValue(ok(user) as any);
  vi.mocked(sendConfirmation).mockResolvedValue(ok(null) as any);
}

describe('useConfirmation', () => {
  it('confirms, loads info (core + bought + user) and sends email once', async () => {
    mockSuccess();
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );

    await waitFor(() => expect(result.current.confirmed).toBe(true));
    await waitFor(() => expect(result.current.isMailSent).toBe(true));

    expect(confirmPurchase).toHaveBeenCalledWith('p1', 'tok');
    // core + bought courses both present, deduped
    const ids = result.current.courses.map((c) => c.id).sort();
    expect(ids).toEqual(['c1', 'core1']);
    expect(result.current.user?.email).toBe('a@b.cl');
    expect(sendConfirmation).toHaveBeenCalledTimes(1);
    expect(sendConfirmation).toHaveBeenCalledWith({ purchaseId: 'p1', email: 'a@b.cl' });
    expect(result.current.errorRedirect).toBeNull();
  });

  it('sets errorRedirect when confirm fails, and does not send email', async () => {
    vi.mocked(confirmPurchase).mockResolvedValue(fail('Pago no realizado', 402) as any);
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );

    await waitFor(() => expect(result.current.errorRedirect).not.toBeNull());
    expect(result.current.errorRedirect).toContain('/error');
    expect(result.current.errorRedirect).toContain('message=Pago%20no%20realizado');
    expect(result.current.confirmed).toBe(false);
    expect(sendConfirmation).not.toHaveBeenCalled();
  });

  it('redirects to error on Transbank abort (no token)', async () => {
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: null, purchaseId: null, aborted: true }),
    );
    await waitFor(() => expect(result.current.errorRedirect).not.toBeNull());
    expect(result.current.errorRedirect).toContain('message=Error%20en%20la%20compra');
    expect(confirmPurchase).not.toHaveBeenCalled();
  });

  it('resendEmail re-sends even after isMailSent is true', async () => {
    mockSuccess();
    const { result } = renderHook(() =>
      useConfirmation({ tokenWs: 'tok', purchaseId: 'p1', aborted: false }),
    );
    await waitFor(() => expect(result.current.isMailSent).toBe(true));
    expect(sendConfirmation).toHaveBeenCalledTimes(1);

    await result.current.resendEmail();
    expect(sendConfirmation).toHaveBeenCalledTimes(2);
  });
});
