"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TenderProvider } from "@/lib/tender/client";

/**
 * App-wide client providers, mounted once by the root layout: the Tender engine store
 * (so every market keeps its state across navigations), tooltip timing, and the toast stack.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TenderProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </TenderProvider>
  );
}
