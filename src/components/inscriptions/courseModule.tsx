import React from 'react';
import Image from 'next/image';
import courseImagesDictionary from '@/components/images/images';
import type { EventsCardProps } from './types';

const CourseModule: React.FC<EventsCardProps> = ({ title, module, features, buttonText, actionOnClick, clicked }) => {
  return (
    <div className="flex flex-col lg:flex-row border-2 border-gray-300 rounded-3xl p-4">
      <div className="flex-none w-full lg:w-1/4 mb-4 lg:mb-0">
        <div>
          <Image
            src={courseImagesDictionary[module]}
            alt="Course Module"
            className="rounded-3xl"
            width={300}
            height={300}
            style={{ width: '100%', height: 'auto' }}
          />
        </div>
      </div>
      <div className="flex-1 lg:ml-10">
        <div className="mb-4">
          <h1 className="font-league-spartan font-bold text-black uppercase text-3xl sm:text-4xl md:text-4xl lg:text-5xl xl:text-5xl">
            {title}
          </h1>
        </div>
        <div className="mb-4">
          {!clicked ? (
            <button
              className="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-base md:text-lg lg:text-xl py-2 px-4 rounded-lg border border-blue-500 text-blue-500 hover:opacity-75 focus:ring focus:ring-blue-200 active:opacity-[0.85] block w-full mt-6 max-w-[180px]"
              type="button"
              onClick={actionOnClick}
            >
              {buttonText}
            </button>
          ) : (
            <button
              className="align-middle select-none font-sans font-bold text-center uppercase transition-all disabled:opacity-50 disabled:shadow-none disabled:pointer-events-none text-base md:text-lg lg:text-xl py-2 px-4 rounded-lg border border-green-500 text-green-500 hover:opacity-75 focus:ring focus:ring-green-200 active:opacity-[0.85] block w-full mt-6 max-w-[180px]"
              type="button"
            >
              Seleccionado
            </button>
          )}
        </div>
        <div className="text-sm md:text-base lg:text-lg font-open-sans">
          <ul className="list-disc list-inside">
            {Object.entries(features).map(([key, value]) => (
              <li key={key}>
                <b>{key}:</b> {value}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default CourseModule;
