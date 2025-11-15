import { prisma } from "@/lib/prisma"
import { Logger } from "@/lib/logger"

export function extractDomainFromEmail(email: string): string {
  return email.split('@')[1]?.toLowerCase() || ''
}

// SSRF protection: Block private IP ranges and localhost
const PRIVATE_IP_RANGES = [
  /^127\./,           // 127.0.0.0/8 - Loopback
  /^10\./,            // 10.0.0.0/8 - Private
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12 - Private
  /^192\.168\./,      // 192.168.0.0/16 - Private
  /^169\.254\./,      // 169.254.0.0/16 - Link-local
  /^::1$/,            // IPv6 localhost
  /^fc00:/,           // IPv6 private
  /^fe80:/,           // IPv6 link-local
  /^localhost$/i,     // localhost hostname
  /^0\.0\.0\.0$/,     // Invalid address
]

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(ip))
}

async function resolveAndValidateIP(hostname: string): Promise<{ isValid: boolean; ip?: string; error?: string }> {
  try {
    // SECURITY: First check if hostname is already an IP address
    // IP addresses in hostname should be blocked immediately
    if (isPrivateIP(hostname)) {
      return { isValid: false, error: 'Private IP addresses are not allowed' }
    }
    
    // Check if it's a valid IP format (IPv4 or IPv6)
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^fc00:/i
    
    if (ipv4Regex.test(hostname) || ipv6Regex.test(hostname)) {
      // It's an IP address - validate it's not private
      if (isPrivateIP(hostname)) {
        return { isValid: false, error: 'Private IP addresses are not allowed' }
      }
      // Public IP addresses are allowed
      return { isValid: true, ip: hostname }
    }
    
    // Use Node.js dns module to resolve hostname to IP
    const dns = await import('dns')
    const { promisify } = await import('util')
    const lookup = promisify(dns.lookup)
    
    const result = await lookup(hostname, { family: 4 })
    const ip = Array.isArray(result) ? result[0].address : result.address
    
    // Validate resolved IP is not private
    if (isPrivateIP(ip)) {
      return { isValid: false, error: 'Hostname resolves to private IP address' }
    }
    
    return { isValid: true, ip }
  } catch (error) {
    Logger.error('DNS resolution failed', { 
      hostname, 
      error: error instanceof Error ? error.message : String(error) 
    })
    // If DNS resolution fails, we can't validate - be conservative and reject
    return { isValid: false, error: 'DNS resolution failed' }
  }
}

export function extractDomainFromUrl(url: string): string {
  try {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    const urlObj = new URL(url)
    
    // SECURITY: Validate protocol - only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      Logger.error('Invalid protocol in URL', { protocol: urlObj.protocol, url })
      return ''
    }
    
    // SECURITY: Block localhost and private IPs in hostname
    const hostname = urlObj.hostname.toLowerCase()
    if (isPrivateIP(hostname)) {
      Logger.error('Private IP detected in URL hostname', { hostname, url })
      return ''
    }
    
    return hostname
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

  // SECURITY: SSRF protection - validate that resolved IP is not private
  if (websiteDomain) {
    const ipValidation = await resolveAndValidateIP(websiteDomain)
    if (!ipValidation.isValid) {
      Logger.error('SSRF protection: Invalid or private IP detected', { 
        websiteDomain, 
        error: ipValidation.error 
      })
      return {
        isValid: false,
        emailDomain,
        websiteDomain: '',
        requiresVerification: false
      }
    }
  }

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


