import { motion } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "../ui/button";
import { Crown, LogOut, ChevronRight, Home } from "lucide-react";
import { useLogout } from "../../hooks/api/useAuth";

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isGameRoom = location.pathname.startsWith("/game/");
  const isLobby = location.pathname === "/lobby";

  const breadcrumbs = [
    { label: "Chess", path: "/", icon: Crown },
    ...(isLobby ? [{ label: "Lobby", path: "/lobby", icon: Home }] : []),
    ...(isGameRoom
      ? [
          { label: "Lobby", path: "/lobby", icon: Home },
          { label: "Game Room", path: location.pathname, icon: Crown },
        ]
      : []),
  ];

  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-4">
            <motion.button
              onClick={() => navigate("/")}
              className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Crown className="w-6 h-6 text-chess-gold" />
              <span className="font-heading font-semibold text-lg tracking-tight">
                Chess
              </span>
            </motion.button>

            {breadcrumbs.length > 1 && (
              <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
                {breadcrumbs.map((crumb, index) => (
                  <div key={crumb.path} className="flex items-center space-x-2">
                    {index > 0 && <ChevronRight className="w-3 h-3" />}
                    <motion.button
                      onClick={() => navigate(crumb.path)}
                      className="flex items-center space-x-1.5 hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/30"
                      whileHover={{ scale: 1.02 }}
                    >
                      <crumb.icon className="w-3.5 h-3.5" />
                      <span className="font-medium">{crumb.label}</span>
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {isGameRoom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden lg:flex items-center space-x-3 px-4 py-2 glass rounded-full border border-white/10"
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                Live Game
              </span>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 group"
            >
              <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-300" />
              <span className="hidden sm:inline font-medium">Logout</span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  );
};
