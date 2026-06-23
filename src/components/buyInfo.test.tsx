import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BuyInfo from './buyInfo';
import type { Course, User } from '@prisma/client';

const user = {
  id: 'u1', names: 'Ada', lastNames: 'Lovelace', rut: '11.111.111-1',
  email: 'ada@example.com', university: 'UC', carrerYear: 3,
  createdAt: new Date(), updatedAt: new Date(),
} as User;

const courses = [
  { id: 'c0', title: 'Base A', module: 1, type: 'core', price: 10000, capacity: 5, features: null, week: 0, topics: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'c1', title: 'Elec 1', module: 2, type: 'elective', price: 15000, capacity: 5, features: null, week: 1, topics: [], createdAt: new Date(), updatedAt: new Date() },
  { id: 'c2', title: 'Elec 2', module: 3, type: 'elective', price: 5000, capacity: 5, features: null, week: 2, topics: [], createdAt: new Date(), updatedAt: new Date() },
] as unknown as Course[];

describe('BuyInfo', () => {
  it('shows loading when user is null', () => {
    render(<BuyInfo courses={courses} user={null} />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('shows loading when courses are empty', () => {
    render(<BuyInfo courses={[]} user={user} />);
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('renders courses, summed price and user details', () => {
    render(<BuyInfo courses={courses} user={user} />);
    expect(screen.getByText('Base A')).toBeTruthy();
    expect(screen.getByText('Elec 1')).toBeTruthy();
    expect(screen.getByText('Elec 2')).toBeTruthy();
    expect(screen.getByText('$30000')).toBeTruthy(); // 10000+15000+5000
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
    expect(screen.getByText('11.111.111-1')).toBeTruthy();
    expect(screen.getByText('ada@example.com')).toBeTruthy();
  });
});
