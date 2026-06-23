import PricingClient from './PricingClient';

export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const registrationOpen = (process.env.REGISTRATION_OPEN ?? 'true') !== 'false';
  return <PricingClient registrationOpen={registrationOpen} />;
}
