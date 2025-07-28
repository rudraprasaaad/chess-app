import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../store/auth";
import { useCurrentUser } from "../../hooks/api/useAuth";
import { useEffect } from "react";
import { toast } from "sonner";

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
        <div className="flex flex-col items-center space-y-4">
          <svg
            className="animate-spin h-8 w-8 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p className="text-xl">Completing login...</p>
          <p className="text-sm text-gray-400">
            Please wait while we set up your session.
          </p>
        </div>
      ) : (
        <p className="text-xl">Processing authentication...</p>
      )}
    </div>
  );
};

export default AuthCallbackHandler;
