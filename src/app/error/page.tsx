'use client';
import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Header from '@/components/header';

const ErrorHeading: React.FC = () => {
  const searchParams = useSearchParams();
  const alreadyPaid = searchParams.get('alreadyPaid');
  if (alreadyPaid === 'true') {
    return <p className="font-display text-2xl font-semibold text-foreground">Ya has pagado un curso</p>;
  }
  return <h2 className="font-display text-2xl font-semibold text-foreground">Error en la compra</h2>;
};

const ErrorMessage: React.FC = () => {
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  return <p className="mb-8 text-muted-foreground">{message}</p>;
};

const RetryButton: React.FC = () => (
  <Link
    href="/pricing"
    className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-700"
  >
    Volver a intentar
  </Link>
);

const OrderError: React.FC = () => {
  return (
    <div>
      <Header />
      <section className="bg-background py-12 md:py-16">
        <div className="mx-auto max-w-2xl px-6">
          <div className="mb-2 flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-7 w-7" />
            <Suspense>
              <ErrorHeading />
            </Suspense>
          </div>
          <p className="mb-8 text-muted-foreground">Ha ocurrido un error en la compra</p>
          <Suspense fallback={<p>Cargando...</p>}>
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
