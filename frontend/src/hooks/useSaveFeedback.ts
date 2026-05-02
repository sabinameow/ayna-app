import { useCallback, useRef, useState } from "react";

export type SaveFeedbackStatus = "idle" | "saving" | "saved" | "error";

export function useSaveFeedback(resetDelay = 1600) {
  const [status, setStatus] = useState<SaveFeedbackStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingReset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleReset = useCallback(
    (nextStatus: SaveFeedbackStatus) => {
      clearPendingReset();
      setStatus(nextStatus);
      timeoutRef.current = setTimeout(() => {
        setStatus("idle");
        timeoutRef.current = null;
      }, resetDelay);
    },
    [clearPendingReset, resetDelay]
  );

  const markSaving = useCallback(() => {
    clearPendingReset();
    setStatus("saving");
  }, [clearPendingReset]);

  const markSaved = useCallback(() => scheduleReset("saved"), [scheduleReset]);
  const markError = useCallback(() => scheduleReset("error"), [scheduleReset]);
  const reset = useCallback(() => {
    clearPendingReset();
    setStatus("idle");
  }, [clearPendingReset]);

  return { status, markSaving, markSaved, markError, reset };
}

export function saveFeedbackLabel(
  status: SaveFeedbackStatus,
  idleLabel: string,
  savedLabel = "Saved",
  errorLabel = "Try again"
) {
  if (status === "saving") return "Saving...";
  if (status === "saved") return savedLabel;
  if (status === "error") return errorLabel;
  return idleLabel;
}
