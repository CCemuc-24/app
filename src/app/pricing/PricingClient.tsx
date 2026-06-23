'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/header';
import WeekSection from '@/components/inscriptions/weekSection';
import { getCourses } from '@/actions/courses';
import type { Course } from '@/actions/courses';

const PricingClient: React.FC<{ registrationOpen: boolean }> = ({ registrationOpen }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseSelectedWeek1, setCourseSelectedWeek1] = useState<Course | null>(null);
  const [courseSelectedWeek2, setCourseSelectedWeek2] = useState<Course | null>(null);
  const [selectedWorkshop, setSelectedWorkshop] = useState<Course | null>(null);
  const [selectedPass, setSelectedPass] = useState(0);

  const router = useRouter();

  useEffect(() => {
    if (!registrationOpen) return;
    (async () => {
      const res = await getCourses();
      if (res.ok) setCourses(res.data);
    })();
  }, [registrationOpen]);

  const handleSelectCourse = (course: Course) => {
    if (course.week === 1) setCourseSelectedWeek1(course);
    else if (course.week === 2) setCourseSelectedWeek2(course);
    else if (course.type === 'workshop') setSelectedWorkshop(course);
  };

  const handleSelectPass = (buttonId: number) => {
    setSelectedPass(buttonId);
    if (selectedWorkshop != null) setSelectedWorkshop(null);
  };

  const handleConfirmSelection = () => {
    let url = `/form?w1id=${courseSelectedWeek1?.id}&w2id=${courseSelectedWeek2?.id}`;
    if (selectedPass === 2 || selectedWorkshop != null) {
      url += `&w3id=${selectedWorkshop?.id}`;
    }
    router.push(url);
  };

  const isAllCoursesSelected = () =>
    courseSelectedWeek1 != null &&
    courseSelectedWeek2 != null &&
    (selectedPass === 1 || (selectedPass === 2 && selectedWorkshop != null));

  if (!registrationOpen) {
    return (
      <div>
        <Header />
        <section className="bg-white dark:bg-gray-900">
          <div className="container flex items-center min-h-screen px-6 py-12 mx-auto">
            <div>
              <h1 className="mt-3 text-2xl font-semibold text-gray-800 dark:text-white md:text-3xl">No disponible</h1>
              <p className="mt-4 text-gray-500 dark:text-gray-400">
                Lo sentimos, ya no esta disponible la inscripción de cursos
              </p>
              <div className="flex items-center mt-6 gap-x-3">
                <Link href="/">
                  <button className="w-1/2 px-5 py-2 text-sm tracking-wide text-white transition-colors duration-200 bg-blue-500 rounded-lg shrink-0 sm:w-auto hover:bg-blue-600 dark:hover:bg-blue-500 dark:bg-blue-600">
                    Ir a inicio
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div>
        <Header />
        <div className="min-h-screen overflow-auto flex items-center justify-center" style={{ background: '#edf2f7' }}>
          <section className="px-4 py-12">
            <div className="container mx-auto text-center">
              <h4 className="block antialiased tracking-normal font-sans text-4xl font-semibold leading-[1.3] text-blue-gray-900 mb-4">
                Cargando cursos...
              </h4>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="mt-10">
        <div className="flex justify-center mb-4">
          <h2 className="text-3xl font-bold text-[#00778B]">INSCRIPCIONES</h2>
        </div>
        <div className="flex justify-center mb-6">
          <hr className="w-full border-t-2 border-gray-300" />
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="flex items-center mb-4">
          <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">Paso 1</h1>
          <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">
            Selecciona tu pase
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button
            className={`bg-[#116D85] text-white py-2 px-6 rounded-[8px] transition-colors flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4 ${selectedPass === 1 ? 'bg-green-500' : 'hover:bg-[#0E5B6D]'}`}
            onClick={() => handleSelectPass(1)}
          >
            <span className="font-open-sans text-base sm:text-lg md:text-2xl lg:text-2xl xl:text-2xl">
              Pase General Congreso
            </span>
            <span className="font-open-sans text-base sm:text-2lg md:text-2xl lg:text-2xl xl:text-2xl">$25.900</span>
          </button>
          <button
            className={`bg-[#116D85] text-white py-2 px-6 rounded-[8px] transition-colors flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-4 ${selectedPass === 2 ? 'bg-green-500' : 'hover:bg-[#0E5B6D]'}`}
            onClick={() => handleSelectPass(2)}
          >
            <span className="font-open-sans text-base sm:text-lg md:text-2xl lg:text-2xl xl:text-2xl">
              Pase Congreso + Workshop
            </span>
            <span className="font-open-sans text-base sm:text-2lg md:text-2xl lg:text-2xl xl:text-2xl">$28.900</span>
          </button>
        </div>
      </div>

      <div>
        <WeekSection
          title="Paso 2"
          subtitle="Selecciona tu módulo de la semana 1"
          courses={courses}
          handleSelectCourse={handleSelectCourse}
          selectedWeek={courseSelectedWeek1}
          weekNumber={1}
        />
        <WeekSection
          title="Paso 3"
          subtitle="Selecciona tu módulo de la semana 2"
          courses={courses}
          handleSelectCourse={handleSelectCourse}
          selectedWeek={courseSelectedWeek2}
          weekNumber={2}
        />
        <div>
          {selectedPass === 2 && (
            <WeekSection
              title="Paso 4"
              subtitle="Selecciona tu Workshop"
              courses={courses}
              handleSelectCourse={handleSelectCourse}
              selectedWeek={selectedWorkshop}
              weekNumber={3}
            />
          )}
        </div>
      </div>

      <div className="container mx-auto p-4">
        <div className="flex items-center mb-4">
          <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">Paso 5</h1>
          <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">
            Procede al pago
          </h2>
        </div>
        <button
          onClick={handleConfirmSelection}
          className={`px-8 py-4 text-white font-semibold rounded-lg shadow-md focus:outline-none ${!isAllCoursesSelected() ? 'disabled cursor-not-allowed bg-gray-400' : 'bg-green-700 hover:bg-green-800'}`}
          disabled={!isAllCoursesSelected()}
        >
          Confirmar
        </button>
      </div>
    </div>
  );
};

export default PricingClient;
