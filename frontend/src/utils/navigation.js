// src/utils/navigation.js
let navigateFn;

export const setNavigator = (navigate) => {
  navigateFn = navigate;
};

export const redirectToAuth = () => {
  if (navigateFn) {
    navigateFn("/auth", { state: { sessionExpired: true } });
  } else {
    window.location.href = "/auth"; // Fallback
  }
};
