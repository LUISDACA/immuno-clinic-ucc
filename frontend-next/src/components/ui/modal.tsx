"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Native modality makes the background inert; Tab edges cycle inside the dialog. */
export function Modal({
  children,
  titleId,
  descriptionId,
  onClose,
  busy = false,
  initialFocusSelector = "button:not(:disabled)",
  className,
}: {
  children: ReactNode;
  titleId: string;
  descriptionId?: string;
  onClose: () => void;
  busy?: boolean;
  initialFocusSelector?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(initialFocusSelector)?.focus();
    return () => {
      dialog.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [initialFocusSelector]);

  useLayoutEffect(() => {
    const dialog = ref.current!;
    if (busy) dialog.focus();
    else if (document.activeElement === dialog) {
      dialog.querySelector<HTMLElement>(initialFocusSelector)?.focus();
    }
  }, [busy, initialFocusSelector]);

  return (
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={busy || undefined}
      className={cn(
        "fixed inset-0 m-auto h-fit max-h-[92dvh] w-[calc(100%_-_2rem)] max-w-xl overflow-y-auto rounded-2xl border border-[color:var(--divider)] bg-card p-5 text-card-foreground shadow-2xl backdrop:bg-[#02090a]/85",
        className,
      )}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const dialog = event.currentTarget;
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
          "button, [href], input, select, textarea, [tabindex]",
        )).filter((element) => element.tabIndex >= 0 &&
          !element.matches(":disabled") && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first) {
          event.preventDefault();
          dialog.focus();
        } else if (document.activeElement === dialog ||
            (event.shiftKey && document.activeElement === first) ||
            (!event.shiftKey && document.activeElement === last)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        }
      }}
      onClick={(event) => {
        if (busy || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) {
          onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
