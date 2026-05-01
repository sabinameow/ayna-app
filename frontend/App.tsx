import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ToastProvider } from "./src/context/ToastContext";
import { AuthProvider } from "./src/context/AuthContext";
import { NotificationsProvider } from "./src/hooks/useNotifications";
import { AppNavigator } from "./src/navigation/AppNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <NotificationsProvider>
            <ToastProvider>
              <StatusBar style="dark" />
              <AppNavigator />
            </ToastProvider>
          </NotificationsProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
