from flask import Blueprint, request, jsonify
from utils.s3_utils import generate_presigned_url, S3_BUCKET, S3_REGION

s3_bp = Blueprint("s3", __name__)


@s3_bp.route("/s3/upload-url", methods=["POST"])
def get_upload_url():
    data = request.get_json()
    freelancer_id = data.get("freelancer_id")
    file_extension = data.get("file_extension", "jpg")
    content_type = data.get("content_type", "image/jpeg")

    if not freelancer_id:
        return jsonify({"error": "Missing freelancer_id"}), 400

    # Construct clean S3 key
    s3_key = f"freelancers/{freelancer_id}/logo.{file_extension}"

    url = generate_presigned_url(s3_key, content_type)
    if not url:
        return jsonify({"error": "Failed to generate upload URL"}), 500

    public_url = f"https://{S3_BUCKET}.s3.{S3_REGION}.amazonaws.com/{s3_key}"
    return jsonify({"upload_url": url, "public_url": public_url})
