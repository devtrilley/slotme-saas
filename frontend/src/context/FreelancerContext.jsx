import { createContext, useContext, useState } from "react";
import { getStoredFreelancer } from "../utils/getStoredFreelancer";

const FreelancerContext = createContext();

export function FreelancerProvider({ children }) {
  const [freelancer, setFreelancer] = useState(getStoredFreelancer());

  return (
    <FreelancerContext.Provider value={{ freelancer, setFreelancer }}>
      {children}
    </FreelancerContext.Provider>
  );
}

export function useFreelancer() {
  return useContext(FreelancerContext) || {};
}
