import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function RequireFreelancerAuth({ children }) {
  const navigate = useNavigate();

  useEffect(() => {
    const isFreelancerLoggedIn = localStorage.getItem("freelancer_logged_in");
    const freelancerId = localStorage.getItem("freelancer_id");
  
    if (!isFreelancerLoggedIn || !freelancerId) {
      navigate("/auth");
    }
  }, [navigate]);

  return children;
}
