import { Navigate } from "react-router-dom";
import { HeroSection } from "../components/HeroSection";
import { useAuthStore } from "../store/auth";

const Index = () => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) return <Navigate to="/lobby" />;

  const isProduction = import.meta.env.NODE_ENV === "production";
  console.log(
    "Using API URL:",
    isProduction
      ? import.meta.env.VITE_API_URL
      : import.meta.env.VITE_API_URL_DEV
  );

  return (
    <div className="h-screen bg-background">
      <HeroSection />
    </div>
  );
};

export default Index;
