import React from 'react';
import fondo from '@/components/images/mainPage/calendario.png';
import Image from 'next/image';
import { Open_Sans, Lato } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const schedule = [
  {
    date: 'Sábado 31 de agosto',
    event: '1° Jornada presencial CCEM UC 2024',
  },
  {
    date: 'Lunes 02 de septiembre al miércoles 04 de septiembre',
    event: 'Módulo Cirugía Digestiva y Coloproctología\nMódulo Cirugía de Trauma y Urología',
  },
  {
    date: 'Sábado 07 de septiembre',
    event: '2° Jornada presencial CCEM UC 2024',
  },
  {
    date: 'Lunes 09 de septiembre al miércoles 11 de septiembre',
    event: 'Módulo Cirugía Plástica y Oncológica\nMódulo Cirugía de Tórax, Cardíaca y Vascular',
  },
  {
    date: 'Viernes 13 de septiembre',
    event: 'Competencia Científica CCEM UC',
  },
  {
    date: 'Sábado 14 de septiembre',
    event: '3° Jornada presencial CCEM UC 2024',
  },
];

const DatesSection: React.FC = () => {
  return (
    <div>
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">FECHAS</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>

      <div className="flex justify-center">
        <Image
          src={fondo}
          alt="Calendario CCEM UC"
          className="rounded-lg object-cover"
          width={729}
          height={729}
        />
      </div>
      <div className="max-w-8xl mx-auto p-6">
        {schedule.map((item, index) => (
          <div key={index} className="flex flex-col lg:flex-row mb-4">
            <div
              className={`lg:w-1/2 font-bold pr-4 ${lato.className} text-base md:text-lg lg:text-xl xl:text-2xl`}
            >
              {item.date}
            </div>
            <div
              className={`lg:w-1/2 whitespace-pre-line ${openSans.className} text-base md:text-lg lg:text-xl xl:text-2xl`}
            >
              {item.event}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DatesSection;
