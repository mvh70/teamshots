# S3 Setup for Teamshots

## Required Environment Variables

Add these environment variables to your `.env` file:

```env
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
AWS_S3_BUCKET_NAME=your-bucket-name-here
```

## S3 Bucket Structure

The application expects the following folder structure in your S3 bucket:

```
your-bucket-name/
├── backgrounds/          # Custom background images for contexts
├── selfies/             # User uploaded selfie photos
├── logos/               # Team logos for contexts
└── generations/         # Generated professional photos
```

## S3 Bucket Configuration

1. **Create an S3 bucket** with a unique name
2. **Set up CORS policy** to allow uploads from your domain:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://yourdomain.com", "http://localhost:3000"],
        "ExposeHeaders": []
    }
]
```

3. **Set bucket permissions** to allow public read access for uploaded files
4. **Create IAM user** with the following policy:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## File Upload Flow

1. **User selects files** in the context creation form
2. **Files are uploaded to S3** via `/api/upload` endpoint
3. **S3 URLs are stored** in the database context records
4. **Files are organized** by folder type (backgrounds, logos, etc.)

## Security Notes

- Files are uploaded with `public-read` ACL for easy access
- Unique filenames are generated using UUIDs to prevent conflicts
- File types are validated on the frontend (image/* only)
- Upload endpoint requires authentication
