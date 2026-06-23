import React from 'react';
import fondo from '@/components/images/mainPage/fondo_1.jpeg';
import { League_Spartan } from 'next/font/google';
import Link from 'next/link';

const leagueSpartan = League_Spartan({ subsets: ['latin'] });

const FirstSection: React.FC = () => {
  return (
    <div>
      <div
        className="relative overflow-hidden rounded-lg bg-cover bg-no-repeat p-12 text-center"
        style={{
          backgroundImage: `url(${fondo.src})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          width: '100vw',
          height: '100vh',
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 top-0 h-full w-full overflow-hidden bg-fixed">
          <div className="flex h-full items-center justify-center">
            <div className="text-white">
              <h2
                className={`mb-1 text-4xl md:text-5xl lg:text-6xl xl:text-[80px] font-bold ${leagueSpartan.className}`}
              >
                I° CONGRESO DE CIRUGÍA UC
              </h2>
              <h2
                className={`mb-1 text-4xl md:text-5xl lg:text-6xl xl:text-[80px] font-bold ${leagueSpartan.className}`}
              >
                PARA ESTUDIANTES DE MEDICINA
              </h2>
              <h4 className="mb-6 text-lg md:text-xl lg:text-2xl xl:text-[30px]">
                El futuro de la cirugía: innovación y nuevas perspectivas
              </h4>
              <div className="flex justify-center w-full lg:w-auto">
                <Link
                  href="/pricing"
                  className={`text-white bg-[#116D85] hover:bg-[#0E5A6E] focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm md:text-base lg:text-lg px-4 lg:px-5 py-2 lg:py-2.5 mr-2 focus:outline-none dark:focus:ring-gray-800 ${leagueSpartan.className}`}
                >
                  ¡Sé parte del Congreso!
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirstSection;
