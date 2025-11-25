import React, { useEffect, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import BaseModal from "./BaseModal";
import axios from "../../utils/axiosInstance";
import axiosBase from "axios";
import { showToast } from "../../utils/toast";
import getCroppedImg from "../../utils/cropCanvas";

import { useFreelancer } from "../../context/FreelancerContext";

export default function LogoUploadModal({
  show,
  onClose,
  onUploadComplete,
  currentLogo,
}) {
  const { freelancer } = useFreelancer();
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

      

      const contentType = croppedBlob.type || "image/jpeg";
      const fileExt = contentType === "image/png" ? "png" : "jpg";

      // 1. Get presigned URL with freelancer_id
      const { data } = await axios.post("/s3/upload-url", {
        freelancer_id: freelancer.id,
        file_extension: fileExt,
        content_type: contentType,
      });

      

      // 2. Upload to S3
      await axiosBase.put(data.upload_url, croppedBlob, {
        headers: { "Content-Type": contentType },
      });

      onUploadComplete(data.public_url);
      handleClose();
    } catch (err) {
      console.error(err);
      showToast("Upload failed. Try again or use smaller file.", "error");
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
        <div className="space-y-3 text-center">
          {currentLogo && (
            <div className="space-y-1">
              <div className="flex justify-center">
                <img
                  src={currentLogo}
                  alt="Current Logo"
                  className="w-20 h-20 rounded-full object-cover mx-auto border shadow-md"
                />
              </div>
              <p className="text-sm text-zinc-400 text-center italic">
                Current Logo
              </p>
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files[0];
              if (!file) return;

              const maxSize = 40 * 1024 * 1024; // 40MB
              if (file.size > maxSize) {
                showToast("File too large. Max 40MB.", "error");
                return;
              }

              setSelectedFile(file);
            }}
            className="file-input w-full max-w-xs mx-auto"
          />

          <p className="text-xs text-zinc-400">
            Upload your profile photo or logo. Max size: 40MB.
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
