// src/utils/navigation.js
let navigateFn;

export const setNavigator = (navigate) => {
  // console.log("🧭 Navigator initialized");
  navigateFn = navigate;
};

export const redirectToAuth = () => {
  if (navigateFn) {
    navigateFn("/auth", { state: { sessionExpired: true } });
  } else {
    window.location.href = "/auth"; // Fallback
  }
};
