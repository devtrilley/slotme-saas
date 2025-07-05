export function showToast(message, type = "success", duration = 6000) {
  const toast = document.createElement("div");
  toast.className = `
    alert 
    ${type === "error" ? "alert-error" : "alert-success"} 
    shadow-lg 
    transition-all 
    transform 
    scale-95 
    opacity-0 
    duration-300
  `.trim();

  const iconSpan = document.createElement("span");
  iconSpan.textContent = type !== "error" ? "💡" : "⚠️";
  toast.appendChild(iconSpan);

  if (typeof message === "string") {
    const textNode = document.createTextNode(" " + message);
    toast.appendChild(textNode);
  } else if (message instanceof Node) {
    toast.appendChild(message);
  } else {
    console.warn("Unsupported toast message type:", message);
    const fallback = document.createTextNode(" Unexpected error");
    toast.appendChild(fallback);
  }

  const container = document.getElementById("toast-container");

  if (!container) {
    console.warn("Toast container not found!");
    return;
  }

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("scale-95", "opacity-0");
    toast.classList.add("scale-100", "opacity-100");
  });

  setTimeout(() => {
    toast.classList.remove("scale-100", "opacity-100");
    toast.classList.add("scale-90", "opacity-0");
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, duration);

  console.log("📢 Showing toast:", message);
}