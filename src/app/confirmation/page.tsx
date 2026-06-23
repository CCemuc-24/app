'use client';
import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Header from '@/components/header';
import BuyInfo from '@/components/buyInfo';
import { useConfirmation } from '@/components/inscriptions/useConfirmation';

const ConfirmationContent: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tokenWs = searchParams.get('token_ws');
  const purchaseId = searchParams.get('purchaseId');
  const tbkToken = searchParams.get('TBK_TOKEN');
  const tbkOrden = searchParams.get('TBK_ORDEN_COMPRA');
  const tbkSesion = searchParams.get('TBK_ID_SESION');
  const aborted = Boolean((tbkToken && tbkOrden) || tbkSesion);

  const { confirmed, courses, user, errorRedirect, resendEmail } = useConfirmation({
    tokenWs,
    purchaseId,
    aborted,
  });

  useEffect(() => {
    if (errorRedirect) router.push(errorRedirect);
  }, [errorRedirect, router]);

  const removeLocalStorage = () => {
    localStorage.removeItem('user_id');
  };

  return (
    <div className="mx-auto max-w-2xl px-4 2xl:px-0">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white sm:text-2xl mb-2">
        Confirmación de Orden
      </h2>
      {confirmed ? (
        <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">
          Tu número de orden es{' '}
          <a className="font-medium text-gray-900 dark:text-white hover:underline">{purchaseId}</a>{' '}
          . Recuerda que te llegará una copia al correo electrónico que hayas indicado en el formulario.
        </p>
      ) : (
        <div>
          <p className="text-gray-500 dark:text-gray-400 mb-6 md:mb-8">Confirmando tu compra...</p>
        </div>
      )}
      <BuyInfo courses={courses} user={user} />
      <div className="flex items-center space-x-4">
        <Link
          href="/"
          onClick={removeLocalStorage}
          className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
        >
          Volver al inicio
        </Link>
        <button
          type="button"
          onClick={() => {
            void resendEmail();
          }}
          className="text-white bg-primary-700 hover:bg-primary-800 focus:ring-4 focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 dark:bg-primary-600 dark:hover:bg-primary-700 focus:outline-none dark:focus:ring-primary-800"
        >
          Reenviar correo
        </button>
      </div>
    </div>
  );
};

const OrderConfirmation: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-white py-8 antialiased dark:bg-gray-900 md:py-16">
        <Suspense fallback={<p>Cargando...</p>}>
          <ConfirmationContent />
        </Suspense>
      </section>
    </div>
  );
};

export default OrderConfirmation;
