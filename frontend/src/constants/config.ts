import { NativeModules, Platform } from "react-native";

function inferHost() {
  if (typeof window !== "undefined" && window.location?.hostname) {
    return window.location.hostname;
  }

  const scriptURL =
    NativeModules.SourceCode?.scriptURL ?? NativeModules.PlatformConstants?.scriptURL ?? "";

  if (!scriptURL) {
    return undefined;
  }

  try {
    return new URL(scriptURL).hostname || undefined;
  } catch {
    const match = scriptURL.match(/^[a-z]+:\/\/([^/:]+)(?::\d+)?/i);
    return match?.[1];
  }
}

function getDefaultApiBaseUrl() {
  const host = inferHost();

  if (host) {
    return `http://${host}:8000`;
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:8000";
  }

  return "http://127.0.0.1:8000";
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.trim() || getDefaultApiBaseUrl();

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, "ws");
