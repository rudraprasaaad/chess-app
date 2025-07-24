import { cn } from "../../lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  shimmer?: boolean;
}

export function Skeleton({
  className,
  shimmer = true,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "glass rounded-lg",
        shimmer
          ? "animate-shimmer bg-gradient-to-r from-transparent via-primary/10 to-transparent bg-[length:200%_100%]"
          : "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

// Specialized skeleton components for your chess app
export function LobbyHeaderSkeleton() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-12">
      <div className="mb-6 md:mb-0">
        <Skeleton className="h-12 w-64 mb-2" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-20 rounded-full" />
        <Skeleton className="h-10 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function QuickActionsSkeleton() {
  return (
    <div className="mb-12">
      <Skeleton className="h-6 w-32 mb-6" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export function GameCardSkeleton() {
  return (
    <div className="glass-intense rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-3 w-3 rounded-full" />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-full rounded-full" />
      </div>
    </div>
  );
}

export function GamesGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-16" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }).map((_, index) => (
          <GameCardSkeleton key={index} />
        ))}
      </div>
    </div>
  );
}

export function AuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-4">
        <Skeleton className="w-16 h-16 rounded-full mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    </div>
  );
}

export function GameCardLoadingSkeleton() {
  return (
    <div className="glass-intense glow-primary rounded-2xl border-border/20 p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="w-3 h-3 rounded-full" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
