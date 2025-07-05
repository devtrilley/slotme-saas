import { createContext, useContext, useState } from "react";

const FreelancerContext = createContext();

export function FreelancerProvider({ children }) {
  const [freelancer, setFreelancer] = useState(() => {
    const stored = localStorage.getItem("freelancer");
    return stored ? JSON.parse(stored) : null;
  });

  return (
    <FreelancerContext.Provider value={{ freelancer, setFreelancer }}>
      {children}
    </FreelancerContext.Provider>
  );
}

export function useFreelancer() {
  return useContext(FreelancerContext) || {};
}