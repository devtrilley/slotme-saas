import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

export default function PageTransition({ children }) {
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);
  
  // Detect navigation direction from sessionStorage
  const isBack = sessionStorage.getItem("slotmeNavFlag") === "back";
  
  useEffect(() => {
    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  const animationClass = isBack ? "page-slide-back" : "page-slide-forward";

  return (
    <div key={location.pathname} className={animationClass}>
      {children}
    </div>
  );
}