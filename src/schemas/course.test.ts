// src/schemas/course.test.ts
import { describe, it, expect } from 'vitest';
import { courseCreateSchema, courseUpdateSchema } from './course';

const valid = {
  title: 'Anatomía',
  module: 1,
  type: 'core',
  price: 15000,
  capacity: 40,
  week: 1,
  features: { duration: '4h' },
  topics: ['huesos', 'músculos'],
};

describe('courseCreateSchema', () => {
  it('accepts a full valid course', () => {
    expect(courseCreateSchema.safeParse(valid).success).toBe(true);
  });
  it('accepts a course without optional features/topics', () => {
    const { features, topics, ...rest } = valid;
    expect(courseCreateSchema.safeParse(rest).success).toBe(true);
  });
  it('rejects a missing required title', () => {
    const { title, ...rest } = valid;
    const r = courseCreateSchema.safeParse(rest);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });
  it('rejects a non-number price', () => {
    const r = courseCreateSchema.safeParse({ ...valid, price: '15000' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['price']);
  });
  it('rejects an invalid course type', () => {
    const r = courseCreateSchema.safeParse({ ...valid, type: 'seminar' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['type']);
  });
});

describe('courseUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(courseUpdateSchema.safeParse({ capacity: 10 }).success).toBe(true);
  });
});
