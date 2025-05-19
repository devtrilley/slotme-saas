export function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `alert ${type === "error" ? "alert-error" : "alert-success"} shadow-lg`;
  toast.innerHTML = `<span>${message}</span>`;

  const container = document.getElementById("toast-container");
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}