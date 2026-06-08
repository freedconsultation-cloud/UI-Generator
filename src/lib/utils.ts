// Utility helpers shared across the application

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// cn — merges Tailwind CSS class names, resolving conflicts intelligently.
// clsx handles conditional/array/object class expressions;
// twMerge deduplicates conflicting Tailwind utilities (e.g. "p-2 p-4" → "p-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
