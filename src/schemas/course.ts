// src/schemas/course.ts
import { z } from 'zod';
import { courseTypeValues } from '../domain/courseType';

// Mirrors ccemuc-api/src/interfaces/course.interfaces.ts (CourseAttributes, minus id).
// The stale `description` field is intentionally NOT ported.
export const courseCreateSchema = z.object({
  title: z.string().min(1),
  module: z.number().int(),
  type: z.enum(courseTypeValues),
  price: z.number().int(),
  capacity: z.number().int(),
  week: z.number().int(),
  features: z.record(z.string()).optional(),
  topics: z.array(z.string()).optional(),
});

export const courseUpdateSchema = courseCreateSchema.partial();

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;
