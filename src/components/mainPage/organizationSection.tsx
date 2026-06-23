import React from 'react';
import Image from 'next/image';
import sponsor1 from '@/components/images/mainPage/sponsors/logo_auspiciador_7.png';
import { Open_Sans } from 'next/font/google';

const openSans = Open_Sans({
  subsets: ['latin'],
  weight: '400',
});

const OrganizationSection: React.FC = () => {
  return (
    <div className="max-w-8xl mx-auto p-6">
      <div className="flex justify-center mb-4">
        <h2 className="text-3xl font-bold text-[#00778B]">ORGANIZACIÓN</h2>
      </div>
      <div className="flex justify-center mb-6">
        <hr className="w-full border-t-2 border-gray-300" />
      </div>
      <div>
        <div className="flex flex-col items-center text-center">
          <Image
            src={sponsor1}
            alt="Pontificia Universidad Católica de Chile"
            className="rounded-lg"
            width={150}
            height={150}
          />
          <p className={`mt-4 text-lg ${openSans.className}`}>¡Síguenos en instagram @ccem.uc!</p>
        </div>
      </div>
    </div>
  );
};

export default OrganizationSection;
