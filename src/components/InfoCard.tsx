import React from 'react';
import Image from 'next/image';
import generalInfo from '@/components/images/generalInfo.png';

interface InfoCardProps {
  text: string;
}

const InfoCard: React.FC<InfoCardProps> = ({ text }) => {
  return (
    <div className="max-w-sm bg-[#116D85] border border-gray-200 rounded-[20px] shadow dark:bg-[#116D85] dark:border-gray-700">
      <div className="relative w-full aspect-square">
        <Image src={generalInfo} alt="Course Module" fill className="rounded-[20px] object-cover" />
      </div>
      <div className="flex items-center justify-center p-4">
        <p className="text-white text-lg text-center font-open-sans">{text}</p>
      </div>
    </div>
  );
};

export default InfoCard;
