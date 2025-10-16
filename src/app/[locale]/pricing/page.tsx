import { routing } from '@/i18n/routing';
import PricingContent from './PricingContent';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function PricingPage() {
  return <PricingContent />;
}

