import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import React, { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppScreen } from "@/components/AppScreen";
import { medicationGuides } from "@/data/medications";
import { palette } from "@/theme";

export function MedicationListScreen() {
  const navigation = useNavigation<any>();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return medicationGuides;
    return medicationGuides.filter((item) =>
      [item.name, item.subtitle, item.category].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [search]);

  const instruct = filtered.slice(0, 3);
  const common = filtered.slice(3);

  function renderMedicationCard(medicationId: string) {
    const medication = medicationGuides.find((item) => item.id === medicationId);
    if (!medication) return null;

    return (
      <Pressable
        key={medication.id}
        style={styles.medCard}
        onPress={() =>
          navigation.navigate("MedicationDetail", {
            medicationId: medication.id,
          })
        }
        accessibilityRole="button"
        accessibilityLabel={medication.name}
      >
        <View
          style={[
            styles.medIcon,
            { backgroundColor: `${medication.color}18` },
          ]}
        >
          <Feather name={medication.icon} size={26} color={medication.color} />
        </View>

        <Text style={styles.medName} numberOfLines={2}>
          {medication.name}
        </Text>
        <Text style={styles.medSubtitle}>{medication.subtitle}</Text>
      </Pressable>
    );
  }

  function renderSection(title: string, items: typeof medicationGuides) {
    return (
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionLink}>See all</Text>
        </View>

        {items.length ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {items.map((item) => renderMedicationCard(item.id))}
          </ScrollView>
        ) : (
          <Text style={styles.empty}>No medications found.</Text>
        )}
      </View>
    );
  }

  return (
    <AppScreen contentContainerStyle={styles.screenContent}>
      <View style={styles.header}>
        <Pressable
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Feather name="chevron-left" size={22} color={palette.text} />
        </Pressable>

        <Text style={styles.title}>Medication</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.searchBar}>
        <Feather name="search" size={18} color="#9C98A0" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search drugs, category..."
          placeholderTextColor="#A8A3AB"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroText}>
          <Text style={styles.heroTitle}>
            Find the medication you need
          </Text>

          <Pressable style={styles.heroButton} accessibilityRole="button">
            <Text style={styles.heroButtonText}>
              Upload Prescription
            </Text>
          </Pressable>
        </View>

        <View style={styles.heroIcon}>
          <Feather name="clipboard" size={42} color="#E53F8F" />
        </View>
      </View>

      {renderSection("Instruct", instruct)}
      {renderSection("Common support", common.length ? common : filtered)}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screenContent: { paddingHorizontal: 16, gap: 18 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },

  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  title: { fontSize: 20, fontWeight: "800", color: palette.text },

  headerSpacer: { width: 40 },

  searchBar: {
    height: 52,
    borderRadius: 26,
    borderWidth: 1.2,
    borderColor: "#9DC3FF",
    backgroundColor: "#FFFFFFB8",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
  },

  searchInput: { flex: 1, fontSize: 16, color: palette.text },

  hero: {
    minHeight: 140,
    borderRadius: 14,
    backgroundColor: "#F0E9F3",
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    overflow: "hidden",
  },

  heroText: { flex: 1, gap: 16 },

  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: palette.text,
  },

  heroButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: "#E53F8F",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },

  heroButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },

  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-10deg" }],
  },

  section: { gap: 12 },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  sectionTitle: { fontSize: 20, fontWeight: "800", color: palette.text },

  sectionLink: { fontSize: 14, fontWeight: "600", color: "#E53F8F" },

  horizontalList: { gap: 16, paddingRight: 16 },

  medCard: {
    width: 140,
    height: 200,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    padding: 10,
    justifyContent: "flex-end",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },

  medIcon: {
    position: "absolute",
    top: 20,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  medName: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "800",
    color: palette.text,
  },

  medSubtitle: {
    fontSize: 12,
    color: "#9A949E",
    marginTop: 2,
  },

  empty: { color: palette.textMuted, fontSize: 13 },
});
