import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

let currentParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
}));
vi.mock('@/components/header', () => ({ default: () => <div>HEADER</div> }));

import OrderError from './page';

describe('OrderError page', () => {
  it('renders the message and default error heading', () => {
    currentParams = new URLSearchParams('message=Compra%20rechazada');
    render(<OrderError />);
    expect(screen.getByText('HEADER')).toBeTruthy();
    expect(screen.getByText('Error en la compra')).toBeTruthy();
    expect(screen.getByText('Compra rechazada')).toBeTruthy();
    expect(screen.getByText('Ha ocurrido un error en la compra')).toBeTruthy();
  });

  it('renders the alreadyPaid variant heading', () => {
    currentParams = new URLSearchParams('alreadyPaid=true');
    render(<OrderError />);
    expect(screen.getByText('Ya has pagado un curso')).toBeTruthy();
    expect(screen.queryByText('Error en la compra')).toBeNull();
  });

  it('renders a retry link back to /pricing', () => {
    currentParams = new URLSearchParams('');
    render(<OrderError />);
    const link = screen.getByText('Volver a intentar').closest('a');
    expect(link?.getAttribute('href')).toBe('/pricing');
  });
});
