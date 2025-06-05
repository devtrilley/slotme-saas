import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireFreelancerAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      navigate("/auth");
    }
  }, [navigate]);

  return children;
}