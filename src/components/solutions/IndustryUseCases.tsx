'use client'

import { useTranslations } from 'next-intl'
import {
  Building2,
  Signpost,
  Globe,
  CreditCard,
  Mail,
  Monitor,
  Briefcase,
  FileText,
  Users,
  BadgeCheck,
  Stethoscope,
  Scale,
} from 'lucide-react'

interface UseCasesProps {
  industry: string
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  building: Building2,
  signpost: Signpost,
  globe: Globe,
  'credit-card': CreditCard,
  mail: Mail,
  monitor: Monitor,
  briefcase: Briefcase,
  'file-text': FileText,
  users: Users,
  badge: BadgeCheck,
  stethoscope: Stethoscope,
  scale: Scale,
}

export function IndustryUseCases({ industry }: UseCasesProps) {
  const t = useTranslations(`solutions.${industry}.useCases`)
  const platforms = t.raw('platforms') as Array<{ name: string; icon: string }>

  return (
    <section className="py-16 sm:py-20 bg-bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl sm:text-4xl font-display font-bold text-text-dark text-center mb-12">
          {t('title')}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform, index) => {
            const Icon = iconMap[platform.icon] || Globe

            return (
              <div
                key={index}
                className="flex items-center gap-4 rounded-xl border border-bg-gray-100 bg-bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-6 w-6 text-brand-primary" />
                </div>
                <span className="text-text-dark font-medium">{platform.name}</span>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
