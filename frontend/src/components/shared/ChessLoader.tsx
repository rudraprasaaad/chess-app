import { Crown, Shield } from "lucide-react";

interface ChessLoaderProps {
  message?: string;
}

export const ChessLoader = ({
  message = "Calibrating the opening…",
}: ChessLoaderProps) => {
  return (
    <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20 rounded-3xl">
      <div className="flex flex-col items-center space-y-6">
        <div className="relative">
          <div className="flex items-center space-x-4">
            <Crown
              className="w-8 h-8 text-foreground animate-pulse"
              style={{ animationDelay: "0ms", animationDuration: "2s" }}
            />
            <Shield
              className="w-10 h-10 text-foreground animate-pulse"
              style={{ animationDelay: "400ms", animationDuration: "2s" }}
            />
            <Crown
              className="w-8 h-8 text-foreground animate-pulse"
              style={{ animationDelay: "800ms", animationDuration: "2s" }}
            />
          </div>

          <div className="absolute inset-0 -m-6 border border-foreground/20 rounded-full animate-spin-slow"></div>
        </div>
        <p className="text-sm text-muted-foreground font-medium tracking-wide animate-fade-in">
          {message}
        </p>
      </div>
    </div>
  );
};
