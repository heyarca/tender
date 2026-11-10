"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { startOver } from "./credits-store";

/** "Start over": confirms, then gives this browser a new, empty account. */
export function StartOverButton({ variant = "outline", size, className }: Pick<ButtonProps, "variant" | "size" | "className">) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setPending(true);
    setError(null);
    try {
      await startOver();
      setOpen(false);
      toast({ tone: "positive", title: "You have a new, empty account" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not start over. Try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={() => setOpen(true)} data-slot="start-over">
        <RotateCcw aria-hidden="true" />
        Start over
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="sm"
          title="Start over?"
          description="This browser gets a new account with a $0.00 balance. The current balance and API keys stay with the old account."
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="primary" onClick={confirm} disabled={pending}>
                {pending ? "Starting over…" : "Start over"}
              </Button>
            </>
          }
        >
          {error ? (
            <DialogBody>
              <p role="alert" className="text-caption text-negative-text">
                {error}
              </p>
            </DialogBody>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
