import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Prisma singleton — no live DB.
vi.mock('@/lib/prisma', () => ({
  prisma: {
    course: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock the admin gate so we control allow/deny per test.
vi.mock('@/lib/auth', () => ({
  assertAdmin: vi.fn(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

import { prisma } from '@/lib/prisma';
import { assertAdmin, UnauthorizedError } from '@/lib/auth';
import {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} from './courses';

const mockPrisma = prisma as unknown as {
  course: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
};
const mockAssertAdmin = assertAdmin as unknown as ReturnType<typeof vi.fn>;

const validCourse = {
  title: 'Cirugía I',
  module: 1,
  type: 'core' as const,
  price: 15000,
  capacity: 30,
  week: 1,
  features: { modality: 'online' },
  topics: ['Asepsia', 'Suturas'],
};

const dbCourse = { id: 'c-1', ...validCourse, createdAt: new Date(), updatedAt: new Date() };

beforeEach(() => {
  vi.clearAllMocks();
  mockAssertAdmin.mockReturnValue(undefined); // default: allowed
});

describe('createCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await createCourse(validCourse, 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it('creates and returns a course on valid input', async () => {
    mockPrisma.course.create.mockResolvedValue(dbCourse);
    const res = await createCourse(validCourse, 'right');
    expect(mockAssertAdmin).toHaveBeenCalledWith('right');
    expect(mockPrisma.course.create).toHaveBeenCalledWith({ data: validCourse });
    expect(res).toEqual({ ok: true, data: dbCourse });
  });

  it('returns 400 with field on invalid Zod input', async () => {
    const res = await createCourse({ ...validCourse, price: -1 }, 'right');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(400);
      expect(res.field).toBe('price');
    }
    expect(mockPrisma.course.create).not.toHaveBeenCalled();
  });

  it('returns 400 when prisma throws', async () => {
    mockPrisma.course.create.mockRejectedValue(new Error('db down'));
    const res = await createCourse(validCourse, 'right');
    expect(res).toEqual({ ok: false, error: 'db down', status: 400 });
  });
});

describe('getCourses', () => {
  it('returns all courses', async () => {
    mockPrisma.course.findMany.mockResolvedValue([dbCourse]);
    const res = await getCourses();
    expect(res).toEqual({ ok: true, data: [dbCourse] });
  });

  it('returns 500 when prisma throws', async () => {
    mockPrisma.course.findMany.mockRejectedValue(new Error('boom'));
    const res = await getCourses();
    expect(res).toEqual({ ok: false, error: 'boom', status: 500 });
  });
});

describe('getCourseById', () => {
  it('returns the course when found', async () => {
    mockPrisma.course.findUnique.mockResolvedValue(dbCourse);
    const res = await getCourseById('c-1');
    expect(mockPrisma.course.findUnique).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    expect(res).toEqual({ ok: true, data: dbCourse });
  });

  it('returns 404 when not found', async () => {
    mockPrisma.course.findUnique.mockResolvedValue(null);
    const res = await getCourseById('nope');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});

describe('updateCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await updateCourse('c-1', { price: 20000 }, 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.update).not.toHaveBeenCalled();
  });

  it('updates and returns the course', async () => {
    const updated = { ...dbCourse, price: 20000 };
    mockPrisma.course.update.mockResolvedValue(updated);
    const res = await updateCourse('c-1', { price: 20000 }, 'right');
    expect(mockPrisma.course.update).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      data: { price: 20000 },
    });
    expect(res).toEqual({ ok: true, data: updated });
  });

  it('returns 404 when the course does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.course.update.mockRejectedValue(err);
    const res = await updateCourse('nope', { price: 1 }, 'right');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});

describe('deleteCourse', () => {
  it('rejects when admin secret is invalid', async () => {
    mockAssertAdmin.mockImplementation(() => {
      throw new UnauthorizedError('Unauthorized');
    });
    const res = await deleteCourse('c-1', 'wrong');
    expect(res).toEqual({ ok: false, error: 'Unauthorized', status: 403 });
    expect(mockPrisma.course.delete).not.toHaveBeenCalled();
  });

  it('deletes and returns null data', async () => {
    mockPrisma.course.delete.mockResolvedValue(dbCourse);
    const res = await deleteCourse('c-1', 'right');
    expect(mockPrisma.course.delete).toHaveBeenCalledWith({ where: { id: 'c-1' } });
    expect(res).toEqual({ ok: true, data: null });
  });

  it('returns 404 when the course does not exist', async () => {
    const err = Object.assign(new Error('not found'), { code: 'P2025' });
    mockPrisma.course.delete.mockRejectedValue(err);
    const res = await deleteCourse('nope', 'right');
    expect(res).toEqual({ ok: false, error: 'Course not found', status: 404 });
  });
});
