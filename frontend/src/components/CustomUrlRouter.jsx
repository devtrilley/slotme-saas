import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "../utils/axiosInstance";
import { API_BASE } from "../utils/constants";

export default function CustomUrlRouter() {
  const { custom_url } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!custom_url) return;

    axios
      .get(`${API_BASE}/${custom_url}`)
      .then((res) => {
        const freelancerId = res.data.id;
        navigate(`/book/${appointment?.freelancer_id || freelancerId || ""}`);
      })
      .catch((err) => {
        const status = err.response?.status;

        if (status === 404 || status === 403) {
          console.warn(
            `❌ Custom URL '${custom_url}' not found or forbidden. Redirecting to /404.`
          );
          navigate("/404");
        } else {
          console.error("❌ Unexpected error resolving custom URL:", err);
        }
      });
  }, [custom_url, navigate]);

  return null;
}
