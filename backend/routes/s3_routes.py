from flask import Blueprint, request, jsonify
from utils.s3_utils import generate_presigned_url, S3_BUCKET, S3_REGION

s3_bp = Blueprint("s3", __name__)


@s3_bp.route("/s3/upload-url", methods=["POST"])
def get_upload_url():
    data = request.get_json()
    filename = data.get("filename")
    content_type = data.get("content_type", "image/jpeg")

    if not filename:
        return jsonify({"error": "Missing filename"}), 400

    url = generate_presigned_url(filename, content_type)
    if not url:
        return jsonify({"error": "Failed to generate upload URL"}), 500

    public_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{filename}"
    return jsonify({"upload_url": url, "public_url": public_url})
