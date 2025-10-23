import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireDevAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const devToken = localStorage.getItem("dev_access_token");
    if (!devToken) {
      navigate("/dev-login");
    }
  }, [navigate]);

  return children;
}