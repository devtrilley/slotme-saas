export default async function getCroppedImg(imageSrc, crop) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // required to prevent CORS taint
    img.src = imageSrc;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject("Image load error");
  });

  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject("Failed to create blob – possible CORS taint or canvas error");
      } else {
        resolve(blob);
      }
    }, "image/jpeg");
  });
}
