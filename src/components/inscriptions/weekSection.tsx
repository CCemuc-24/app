import React from 'react';
import CourseModule from '@/components/inscriptions/courseModule';
import type { WeekSectionProps } from './types';

const WeekSection: React.FC<WeekSectionProps> = ({ title, subtitle, courses, handleSelectCourse, selectedWeek, weekNumber }) => {
  return (
    <div>
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-4">
          <h1 className="font-lato text-3xl md:text-4xl lg:text-5xl font-light text-[#6D6D6D]">{title}</h1>
          <h2 className="font-open-sans text-xl md:text-2xl lg:text-3xl font-light text-[#6D6D6D] ml-2">{subtitle}</h2>
        </div>
        <div className="grid gap-8">
          {courses
            .filter((event) => event.week === weekNumber)
            .map((event) => (
              <CourseModule
                key={event.id}
                id={event.id}
                title={event.title}
                module={event.module}
                features={(event.features ?? {}) as Record<string, string>}
                buttonText={`${event.capacity} cupos disponibles`}
                actionOnClick={() => handleSelectCourse(event)}
                clicked={selectedWeek?.id === event.id}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default WeekSection;
