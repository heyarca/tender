"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Dialog root. Re-export of Base UI `Dialog.Root`
 * (`open`, `defaultOpen`, `onOpenChange`, `modal`, `handle`, …).
 */
export const Dialog = BaseDialog.Root;
/** Button that opens the dialog. Use `render` to compose with your own button. */
export const DialogTrigger = BaseDialog.Trigger;
/** Unstyled button that closes the dialog. Use `render` to compose with your own button. */
export const DialogClose = BaseDialog.Close;
/** Creates a handle that opens a dialog from a detached trigger or imperatively. */
export const createDialogHandle = BaseDialog.createHandle;

export type DialogProps = BaseDialog.Root.Props;
export type DialogSize = "sm" | "md" | "lg" | "xl";
export type DialogPlacement = "center" | "top";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export interface DialogContentProps
  extends Omit<BaseDialog.Popup.Props, "className" | "children" | "title"> {
  /** Panel width. `md` (max-w-lg, 512px) by default. */
  size?: DialogSize;
  /** `center` (default) or `top` (12vh from the top, for search and command surfaces). */
  placement?: DialogPlacement;
  /** Renders a header with a title. Omit it and render `DialogTitle` yourself for custom layouts. */
  title?: React.ReactNode;
  /** Muted line under the title. */
  description?: React.ReactNode;
  /** Footer row, right-aligned on desktop (for example a cancel and a primary button). */
  footer?: React.ReactNode;
  /** Shows the close (×) button in the top-right corner. Default `true`. */
  showCloseButton?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Portal, backdrop, and panel of a dialog.
 *
 * @example
 * <Dialog open={open} onOpenChange={setOpen}>
 *   <DialogContent title="Reset policy" description="Restore the default limits." footer={…}>
 *     <DialogBody>…</DialogBody>
 *   </DialogContent>
 * </Dialog>
 */
export function DialogContent({
  size = "md",
  placement = "center",
  title,
  description,
  footer,
  showCloseButton = true,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-foreground/20 transition-opacity duration-quick ease-smooth-out data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute" />
      <BaseDialog.Viewport
        className={cn(
          "fixed inset-0 z-50 flex justify-center overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6",
          placement === "top" ? "items-start pt-[12vh]" : "items-center pt-4 sm:pt-6",
        )}
      >
        <BaseDialog.Popup
          className={cn(
            // shadow-popover includes a 1px ink/8% ring, which draws the panel border.
            "relative flex w-full min-w-0 flex-col rounded-xl bg-card text-card-foreground shadow-popover outline-none",
            "transition-[opacity,scale] duration-quick ease-smooth-out data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none",
            SIZE_CLASS[size],
            className,
          )}
          {...props}
        >
          {title || description ? (
            <DialogHeader className={showCloseButton ? "pr-12" : undefined}>
              {title ? <DialogTitle>{title}</DialogTitle> : null}
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
          ) : null}
          {children}
          {footer ? <DialogFooter>{footer}</DialogFooter> : null}
          {showCloseButton ? <DialogCloseButton className="absolute top-3.5 right-3.5" /> : null}
        </BaseDialog.Popup>
      </BaseDialog.Viewport>
    </BaseDialog.Portal>
  );
}

/** Title and description stack at the top of the panel. */
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 px-5 pt-5 pb-4", className)} {...props} />;
}

/** Accessible dialog title (`h2`). */
export function DialogTitle({ className, ...props }: Omit<BaseDialog.Title.Props, "className"> & { className?: string }) {
  return (
    <BaseDialog.Title
      className={cn("text-base leading-snug font-semibold tracking-[-0.01em] text-foreground", className)}
      {...props}
    />
  );
}

/** Muted description linked to the dialog with `aria-describedby`. */
export function DialogDescription({
  className,
  ...props
}: Omit<BaseDialog.Description.Props, "className"> & { className?: string }) {
  return (
    <BaseDialog.Description
      className={cn("text-body leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

/** Main content area with panel padding. */
export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-w-0 px-5 pb-5 text-body text-foreground", className)} {...props} />;
}

/** Bottom action row. Stacks on mobile, right-aligned from `sm`. */
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 rounded-b-xl border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
      {...props}
    />
  );
}

/** Icon button (×) that closes the dialog. */
export function DialogCloseButton({
  className,
  "aria-label": ariaLabel = "Close",
  ...props
}: Omit<BaseDialog.Close.Props, "className" | "children"> & { className?: string }) {
  return (
    <BaseDialog.Close
      aria-label={ariaLabel}
      className={cn(
        "inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors duration-quick hover:bg-muted hover:text-foreground focus-visible:border-focus-border focus-visible:shadow-focus focus-visible:outline-none",
        className,
      )}
      {...props}
    >
      <X className="size-4" strokeWidth={2} aria-hidden />
    </BaseDialog.Close>
  );
}
