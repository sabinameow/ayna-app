import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";

/**
 * Re-runs `load` every time the screen gains focus. Use instead of useEffect
 * for any screen whose data can be mutated by another role/screen so users see
 * fresh data when they navigate back.
 */
export function useFocusReload(load: () => void | Promise<void>, enabled = true) {
  useFocusEffect(
    useCallback(() => {
      if (enabled) void load();
    }, [enabled, load])
  );
}
