interface SkeletonProps {
  className?: string;
}
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div className={`animate-pulse rounded-md bg-gray-200 dark:bg-gray-700 ${className}`} />
  );
}

// 预设骨架组合
export function CardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="p-3"><Skeleton className="h-4 w-24" /></td>
      <td className="p-3"><Skeleton className="h-4 w-32" /></td>
      <td className="p-3"><Skeleton className="h-4 w-16" /></td>
      <td className="p-3"><Skeleton className="h-4 w-20" /></td>
    </tr>
  );
}

export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
