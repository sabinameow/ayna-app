import { Feather } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppScreen } from "@/components/AppScreen";
import { getMedicationGuide } from "@/data/medications";
import { palette } from "@/theme";

export function MedicationDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const medication = getMedicationGuide(route.params?.medicationId);

  if (!medication) {
    return (
      <AppScreen>
        <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="chevron-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.title}>Medication not found</Text>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={24} color={palette.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Medication</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.imagePanel}>
        <View style={[styles.imageIcon, { backgroundColor: `${medication.color}18` }]}>
          <Feather name={medication.icon} size={84} color={medication.color} />
        </View>
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.category}>{medication.category}</Text>
        <Text style={styles.title}>{medication.name}</Text>
        <Text style={styles.subtitle}>{medication.subtitle}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.bodyText}>{medication.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Purpose</Text>
        <Text style={styles.bodyText}>{medication.purpose}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Instructions</Text>
        {medication.instructions.map((instruction, index) => (
          <View key={instruction} style={styles.instructionRow}>
            <View style={styles.instructionNumber}>
              <Text style={styles.instructionNumberText}>{index + 1}</Text>
            </View>
            <Text style={styles.instructionText}>{instruction}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.section, styles.warningSection]}>
        <Text style={styles.sectionTitle}>Contraindications</Text>
        {medication.contraindications.map((item) => (
          <View key={item} style={styles.warningRow}>
            <Feather name="alert-circle" size={18} color="#E25555" />
            <Text style={styles.warningText}>{item}</Text>
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "900", color: palette.text },
  headerSpacer: { width: 42 },
  imagePanel: {
    minHeight: 220,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  imageIcon: {
    width: 156,
    height: 156,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { gap: 4 },
  category: { fontSize: 13, color: "#E53F8F", fontWeight: "800", textTransform: "uppercase" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "900", color: palette.text },
  subtitle: { fontSize: 16, color: palette.textMuted, fontWeight: "700" },
  section: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 18,
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: palette.text },
  bodyText: { fontSize: 14, lineHeight: 21, color: "#4A4351" },
  instructionRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  instructionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FCE4EF",
    alignItems: "center",
    justifyContent: "center",
  },
  instructionNumberText: { color: "#E53F8F", fontSize: 12, fontWeight: "900" },
  instructionText: { flex: 1, fontSize: 14, lineHeight: 21, color: "#4A4351" },
  warningSection: { borderWidth: 1, borderColor: "#F3B0B0", backgroundColor: "#FFF7F7" },
  warningRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  warningText: { flex: 1, fontSize: 14, lineHeight: 21, color: "#4A4351" },
});
