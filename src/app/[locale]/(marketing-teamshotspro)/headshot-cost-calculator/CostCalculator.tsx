'use client';

import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PRICING_CONFIG } from '@/config/pricing';
import BeforeAfterSlider from '@/components/BeforeAfterSlider';

const BEFORE_AFTER_SAMPLES = [
  { before: '/samples/before-6.jpeg', after: '/samples/after-6.png', name: 'David' },
  { before: '/samples/before-4.webp', after: '/samples/after-4.webp', name: 'Clarice' },
  { before: '/samples/before-5.webp', after: '/samples/after-5.webp', name: 'Mathieu' },
];

const DEFAULT_PHOTOGRAPHER_RATE = 150;
const DEFAULT_SESSION_MINUTES = 30;
const DEFAULT_EMPLOYEE_HOURLY = 50;
const DEFAULT_ADMIN_HOURS = 4;
const DEFAULT_ADMIN_HOURLY = 35;
const DEFAULT_RETOUCHING = 35;

const MIN_TEAM_SIZE = 2;
const MAX_TEAM_SIZE = 200;

const currencyFormatter = new Intl.NumberFormat('en-US');
const hourFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

const formatCurrency = (value: number) => `$${currencyFormatter.format(Math.round(value))}`;
const formatHours = (value: number) => `${hourFormatter.format(value)}h`;

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const startValue = prevValue.current;
    const endValue = value;
    const duration = 500;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);
      const current = startValue + (endValue - startValue) * easeOut;
      setDisplayValue(Math.round(current));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
    prevValue.current = value;
  }, [value]);

  return <>{currencyFormatter.format(displayValue)}</>;
}

export default function CostCalculator() {
  const t = useTranslations('costCalculator');
  const [teamSize, setTeamSize] = useState(25);
  const [photographerRate, setPhotographerRate] = useState(DEFAULT_PHOTOGRAPHER_RATE);
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_MINUTES);
  const [employeeHourly, setEmployeeHourly] = useState(DEFAULT_EMPLOYEE_HOURLY);
  const [adminHours, setAdminHours] = useState(DEFAULT_ADMIN_HOURS);
  const [adminHourly, setAdminHourly] = useState(DEFAULT_ADMIN_HOURLY);
  const [retouchingCost, setRetouchingCost] = useState(DEFAULT_RETOUCHING);
  const [showAssumptions, setShowAssumptions] = useState(false);
  const [includeExtras, setIncludeExtras] = useState(false);
  const [activeSample, setActiveSample] = useState(0);

  const sessionHours = useMemo(() => sessionMinutes / 60, [sessionMinutes]);

  const teamshotsCost = useMemo(() => {
    const total = PRICING_CONFIG.seats.calculateTotal(teamSize);
    return {
      total,
      perPerson: total / teamSize,
      marginalSeat: PRICING_CONFIG.seats.getPricePerSeatAtTier(teamSize),
    };
  }, [teamSize]);

  const traditionalCosts = useMemo(() => {
    const photography = photographerRate * teamSize;
    const employeeTime = teamSize * sessionHours * employeeHourly;
    const adminTime = adminHours * adminHourly;
    const retouching = retouchingCost * teamSize;
    const extras = includeExtras ? 350 : 0;
    const total = photography + employeeTime + adminTime + retouching + extras;
    return { photography, employeeTime, adminTime, retouching, extras, total, perPerson: total / teamSize };
  }, [teamSize, photographerRate, sessionHours, employeeHourly, adminHours, adminHourly, retouchingCost, includeExtras]);

  const traditionalHours = useMemo(() => teamSize * sessionHours + adminHours, [teamSize, sessionHours, adminHours]);

  const savings = useMemo(() => {
    const amount = traditionalCosts.total - teamshotsCost.total;
    const percentage = traditionalCosts.total ? (amount / traditionalCosts.total) * 100 : 0;
    return { amount, percentage, perPerson: amount / teamSize };
  }, [traditionalCosts.total, teamshotsCost.total, teamSize]);

  const isSaving = savings.amount >= 0;
  const savingsAmount = Math.abs(savings.amount);
  const savingsPercent = Math.abs(savings.percentage);

  return (
    <div className="min-h-screen bg-bg-white relative overflow-hidden grain-texture pb-20 lg:pb-0">
      <div className="absolute inset-0 bg-gradient-mesh opacity-20 -z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-gray-50/60 -z-10" />

      {/* Floating decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute top-40 right-20 w-96 h-96 bg-brand-cta/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
      <div className="absolute bottom-40 left-1/4 w-64 h-64 bg-brand-primary/5 rounded-full blur-3xl -z-10 animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 py-16 lg:py-20">
        <header className="text-center max-w-3xl mx-auto space-y-4 animate-slide-up">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-text-dark leading-tight">
            {t('hero.title')}
          </h1>
          <p className="text-base sm:text-lg text-text-body leading-relaxed max-w-xl mx-auto">
            {t('hero.subtitle')}
          </p>
        </header>

        {/* Top row: Slider + Savings */}
        <div className="mt-12 grid lg:grid-cols-[1.1fr_0.9fr] gap-6 lg:gap-8">
          <section className="rounded-3xl bg-bg-white border border-gray-200 shadow-depth-lg p-8">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-text-muted">{t('teamSize.label')}</p>
                <h2 className="mt-2 text-3xl sm:text-4xl font-display font-bold text-text-dark">
                  <AnimatedNumber value={teamSize} /> {t('teamSize.people')}
                </h2>
                <p className="mt-1 text-sm text-text-muted">
                  {t('teamSize.avgCost')}{' '}
                  <span className="font-semibold text-text-dark">{formatCurrency(teamshotsCost.perPerson)}{t('teamSize.perPerson')}</span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-text-muted">{t('teamSize.total')}</div>
                <div className="text-2xl font-display font-bold text-text-dark">{formatCurrency(teamshotsCost.total)}</div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <input
                type="range"
                min={MIN_TEAM_SIZE}
                max={MAX_TEAM_SIZE}
                step="1"
                value={teamSize}
                onChange={(e) => setTeamSize(Number(e.target.value))}
                className="w-full accent-brand-primary"
                aria-label={t('teamSize.label')}
              />
              <div className="flex justify-between text-xs text-text-muted font-medium">
                <span>2 {t('teamSize.people')}</span>
                <span>200 {t('teamSize.people')}</span>
              </div>
            </div>

            {teamSize >= 150 && (
              <div className="mt-4 p-3 rounded-xl bg-brand-primary-light text-sm text-brand-primary">
                <span className="font-semibold">{t('largeTeam.title')}</span>{' '}
                <a href="https://calendly.com/teamshotspro/demo" className="underline hover:no-underline">
                  {t('largeTeam.link')}
                </a>
              </div>
            )}

            {/* Before/After Interactive Slider */}
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-text-dark">{t('beforeAfter.title')}</p>
                {/* Named tabs for samples */}
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                  {BEFORE_AFTER_SAMPLES.map((sample, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSample(i)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        activeSample === i
                          ? 'bg-white text-brand-primary shadow-sm'
                          : 'text-text-muted hover:text-text-dark'
                      }`}
                    >
                      {sample.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Interactive comparison slider - uses shared component */}
              <div className="relative w-full rounded-2xl overflow-hidden shadow-xl ring-1 ring-gray-200">
                <BeforeAfterSlider
                  key={activeSample}
                  beforeSrc={BEFORE_AFTER_SAMPLES[activeSample].before}
                  afterSrc={BEFORE_AFTER_SAMPLES[activeSample].after}
                  alt={`${BEFORE_AFTER_SAMPLES[activeSample].name}'s professional headshot transformation`}
                  size="md"
                  aspectRatio="4/3"
                  priority={activeSample === 0}
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
              </div>
              <p className="text-sm text-text-muted text-center mt-2">{t('beforeAfter.dragToCompare')}</p>
            </div>
          </section>

          <section
            className="rounded-3xl text-white shadow-depth-2xl p-6 sm:p-8 animate-fade-in flex flex-col"
            style={{
              backgroundColor: 'var(--brand-primary)',
              backgroundImage: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%)',
            }}
          >
            <div className="text-xs uppercase tracking-widest text-bg-white/70">
              {isSaving ? t('savings.estimated') : t('savings.gap')}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-display font-bold">$</span>
              <span className="text-4xl sm:text-5xl font-display font-bold tracking-tight">
                <AnimatedNumber value={Math.round(savingsAmount)} />
              </span>
            </div>
            <div className="mt-1 text-sm text-bg-white/70">
              {t('savings.comparedTo', { amount: formatCurrency(traditionalCosts.total) })}
            </div>

            {/* Key metric */}
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-bg-white/15 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-display font-bold">
                  <AnimatedNumber value={Math.round(savingsPercent)} />%
                </div>
                <div className="text-xs text-bg-white/70">{t('savings.lessThan')}</div>
              </div>
            </div>

            {/* What's included - benefit focused */}
            <div className="mt-5 pt-5 border-t border-bg-white/20">
              <p className="text-xs uppercase tracking-widest text-bg-white/70 mb-3">{t('savings.whySwitch')}</p>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-green-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-bg-white/90">{t('savings.benefits.noScheduling')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-green-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-bg-white/90">{t('savings.benefits.commercialRights')}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4 text-green-300 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-bg-white/90">{t('savings.benefits.consistentBranding')}</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-auto pt-5 flex flex-col gap-2">
              <a
                href="/auth/signup"
                className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-brand-cta text-white font-bold rounded-2xl hover:bg-brand-cta-hover transition-all shadow-depth-lg text-sm group"
              >
                {t('cta.primary')}
                <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
              <p className="text-center text-[10px] text-bg-white/60">{t('cta.noCreditCard')}</p>
            </div>
          </section>
        </div>

        {/* Traditional photography costs */}
        <div className="mt-8">
          <section className="rounded-3xl bg-bg-white border border-gray-200 shadow-depth-lg p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-display font-bold text-text-dark">{t('traditional.title')}</h3>
                  <p className="text-sm text-text-muted mt-1">{t('traditional.subtitle')}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-widest text-text-muted">{t('traditional.total')}</div>
                  <div className="text-2xl font-display font-bold text-text-dark">{formatCurrency(traditionalCosts.total)}</div>
                </div>
              </div>

              {/* Cost breakdown summary - always visible */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-lg font-bold text-text-dark">{formatCurrency(traditionalCosts.photography)}</div>
                  <div className="text-xs text-text-muted">{t('traditional.photographer')}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-lg font-bold text-text-dark">{formatCurrency(traditionalCosts.employeeTime)}</div>
                  <div className="text-xs text-text-muted">{t('traditional.employeeTime')}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-lg font-bold text-text-dark">{formatCurrency(traditionalCosts.retouching)}</div>
                  <div className="text-xs text-text-muted">{t('traditional.retouching')}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <div className="text-lg font-bold text-text-dark">{formatCurrency(traditionalCosts.adminTime + traditionalCosts.extras)}</div>
                  <div className="text-xs text-text-muted">{t('traditional.adminExtras')}</div>
                </div>
              </div>

              {/* Customize toggle */}
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => setShowAssumptions(!showAssumptions)}
                  className="flex items-center gap-2 text-sm font-medium text-brand-primary hover:text-brand-primary-hover transition"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showAssumptions ? 'rotate-90' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  {showAssumptions ? t('traditional.hideDetails') : t('traditional.customize')}
                </button>
              </div>

              <div className={`mt-4 space-y-4 ${showAssumptions ? '' : 'hidden'}`}>
                <AssumptionRow
                  icon={
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h3l2-2h6l2 2h3a1 1 0 011 1v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8a1 1 0 011-1z" />
                      <circle cx="12" cy="12" r="3.5" />
                    </svg>
                  }
                  title={t('assumptions.photographerRate.title')}
                  description={`${teamSize} ${t('teamSize.people')} × $${photographerRate}${t('assumptions.photographerRate.perPerson')}`}
                  total={traditionalCosts.photography}
                  costLabel={t('traditional.cost')}
                  primary={{
                    label: t('assumptions.photographerRate.rateLabel'),
                    value: photographerRate,
                    onChange: setPhotographerRate,
                    min: 75,
                    max: 400,
                    step: 5,
                    prefix: '$',
                    suffix: t('assumptions.photographerRate.perPerson'),
                  }}
                />

                <AssumptionRow
                  icon={
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  }
                  title={t('assumptions.employeeTime.title')}
                  tooltip={t('assumptions.employeeTime.tooltip')}
                  description={`${teamSize} ${t('teamSize.people')} × ${sessionMinutes} min × $${employeeHourly}${t('assumptions.employeeTime.perHour')}`}
                  total={traditionalCosts.employeeTime}
                  costLabel={t('traditional.cost')}
                  primary={{
                    label: t('assumptions.employeeTime.hourlyLabel'),
                    value: employeeHourly,
                    onChange: setEmployeeHourly,
                    min: 20,
                    max: 200,
                    step: 5,
                    prefix: '$',
                    suffix: t('assumptions.employeeTime.perHour'),
                  }}
                  secondary={{
                    label: t('assumptions.employeeTime.minutesLabel'),
                    value: sessionMinutes,
                    onChange: setSessionMinutes,
                    min: 10,
                    max: 120,
                    step: 5,
                    suffix: t('assumptions.employeeTime.minutes'),
                  }}
                />

                <AssumptionRow
                  icon={
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6a2 2 0 012 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 10h6" />
                    </svg>
                  }
                  title={t('assumptions.adminCoordination.title')}
                  description={`${adminHours} ${t('assumptions.adminCoordination.hours')} × $${adminHourly}${t('assumptions.adminCoordination.perHour')}`}
                  total={traditionalCosts.adminTime}
                  costLabel={t('traditional.cost')}
                  primary={{
                    label: t('assumptions.adminCoordination.hourlyLabel'),
                    value: adminHourly,
                    onChange: setAdminHourly,
                    min: 20,
                    max: 100,
                    step: 5,
                    prefix: '$',
                    suffix: t('assumptions.adminCoordination.perHour'),
                  }}
                  secondary={{
                    label: t('assumptions.adminCoordination.hoursLabel'),
                    value: adminHours,
                    onChange: setAdminHours,
                    min: 1,
                    max: 40,
                    step: 1,
                    suffix: t('assumptions.adminCoordination.hours'),
                  }}
                />

                <AssumptionRow
                  icon={
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4l2.2 4.5L19 9l-3.5 3.4.8 4.6L12 15.5 7.7 17l.8-4.6L5 9l4.8-.5L12 4z" />
                    </svg>
                  }
                  title={t('assumptions.retouching.title')}
                  description={`${teamSize} ${t('teamSize.people')} × $${retouchingCost}${t('assumptions.retouching.perPerson')}`}
                  total={traditionalCosts.retouching}
                  costLabel={t('traditional.cost')}
                  primary={{
                    label: t('assumptions.retouching.costLabel'),
                    value: retouchingCost,
                    onChange: setRetouchingCost,
                    min: 0,
                    max: 150,
                    step: 5,
                    prefix: '$',
                    suffix: t('assumptions.retouching.perPerson'),
                  }}
                />
              </div>

              {/* Usage rights checkbox */}
              <label className="mt-6 flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeExtras}
                  onChange={(e) => setIncludeExtras(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-gray-300 text-brand-primary focus:ring-brand-primary"
                />
                <div>
                  <span className="text-sm font-medium text-text-dark group-hover:text-brand-primary transition">
                    {t('extras.label')}
                  </span>
                  <p className="text-xs text-text-muted mt-0.5">{t('extras.description')}</p>
                </div>
              </label>
            </section>
        </div>

        <p className="text-center text-xs text-text-muted mt-10">
          {t('disclaimer')}
        </p>
      </div>

      {/* Sticky mobile CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-bg-white border-t border-gray-200 p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] z-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-brand-primary">{formatCurrency(savingsAmount)}</div>
            <div className="text-xs text-text-muted">{t('cta.potentialSavings')}</div>
          </div>
          <a
            href="/auth/signup"
            className="flex-shrink-0 px-6 py-3 bg-brand-cta text-white font-bold rounded-xl hover:bg-brand-cta-hover transition-all text-sm shadow-lg"
          >
            {t('cta.secondary')}
          </a>
        </div>
      </div>
    </div>
  );
}

function AssumptionRow({
  icon,
  title,
  tooltip,
  description,
  total,
  costLabel,
  primary,
  secondary,
}: {
  icon: ReactNode;
  title: string;
  tooltip?: string;
  description: string;
  total: number;
  costLabel: string;
  primary: NumberFieldProps;
  secondary?: NumberFieldProps;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-2xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
            {icon}
          </div>
          <div>
            <div className="font-semibold text-text-dark flex items-center gap-1.5">
              {title}
              {tooltip && (
                <span className="group relative">
                  <svg className="w-4 h-4 text-text-muted cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition pointer-events-none">
                    {tooltip}
                  </span>
                </span>
              )}
            </div>
            <div className="text-xs text-text-muted">{description}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-text-muted">{costLabel}</div>
          <div className="text-lg font-semibold text-text-dark">{formatCurrency(total)}</div>
        </div>
      </div>
      <div className={`mt-4 grid gap-4 ${secondary ? 'sm:grid-cols-2' : ''}`}>
        <NumberField {...primary} />
        {secondary ? <NumberField {...secondary} /> : null}
      </div>
    </div>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  prefix?: string;
  suffix?: string;
};

function NumberField({ label, value, onChange, min, max, step = 1, prefix, suffix }: NumberFieldProps) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-text-muted">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-200 bg-bg-white px-3 py-2 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition">
        {prefix ? <span className="text-sm text-text-muted font-semibold">{prefix}</span> : null}
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const raw = e.target.value;
            const next = raw === '' ? min : Number(raw);
            onChange(Number.isFinite(next) ? next : min);
          }}
          className="w-full bg-transparent text-sm font-semibold text-text-dark focus:outline-none"
        />
        {suffix ? <span className="text-xs text-text-muted">{suffix}</span> : null}
      </div>
    </label>
  );
}


