import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"

export function extractDomainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

export function extractDomainFromUrl(url: string): string {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase()
  } catch (error) {
    Logger.error('Error extracting domain from URL', { error: error instanceof Error ? error.message : String(error) })
    return ''
  }
}

export async function verifyCompanyDomain(email: string, companyWebsite: string): Promise<{
  isValid: boolean
  emailDomain: string
  websiteDomain: string
  requiresVerification: boolean
}> {
  const emailDomain = extractDomainFromEmail(email)
  const websiteDomain = extractDomainFromUrl(companyWebsite)

  if (emailDomain === websiteDomain) {
    return {
      isValid: true,
      emailDomain,
      websiteDomain,
      requiresVerification: false
    }
  }

  const commonProviders = [
    'gmail.com',
    'outlook.com',
    'hotmail.com',
    'yahoo.com',
    'icloud.com'
  ]

  const isCommonProvider = commonProviders.includes(emailDomain)

  return {
    isValid: false,
    emailDomain,
    websiteDomain,
    requiresVerification: !isCommonProvider
  }
}

export async function createCompanyVerificationRequest(
  email: string, 
  companyWebsite: string,
  adminUserId: string
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  try {
    const verification = await verifyCompanyDomain(email, companyWebsite)
    
    if (verification.isValid) {
      const company = await prisma.company.create({
        data: {
          name: extractDomainFromUrl(companyWebsite),
          website: companyWebsite,
          domain: verification.websiteDomain,
          adminId: adminUserId,
        }
      })

      return { success: true, companyId: company.id }
    } else if (verification.requiresVerification) {
      const company = await prisma.company.create({
        data: {
          name: extractDomainFromUrl(companyWebsite),
          website: companyWebsite,
          domain: verification.websiteDomain,
          adminId: adminUserId,
        }
      })

      return { 
        success: true, 
        companyId: company.id,
        error: 'Company email verification required'
      }
    } else {
      return { 
        success: false, 
        error: 'Email domain does not match company website'
      }
    }
  } catch (error) {
    Logger.error('Error creating company verification request', { error: error instanceof Error ? error.message : String(error) })
    return { 
      success: false, 
      error: 'Failed to create company verification request'
    }
  }
}

export async function verifyCompanyEmail(
  companyId: string, 
  companyEmail: string, 
  otpCode: string
): Promise<boolean> {
  try {
    const isValidOTP = await import("@/domain/auth/otp").then(module => 
      module.verifyOTP(companyEmail, otpCode)
    )

    if (!isValidOTP) {
      return false
    }

    await prisma.company.update({
      where: { id: companyId },
      data: {
        domain: extractDomainFromEmail(companyEmail),
      }
    })

    return true
  } catch (error) {
    Logger.error('Error verifying company email', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}


