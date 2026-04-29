import React, { useCallback, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { api } from "@/api/client";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SectionHeader } from "@/components/SectionHeader";
import { useAuth } from "@/context/AuthContext";
import { useFocusReload } from "@/hooks/useFocusReload";
import type { DoctorProfile } from "@/types/api";

export function DoctorProfileScreen() {
  const { accessToken, logout } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);

  const load = useCallback(() => {
    if (!accessToken) return;
    void api.doctorProfile(accessToken).then(setProfile).catch(() => undefined);
  }, [accessToken]);
  useFocusReload(load);

  return (
    <AppScreen>
      <SectionHeader title="Doctor profile" subtitle="Professional identity and session access" />
      <GlassCard>
        <Text style={styles.name}>{profile?.full_name || "Doctor"}</Text>
        <Text style={styles.meta}>{profile?.specialization || "Specialization not set"}</Text>
        <Text style={styles.bio}>{profile?.bio || "Bio not available."}</Text>
      </GlassCard>
      <PrimaryButton label="Log Out" onPress={logout} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 28, fontWeight: "800", color: "#231F29" },
  meta: { color: "#3F6CF6", marginTop: 8, fontWeight: "700" },
  bio: { color: "#6E7690", marginTop: 12, lineHeight: 22 },
});
