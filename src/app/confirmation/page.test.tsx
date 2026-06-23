import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams('token_ws=tok&purchaseId=p1'),
}));
vi.mock('@/components/header', () => ({ default: () => <div>HEADER</div> }));
vi.mock('@/components/buyInfo', () => ({ default: () => <div>BUYINFO</div> }));

const useConfirmation = vi.fn();
vi.mock('@/components/inscriptions/useConfirmation', () => ({
  useConfirmation: (...args: unknown[]) => useConfirmation(...args),
}));

import OrderConfirmation from './page';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('OrderConfirmation page', () => {
  it('shows order number when confirmed and renders BuyInfo', () => {
    const resendEmail = vi.fn().mockResolvedValue(undefined);
    useConfirmation.mockReturnValue({
      confirmed: true, courses: [], user: null, isMailSent: true, errorRedirect: null, resendEmail,
    });
    render(<OrderConfirmation />);
    expect(screen.getByText('HEADER')).toBeTruthy();
    expect(screen.getByText(/Tu número de orden es/)).toBeTruthy();
    expect(screen.getByText('p1')).toBeTruthy();
    expect(screen.getByText('BUYINFO')).toBeTruthy();
  });

  it('shows the confirming message while not confirmed', () => {
    useConfirmation.mockReturnValue({
      confirmed: false, courses: [], user: null, isMailSent: false, errorRedirect: null, resendEmail: vi.fn(),
    });
    render(<OrderConfirmation />);
    expect(screen.getByText('Confirmando tu compra...')).toBeTruthy();
  });

  it('pushes to errorRedirect when present', () => {
    useConfirmation.mockReturnValue({
      confirmed: false, courses: [], user: null, isMailSent: false,
      errorRedirect: '/error?message=Pago%20no%20realizado&token_ws=tok&purchaseId=p1',
      resendEmail: vi.fn(),
    });
    render(<OrderConfirmation />);
    expect(push).toHaveBeenCalledWith('/error?message=Pago%20no%20realizado&token_ws=tok&purchaseId=p1');
  });

  it('"Reenviar correo" button calls resendEmail', () => {
    const resendEmail = vi.fn().mockResolvedValue(undefined);
    useConfirmation.mockReturnValue({
      confirmed: true, courses: [], user: null, isMailSent: true, errorRedirect: null, resendEmail,
    });
    render(<OrderConfirmation />);
    fireEvent.click(screen.getByText('Reenviar correo'));
    expect(resendEmail).toHaveBeenCalledTimes(1);
  });
});
