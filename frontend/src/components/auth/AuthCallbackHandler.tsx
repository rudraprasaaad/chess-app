import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";
import { useCurrentUser } from "../../hooks/api/useAuth";
import { useEffect } from "react";
import { toast } from "sonner";
import { ChessLoader } from "../shared/ChessLoader";

const AuthCallbackHandler = () => {
  const navigate = useNavigate();
  const { setLoading } = useAuthStore();

  const location = useLocation();

  const {
    data: currentUserData,
    isLoading: isFetchingUser,
    isSuccess: isUserFetched,
    isError: isUserFetchError,
    error: userFetchError,
  } = useCurrentUser();

  useEffect(() => {
    setLoading(isFetchingUser);

    if (isUserFetched && currentUserData) {
      toast.success(`Welcome, ${currentUserData.name.trim()}!`);
      navigate("/lobby", { replace: true });
    } else if (isUserFetchError) {
      const errorMessage =
        userFetchError instanceof Error
          ? userFetchError.message
          : "Google Login failed: Could not retrieve user session.";
      toast.error(errorMessage);
      navigate("/", { replace: true });
    }
  }, [
    currentUserData,
    isFetchingUser,
    isUserFetched,
    isUserFetchError,
    userFetchError,
    setLoading,
    navigate,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.has("error")) {
      const backendError = params.get("error");
      toast.error(`Google login error: ${backendError}`);
      navigate("/", { replace: true });
    }
  }, [location.search, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      {isFetchingUser ? (
        <ChessLoader />
      ) : (
        <p className="text-xl">Processing authentication...</p>
      )}
    </div>
  );
};

export default AuthCallbackHandler;
