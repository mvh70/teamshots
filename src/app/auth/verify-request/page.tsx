import { Suspense } from 'react'
import VerifyContent from './verify-content'
import {useTranslations} from 'next-intl'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'

export default function VerifyRequestPage() {
  const t = useTranslations('auth.verify')
  return (
    <AuthSplitLayout
      left={
        <div className="relative group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl shadow-xl border border-white/20 backdrop-blur-sm transition-all duration-500 group-hover:shadow-2xl group-hover:from-blue-500/15 group-hover:via-purple-500/8 group-hover:to-pink-500/15" />
          <div className="relative p-12 lg:p-14">
            <h1 className="text-5xl lg:text-6xl font-display font-bold text-slate-900 mb-6 tracking-tight leading-tight bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 bg-clip-text text-transparent">{t('title')}</h1>
            <p className="text-xl lg:text-2xl text-slate-600 mb-12 leading-relaxed font-medium">{t('subtitle')}</p>
            <div className="space-y-6">
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1">
                <span className="w-3 h-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('tip1')}</span>
              </div>
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1" style={{ transitionDelay: '50ms' }}>
                <span className="w-3 h-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('tip2')}</span>
              </div>
              <div className="flex items-center gap-4 transform transition-all duration-200 hover:translate-x-1" style={{ transitionDelay: '100ms' }}>
                <span className="w-3 h-3 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full shadow-sm animate-pulse" style={{ animationDuration: '2s', animationDelay: '1s' }} />
                <span className="text-lg lg:text-xl text-slate-700 font-medium">{t('tip3')}</span>
              </div>
            </div>
          </div>
        </div>
      }
    >
      <AuthCard title={t('title')}>
        <Suspense fallback={<div className="text-center text-slate-600">{t('loading')}</div>}>
          <VerifyContent />
        </Suspense>
      </AuthCard>
    </AuthSplitLayout>
  )
}
