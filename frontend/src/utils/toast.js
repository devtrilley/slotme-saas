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

  toast.innerHTML = `
    <span>${type !== "error" ? "💡" : "⚠️"} ${message}</span>
  `;

  const container = document.getElementById("toast-container");

  if (!container) {
    console.warn("Toast container not found!");
    return;
  }

  container.appendChild(toast);

  // 🔥 Animate in
  requestAnimationFrame(() => {
    toast.classList.remove("scale-95", "opacity-0");
    toast.classList.add("scale-100", "opacity-100");
  });

  // ⏳ Animate out + remove after `duration`
  setTimeout(() => {
    toast.classList.remove("scale-100", "opacity-100");
    toast.classList.add("scale-90", "opacity-0");
    setTimeout(() => {
      toast.remove();
    }, 300); // match duration-300
  }, duration);

  console.log("📢 Showing toast:", message);
}