import { prisma } from "@/lib/prisma"

// Extract domain from email
export function extractDomainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

// Extract domain from URL
export function extractDomainFromUrl(url: string): string {
  try {
    // Add protocol if missing
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    const urlObj = new URL(url)
    return urlObj.hostname.toLowerCase()
  } catch (error) {
    console.error('Error extracting domain from URL:', error)
    return ''
  }
}

// Check if email domain matches company website domain
export async function verifyCompanyDomain(email: string, companyWebsite: string): Promise<{
  isValid: boolean
  emailDomain: string
  websiteDomain: string
  requiresVerification: boolean
}> {
  const emailDomain = extractDomainFromEmail(email)
  const websiteDomain = extractDomainFromUrl(companyWebsite)

  // If domains match exactly, no verification needed
  if (emailDomain === websiteDomain) {
    return {
      isValid: true,
      emailDomain,
      websiteDomain,
      requiresVerification: false
    }
  }

  // Check if this is a common company email provider that should be allowed
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

// Store company verification request
export async function createCompanyVerificationRequest(
  email: string, 
  companyWebsite: string,
  adminUserId: string
): Promise<{ success: boolean; companyId?: string; error?: string }> {
  try {
    const verification = await verifyCompanyDomain(email, companyWebsite)
    
    if (verification.isValid) {
      // Create company directly if domains match
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
      // Create company with pending verification
      const company = await prisma.company.create({
        data: {
          name: extractDomainFromUrl(companyWebsite),
          website: companyWebsite,
          domain: verification.websiteDomain,
          adminId: adminUserId,
          // Add verification status fields if needed
        }
      })

      // TODO: Send verification email to company email
      // This would require implementing company email verification flow
      
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
    console.error('Error creating company verification request:', error)
    return { 
      success: false, 
      error: 'Failed to create company verification request'
    }
  }
}

// Verify company email domain (for when domains don't match)
export async function verifyCompanyEmail(
  companyId: string, 
  companyEmail: string, 
  otpCode: string
): Promise<boolean> {
  try {
    // Verify OTP for company email
    const isValidOTP = await import("@/lib/otp").then(module => 
      module.verifyOTP(companyEmail, otpCode)
    )

    if (!isValidOTP) {
      return false
    }

    // Update company with verified domain
    await prisma.company.update({
      where: { id: companyId },
      data: {
        domain: extractDomainFromEmail(companyEmail),
        // Add verification status fields if needed
      }
    })

    return true
  } catch (error) {
    console.error('Error verifying company email:', error)
    return false
  }
}
