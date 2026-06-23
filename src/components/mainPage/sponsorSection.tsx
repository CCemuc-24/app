import React from 'react';
import Image from 'next/image';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_1.png';
import sponsor3 from '@/components/images/mainPage/sponsors/logo_auspiciador_3.jpeg';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const sponsors = [
  {
    name: 'Pontificia Universidad Católica de Chile',
    image: sponsor1,
  },
  {
    name: 'Sociedad de Cirujanos de Chile',
    image: sponsor3,
  },
];

const SponsorSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">PATROCINADORES Y AUSPICIADORES</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {sponsors.map((sponsor, index) => (
          <div key={index} className="flex flex-col items-center text-center">
            <Image
              src={sponsor.image}
              alt={sponsor.name}
              className="rounded-lg"
              width={150}
              height={150}
            />
            <p className={`mt-4 text-lg ${openSans.className}`}>{sponsor.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SponsorSection;
