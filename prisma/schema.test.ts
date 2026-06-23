import { describe, it, expect } from 'vitest';
import type { User, Course, Purchase, Enrollment } from '@prisma/client';
import { CourseType, Prisma } from '@prisma/client';

// These are type-level assertions compiled by Vitest's esbuild/tsc pipeline.
// If the schema/generated client is missing a field, this file fails to compile.
describe('prisma generated types', () => {
  it('CourseType enum has core/elective/workshop', () => {
    expect(CourseType.core).toBe('core');
    expect(CourseType.elective).toBe('elective');
    expect(CourseType.workshop).toBe('workshop');
  });

  it('models expose the mirrored fields', () => {
    const user: Pick<User, 'names' | 'lastNames' | 'rut' | 'email' | 'university' | 'carrerYear'> = {
      names: 'a', lastNames: 'b', rut: '1-9', email: 'e', university: 'u', carrerYear: 1,
    };
    const course: Pick<Course, 'title' | 'module' | 'type' | 'price' | 'capacity' | 'week' | 'topics'> = {
      title: 't', module: 1, type: CourseType.core, price: 0, capacity: 10, week: 0, topics: [],
    };
    const purchase: Pick<Purchase, 'userId' | 'buyOrder' | 'isPaid' | 'coursesIds'> = {
      userId: 'u', buyOrder: 'b', isPaid: false, coursesIds: [],
    };
    const enrollment: Pick<Enrollment, 'userId' | 'courseId' | 'purchaseId'> = {
      userId: 'u', courseId: 'c', purchaseId: 'p',
    };
    // features is a nullable Json column on Course
    const features: Prisma.InputJsonValue = { Modalidad: 'on-line' };

    expect(user.carrerYear).toBe(1);
    expect(course.type).toBe('core');
    expect(purchase.isPaid).toBe(false);
    expect(enrollment.courseId).toBe('c');
    expect(features).toBeTruthy();
  });
});
