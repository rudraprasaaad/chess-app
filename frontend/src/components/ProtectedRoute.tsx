import React, { useEffect, useRef } from "react";
import { useAuthStore } from "../store/auth";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { isAuthenticated } = useAuthStore();

  const toastShownRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated && !toastShownRef.current) {
      toast.error("You need to be logged in to access this page.", {
        duration: 3000,
      });
      toastShownRef.current = true;
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
