import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';
import fondo from '@/components/images/mainPage/fondo_1.jpeg';
import { IncisionDivider } from '@/components/luz/IncisionDivider';

const FirstSection: React.FC = () => {
  return (
    <section className="border-b border-border bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28">
        <div>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.18em] text-primary">
            I Congreso · 31 ago — 14 sep 2024 · Santiago
          </p>
          <h1 className="font-display text-4xl font-semibold leading-[1.03] tracking-tight text-foreground md:text-5xl xl:text-6xl">
            <span className="block">I° CONGRESO DE CIRUGÍA UC</span>
            <span className="block text-primary">PARA ESTUDIANTES DE MEDICINA</span>
          </h1>
          <IncisionDivider className="my-8" />
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            El futuro de la cirugía: innovación y nuevas perspectivas.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-7 py-3.5 font-medium text-primary-foreground transition-colors hover:bg-primary-700"
            >
              ¡Sé parte del Congreso!
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/modules"
              className="inline-flex items-center rounded-lg border border-border px-6 py-3.5 font-medium text-foreground transition-colors hover:bg-muted"
            >
              Ver módulos
            </Link>
          </div>
          <div className="mt-12 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-sm text-muted-foreground">
            <span><b className="text-primary">04</b> módulos</span>
            <span className="h-3.5 w-px bg-border" />
            <span><b className="text-primary">02</b> workshops</span>
            <span className="h-3.5 w-px bg-border" />
            <span><b className="text-primary">01</b> competencia científica</span>
          </div>
        </div>
        <div className="relative hidden lg:block">
          <div className="relative h-[520px] overflow-hidden rounded-xl border border-border">
            <Image src={fondo} alt="Cirugía en el CCEM UC" fill className="object-cover" priority />
          </div>
        </div>
      </div>
    </section>
  );
};

export default FirstSection;
