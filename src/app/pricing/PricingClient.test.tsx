import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ok } from '@/domain/result';

const getCourses = vi.fn();
vi.mock('@/actions/courses', () => ({ getCourses: () => getCourses() }));

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

vi.mock('@/components/header', () => ({ default: () => <div data-testid="header" /> }));

import PricingClient from './PricingClient';

const courses = [
  { id: 'c1', title: 'Sem1 A', module: 1, type: 'core', price: 0, capacity: 10, features: {}, week: 1, topics: [] },
  { id: 'c2', title: 'Sem2 A', module: 2, type: 'core', price: 0, capacity: 10, features: {}, week: 2, topics: [] },
  { id: 'w1', title: 'Workshop A', module: 3, type: 'workshop', price: 0, capacity: 10, features: {}, week: 3, topics: [] },
];

describe('PricingClient', () => {
  beforeEach(() => {
    getCourses.mockReset();
    push.mockReset();
    getCourses.mockResolvedValue(ok(courses));
  });

  it('shows "No disponible" when registration is closed and does not fetch courses', () => {
    render(<PricingClient registrationOpen={false} />);
    expect(screen.getByText('No disponible')).toBeInTheDocument();
    expect(getCourses).not.toHaveBeenCalled();
  });

  it('fetches courses and shows the selection UI when registration is open', async () => {
    render(<PricingClient registrationOpen={true} />);
    await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
    expect(getCourses).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Selecciona tu pase')).toBeInTheDocument();
  });

  it('builds /form?w1id&w2id for a general pass (no workshop)', async () => {
    render(<PricingClient registrationOpen={true} />);
    await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pase General Congreso'));
    // week1 + week2 modules
    const buttons = screen.getAllByText('10 cupos disponibles');
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(push).toHaveBeenCalledWith('/form?w1id=c1&w2id=c2');
  });

  it('appends w3id when pass 2 (workshop) is selected', async () => {
    render(<PricingClient registrationOpen={true} />);
    await waitFor(() => expect(screen.getByText('INSCRIPCIONES')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Pase Congreso + Workshop'));
    const buttons = screen.getAllByText('10 cupos disponibles');
    // week1, week2, workshop modules each render one CourseModule button
    fireEvent.click(buttons[0]);
    fireEvent.click(buttons[1]);
    fireEvent.click(buttons[2]);
    fireEvent.click(screen.getByText('Confirmar'));
    expect(push).toHaveBeenCalledWith('/form?w1id=c1&w2id=c2&w3id=w1');
  });
});
