import io
from typing import BinaryIO

import boto3
from botocore.config import Config

from app.config import settings

_client = None


def get_s3_client():
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
    return _client


def upload_file(bucket: str, key: str, data: BinaryIO, content_type: str = "application/octet-stream") -> str:
    client = get_s3_client()
    client.upload_fileobj(data, bucket, key, ExtraArgs={"ContentType": content_type})
    base_url = settings.S3_PUBLIC_URL or settings.S3_ENDPOINT
    return f"{base_url}/{bucket}/{key}"


def upload_bytes(bucket: str, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    return upload_file(bucket, key, io.BytesIO(data), content_type)


def download_file(bucket: str, key: str) -> bytes:
    client = get_s3_client()
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read()


def generate_presigned_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )


def ensure_buckets_exist():
    client = get_s3_client()
    existing = {b["Name"] for b in client.list_buckets().get("Buckets", [])}
    for bucket in [settings.S3_BUCKET_UPLOADS, settings.S3_BUCKET_RESULTS]:
        if bucket not in existing:
            client.create_bucket(Bucket=bucket)
