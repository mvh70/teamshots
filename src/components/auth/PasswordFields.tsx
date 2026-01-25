'use client'

import { useTranslations } from 'next-intl'
import AuthInput from './AuthInput'

interface PasswordFieldsProps {
  password: string
  confirmPassword: string
  onPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  /** Translation namespace for labels (e.g., 'auth.signup', 'auth.setPassword') */
  namespace: string
  /** Whether the passwords are valid (meets requirements and match) */
  isValid?: boolean
}

export default function PasswordFields({
  password,
  confirmPassword,
  onPasswordChange,
  onConfirmPasswordChange,
  namespace,
}: PasswordFieldsProps) {
  const t = useTranslations(namespace)

  // Password validation state
  const passwordMeetsRequirements = password.length >= 8
  const passwordsMatch = password === confirmPassword
  const confirmPasswordTouched = confirmPassword.length > 0

  return (
    <>
      <div>
        <AuthInput
          id="password"
          name="password"
          type="password"
          required
          label={
            <span className="flex items-center gap-2">
              <span>{t('passwordLabel')}</span>
              {passwordMeetsRequirements && (
                <svg className="w-4 h-4 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          }
          placeholder={t('passwordRequirement')}
          strengthMeter
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
        />
      </div>

      <div>
        <AuthInput
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          required
          label={t('confirmPasswordLabel')}
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
        />
        {confirmPasswordTouched && !passwordsMatch && (
          <div className="mt-2 flex items-center gap-1.5 text-sm text-red-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            {t('passwordMismatch')}
          </div>
        )}
      </div>
    </>
  )
}

/** Hook to get password validation state */
export function usePasswordValidation(password: string, confirmPassword: string) {
  const passwordMeetsRequirements = password.length >= 8
  const passwordsMatch = password === confirmPassword
  const isValid = passwordMeetsRequirements && passwordsMatch

  return { passwordMeetsRequirements, passwordsMatch, isValid }
}
