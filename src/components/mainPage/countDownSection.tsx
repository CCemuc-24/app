'use client';

import React, { useEffect, useState } from 'react';

type TimeLeft = {
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
};

const Countdown: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  const calculateTimeLeft = (): TimeLeft => {
    const difference = +new Date('2024-08-31T00:00:00') - +new Date();
    let timeLeft: TimeLeft = { dias: 0, horas: 0, minutos: 0, segundos: 0 };

    if (difference > 0) {
      timeLeft = {
        dias: Math.floor(difference / (1000 * 60 * 60 * 24)),
        horas: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutos: Math.floor((difference / 1000 / 60) % 60),
        segundos: Math.floor((difference / 1000) % 60),
      };
    }

    return timeLeft;
  };

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!timeLeft) {
    return null;
  }

  const timerComponents: React.JSX.Element[] = [];

  (Object.keys(timeLeft) as (keyof TimeLeft)[]).forEach((interval) => {
    if (!timeLeft[interval]) {
      return;
    }

    timerComponents.push(
      <div key={interval} className="flex flex-col items-center mx-2">
        <div className="text-4xl md:text-6xl lg:text-8xl font-bold bg-black text-white rounded-md p-4">
          {timeLeft[interval]}
        </div>
        <div className="text-lg md:text-xl lg:text-2xl font-semibold mt-2">
          {interval.toUpperCase()}
        </div>
      </div>,
    );
  });

  return (
    <div className="flex flex-col items-center justify-center my-10">
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6">QUEDAN</h2>
      <div className="flex justify-center">
        {timerComponents.length ? timerComponents : <span>¡Ya comenzó!</span>}
      </div>
      <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mt-6">PARA EL CONGRESO</h2>
    </div>
  );
};

export default Countdown;
