'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCourseById } from '@/actions/courses';
import type { Course } from '@/actions/courses';

const CourseInfo: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const searchParams = useSearchParams();

  useEffect(() => {
    const ids = [
      searchParams.get('w1id') ?? '',
      searchParams.get('w2id') ?? '',
      searchParams.get('w3id') ?? '',
    ].filter((id) => id !== '');

    let cancelled = false;
    (async () => {
      const resolved: Course[] = [];
      for (const id of ids) {
        const res = await getCourseById(id);
        if (res.ok) resolved.push(res.data);
      }
      if (!cancelled) setCourses(resolved);
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  if (courses.length === 0) {
    return <h2 className="text-muted-foreground">Cargando...</h2>;
  }

  return (
    <div className="rounded-lg border border-border bg-secondary/50 p-4">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.14em] text-primary">Estás inscribiendo</p>
      <ul className="space-y-1">
        {courses.map((course) => (
          <li key={course.id} className="text-foreground">{course.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default CourseInfo;
