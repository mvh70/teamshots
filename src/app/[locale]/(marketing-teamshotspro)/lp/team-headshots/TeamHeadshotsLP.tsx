'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowRightIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  CloudArrowUpIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  UserPlusIcon,
} from '@heroicons/react/24/outline';
import { TrackedLink } from '@/components/TrackedLink';
import { PRICING_CONFIG } from '@/config/pricing';
import { calculatePhotosFromCredits } from '@/domain/pricing/utils';
import type { LandingVariant } from '@/config/landing-content';

interface TeamHeadshotsLPProps {
  supportEmail: string;
  variant: LandingVariant;
}

const SOCIAL_PROOF_IMAGES = [
  {
    key: 'david',
    beforeSrc: '/samples/before-6.jpeg',
    afterSrc: '/samples/after-6.png',
    linkedinUrl: 'https://www.linkedin.com/in/roblesfosg/',
  },
  {
    key: 'clarice',
    beforeSrc: '/samples/before-4.webp',
    afterSrc: '/samples/after-4.webp',
    linkedinUrl: 'https://www.linkedin.com/in/clarice-pinto-39578/',
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  { key: 'setBrand', icon: PaintBrushIcon },
  { key: 'inviteTeam', icon: UserPlusIcon },
  { key: 'uploadSelfie', icon: CloudArrowUpIcon },
  { key: 'download', icon: CheckBadgeIcon },
] as const;

const TEAM_FEATURES = [
  { key: 'bulkInvite', icon: UserGroupIcon },
  { key: 'brandControl', icon: PaintBrushIcon },
  { key: 'adminDashboard', icon: BuildingOffice2Icon },
  { key: 'consistentOutput', icon: ShieldCheckIcon },
] as const;

function getReferenceTierPrice(): number {
  const midTier =
    PRICING_CONFIG.seats.graduatedTiers.find((tier) => tier.min === 5 && tier.max === 24) ??
    PRICING_CONFIG.seats.graduatedTiers[PRICING_CONFIG.seats.graduatedTiers.length - 1];
  return midTier.pricePerSeat;
}

export default function TeamHeadshotsLP({ supportEmail, variant }: TeamHeadshotsLPProps) {
  const t = useTranslations('lp.teamHeadshots');
  const locale = useLocale();

  const pricePerPerson = getReferenceTierPrice();
  const formattedPrice = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pricePerPerson);
  const photosPerSeat = calculatePhotosFromCredits(PRICING_CONFIG.seats.creditsPerSeat);

  return (
    <div className="bg-bg-white text-text-dark">
      <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-12 sm:pt-16 lg:pt-20 pb-14 sm:pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold leading-tight text-balance">
              {t('hero.title')}
            </h1>
            <p className="mt-5 text-lg sm:text-xl text-text-body leading-relaxed max-w-xl">
              {t('hero.subtitle')}
            </p>

            <div className="mt-8">
              <TrackedLink
                href="/auth/signup"
                event="cta_clicked"
                eventProperties={{
                  placement: 'lp_team_headshots_hero',
                  action: 'signup',
                  variant,
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-cta px-7 py-4 text-white font-bold text-lg hover:bg-brand-cta-hover transition-colors focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2"
              >
                {t('hero.cta')}
                <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
              </TrackedLink>
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5 text-sm">
              <span className="rounded-full border border-brand-primary-lighter bg-brand-primary-light px-4 py-1.5">
                {t('hero.badges.teams')}
              </span>
              <span className="rounded-full border border-brand-primary-lighter bg-brand-primary-light px-4 py-1.5">
                {t('hero.badges.speed')}
              </span>
              <span className="rounded-full border border-brand-primary-lighter bg-brand-primary-light px-4 py-1.5">
                {t('hero.badges.payment')}
              </span>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white shadow-depth-lg p-5 sm:p-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <Image
                    src="/samples/before-hero.webp"
                    alt={t('hero.visual.beforeAlt')}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    priority
                  />
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('labels.before')}</p>
              </div>
              <div>
                <div className="relative aspect-square overflow-hidden rounded-2xl">
                  <Image
                    src="/samples/after-hero.webp"
                    alt={t('hero.visual.afterAlt')}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 45vw, 320px"
                    priority
                  />
                </div>
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('labels.after')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-balance">{t('socialProof.title')}</h2>
          <p className="mt-3 text-lg text-text-body max-w-2xl">{t('socialProof.subtitle')}</p>

          <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {SOCIAL_PROOF_IMAGES.map((sample) => (
              <article key={sample.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-depth-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold">{t(`socialProof.examples.${sample.key}.name`)}</h3>
                    <p className="text-sm text-text-body">
                      {t(`socialProof.examples.${sample.key}.role`)} · {t(`socialProof.examples.${sample.key}.company`)}
                    </p>
                  </div>
                  <a
                    href={sample.linkedinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-brand-primary hover:text-brand-primary-hover underline underline-offset-2"
                  >
                    {t('socialProof.linkedin')}
                  </a>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <div className="relative aspect-square overflow-hidden rounded-xl">
                      <Image
                        src={sample.beforeSrc}
                        alt={t(`socialProof.examples.${sample.key}.beforeAlt`)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 45vw, 240px"
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('labels.before')}</p>
                  </div>
                  <div>
                    <div className="relative aspect-square overflow-hidden rounded-xl">
                      <Image
                        src={sample.afterSrc}
                        alt={t(`socialProof.examples.${sample.key}.afterAlt`)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 45vw, 240px"
                      />
                    </div>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{t('labels.after')}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-balance">{t('howItWorks.title')}</h2>
        <p className="mt-3 text-lg text-text-body max-w-2xl">{t('howItWorks.subtitle')}</p>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOW_IT_WORKS_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-depth-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-primary text-white text-sm font-bold">
                    {index + 1}
                  </span>
                  <Icon className="w-6 h-6 text-brand-primary" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-semibold">{t(`howItWorks.steps.${step.key}.title`)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-body">{t(`howItWorks.steps.${step.key}.description`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bg-bg-gray-50 border-y border-gray-200">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-balance">{t('builtForTeams.title')}</h2>
          <p className="mt-3 text-lg text-text-body max-w-2xl">{t('builtForTeams.subtitle')}</p>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-4">
            {TEAM_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.key} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-depth-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-brand-primary-light p-2.5">
                      <Icon className="w-5 h-5 text-brand-primary" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold">{t(`builtForTeams.features.${feature.key}.title`)}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-text-body">
                        {t(`builtForTeams.features.${feature.key}.description`)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-14 sm:py-16">
        <div className="rounded-3xl border border-gray-200 bg-white p-8 sm:p-10 shadow-depth-lg">
          <h2 className="text-3xl sm:text-4xl font-display font-bold text-balance">{t('pricing.title')}</h2>
          <p className="mt-3 text-lg text-text-body">{t('pricing.subtitle')}</p>
          <p className="mt-6 text-2xl sm:text-3xl font-semibold text-text-dark">
            {t('pricing.priceLine', { price: formattedPrice, photos: String(photosPerSeat) })}
          </p>

          <div className="mt-8">
            <TrackedLink
              href="/auth/signup"
              event="cta_clicked"
              eventProperties={{
                placement: 'lp_team_headshots_pricing',
                action: 'signup',
                variant,
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-cta px-7 py-4 text-white font-bold text-lg hover:bg-brand-cta-hover transition-colors focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2"
            >
              {t('pricing.cta')}
              <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
            </TrackedLink>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-2 pb-20 sm:pb-24">
        <div className="rounded-3xl bg-text-dark text-white p-8 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3 text-brand-primary-light">
            <SparklesIcon className="w-6 h-6" aria-hidden="true" />
            <span className="text-sm font-semibold uppercase tracking-wide">{t('finalCta.kicker')}</span>
          </div>
          <h2 className="mt-4 text-3xl sm:text-4xl font-display font-bold text-balance">{t('finalCta.title')}</h2>
          <p className="mt-4 text-lg text-white/85 max-w-2xl">{t('finalCta.subtitle')}</p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <TrackedLink
              href="/auth/signup"
              event="cta_clicked"
              eventProperties={{
                placement: 'lp_team_headshots_final',
                action: 'signup',
                variant,
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-cta px-7 py-4 text-white font-bold text-lg hover:bg-brand-cta-hover transition-colors focus:outline-none focus:ring-4 focus:ring-brand-cta-ring focus:ring-offset-2 ring-offset-text-dark"
            >
              {t('finalCta.cta')}
              <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
            </TrackedLink>
            <p className="text-sm text-white/80">{t('finalCta.disclaimer')}</p>
          </div>
          <p className="mt-5 text-sm text-white/75">{t('finalCta.support', { email: supportEmail })}</p>
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden">
        <div className="px-4 py-3">
          <TrackedLink
            href="/auth/signup"
            event="cta_clicked"
            eventProperties={{
              placement: 'lp_team_headshots_sticky_mobile',
              action: 'signup',
              variant,
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-cta px-5 py-3 text-white font-bold"
          >
            {t('hero.cta')}
            <ArrowRightIcon className="w-5 h-5" aria-hidden="true" />
          </TrackedLink>
        </div>
      </div>
      <div className="h-20 md:hidden" aria-hidden="true" />
    </div>
  );
}
