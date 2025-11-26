import boto3
from botocore.client import Config

# Configure the S3 client for Hetzner
s3 = boto3.client(
    's3',
    endpoint_url='https://nbg1.your-objectstorage.com',
    aws_access_key_id='GR1SI42EWCNJ7GFX4LKW',
    aws_secret_access_key='FzgvPELmauAVJhPjp5ovynKBkDMmONKa6jF1CFW4',
    config=Config(signature_version='s3v4'),
    region_name='eu-central'
)

# CORS configuration for all production domains
cors_configuration = {
    'CORSRules': [
        {
            'AllowedOrigins': [
                # Local development
                'http://localhost:3000',
                'https://localhost:3000',
                'http://127.0.0.1:3000',
                'https://127.0.0.1:3000',
                # Team domain (teamshotspro.com)
                'https://teamshotspro.com',
                'https://www.teamshotspro.com',
                # Individual domain (photoshotspro.com)
                'https://photoshotspro.com',
                'https://www.photoshotspro.com',
                # Legacy domains (keep for backwards compatibility)
                'https://app.teamshots.vip',
                'https://www.teamshots.vip'
            ],
            'AllowedMethods': ['GET', 'PUT', 'POST'],
            'AllowedHeaders': ['*'],
            'ExposeHeaders': ['ETag', 'x-amz-request-id', 'x-amz-id-2'],
            'MaxAgeSeconds': 600
        }
    ]
}

# Set CORS
try:
    s3.put_bucket_cors(
        Bucket='teamshots',
        CORSConfiguration=cors_configuration
    )
    print("CORS configuration set successfully!")
    
    # Get CORS to verify
    response = s3.get_bucket_cors(Bucket='teamshots')
    print("Current CORS configuration:", response['CORSRules'])

except Exception as e:
    print(f"Error: {e}")
