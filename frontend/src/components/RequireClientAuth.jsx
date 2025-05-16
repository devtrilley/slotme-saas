import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireClientAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const isClientLoggedIn = localStorage.getItem("client_logged_in");
    if (!isClientLoggedIn) {
      navigate("/client-login");
    }
  }, [navigate]);

  return children;
}