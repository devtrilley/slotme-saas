import boto3
from botocore.exceptions import ClientError
import os
from datetime import datetime, timedelta

# Load from environment variables
S3_BUCKET = os.getenv("S3_BUCKET_NAME")
S3_REGION = os.getenv("S3_REGION", "us-east-2")

s3_client = boto3.client("s3", region_name=S3_REGION)


def generate_presigned_url(filename, content_type="image/jpeg", expires_in=300):
    try:
        response = s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": S3_BUCKET, "Key": filename, "ContentType": content_type},
            ExpiresIn=expires_in,
            HttpMethod="PUT",
        )
        return response
    except ClientError as e:
        print("Error generating presigned URL:", e)
        return None
