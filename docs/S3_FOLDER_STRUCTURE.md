# S3 Folder Structure Overview

This document explains how files are organized in your S3 bucket (Backblaze B2, Hetzner, or AWS S3).

## Folder Structure

**Note**: If `S3_FOLDER` environment variable is set, all files will be stored under that folder prefix. This allows separating localhost/test files from production files in the same bucket.

### Without S3_FOLDER (Production)
```
your-bucket-name/
├── selfies/                    # User-uploaded selfie photos
│   └── {personId}/            # Organized by person ID
│       ├── {selfieId}.jpg      # Original selfie (e.g., "clx123.jpg")
│       └── {selfieId}-processed.png  # Background-removed version (if processed)
│
├── generations/                # AI-generated professional photos
│   └── {personId}/            # Organized by person ID
│       └── {generationId}/    # Each generation has its own folder
│           ├── variation-1.png # First variation (4 variations per generation)
│           ├── variation-2.png
│           ├── variation-3.png
│           └── variation-4.png
│
├── backgrounds/               # Custom background images for photo contexts
│   └── {personId}/           # Organized by person ID
│       └── {uuid}.{ext}       # Random UUID filename (e.g., "a1b2c3d4.jpg")
│
└── logos/                    # Team logos for branding
    └── {personId}/           # Organized by person ID
        └── {uuid}.{ext}      # Random UUID filename (e.g., "e5f6g7h8.png")
```

### With S3_FOLDER="localhost" (Development/Testing)
```
your-bucket-name/
└── localhost/                 # Folder prefix from S3_FOLDER env var
    ├── selfies/
    │   └── {personId}/
    │       └── ...
    ├── generations/
    │   └── {personId}/
    │       └── ...
    ├── backgrounds/
    │   └── {personId}/
    │       └── ...
    └── logos/
        └── {personId}/
            └── ...
```

**Example with S3_FOLDER="dev"**:
- Production files: `selfies/personId-firstName/selfieId.jpg`
- Dev files: `dev/selfies/personId-firstName/selfieId.jpg`

## Detailed File Paths

### 1. Selfies (`selfies/`)

**Path Format**: `selfies/{personId}-{firstName}/{selfieId}.{ext}`

**Example**: `selfies/clx123abc-john/clx456def.jpg`

**Structure**:
- **Folder**: Always `selfies/`
- **Subfolder**: Person ID + first name (e.g., `clx123abc-john`)
  - Person ID is extracted from the database `Person` table
  - First name is sanitized (lowercase, special characters replaced with hyphens)
  - Format: `{personId}-{firstName}`
- **Filename**: Selfie ID (from database `Selfie` table) + file extension
- **Extensions**: `.jpg`, `.jpeg`, `.png`, `.webp`

**Processed Versions**:
- If a selfie is processed for background removal, a processed version is stored as:
- `selfies/{personId}-{firstName}/{selfieId}-processed.png`
- The original file remains unchanged

**Example**:
```
selfies/clx123abc-john/
  ├── clx456def.jpg          # Original selfie
  └── clx456def-processed.png # Background-removed version
```

### 2. Generations (`generations/`)

**Path Format**: `generations/{personId}-{firstName}/{generationId}/variation-{i}.png`

**Example**: `generations/clx123abc-john/clx789xyz/variation-1.png`

**Structure**:
- **Folder**: Always `generations/`
- **Subfolder**: Person ID + first name (e.g., `clx123abc-john`)
  - Person ID is extracted from the database `Person` table
  - First name is sanitized (lowercase, special characters replaced with hyphens)
  - Format: `{personId}-{firstName}`
- **Sub-subfolder**: Generation ID (from database `Generation` table)
- **Filename**: `variation-{1-4}.png` (always PNG, always 4 variations)

**Example**:
```
generations/clx123abc-john/clx789xyz/
  ├── variation-1.png
  ├── variation-2.png
  ├── variation-3.png
  └── variation-4.png
```

**Note**: Each generation creates exactly 4 variations, stored as PNG files.

### 3. Backgrounds (`backgrounds/`)

**Path Format**: `backgrounds/{personId}/{uuid}.{ext}`

**Example**: `backgrounds/clx123abc/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`

**Structure**:
- **Folder**: Always `backgrounds/`
- **Subfolder**: Person ID
- **Filename**: Random UUID + file extension

**Used For**: Custom background images uploaded by users for photo contexts/styles.

### 4. Logos (`logos/`)

**Path Format**: `logos/{personId}/{uuid}.{ext}`

**Example**: `logos/clx123abc/b2c3d4e5-f6g7-8901-bcde-f23456789012.png`

**Structure**:
- **Folder**: Always `logos/`
- **Subfolder**: Person ID
- **Filename**: Random UUID + file extension

**Used For**: Team logos uploaded for branding on generated photos.

## Key Points

### S3 Folder Prefix (Optional)

You can set `S3_FOLDER` environment variable to add a prefix to all S3 keys. This is useful for:
- **Separating environments**: `localhost`, `staging`, `production`
- **Testing**: Keep test files separate from production files
- **Organization**: Group files by environment in the same bucket

**How it works**:
- Database stores **relative keys** (without folder prefix): `selfies/personId-firstName/selfieId.jpg`
- When accessing S3, the folder prefix is automatically prepended: `localhost/selfies/personId-firstName/selfieId.jpg`
- This is transparent to the application code - all S3 operations use `getS3Key()` helper

**Example**:
```env
# Production
S3_FOLDER=production

# Development
S3_FOLDER=localhost

# Staging
S3_FOLDER=staging
```

### Organization by Person ID

All files are organized by `personId` (the database ID from the `Person` table). This ensures:
- Easy access control (person-based permissions)
- Logical grouping of user files
- Simple cleanup when a person is deleted

### File Naming Conventions

1. **Selfies**: Use the selfie database ID as filename for easy lookup
2. **Generations**: Use generation ID as folder name, with numbered variations
3. **Backgrounds/Logos**: Use UUIDs to prevent conflicts

### File Extensions

- **Selfies**: Original extension preserved (`.jpg`, `.jpeg`, `.png`, `.webp`)
- **Processed Selfies**: Always `.png`
- **Generations**: Always `.png`
- **Backgrounds/Logos**: Original extension preserved

### Access Control

- All files are **private** by default (no public ACL)
- Files are accessed via **signed URLs** with expiration (typically 1 hour)
- Access is verified server-side before generating signed URLs
- Users can only access files they own or team members' files (if in same team)

## Database Relationship

The S3 keys (file paths) are stored in the database as **relative keys** (without folder prefix):

- **Selfies**: `Selfie.key` field contains the relative path (e.g., `selfies/personId-firstName/selfieId.jpg`)
- **Generations**: `Generation.generatedPhotoKeys` array contains relative paths (e.g., `generations/personId-firstName/generationId/variation-1.png`)
- **Generations**: `Generation.acceptedPhotoKey` contains the relative path of the selected variation
- **Contexts**: Background and logo keys stored as relative paths in context settings

**Important**: 
- The database stores keys **without** the `S3_FOLDER` prefix. The prefix is automatically added when accessing S3.
- The folder structure includes the person's first name (sanitized) for easier identification in S3: `{personId}-{firstName}`
- The personId is extracted from keys by taking the part before the first hyphen for security checks

## Migration Notes

When migrating from Hetzner to Backblaze:
- **Keep the same S3 keys** (folder structure and filenames)
- Only the bucket/endpoint changes, not the file paths
- Database records remain unchanged (they reference relative S3 keys, not bucket URLs)
- If using `S3_FOLDER`, ensure it's set consistently across environments

## Example Real-World Structure

```
teamshots-photos/
├── selfies/
│   ├── clx123abc-john/
│   │   ├── clx456def.jpg
│   │   ├── clx456def-processed.png
│   │   └── clx789ghi.jpg
│   └── clx999xyz-jane/
│       └── clx111aaa.jpg
│
├── generations/
│   ├── clx123abc-john/
│   │   ├── gen001/
│   │   │   ├── variation-1.png
│   │   │   ├── variation-2.png
│   │   │   ├── variation-3.png
│   │   │   └── variation-4.png
│   │   └── gen002/
│   │       ├── variation-1.png
│   │       └── ...
│   └── clx999xyz-jane/
│       └── gen003/
│           └── ...
│
├── backgrounds/
│   └── clx123abc/
│       └── a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
│
└── logos/
    └── clx123abc/
        └── b2c3d4e5-f6g7-8901-bcde-f23456789012.png
```

