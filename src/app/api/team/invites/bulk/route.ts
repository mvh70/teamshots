import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withTeamPermission } from '@/domain/access/permissions'
import { parseCSV, validateBulkInvites } from '@/domain/team/bulk-invite'
import { Logger } from '@/lib/logger'
import { getTranslation } from '@/lib/translations'
import JSZip from 'jszip'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

/**
 * POST /api/team/invites/bulk
 * Upload CSV/ZIP and get preview of bulk import
 */
export async function POST(request: NextRequest) {
  try {
    // Check permission to invite team members
    const permissionCheck = await withTeamPermission(
      request,
      'team.invite_members'
    )

    if (permissionCheck instanceof NextResponse) {
      return permissionCheck
    }

    const { session } = permissionCheck
    const locale = (session.user.locale || 'en') as 'en' | 'es'

    // Get user's team
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        person: {
          include: {
            team: {
              include: { activeContext: true }
            }
          }
        }
      }
    })

    if (!user?.person?.team) {
      return NextResponse.json(
        { error: getTranslation('api.errors.teamInvites.userNotInTeam', locale) },
        { status: 400 }
      )
    }

    const team = user.person.team

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Get file content
    let csvContent: string

    const fileName = file.name.toLowerCase()
    if (fileName.endsWith('.zip')) {
      // Handle ZIP file
      const arrayBuffer = await file.arrayBuffer()
      const zip = await JSZip.loadAsync(arrayBuffer)

      // Find first CSV file in ZIP
      let csvFile: JSZip.JSZipObject | null = null
      for (const [name, zipEntry] of Object.entries(zip.files)) {
        if (name.toLowerCase().endsWith('.csv') && !zipEntry.dir) {
          csvFile = zipEntry
          break
        }
      }

      if (!csvFile) {
        return NextResponse.json(
          { error: 'No CSV file found in ZIP archive' },
          { status: 400 }
        )
      }

      csvContent = await csvFile.async('string')
    } else if (fileName.endsWith('.csv')) {
      csvContent = await file.text()
    } else {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or ZIP file.' },
        { status: 400 }
      )
    }

    // Parse CSV
    const parseResult = parseCSV(csvContent)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error },
        { status: 400 }
      )
    }

    if (parseResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'No valid rows found in CSV file' },
        { status: 400 }
      )
    }

    // Validate for bulk import
    const validationResult = await validateBulkInvites(team.id, parseResult.rows)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      )
    }

    // Return preview
    return NextResponse.json({
      success: true,
      preview: {
        totalRowsParsed: parseResult.rows.length,
        readyToImport: validationResult.readyToImport.length,
        duplicatesRemoved: validationResult.duplicatesRemoved,
        existingMembersSkipped: validationResult.existingMembersSkipped,
        seatsRequired: validationResult.seatsRequired,
        seatsAvailable: validationResult.seatsAvailable,
        hasEnoughSeats: validationResult.hasEnoughSeats,
        previewRows: validationResult.readyToImport.slice(0, 5).map(r => ({
          email: r.email,
          firstName: r.firstName
        })),
        detectedColumns: parseResult.detectedColumns,
        warnings: parseResult.warnings.slice(0, 10) // Limit warnings shown
      },
      // Store parsed data for confirmation step (will be passed back)
      parsedData: validationResult.readyToImport.map(r => ({
        email: r.email,
        firstName: r.firstName
      }))
    })

  } catch (error) {
    Logger.error('Error in bulk invite preview', {
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json(
      { error: 'Failed to process file' },
      { status: 500 }
    )
  }
}
