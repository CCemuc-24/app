'use client';

import React, { useEffect, useState } from 'react';

type TimeLeft = { dias: number; horas: number; minutos: number; segundos: number };

const Countdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date('2024-08-31T00:00:00') - +new Date();
    let result: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };
    if (difference > 0) {
      result = {
        dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
        horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((difference / 1000 / 60) % 60),
        segundos: Math.floor((difference / 1000) % 60),
      };
    }
    return result;
  };

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) return null;

  const boxes = (Object.keys(timeLeft) as (keyof TimeLeft)[])
    .filter((k) => timeLeft[k])
    .map((interval) => (
      <div key={interval} className="flex flex-col items-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-border bg-card font-mono text-3xl font-bold text-primary md:h-24 md:w-24 md:text-4xl">
          {timeLeft[interval]}
        </div>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {interval}
        </div>
      </div>
    ));

  return (
    <section className="mx-auto flex max-w-7xl flex-col items-center px-6 py-16">
      <h2 className="mb-8 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        QUEDAN
      </h2>
      <div className="flex justify-center gap-4">
        {boxes.length ? boxes : <span className="text-muted-foreground">¡Ya comenzó!</span>}
      </div>
      <h2 className="mt-8 font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
        PARA EL CONGRESO
      </h2>
    </section>
  );
};

export default Countdown;
