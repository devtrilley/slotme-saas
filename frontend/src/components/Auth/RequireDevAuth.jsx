import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireDevAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("dev_logged_in");
    if (!isLoggedIn) {
      navigate("/dev-login");
    }
  }, [navigate]);

  return children;
}