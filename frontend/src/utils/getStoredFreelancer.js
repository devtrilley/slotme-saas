export function getStoredFreelancer() {
  try {
    const raw = localStorage.getItem("freelancer");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("⚠️ Bad freelancer data. Clearing it.");
    localStorage.removeItem("freelancer");
    return null;
  }
}
