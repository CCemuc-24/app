import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ok } from '@/domain/result';

const getCourseById = vi.fn();
vi.mock('@/actions/courses', () => ({ getCourseById: (id: string) => getCourseById(id) }));

let params = new URLSearchParams();
vi.mock('next/navigation', () => ({ useSearchParams: () => params }));

import CourseInfo from './courseInfo';

describe('CourseInfo', () => {
  beforeEach(() => {
    getCourseById.mockReset();
    params = new URLSearchParams('w1id=a&w2id=b');
  });

  it('resolves each w*id param via getCourseById and renders the titles', async () => {
    getCourseById.mockImplementation((id: string) =>
      Promise.resolve(ok({ id, title: id === 'a' ? 'Modulo A' : 'Modulo B', module: 1, features: {} })),
    );
    render(<CourseInfo />);
    await waitFor(() => {
      expect(screen.getByText('Modulo A')).toBeInTheDocument();
      expect(screen.getByText('Modulo B')).toBeInTheDocument();
    });
    expect(getCourseById).toHaveBeenCalledWith('a');
    expect(getCourseById).toHaveBeenCalledWith('b');
  });

  it('skips failed lookups and renders only the resolved courses', async () => {
    getCourseById.mockImplementation((id: string) =>
      id === 'a'
        ? Promise.resolve(ok({ id, title: 'Modulo A', module: 1, features: {} }))
        : Promise.resolve({ ok: false as const, error: 'Course not found', status: 404 }),
    );
    render(<CourseInfo />);
    await waitFor(() => expect(screen.getByText('Modulo A')).toBeInTheDocument());
    expect(screen.queryByText('Modulo B')).not.toBeInTheDocument();
  });
});
