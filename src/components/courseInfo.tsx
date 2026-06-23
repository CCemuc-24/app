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

  return (
    <div>
      {courses.length > 0 ? (
        <div>
          <h2 className="text-lg mb-2">Estás inscribiendo:</h2>
          {courses.map((course) => (
            <div key={course.id}>
              <p className="text-base mb-1">{course.title}</p>
            </div>
          ))}
        </div>
      ) : (
        <h2 className="text-lg mb-8">Cargando...</h2>
      )}
    </div>
  );
};

export default CourseInfo;
