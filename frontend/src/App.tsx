import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/sonner";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Lobby from "./pages/Lobby";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthCallbackHandler from "./components/auth/AuthCallbackHandler";
import GameRoom from "./pages/GameRoom";
import { WebSocketManager } from "./components/websocket/WebSocketManager";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "glass border-border/30",
          style: {
            background: "hsla(var(--card), 0.8)",
            backdropFilter: "blur(20px)",
            border: "1px solid hsla(var(--border), 0.3)",
            color: "hsl(var(--foreground))",
          },
        }}
        expand={true}
        richColors={true}
      />
      <WebSocketManager />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route
            path="/auth/google/callback"
            element={<AuthCallbackHandler />}
          />
          <Route path="/game/:gameId" element={<GameRoom />} />
          <Route
            path="/lobby"
            element={
              <ProtectedRoute>
                <Lobby />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
