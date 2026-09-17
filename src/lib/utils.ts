// src/lib/utils.ts
// The class-name helper every shadcn/ui component expects.
//
// clsx joins conditional class names; tailwind-merge then resolves conflicts
// so that a later class wins (`cn("px-2", "px-4")` gives "px-4"). That second
// step is what lets a caller override a component's default classes by
// passing `className`, instead of both classes landing in the output and the
// winner depending on stylesheet order.
//
// FLAG: tailwind-merge is pinned to v2. Its v3 line only understands
// Tailwind v4 class names, and this project is on Tailwind v3.

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
