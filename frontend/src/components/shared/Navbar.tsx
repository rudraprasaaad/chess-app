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
      className="sticky top-0 left-0 right-0 z-50 glass border-b border-white/10 backdrop-blur-md"
    >
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8"
        style={{ maxWidth: "1318px" }}
      >
        <div
          className="flex items-center justify-between"
          style={{ height: "4.12rem" }}
        >
          {/* Left Section - Logo and Breadcrumbs */}
          <div className="flex items-center space-x-3 lg:space-x-4 min-w-0 flex-1">
            <motion.button
              onClick={() => navigate("/")}
              className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Crown className="w-5 h-5 text-chess-gold" />
              <span className="font-heading font-semibold text-base tracking-tight">
                Chess
              </span>
            </motion.button>

            {/* Breadcrumbs */}
            {breadcrumbs.length > 1 && (
              <div className="hidden md:flex items-center space-x-1.5 text-sm text-muted-foreground min-w-0">
                {breadcrumbs.map((crumb, index) => (
                  <div
                    key={crumb.path}
                    className="flex items-center space-x-1.5 min-w-0"
                  >
                    {index > 0 && (
                      <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    )}
                    <motion.button
                      onClick={() => navigate(crumb.path)}
                      className="flex items-center space-x-1 hover:text-foreground transition-colors px-1.5 py-0.5 rounded-md hover:bg-muted/30 min-w-0"
                      whileHover={{ scale: 1.02 }}
                    >
                      <crumb.icon className="w-3 h-3 flex-shrink-0" />
                      <span className="font-medium truncate text-xs">
                        {crumb.label}
                      </span>
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Center Section - Live Game Indicator */}
          {isGameRoom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="hidden lg:flex items-center space-x-2 px-3 py-1.5 glass rounded-full border border-white/10 mx-3"
            >
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-medium text-foreground whitespace-nowrap">
                Live Game
              </span>
            </motion.div>
          )}

          {/* Right Section - Logout Button */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-shrink-0"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 group px-3"
              style={{ height: "2.4rem" }}
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform duration-300" />
              <span className="hidden sm:inline font-medium text-xs">
                Logout
              </span>
            </Button>
          </motion.div>
        </div>
      </div>
    </motion.nav>
  );
};
