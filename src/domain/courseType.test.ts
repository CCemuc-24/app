// src/domain/courseType.test.ts
import { describe, it, expect } from 'vitest';
import { CourseType, courseTypeValues } from './courseType';

describe('CourseType', () => {
  it('maps each key to its lowercase string value', () => {
    expect(CourseType.core).toBe('core');
    expect(CourseType.elective).toBe('elective');
    expect(CourseType.workshop).toBe('workshop');
  });
  it('exposes the values as a tuple for z.enum', () => {
    expect(courseTypeValues).toEqual(['core', 'elective', 'workshop']);
  });
});
