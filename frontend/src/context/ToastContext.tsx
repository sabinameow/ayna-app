import React, { createContext, useContext, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ToastVariant = "success" | "error" | "info";

type ToastState = {
  message: string;
  variant: ToastVariant;
} | null;

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const TOAST_COLORS: Record<ToastVariant, { bg: string; border: string }> = {
  success: { bg: "#E8F7EE", border: "#38A169" },
  error: { bg: "#FFF4F4", border: "#E25555" },
  info: { bg: "#F3EEFF", border: "#7C6CF3" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function hideToast() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }

  function showToast(message: string, variant: ToastVariant = "info") {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setToast({ message, variant });
    timerRef.current = setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, 2600);
  }

  const value = useMemo<ToastContextValue>(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View pointerEvents="box-none" style={styles.overlay}>
          <Pressable
            onPress={hideToast}
            style={[
              styles.toast,
              {
                backgroundColor: TOAST_COLORS[toast.variant].bg,
                borderColor: TOAST_COLORS[toast.variant].border,
              },
            ]}
          >
            <Text style={styles.toastText}>{toast.message}</Text>
          </Pressable>
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return value;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 32,
    alignItems: "center",
  },
  toast: {
    maxWidth: 420,
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: "#231F29",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  toastText: {
    color: "#231F29",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
});
