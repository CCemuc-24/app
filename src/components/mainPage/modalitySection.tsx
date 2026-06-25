import React from 'react';
import Image from 'next/image';
import fondo from '@/components/images/mainPage/fondo_2.jpeg';
import { SectionHeading } from '@/components/luz/SectionHeading';

const columns = [
  {
    label: 'Presencial',
    items: [
      'Módulo General: «Cirugía en pacientes complejos»',
      'Clases magistrales — 4 sábados',
      '2 workshops prácticos a elección',
    ],
  },
  {
    label: 'On-line',
    items: [
      'Módulo optativo sincrónico (elige 1):',
      'Ginecología y Obstetricia',
      'Cirugía Digestiva y Coloproctología',
      'Cirugía Vascular',
    ],
  },
  {
    label: 'Presencial',
    items: ['Competencia Científica', 'Presentación de trabajos y finalistas'],
  },
];

const ModalidadSection: React.FC = () => {
  return (
    <section>
      <div className="relative h-72 w-full overflow-hidden border-y border-border md:h-96">
        <Image src={fondo} alt="" fill className="object-cover" />
      </div>
      <div className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading eyebrow="Cómo se vive" title="Modalidad" align="left" />
        <div className="grid gap-8 md:grid-cols-3">
          {columns.map((col, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-6">
              <h3 className="font-display text-xl font-semibold uppercase tracking-tight text-primary">
                {col.label}
              </h3>
              <ul className="mt-4 space-y-1.5 text-muted-foreground">
                {col.items.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModalidadSection;
