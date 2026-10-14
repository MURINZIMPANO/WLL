import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names, letting later Tailwind utilities win over earlier ones.
 *
 * Plain `clsx` is not enough: a consumer passing `className="px-2"` to a
 * component whose base already sets `px-6` would otherwise get both, and
 * padding would depend on stylesheet order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
