import { cn } from "@/lib/utils"

// Local edit to the shadcn/ui source: `bg-primary/10` became `bg-muted`.
// Primary is blue in this design, and a blue-tinted placeholder would read
// as an active state rather than as content still loading.
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
