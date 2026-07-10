import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes intelligently - `cn(...)` is the only way classes get composed. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
