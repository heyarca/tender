import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must know the custom type scale from globals.css,
 * otherwise `text-body` and `text-muted-foreground` are treated as conflicting.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "body",
        "button",
        "caption",
        "overline",
        "micro",
        "2xs",
        "title",
        "display",
        "section",
        "heading",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
