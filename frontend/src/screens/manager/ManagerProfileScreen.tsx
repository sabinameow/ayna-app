import React, { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { ManagerProfile } from "@/types/api";

export function ManagerProfileScreen() {
  const { accessToken, logout } = useAuth();
  const [profile, setProfile] = useState<ManagerProfile | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    void api.managerProfile(accessToken).then(setProfile).catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  return (
    <AppScreen>
      <SectionHeader title="Manager profile" subtitle="Operational role and assigned doctor context" />
      <GlassCard>
        <Text style={styles.name}>{profile?.full_name || "Manager"}</Text>
        <Text style={styles.meta}>Assigned doctor id: {profile?.assigned_doctor_id || "Not assigned"}</Text>
      </GlassCard>
      <PrimaryButton label="Log Out" onPress={logout} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 28, fontWeight: "800", color: "#231F29" },
  meta: { color: "#6E7760", marginTop: 8 },
});
