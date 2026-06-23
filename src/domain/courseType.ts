// src/domain/courseType.ts
// Ported from ccemuc-api/src/enums/course-type.enum.ts.
// Values must stay in sync with prisma enum CourseType { core elective workshop }.
export const CourseType = {
  core: 'core',
  elective: 'elective',
  workshop: 'workshop',
} as const;

export type CourseType = (typeof CourseType)[keyof typeof CourseType];

export const courseTypeValues = ['core', 'elective', 'workshop'] as const;
