import { Navigate } from "react-router-dom";
import { HeroSection } from "../components/HeroSection";
import { useAuthStore } from "../store/auth";

const Index = () => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) return <Navigate to="/lobby" />;

  const apiUrl = import.meta.env.PROD
    ? import.meta.env.VITE_API_URL
    : import.meta.env.VITE_API_URL_DEV;
  console.log("Using API URL:", apiUrl);

  return (
    <div className="h-screen bg-background">
      <HeroSection />
    </div>
  );
};

export default Index;
