import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import FirstSection from './firstSection';

vi.mock('next/font/google', () => ({
  League_Spartan: () => ({ className: 'league-spartan' }),
}));

describe('FirstSection', () => {
  it('renders the congress headline and a pricing CTA', () => {
    render(<FirstSection />);
    expect(screen.getByText('II° CONGRESO DE CIRUGÍA UC')).toBeInTheDocument();
    expect(screen.getByText('PARA ESTUDIANTES DE MEDICINA')).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: '¡Sé parte del Congreso!' });
    expect(cta).toHaveAttribute('href', '/pricing');
  });
});
