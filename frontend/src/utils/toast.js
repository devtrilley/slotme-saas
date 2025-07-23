export function showToast(message, type = "success", duration = 6000) {
  const toast = document.createElement("div");

  const typeClassMap = {
    success: "alert-success",
    error: "alert-error",
    warning: "alert-warning",
    info: "alert-info",
  };

  const iconMap = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  toast.className = `
    alert 
    ${typeClassMap[type] || "alert-info"} 
    shadow-lg 
    transition-all 
    transform 
    scale-95 
    opacity-0 
    duration-300 
    flex items-center
  `.trim();

  const iconSpan = document.createElement("span");
  iconSpan.textContent = iconMap[type] || "💬";
  toast.appendChild(iconSpan);

  // Message text
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

  const closeButton = document.createElement("button");
  closeButton.textContent = "×";
  closeButton.className = "ml-auto btn btn-sm btn-circle btn-ghost text-lg";
  closeButton.onclick = () => {
    toast.classList.remove("scale-100", "opacity-100");
    toast.classList.add("scale-90", "opacity-0");
    setTimeout(() => toast.remove(), 300);
  };
  toast.appendChild(closeButton);

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