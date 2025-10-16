import { Suspense } from 'react'
import Link from 'next/link'
import VerifyContent from './verify-content'
import {useTranslations} from 'next-intl'
import AuthSplitLayout from '@/components/auth/AuthSplitLayout'
import AuthCard from '@/components/auth/AuthCard'

export default function VerifyRequestPage() {
  const t = useTranslations('auth.verify')
  return (
    <AuthSplitLayout
      left={
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-primary-light via-white to-brand-cta-light rounded-2xl" />
          <div className="relative p-10">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{t('title')}</h1>
            <p className="text-gray-700 mb-8 text-lg">{t('subtitle')}</p>
          </div>
        </div>
      }
    >
      <AuthCard>
        <div className="space-y-6">
          <Suspense fallback={<div className="text-center text-gray-600">{t('loading')}</div>}>
            <VerifyContent />
          </Suspense>
          <div className="bg-brand-primary-light border border-brand-primary-lighter rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-brand-primary">
                  {t('cantFindTitle')}
                </h3>
                <div className="mt-2 text-sm text-gray-700">
                  <ul className="list-disc pl-5 space-y-1">
                    <li>{t('tipSpam')}</li>
                    <li>{t('tipCorrect')}</li>
                    <li>{t('tipDelay')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center">
            <Link href="/auth/signin" className="font-medium text-brand-primary hover:text-brand-primary-hover">
              {t('backToSignIn')}
            </Link>
          </div>
        </div>
      </AuthCard>
    </AuthSplitLayout>
  )
}
