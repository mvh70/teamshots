'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {useTranslations} from 'next-intl'

export default function VerifyContent() {
  const t = useTranslations('auth.verify')
  const [email, setEmail] = useState('')
  const searchParams = useSearchParams()

  useEffect(() => {
    const emailParam = searchParams.get('email')
    if (emailParam) setEmail(emailParam)
  }, [searchParams])

  return (
    <div className="text-center">
      <div className="mx-auto h-12 w-12 text-green-600">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="mt-6 text-3xl font-extrabold text-gray-900">{t('title')}</h2>
      <p className="mt-2 text-sm text-gray-600">{t('sentTo', { email: email || t('yourEmail') })}</p>
      <p className="mt-1 text-sm text-gray-500">{t('instructions')}</p>

      <div className="mt-8">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">{t('cantFindTitle')}</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>{t('tipSpam')}</li>
                  <li>{t('tipCorrect')}</li>
                  <li>{t('tipDelay')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <Link href="/auth/signin" className="font-medium text-indigo-600 hover:text-indigo-500">{t('backToSignIn')}</Link>
      </div>
    </div>
  )
}


