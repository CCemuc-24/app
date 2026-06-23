'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/header';

const ErrorHeading: React.FC = () => {
  const searchParams = useSearchParams();
  const alreadyPaid = searchParams.get('alreadyPaid');

  if (alreadyPaid === 'true') {
    return (
      <div className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        <p>Ya has pagado un curso</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        Error en la compra
      </h2>
    </div>
  );
};

const ErrorMessage: React.FC = () => {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  return <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">{message}</p>;
};

const RetryButton: React.FC = () => {
  return (
    <div className="flex items-center space-x-4">
      <Link
        href="/pricing"
        className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
      >
        Volver a intentar
      </Link>
    </div>
  );
};

const OrderError: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <div className="mx-auto max-w-2xl px-4 2xl:px-0">
          <Suspense>
            <ErrorHeading />
          </Suspense>
          <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">
            Ha ocurrido un error en la compra
          </p>
          <Suspense fallback={<p>Loading...</p>}>
            <ErrorMessage />
          </Suspense>
          <Suspense>
            <RetryButton />
          </Suspense>
        </div>
      </section>
    </div>
  );
};

export default OrderError;
