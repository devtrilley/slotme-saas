// This wraps a page and only allows access if isDevAdmin is set in localStorage

import { Navigate } from "react-router-dom";

export default function DevProtectedRoute({ children }) {
  const isAuthenticated = localStorage.getItem("isDevAdmin") === "true";

  return isAuthenticated ? children : <Navigate to="/dev-login" />;
}