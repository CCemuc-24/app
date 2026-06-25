import React from 'react';
import Image from 'next/image';
import surgicalImage from '@/components/images/mainPage/foto_2.png';
import { IncisionDivider } from '@/components/luz/IncisionDivider';

const CcemSection: React.FC = () => {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-10 px-6 py-16 lg:flex-row">
      <div className="lg:w-1/2">
        <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          ¿Qué puedo hacer en el CCEM UC 2024?
        </h2>
        <IncisionDivider className="my-6" />
        <p className="text-lg leading-relaxed text-muted-foreground">
          ¡Bienvenidos al Primer Congreso de Cirugía UC para Estudiantes de Medicina! Nos complace
          darles la bienvenida a este evento único, donde la innovación y el aprendizaje se unen para
          ofrecer una experiencia enriquecedora y transformadora. Durante este congreso, tendrán la
          oportunidad de interactuar con destacados profesionales de la cirugía, participar en
          talleres prácticos, y explorar los últimos avances tecnológicos que están revolucionando el
          campo quirúrgico.
        </p>
      </div>
      <div className="lg:w-1/2">
        <Image
          src={surgicalImage}
          alt="Cirugía en el CCEM UC"
          width={729}
          height={486}
          className="w-full rounded-xl border border-border object-cover"
        />
      </div>
    </section>
  );
};

export default CcemSection;
