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

export async function verifyTeamDomain(email: string, teamWebsite: string): Promise<{
  isValid: boolean
  emailDomain: string
  websiteDomain: string
  requiresVerification: boolean
}> {
  const emailDomain = extractDomainFromEmail(email)
  const websiteDomain = extractDomainFromUrl(teamWebsite)

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

export async function createTeamVerificationRequest(
  email: string, 
  teamWebsite: string,
  adminUserId: string
): Promise<{ success: boolean; teamId?: string; error?: string }> {
  try {
    const verification = await verifyTeamDomain(email, teamWebsite)
    
    if (verification.isValid) {
      const team = await prisma.team.create({
        data: {
          name: extractDomainFromUrl(teamWebsite),
          website: teamWebsite,
          domain: verification.websiteDomain,
          adminId: adminUserId,
        }
      })

      return { success: true, teamId: team.id }
    } else if (verification.requiresVerification) {
      const team = await prisma.team.create({
        data: {
          name: extractDomainFromUrl(teamWebsite),
          website: teamWebsite,
          domain: verification.websiteDomain,
          adminId: adminUserId,
        }
      })

      return { 
        success: true, 
        teamId: team.id,
        error: 'Team email verification required'
      }
    } else {
      return { 
        success: false, 
        error: 'Email domain does not match team website'
      }
    }
  } catch (error) {
    Logger.error('Error creating team verification request', { error: error instanceof Error ? error.message : String(error) })
    return { 
      success: false, 
      error: 'Failed to create team verification request'
    }
  }
}

export async function verifyTeamEmail(
  teamId: string, 
  teamEmail: string, 
  otpCode: string
): Promise<boolean> {
  try {
    const isValidOTP = await import("@/domain/auth/otp").then(module => 
      module.verifyOTP(teamEmail, otpCode)
    )

    if (!isValidOTP) {
      return false
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        domain: extractDomainFromEmail(teamEmail),
      }
    })

    return true
  } catch (error) {
    Logger.error('Error verifying team email', { error: error instanceof Error ? error.message : String(error) })
    return false
  }
}


