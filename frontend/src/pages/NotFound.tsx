import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Crown } from "lucide-react";
import { Button } from "../components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-8 max-w-md">
        <div className="flex justify-center">
          <Crown className="w-16 h-16 text-muted-foreground opacity-50" />
        </div>

        <div className="space-y-4">
          <h1 className="heading-1 text-foreground">404</h1>
          <p className="body-text text-muted-foreground">
            This page doesn't exist.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => (window.location.href = "/")}
          className="interactive"
        >
          Return to Game
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
