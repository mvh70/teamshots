import Papa from 'papaparse'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'
import { canAddTeamMember, isSeatsBasedTeam } from '@/domain/pricing/seats'
import { PRICING_CONFIG } from '@/config/pricing'

/**
 * Column name mappings for fuzzy matching CSV headers
 */
const COLUMN_MAPPINGS = {
  email: [
    'email', 'e-mail', 'email_address', 'emailaddress',
    'work_email', 'workemail', 'email address', 'e-mail address',
    'corporate_email', 'business_email'
  ],
  firstName: [
    'first_name', 'firstname', 'first', 'given_name',
    'givenname', 'prénom', 'first name', 'given name',
    'legal_name_first_name', 'prenom', 'vorname'
  ],
  lastName: [
    'last_name', 'lastname', 'last', 'family_name',
    'familyname', 'surname', 'last name', 'family name',
    'legal_name_last_name', 'nom', 'nachname'
  ],
  fullName: [
    'name', 'full_name', 'fullname', 'employee_name',
    'full name', 'display_name', 'displayname', 'employee name'
  ]
}

/**
 * Result of parsing a CSV file
 */
export interface ParsedCSVResult {
  success: boolean
  error?: string
  rows: ParsedRow[]
  warnings: string[]
  detectedColumns: {
    email?: string
    firstName?: string
    lastName?: string
    fullName?: string
  }
}

export interface ParsedRow {
  email: string
  firstName: string
  lastName?: string
  rowNumber: number
}

export interface BulkInviteValidationResult {
  success: boolean
  error?: string
  readyToImport: ParsedRow[]
  duplicatesRemoved: number
  duplicateEmails: string[]
  invalidEmailsSkipped: number
  invalidEmails: string[]
  existingMembersSkipped: number
  existingEmails: string[]
  seatsRequired: number
  seatsAvailable: number
  hasEnoughSeats: boolean
}

export interface BulkInviteResult {
  success: boolean
  error?: string
  imported: number
  invites: Array<{
    id: string
    email: string
    firstName: string
    token: string
    inviteLink: string
  }>
}

/**
 * Normalize a column header for matching
 */
function normalizeHeader(header: string): string {
  return header.toLowerCase().trim().replace(/[_\-\s]+/g, '_')
}

/**
 * Find the matching column name from CSV headers
 */
function findColumn(headers: string[], mappings: string[]): string | undefined {
  const normalizedMappings = mappings.map(m => normalizeHeader(m))

  for (const header of headers) {
    const normalized = normalizeHeader(header)
    if (normalizedMappings.includes(normalized)) {
      return header
    }
  }
  return undefined
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Extract first name from a full name string
 */
function extractFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[0] || fullName
}

/**
 * Extract first name from email (before @)
 */
function extractFirstNameFromEmail(email: string): string {
  const localPart = email.split('@')[0]
  // Try to extract a name-like string (handle formats like john.doe, john_doe)
  const namePart = localPart.split(/[._\-+]/)[0]
  // Capitalize first letter
  return namePart.charAt(0).toUpperCase() + namePart.slice(1).toLowerCase()
}

/**
 * Parse CSV content and extract rows
 */
export function parseCSV(content: string): ParsedCSVResult {
  const warnings: string[] = []

  // Parse CSV with papaparse
  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim()
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(e => e.type === 'Quotes' || e.type === 'Delimiter')
    if (criticalErrors.length > 0) {
      return {
        success: false,
        error: `CSV parsing error: ${criticalErrors[0].message}`,
        rows: [],
        warnings: [],
        detectedColumns: {}
      }
    }
    // Non-critical errors become warnings
    parseResult.errors.forEach(e => {
      warnings.push(`Row ${e.row}: ${e.message}`)
    })
  }

  const headers = parseResult.meta.fields || []

  // Find columns using fuzzy matching
  const emailColumn = findColumn(headers, COLUMN_MAPPINGS.email)
  const firstNameColumn = findColumn(headers, COLUMN_MAPPINGS.firstName)
  const lastNameColumn = findColumn(headers, COLUMN_MAPPINGS.lastName)
  const fullNameColumn = findColumn(headers, COLUMN_MAPPINGS.fullName)

  if (!emailColumn) {
    return {
      success: false,
      error: `Could not find email column. Available columns: ${headers.join(', ')}. Expected one of: ${COLUMN_MAPPINGS.email.join(', ')}`,
      rows: [],
      warnings,
      detectedColumns: {}
    }
  }

  // We need either firstName, fullName, or we'll derive from email
  const hasNameColumn = firstNameColumn || fullNameColumn
  if (!hasNameColumn) {
    warnings.push('No name column found. First names will be derived from email addresses.')
  }

  const rows: ParsedRow[] = []

  for (let i = 0; i < parseResult.data.length; i++) {
    const row = parseResult.data[i]
    const rowNumber = i + 2 // +2 because header is row 1, and we're 0-indexed

    const email = row[emailColumn]?.trim().toLowerCase()

    if (!email) {
      warnings.push(`Row ${rowNumber}: Empty email, skipping`)
      continue
    }

    if (!isValidEmail(email)) {
      warnings.push(`Row ${rowNumber}: Invalid email format "${email}", skipping`)
      continue
    }

    // Determine first name
    let firstName: string
    if (firstNameColumn && row[firstNameColumn]) {
      firstName = row[firstNameColumn].trim()
    } else if (fullNameColumn && row[fullNameColumn]) {
      firstName = extractFirstName(row[fullNameColumn])
    } else {
      firstName = extractFirstNameFromEmail(email)
    }

    // Get last name if available
    let lastName: string | undefined
    if (lastNameColumn && row[lastNameColumn]) {
      lastName = row[lastNameColumn].trim()
    } else if (fullNameColumn && row[fullNameColumn]) {
      const parts = row[fullNameColumn].trim().split(/\s+/)
      if (parts.length > 1) {
        lastName = parts.slice(1).join(' ')
      }
    }

    rows.push({
      email,
      firstName,
      lastName,
      rowNumber
    })
  }

  return {
    success: true,
    rows,
    warnings,
    detectedColumns: {
      email: emailColumn,
      firstName: firstNameColumn,
      lastName: lastNameColumn,
      fullName: fullNameColumn
    }
  }
}

/**
 * Validate parsed rows for bulk import
 */
export async function validateBulkInvites(
  teamId: string,
  rows: ParsedRow[]
): Promise<BulkInviteValidationResult> {
  // Step 1: Deduplicate by email
  const emailMap = new Map<string, ParsedRow>()
  const duplicateEmails: string[] = []

  for (const row of rows) {
    if (emailMap.has(row.email)) {
      duplicateEmails.push(row.email)
    } else {
      emailMap.set(row.email, row)
    }
  }

  const uniqueRows = Array.from(emailMap.values())

  // Step 2: Check for existing team members/invites
  const existingInvites = await prisma.teamInvite.findMany({
    where: {
      teamId,
      email: { in: uniqueRows.map(r => r.email) }
    },
    select: { email: true }
  })

  const existingMembers = await prisma.person.findMany({
    where: {
      teamId,
      email: { in: uniqueRows.map(r => r.email) }
    },
    select: { email: true }
  })

  const existingEmailSet = new Set([
    ...existingInvites.map(i => i.email.toLowerCase()),
    ...existingMembers.filter(m => m.email).map(m => m.email!.toLowerCase())
  ])

  const existingEmails: string[] = []
  const readyToImport: ParsedRow[] = []

  for (const row of uniqueRows) {
    if (existingEmailSet.has(row.email)) {
      existingEmails.push(row.email)
    } else {
      readyToImport.push(row)
    }
  }

  // Step 3: Check seat availability
  const useSeatsModel = await isSeatsBasedTeam(teamId)
  let seatsAvailable = Infinity
  let hasEnoughSeats = true

  if (useSeatsModel) {
    const seatCheck = await canAddTeamMember(teamId)
    if (seatCheck.totalSeats !== undefined && seatCheck.currentSeats !== undefined) {
      seatsAvailable = seatCheck.totalSeats - seatCheck.currentSeats
      hasEnoughSeats = readyToImport.length <= seatsAvailable
    }
  }

  return {
    success: true,
    readyToImport,
    duplicatesRemoved: duplicateEmails.length,
    duplicateEmails,
    invalidEmailsSkipped: rows.length - uniqueRows.length - duplicateEmails.length,
    invalidEmails: [],
    existingMembersSkipped: existingEmails.length,
    existingEmails,
    seatsRequired: readyToImport.length,
    seatsAvailable: seatsAvailable === Infinity ? -1 : seatsAvailable, // -1 means unlimited
    hasEnoughSeats
  }
}

/**
 * Create bulk team invites
 */
export async function createBulkInvites(
  teamId: string,
  contextId: string,
  rows: ParsedRow[],
  baseUrl: string
): Promise<BulkInviteResult> {
  const useSeatsModel = await isSeatsBasedTeam(teamId)
  const creditsAllocated = useSeatsModel
    ? PRICING_CONFIG.seats.creditsPerSeat
    : PRICING_CONFIG.team.defaultInviteCredits

  const invites: BulkInviteResult['invites'] = []

  // Create invites in a transaction
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const token = randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      const invite = await tx.teamInvite.create({
        data: {
          email: row.email,
          firstName: row.firstName,
          teamId,
          token,
          expiresAt,
          creditsAllocated,
          contextId
        }
      })

      invites.push({
        id: invite.id,
        email: invite.email,
        firstName: invite.firstName,
        token: invite.token,
        inviteLink: `${baseUrl}/invite/${invite.token}`
      })
    }
  })

  return {
    success: true,
    imported: invites.length,
    invites
  }
}
