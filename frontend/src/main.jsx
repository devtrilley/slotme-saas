// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import { FreelancerProvider } from "./context/FreelancerContext";
import ErrorBoundary from "./components/ErrorBoundary"; // ✅ import your error boundary
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary> {/* ✅ wrap the entire app */}
      <BrowserRouter>
        <FreelancerProvider>
          <App />
        </FreelancerProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);