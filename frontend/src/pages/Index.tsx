import { Navigate } from "react-router-dom";
import { HeroSection } from "../components/HeroSection";
import { useAuthStore } from "../store/auth";

const Index = () => {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) return <Navigate to="/lobby" />;

  return (
    <div className="h-screen bg-background">
      <HeroSection />
    </div>
  );
};

export default Index;
