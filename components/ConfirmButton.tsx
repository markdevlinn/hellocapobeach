"use client";

import { useEffect, useState } from "react";

/**
 * A button for actions that are hard to undo. The first tap asks, the second tap does it.
 * It goes back to normal after a few seconds if left alone.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Tap again to confirm",
  onConfirm,
  className = "link danger",
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 5000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
