'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

export default function VerifyContent() {
  const t = useTranslations('auth.verify')
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''

  return (
    <div className="space-y-7 lg:space-y-8">
      {/* Email Icon */}
      <div className="flex justify-center">
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center">
          <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
      </div>

      {/* Main Message */}
      <div className="text-center space-y-3">
        <p className="text-base lg:text-lg text-slate-600 leading-relaxed">
          {t('sentTo', { email: email || t('yourEmail') })}
        </p>
        <p className="text-sm text-slate-500">
          {t('instructions')}
        </p>
      </div>

      {/* Help Section */}
      <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-5">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{t('cantFindTitle')}</h3>
            <ul className="text-sm text-slate-600 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>{t('tipSpam')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>{t('tipCorrect')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>{t('tipDelay')}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Back Link */}
      <div className="text-center pt-3">
        <Link 
          href="/auth/signin" 
          className="text-sm lg:text-base font-semibold text-blue-600 hover:text-blue-700 transition-all duration-200 hover:underline underline-offset-4 decoration-2"
        >
          {t('backToSignIn')}
        </Link>
      </div>
    </div>
  )
}


