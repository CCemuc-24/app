import { describe, it, expect, vi } from 'vitest';
import { CourseType } from '@prisma/client';
import { seedCourses } from './seed';

function makeFakeClient(existingCount = 0) {
  const created: Array<Record<string, unknown>> = [];
  return {
    created,
    course: {
      count: vi.fn(async () => existingCount),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return { id: `id-${created.length}`, ...data };
      }),
    },
  };
}

describe('seedCourses', () => {
  it('creates all 9 catalog courses with mirrored shapes', async () => {
    const client = makeFakeClient(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedCourses(client as any);

    expect(client.course.create).toHaveBeenCalledTimes(9);
    expect(client.created).toHaveLength(9);

    const titles = client.created.map((c) => c.title);
    expect(titles).toContain('Módulo: Cirugía General');
    expect(titles).toContain('Workshop: Ultrasonido Clínico de urgencia');
    expect(titles).toContain('Curso de prueba');

    const general = client.created.find((c) => c.title === 'Módulo: Cirugía General')!;
    expect(general.type).toBe(CourseType.core);
    expect(general.price).toBe(0);
    expect(general.module).toBe(1);
    expect((general.topics as string[]).length).toBe(12);
    expect((general.features as Record<string, string>)['Horario']).toBe('09:00 a 14:00 hrs.');

    const digestive = client.created.find(
      (c) => c.title === 'Módulo: Cirugía Digestiva y Colopractología',
    )!;
    expect(digestive.type).toBe(CourseType.elective);
    expect(digestive.price).toBe(25900);

    // type distribution: 2 core, 5 elective, 2 workshop
    const types = client.created.map((c) => c.type);
    expect(types.filter((t) => t === CourseType.core)).toHaveLength(2);
    expect(types.filter((t) => t === CourseType.elective)).toHaveLength(5);
    expect(types.filter((t) => t === CourseType.workshop)).toHaveLength(2);
  });

  it('is idempotent — skips creation when courses already exist', async () => {
    const client = makeFakeClient(9);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await seedCourses(client as any);
    expect(client.course.create).not.toHaveBeenCalled();
  });
});
