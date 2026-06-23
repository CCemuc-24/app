import React from 'react';
import type { Course, User } from '@prisma/client';

const BuyInfo: React.FC<{ courses: Course[]; user: User | null }> = ({ courses, user }) => {
  if (courses.length === 0 || !user) {
    return <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">Cargando...</p>;
  }

  const courseWeek0 = courses.filter((course) => course.week === 0);
  const courseWeek1 = courses.find((course) => course.week === 1);
  const courseWeek2 = courses.find((course) => course.week === 2);
  const courseWorkshop = courses.find((course) => course.type === 'workshop');
  const price = courses.reduce((sum, course) => sum + course.price, 0);

  return (
    <div>
      <div className="space-y-4 sm:space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-800 mb-6 md:mb-8">
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Cursos</dt>
        </dl>
        {courseWeek0.map((course, index) => (
          <dl key={course.id} className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Módulo Base {index + 1}</dt>
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{course.title}</dd>
          </dl>
        ))}
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Semana 1</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWeek1?.title}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Semana 2</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWeek2?.title}</dd>
        </dl>
        {courseWorkshop && (
          <dl className="sm:flex items-center justify-between gap-4">
            <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-600"> Workshop</dt>
            <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{courseWorkshop.title}</dd>
          </dl>
        )}
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Precio</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">${price}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Nombre</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.names} {user.lastNames}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">RUT</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.rut}</dd>
        </dl>
        <dl className="sm:flex items-center justify-between gap-4">
          <dt className="font-normal mb-1 sm:mb-0 text-gray-500 dark:text-gray-400">Correo</dt>
          <dd className="font-medium text-gray-900 dark:text-white sm:text-end">{user.email}</dd>
        </dl>
      </div>
    </div>
  );
};

export default BuyInfo;
