import React from 'react';
import Image from 'next/image';
import surgicalImage from '@/components/images/mainPage/foto_2.png';
import { Lato } from 'next/font/google';

const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const CcemSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6 flex flex-col lg:flex-row items-center">
      <div className="lg:w-1/2 p-6">
        <h2 className={`text-3xl md:text-4xl lg:text-5xl font-bold text-[#00778B] ${lato.className}`}>
          ¿QUÉ PUEDO HACER EN EL CCEM UC 2024?
        </h2>
        <p className="mt-4 text-lg text-gray-700">
          ¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace
          darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen
          para ofrecer una experiencia enriquecedora y transformadora. Durante este congreso,
          tendrán la oportunidad de interactuar con destacados profesionales de la cirugía,
          participar en talleres prácticos, y explorar los últimos avances tecnológicos que están
          revolucionando el campo quirúrgico.
        </p>
      </div>

      <div className="lg:w-1/2 p-6">
        <Image
          src={surgicalImage}
          alt="Cirugía en el CCEM UC"
          className="rounded-lg object-cover"
          width={729}
          height={486}
        />
      </div>
    </div>
  );
};

export default CcemSection;
