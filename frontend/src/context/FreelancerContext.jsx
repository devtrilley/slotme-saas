import { createContext, useContext, useState, useEffect } from "react";
import { getStoredFreelancer } from "../utils/getStoredFreelancer";

const FreelancerContext = createContext();

export function FreelancerProvider({ children }) {
  const [freelancer, setFreelancer] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false); // ✅ wait until localStorage is read

  useEffect(() => {
    const stored = getStoredFreelancer();
    if (stored) setFreelancer(stored);
    setIsLoaded(true); // ✅ flag ready
  }, []);

  // ✅ Reset context (called on logout)
  const clearFreelancer = () => {
    setFreelancer(null);
    [
      "freelancer",
      "access_token",
      "refresh_token", // ✅ NEW: Clear refresh token on logout
      "freelancer_logged_in",
      "freelancer_id",
      "freelancerDetails_updated",
      "client_id",
    ].forEach((key) => localStorage.removeItem(key));
  };

  return (
    <FreelancerContext.Provider
      value={{ freelancer, setFreelancer, clearFreelancer, isLoaded }}
    >
      {children}
    </FreelancerContext.Provider>
  );
}

export function useFreelancer() {
  return useContext(FreelancerContext) || {};
}
