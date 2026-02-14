import sharp from 'sharp'

const SHARP_FORMAT_TO_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heif: 'image/heif'
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/heif': 'heif',
  'image/svg+xml': 'svg'
}

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  avif: 'image/avif',
  heif: 'image/heif',
  heic: 'image/heif',
  svg: 'image/svg+xml'
}

export function mimeTypeFromSharpFormat(format?: string): string {
  if (!format) return 'image/png'
  return SHARP_FORMAT_TO_MIME[format.toLowerCase()] ?? `image/${format.toLowerCase()}`
}

export function extensionFromMimeType(mimeType?: string): string {
  if (!mimeType) return 'png'
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] ?? 'png'
}

export function mimeTypeFromFileName(fileName: string): string {
  const extMatch = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)
  if (!extMatch) return 'image/png'
  return EXTENSION_TO_MIME[extMatch[1]] ?? 'image/png'
}

export async function detectImageFormat(buffer: Buffer): Promise<{ mimeType: string; extension: string }> {
  try {
    const metadata = await sharp(buffer).metadata()
    const mimeType = mimeTypeFromSharpFormat(metadata.format)
    return {
      mimeType,
      extension: extensionFromMimeType(mimeType)
    }
  } catch {
    return {
      mimeType: 'image/png',
      extension: 'png'
    }
  }
}
