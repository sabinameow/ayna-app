import { Feather } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { LoginScreen } from "@/screens/auth/LoginScreen";
import { RegisterScreen } from "@/screens/auth/RegisterScreen";
import { DoctorAppointmentsScreen } from "@/screens/doctor/DoctorAppointmentsScreen";
import { DoctorDashboardScreen } from "@/screens/doctor/DoctorDashboardScreen";
import { DoctorPatientsScreen } from "@/screens/doctor/DoctorPatientsScreen";
import { DoctorProfileScreen } from "@/screens/doctor/DoctorProfileScreen";
import { DoctorScheduleScreen } from "@/screens/doctor/DoctorScheduleScreen";
import { ManagerAppointmentsScreen } from "@/screens/manager/ManagerAppointmentsScreen";
import { ManagerChatsScreen } from "@/screens/manager/ManagerChatsScreen";
import { ManagerDashboardScreen } from "@/screens/manager/ManagerDashboardScreen";
import { ManagerProfileScreen } from "@/screens/manager/ManagerProfileScreen";
import { ManagerSchedulesScreen } from "@/screens/manager/ManagerSchedulesScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { PatientAppointmentsScreen } from "@/screens/patient/PatientAppointmentsScreen";
import { PatientChatScreen } from "@/screens/patient/PatientChatScreen";
import { PatientCycleScreen } from "@/screens/patient/PatientCycleScreen";
import { PatientHomeScreen } from "@/screens/patient/PatientHomeScreen";
import { PatientProfileScreen } from "@/screens/patient/PatientProfileScreen";
import { palette } from "@/theme";

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function makeTabs(
  screens: {
    name: string;
    component: React.ComponentType;
    icon: keyof typeof Feather.glyphMap;
    title: string;
  }[],
  activeColor: string
) {
  return function RoleTabs() {
    return (
      <Tabs.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: activeColor,
          tabBarInactiveTintColor: "#8E8895",
          tabBarStyle: {
            height: 78,
            paddingTop: 8,
            paddingBottom: 10,
            borderTopWidth: 0,
            backgroundColor: "#FFFFFF",
          },
        }}
      >
        {screens.map((screen) => (
          <Tabs.Screen
            key={screen.name}
            name={screen.name}
            component={screen.component}
            options={{
              title: screen.title,
              tabBarIcon: ({ color, size }) => (
                <Feather name={screen.icon} color={color} size={size} />
              ),
            }}
          />
        ))}
      </Tabs.Navigator>
    );
  };
}

const PatientTabs = makeTabs(
  [
    { name: "PatientHome", component: PatientHomeScreen, icon: "home", title: "Home" },
    { name: "PatientCycle", component: PatientCycleScreen, icon: "activity", title: "Cycle" },
    { name: "PatientAppointments", component: PatientAppointmentsScreen, icon: "calendar", title: "Appointments" },
    { name: "PatientChat", component: PatientChatScreen, icon: "message-circle", title: "Chat" },
    { name: "PatientProfile", component: PatientProfileScreen, icon: "user", title: "Profile" },
  ],
  palette.patient
);

const DoctorTabs = makeTabs(
  [
    { name: "DoctorDashboard", component: DoctorDashboardScreen, icon: "grid", title: "Dashboard" },
    { name: "DoctorPatients", component: DoctorPatientsScreen, icon: "users", title: "Patients" },
    { name: "DoctorAppointments", component: DoctorAppointmentsScreen, icon: "clock", title: "Appointments" },
    { name: "DoctorSchedule", component: DoctorScheduleScreen, icon: "calendar", title: "Schedule" },
    { name: "DoctorProfile", component: DoctorProfileScreen, icon: "user", title: "Profile" },
  ],
  palette.doctor
);

const ManagerTabs = makeTabs(
  [
    { name: "ManagerDashboard", component: ManagerDashboardScreen, icon: "grid", title: "Dashboard" },
    { name: "ManagerChats", component: ManagerChatsScreen, icon: "message-square", title: "Chats" },
    { name: "ManagerAppointments", component: ManagerAppointmentsScreen, icon: "calendar", title: "Appointments" },
    { name: "ManagerSchedules", component: ManagerSchedulesScreen, icon: "briefcase", title: "Schedules" },
    { name: "ManagerProfile", component: ManagerProfileScreen, icon: "user", title: "Profile" },
  ],
  palette.manager
);

function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#FFF7FA",
      }}
    >
      <ActivityIndicator size="large" color={palette.patient} />
      <Text style={{ color: "#6C6670" }}>Preparing Ayna...</Text>
    </View>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : user.role === "patient" ? (
        <>
          <Stack.Screen name="PatientTabs" component={PatientTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : user.role === "doctor" ? (
        <>
          <Stack.Screen name="DoctorTabs" component={DoctorTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="ManagerTabs" component={ManagerTabs} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
