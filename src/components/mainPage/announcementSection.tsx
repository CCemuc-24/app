import React from 'react';
import Image from 'next/image';
import Foto1 from '@/components/images/mainPage/Foto Anuncio 1.png';
import Foto2 from '@/components/images/mainPage/Foto Anuncio 2.png';
import { Open_Sans, Lato } from 'next/font/google';

const openSans = Open_Sans({ subsets: ['latin'] });
const lato = Lato({
  subsets: ['latin'],
  weight: '700',
});

const announcements = [
  {
    id: 1,
    title: 'Bienvenidos al I° CCEM UC',
    date: '31/07/2014',
    description:
      '¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen para ofrecer una experiencia enriquecedora y transformadora. Durante este congreso, tendrán la oportunidad de interactuar con destacados profesionales de la cirugía, participar en talleres prácticos, y explorar los últimos avances tecnológicos que están revolucionando el campo quirúrgico.',
    image: Foto1,
  },
  {
    id: 2,
    title: 'Ya están abiertas las inscripciones para la competencia científica',
    date: '31/07/2024',
    description: 'Toda la información está disponible en las bases que puedes encontrar aquí.',
    image: Foto2,
  },
];

const AnnouncementSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">ANUNCIOS</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>

      <div className="flex flex-col space-y-8">
        {announcements.map((announcement) => (
          <div
            key={announcement.id}
            className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4"
          >
            <div className="w-full lg:w-1/4 flex justify-center">
              <Image
                src={announcement.image}
                alt={announcement.title}
                className="rounded-lg"
                width={350}
                height={350}
                style={{ maxWidth: '300px', maxHeight: '300px' }}
              />
            </div>
            <div className="w-full lg:w-2/3">
              <h3 className={`text-2xl font-bold ${lato.className}`}>{announcement.title}</h3>
              <p className={`text-gray-500 mb-2 ${lato.className}`}>{announcement.date}</p>
              <p className={`${openSans.className}`}>{announcement.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementSection;
