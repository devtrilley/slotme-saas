import React, { useEffect, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import BaseModal from "./BaseModal";
import axios from "../../utils/axiosInstance";
import axiosBase from "axios";
import { showToast } from "../../utils/toast";
import getCroppedImg from "../../utils/cropCanvas";

export default function LogoUploadModal({ show, onClose, onUploadComplete }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [zoom, setZoom] = useState(1.2);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const onCropComplete = useCallback((_, croppedArea) => {
    setCroppedAreaPixels(croppedArea);
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !croppedAreaPixels) return;
    setIsUploading(true);
    try {
      const croppedBlob = await getCroppedImg(
        URL.createObjectURL(selectedFile),
        croppedAreaPixels
      );
      if (!croppedBlob) {
        throw new Error("Failed to generate image blob");
      }

      console.log("🧪 Blob:", croppedBlob);
      console.log("🧪 Blob Type:", croppedBlob?.type);
      console.log("🧪 Blob Size:", croppedBlob?.size);

      const contentType = croppedBlob.type || "image/jpeg"; // default fallback
      const fileExt = contentType === "image/png" ? "png" : "jpg";
      const fileName = `logo_${Date.now()}.${fileExt}`;

      // 1. Get presigned URL
      const { data } = await axios.post("/s3/upload-url", {
        filename: fileName,
        content_type: contentType,
      });

      console.log("Blob type:", croppedBlob.type); // should be "image/jpeg" or "image/png"

      // 2. Upload to S3
      await axiosBase.put(data.upload_url, croppedBlob, {
        headers: { "Content-Type": contentType },
      });

      showToast("Logo uploaded!");
      onUploadComplete(data.public_url);
      handleClose();
    } catch (err) {
      console.error(err);
      showToast("Upload failed", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setZoom(1.2);
    setCrop({ x: 0, y: 0 });
    onClose();
  };

  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [show]);

  return (
    <BaseModal
      title="Upload Your Logo"
      open={show}
      onClose={handleClose}
      showCloseX
    >
      {!selectedFile ? (
        <div className="space-y-2 text-center">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files[0])}
            className="file-input w-full max-w-xs mx-auto"
          />
          <p className="text-xs text-zinc-400">
            Upload your profile photo or logo. It will appear on your public
            booking page.
          </p>
        </div>
      ) : (
        <>
          <div className="relative w-full h-64 bg-gray-200 rounded">
            <Cropper
              image={URL.createObjectURL(selectedFile)}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="range range-xs my-3"
          />

          <div className="flex justify-between gap-4">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setSelectedFile(null)}
            >
              Choose Another
            </button>
            <button
              className="btn bg-primary text-white btn-sm"
              onClick={handleUpload}
              disabled={isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </>
      )}
    </BaseModal>
  );
}
