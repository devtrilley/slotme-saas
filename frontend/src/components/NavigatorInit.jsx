// NavigatorInit.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { setNavigator } from "../utils/navigation";

export default function NavigatorInit() {
  const navigate = useNavigate();

  useEffect(() => {
    setNavigator(navigate); // ✅ gives navigation.js the real router instance
  }, [navigate]);

  return null; // doesn't render anything
}