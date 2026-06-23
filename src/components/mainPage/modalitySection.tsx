import React from 'react';
import fondo from '@/components/images/mainPage/fondo_2.jpeg';
import { League_Spartan, Lato, Open_Sans } from 'next/font/google';

const leagueSpartan = League_Spartan({
  subsets: ['latin'],
  weight: '700',
});
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});
const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const ModalidadSection: React.FC = () => {
  return (
    <div>
      <div>
        <div
          className="bg-cover"
          style={{
            backgroundImage: `url(${fondo.src})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            height: '729px',
          }}
        ></div>
      </div>
      <div className="max-w-8xl mx-auto p-6">
        <div className="flex justify-center mb-4">
          <h2
            className={`text-3xl font-bold text-[#00778B] ${leagueSpartan.className}`}
            style={{
              fontSize: '40px',
              fontWeight: 700,
              lineHeight: '60px',
              letterSpacing: '-0.02em',
              textAlign: 'left',
            }}
          >
            MODALIDAD
          </h2>
        </div>

        <div className="flex flex-col lg:flex-row justify-center items-center space-y-8 lg:space-y-0 lg:space-x-8">
          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontFamily: 'Lato, sans-serif',
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              PRESENCIAL
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Módulo de Cirugía General e Innovación</li>
              <li>Clases Magistrales de cada Módulo optativo</li>
              <li>Workshops</li>
            </ul>
          </div>

          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              ON-LINE
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Módulos optativos:</li>
              <li>• Cirugía Digestiva y Coloproctología</li>
              <li>• Cirugía de Trauma y Urología</li>
              <li>• Cirugía Plástica y Oncológica</li>
              <li>• Cirugía de Tórax, Cardíaca y Vascular</li>
            </ul>
          </div>

          <div className="flex flex-col items-center text-center lg:w-1/3">
            <h3
              className={`text-2xl font-bold text-gray-400 ${lato.className}`}
              style={{
                fontFamily: 'Lato, sans-serif',
                fontSize: '40px',
                fontWeight: 700,
                lineHeight: '60px',
                letterSpacing: '-0.02em',
                textAlign: 'left',
              }}
            >
              PRESENCIAL
            </h3>
            <ul className={`mt-2 text-gray-600 ${openSans.className}`}>
              <li>Mejores trabajos presentados en la</li>
              <li>Competencia Científica del Congreso</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModalidadSection;
