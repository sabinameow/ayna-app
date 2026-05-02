import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { api } from "@/api/client";
import { AppInput } from "@/components/AppInput";
import { AppScreen } from "@/components/AppScreen";
import { GlassCard } from "@/components/GlassCard";
import { NotificationBell } from "@/components/NotificationBell";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { useNotifications } from "@/hooks/useNotifications";
import { saveFeedbackLabel, useSaveFeedback } from "@/hooks/useSaveFeedback";
import {
  listLocalMedicationLogsForDate,
  saveLocalMedicationLogsForDate,
} from "@/services/medicationLogStorage";
import type {
  Cycle,
  CycleDay,
  Medication,
  MedicationLog,
  MoodEntry,
  MoodStats,
  Symptom,
} from "@/types/api";

const PERIOD_COLOR = "#E53F8F";
const PERIOD_LIGHT = "#F8B6CF";
const PERIOD_DARK = "#A11D5C";
const PERIOD_BG = "#FCE4EF";

const PERIOD_LENGTH = 5;
const DEFAULT_CYCLE_LENGTH = 28;
const PREDICTION_HORIZON = 6;
const MIN_CYCLE_GAP_DAYS = 18;

const moods = ["great", "good", "okay", "bad", "terrible"] as const;
const moodLabels: Record<(typeof moods)[number], string> = {
  great: "Great",
  good: "Good",
  okay: "Okay",
  bad: "Bad",
  terrible: "Terrible",
};

type MedicationInput = {
  id: string;
  name: string;
  taken: boolean;
  locked: boolean;
};

function createMedicationInput(): MedicationInput {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: "",
    taken: false,
    locked: false,
  };
}

function medicationInputsFromNames(names: string[]): MedicationInput[] {
  const inputs = names.slice(0, 5).map((name) => ({
    id: `${Date.now()}-${name}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    taken: true,
    locked: true,
  }));
  return inputs.length ? inputs : [createMedicationInput()];
}

function getCyclePhase(dayOfCycle: number, cycleLength: number) {
  if (dayOfCycle <= 5) return { name: "Menstrual Phase", color: PERIOD_COLOR };
  const ovulation = Math.round(cycleLength / 2);
  if (dayOfCycle <= ovulation - 2) return { name: "Follicular Phase", color: PERIOD_LIGHT };
  if (dayOfCycle <= ovulation + 2) return { name: "Ovulation Phase", color: PERIOD_DARK };
  return { name: "Luteal Phase", color: PERIOD_COLOR };
}

function buildCalendarMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return { cells, month, year };
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  return Math.round(
    (new Date(b + "T12:00:00").getTime() - new Date(a + "T12:00:00").getTime()) / 86400000
  );
}

function formatDate(dateStr: string, opts?: Intl.DateTimeFormatOptions) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString(
    "en-US",
    opts ?? { month: "short", day: "numeric" }
  );
}

function buildDateRange(startDate: string, duration: number): string[] {
  return Array.from({ length: duration }, (_, index) => addDays(startDate, index));
}

function medicationLogDate(log: MedicationLog) {
  return log.taken_at.slice(0, 10);
}

function last7DaysRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 6);
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  };
}

export function PatientCycleScreen() {
  const { accessToken } = useAuth();
  const { showToast } = useToast();
  const { refreshUnread } = useNotifications();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleDays, setCycleDays] = useState<CycleDay[]>([]);
  const [catalog, setCatalog] = useState<Symptom[]>([]);
  const [moodStats, setMoodStats] = useState<MoodStats | null>(null);
  const [prescribedMedications, setPrescribedMedications] = useState<Medication[]>([]);
  const [prescribedMedicationLogs, setPrescribedMedicationLogs] = useState<MedicationLog[]>([]);
  const [selectedPrescriptionIds, setSelectedPrescriptionIds] = useState<string[]>([]);
  const [savingPrescriptionIds, setSavingPrescriptionIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"overview" | "log" | "mood">("overview");
  const [medicationInputs, setMedicationInputs] = useState<MedicationInput[]>([
    createMedicationInput(),
  ]);
  const [selectedSymptom, setSelectedSymptom] = useState<string | null>(null);
  const [severity, setSeverity] = useState(3);
  const [selectedMood, setSelectedMood] = useState<(typeof moods)[number]>("good");
  const [energy, setEnergy] = useState(3);
  const [stress, setStress] = useState(3);
  const [sleep, setSleep] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [todayMoodEntry, setTodayMoodEntry] = useState<MoodEntry | null>(null);
  const [error, setError] = useState("");
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [confirmDelete, setConfirmDelete] = useState<{
    visible: boolean;
    rangeStart: string;
    rangeEnd: string;
    rangeLength: number;
  } | null>(null);
  const [pendingDates, setPendingDates] = useState<string[]>([]);
  const [isPeriodMutating, setIsPeriodMutating] = useState(false);
  const prescriptionSave = useSaveFeedback();
  const otherMedicationSave = useSaveFeedback();
  const symptomSave = useSaveFeedback();
  const moodSave = useSaveFeedback();

  // Monotonically-increasing token. Every mutation increments it; any async
  // continuation that finds the token has moved on bails out — this is what
  // keeps rapid taps from re-introducing stale state.
  const seqRef = useRef(0);

  const load = useCallback(async () => {
    if (!accessToken) return;
    const seq = ++seqRef.current;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const moodRange = last7DaysRange();
      const [
        allCycles,
        monthDays,
        nextCatalog,
        nextMoodStats,
        todayMoodEntries,
        todayMedicationLogs,
        medications,
      ] = await Promise.all([
        api.listCycles(accessToken),
        api.listCycleDays(accessToken, calMonth.month + 1, calMonth.year),
        api.listSymptomsCatalog(accessToken),
        api.moodStats(accessToken, moodRange.from, moodRange.to).catch(() => null),
        api.listMoodEntries(accessToken, today, today).catch(() => [] as MoodEntry[]),
        listLocalMedicationLogsForDate(today).catch(() => []),
        api.patientMedications(accessToken).catch(() => [] as Medication[]),
      ]);
      const activeMedications = medications.filter((medication) => medication.is_active);
      const medicationLogs = (
        await Promise.all(
          activeMedications.map((medication) =>
            api.medicationLogs(accessToken, medication.id).catch(() => [] as MedicationLog[])
          )
        )
      ).flat();
      if (seq !== seqRef.current) return;
      setCycles(allCycles.filter((c) => !c.is_predicted));
      setCycleDays(monthDays);
      setCatalog(nextCatalog.slice(0, 10));
      setMoodStats(nextMoodStats);
      const savedMood = todayMoodEntries[0] ?? null;
      setTodayMoodEntry(savedMood);
      if (savedMood) {
        setSelectedMood(savedMood.mood);
        setEnergy(savedMood.energy_level);
        setStress(savedMood.stress_level);
        setSleep(savedMood.sleep_quality);
        setMoodNotes(savedMood.notes ?? "");
      }
      setPrescribedMedications(activeMedications);
      setPrescribedMedicationLogs(medicationLogs);
      setSelectedPrescriptionIds([]);
      setSavingPrescriptionIds([]);
      setMedicationInputs(medicationInputsFromNames(todayMedicationLogs.map((log) => log.name)));
      setError("");
    } catch (err) {
      if (seq !== seqRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to load cycle data");
    }
  }, [accessToken, calMonth.year, calMonth.month]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load(); }, [accessToken, calMonth.year, calMonth.month]);

  const periodDates = useMemo(() => {
    const dates = new Set<string>();
    if (cycles.length > 0) {
      for (const cycle of cycles) {
        const length = cycle.period_length ?? PERIOD_LENGTH;
        for (const day of buildDateRange(cycle.start_date, length)) {
          dates.add(day);
        }
      }
      return dates;
    }
    for (const day of cycleDays) {
      if (day.flow_intensity !== "none") {
        dates.add(day.date);
      }
    }
    return dates;
  }, [cycles, cycleDays]);

  // Predictions are derived purely from the local cycle list — no server roundtrip,
  // no stale prediction race. avg gap → project forward PREDICTION_HORIZON cycles.
  const { avgCycleLength, predictedDates } = useMemo(() => {
    const starts = Array.from(new Set(cycles.map((c) => c.start_date))).sort();
    let avg = DEFAULT_CYCLE_LENGTH;
    if (starts.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < starts.length; i++) gaps.push(diffDays(starts[i - 1], starts[i]));
      const mean = Math.round(gaps.reduce((s, n) => s + n, 0) / gaps.length);
      avg = Math.max(15, Math.min(45, mean));
    }
    const set = new Set<string>();
    if (starts.length > 0) {
      let cursor = starts[starts.length - 1];
      for (let i = 0; i < PREDICTION_HORIZON; i++) {
        cursor = addDays(cursor, avg);
        for (let j = 0; j < PERIOD_LENGTH; j++) set.add(addDays(cursor, j));
      }
    }
    return { avgCycleLength: avg, predictedDates: set };
  }, [cycles]);

  function findCycleContaining(dateKey: string): Cycle | undefined {
    return cycles.find((c) => {
      const end = c.end_date ?? addDays(c.start_date, PERIOD_LENGTH - 1);
      return dateKey >= c.start_date && dateKey <= end;
    });
  }

  function findOverlappingCycles(startDate: string, endDate: string): Cycle[] {
    return cycles.filter((cycle) => {
      const cycleEnd = cycle.end_date ?? addDays(cycle.start_date, (cycle.period_length ?? PERIOD_LENGTH) - 1);
      return cycle.start_date <= endDate && cycleEnd >= startDate;
    });
  }

  function cycleRange(cycle: Cycle): string[] {
    const endDate = cycle.end_date ?? addDays(cycle.start_date, (cycle.period_length ?? PERIOD_LENGTH) - 1);
    return buildDateRange(cycle.start_date, diffDays(cycle.start_date, endDate) + 1);
  }

  function applyOptimisticPeriod(dateKey: string) {
    const optimisticEnd = addDays(dateKey, PERIOD_LENGTH - 1);
    const overlappingCycles = findOverlappingCycles(dateKey, optimisticEnd);
    const overlappingDates = new Set(
      overlappingCycles.flatMap((cycle) => cycleRange(cycle))
    );
    const nextPeriodDates = buildDateRange(dateKey, PERIOD_LENGTH);

    setCycles((prev) => {
      const overlapIds = new Set(overlappingCycles.map((cycle) => cycle.id));
      const filtered = prev.filter((cycle) => !overlapIds.has(cycle.id));
      const next: Cycle = {
        id: `preview-${dateKey}`,
        patient_id: "",
        start_date: dateKey,
        end_date: optimisticEnd,
        cycle_length: null,
        period_length: PERIOD_LENGTH,
        is_predicted: false,
      };
      return [...filtered, next].sort((a, b) => a.start_date.localeCompare(b.start_date));
    });

    setCycleDays((prev) => {
      const filtered = prev.filter(
        (day) => !overlappingDates.has(day.date) && !nextPeriodDates.includes(day.date)
      );
      const map = new Map(filtered.map((d) => [d.date, d]));
      for (const d of nextPeriodDates) {
        map.set(d, {
          id: `preview-${d}`,
          patient_id: "",
          date: d,
          flow_intensity: "medium",
        });
      }
      return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  async function refreshCycleData(seq: number) {
    if (!accessToken) return;
    const [freshCycles, freshDays] = await Promise.all([
      api.listCycles(accessToken),
      api.listCycleDays(accessToken, calMonth.month + 1, calMonth.year),
    ]);
    if (seq !== seqRef.current) return;
    setCycles(freshCycles.filter((c) => !c.is_predicted));
    setCycleDays(freshDays);
  }

  function commitSavedPeriod(dateKey: string, savedDays: CycleDay[]) {
    const periodLength = savedDays.length || PERIOD_LENGTH;
    const periodDates = buildDateRange(dateKey, periodLength);

    setCycleDays((prev) => {
      const keep = prev.filter((day) => !periodDates.includes(day.date));
      return [...keep, ...savedDays].sort((a, b) => a.date.localeCompare(b.date));
    });

    setCycles((prev) => {
      const nextCycle: Cycle = {
        id: `saved-${dateKey}`,
        patient_id: savedDays[0]?.patient_id ?? "",
        start_date: dateKey,
        end_date: addDays(dateKey, periodLength - 1),
        cycle_length: null,
        period_length: periodLength,
        is_predicted: false,
      };

      const filtered = prev.filter((cycle) => {
        const cycleEnd = cycle.end_date ?? addDays(cycle.start_date, (cycle.period_length ?? PERIOD_LENGTH) - 1);
        const overlaps = cycle.start_date <= nextCycle.end_date! && cycleEnd >= nextCycle.start_date;
        const tooClose = Math.abs(diffDays(cycle.start_date, dateKey)) < MIN_CYCLE_GAP_DAYS;
        return !overlaps && !tooClose;
      });

      return [...filtered, nextCycle].sort((a, b) => a.start_date.localeCompare(b.start_date));
    });
  }

  async function applyPeriodAt(dateKey: string) {
    if (!accessToken || isPeriodMutating || pendingDates.includes(dateKey)) return;
    const seq = ++seqRef.current;
    const optimisticDates = Array.from(
      new Set([
        ...buildDateRange(dateKey, PERIOD_LENGTH),
        ...findOverlappingCycles(dateKey, addDays(dateKey, PERIOD_LENGTH - 1)).flatMap((cycle) =>
          cycleRange(cycle)
        ),
      ])
    );

    setPendingDates((prev) => Array.from(new Set([...prev, ...optimisticDates])));
    setIsPeriodMutating(true);
    setError("");

    applyOptimisticPeriod(dateKey);

    try {
      const savedDays = await api.logPeriod(accessToken, dateKey, PERIOD_LENGTH);
      if (seq !== seqRef.current) return;
      commitSavedPeriod(dateKey, savedDays);
      showToast("Saved successfully", "success");
      try {
        await Promise.all([refreshCycleData(seq), refreshUnread()]);
      } catch (refreshErr) {
        setError(
          refreshErr instanceof Error
            ? `Period saved, but refresh failed: ${refreshErr.message}`
            : "Period saved, but refresh failed."
        );
      }
    } catch (err) {
      if (seq !== seqRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setError(message);
      showToast("Something went wrong", "error");
      Alert.alert("Could not save period", message);
      void load();
    } finally {
      setPendingDates((prev) => prev.filter((date) => !optimisticDates.includes(date)));
      setIsPeriodMutating(false);
    }
  }

  function onDayPress(dateKey: string) {
    if (isPeriodMutating || pendingDates.includes(dateKey)) return;
    const containing = findCycleContaining(dateKey);
    if (containing) {
      const start = containing.start_date;
      const end = containing.end_date ?? addDays(start, PERIOD_LENGTH - 1);
      setConfirmDelete({
        visible: true,
        rangeStart: start,
        rangeEnd: end,
        rangeLength: diffDays(start, end) + 1,
      });
    } else {
      void applyPeriodAt(dateKey);
    }
  }

  async function confirmDeletePeriod() {
    if (!accessToken || !confirmDelete || isPeriodMutating) return;
    const seq = ++seqRef.current;
    const { rangeStart, rangeEnd } = confirmDelete;
    const rollbackCycles = cycles;
    const rollbackDays = cycleDays;
    const deletedDates = buildDateRange(rangeStart, diffDays(rangeStart, rangeEnd) + 1);
    const targetCycleId = findCycleContaining(rangeStart)?.id;

    setPendingDates((prev) => Array.from(new Set([...prev, ...deletedDates])));
    setIsPeriodMutating(true);
    setError("");

    setCycles((prev) =>
      prev.filter((cycle) => cycle.id !== targetCycleId)
    );
    setCycleDays((prev) => prev.filter((day) => !deletedDates.includes(day.date)));
    setConfirmDelete(null);

    try {
      await api.deleteCycleDaysRange(accessToken, rangeStart, rangeEnd);
      if (seq !== seqRef.current) return;
      showToast("Deleted", "success");
      try {
        await Promise.all([refreshCycleData(seq), refreshUnread()]);
      } catch (refreshErr) {
        setError(
          refreshErr instanceof Error
            ? `Period deleted, but refresh failed: ${refreshErr.message}`
            : "Period deleted, but refresh failed."
        );
      }
    } catch (err) {
      if (seq !== seqRef.current) return;
      setCycles(rollbackCycles);
      setCycleDays(rollbackDays);
      const message = err instanceof Error ? err.message : "Failed to delete. Please try again.";
      setError(message);
      showToast("Something went wrong", "error");
      Alert.alert("Could not delete period", message);
    } finally {
      setPendingDates((prev) => prev.filter((date) => !deletedDates.includes(date)));
      setIsPeriodMutating(false);
    }
  }

  function shiftMonth(delta: number) {
    setCalMonth((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  function updateMedicationInput(id: string, patch: Partial<MedicationInput>) {
    setMedicationInputs((prev) =>
      prev.map((item) => (item.id === id && !item.locked ? { ...item, ...patch } : item))
    );
  }

  function addMedicationInput() {
    setMedicationInputs((prev) =>
      prev.length >= 5 ? prev : [...prev, createMedicationInput()]
    );
  }

  function removeMedicationInput(id: string) {
    setMedicationInputs((prev) =>
      prev.length <= 1 ? prev : prev.filter((item) => item.id !== id || item.locked)
    );
  }

  async function saveMedicationIntake() {
    const lockedNames = medicationInputs
      .filter((item) => item.locked && item.taken)
      .map((item) => item.name.trim())
      .filter(Boolean);
    const draftNames = medicationInputs
      .filter((item) => !item.locked && item.taken)
      .map((item) => item.name.trim())
      .filter(Boolean);
    const uniqueNames = Array.from(
      new Map([...lockedNames, ...draftNames].map((name) => [name.toLowerCase(), name])).values()
    ).slice(0, 5);

    if (!draftNames.length) {
      setError("Mark at least one medication as taken and enter its name.");
      otherMedicationSave.markError();
      return;
    }

    otherMedicationSave.markSaving();
    try {
      await saveLocalMedicationLogsForDate(new Date().toISOString().slice(0, 10), uniqueNames);
      setMedicationInputs(medicationInputsFromNames(uniqueNames));
      setError("");
      otherMedicationSave.markSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save medication intake");
      otherMedicationSave.markError();
    }
  }

  function hasPrescriptionLogToday(medicationId: string) {
    return prescribedMedicationLogs.some(
      (log) => log.medication_id === medicationId && !log.skipped && medicationLogDate(log) === todayKey
    );
  }

  function togglePrescription(medicationId: string) {
    if (hasPrescriptionLogToday(medicationId) || savingPrescriptionIds.includes(medicationId)) return;
    setSelectedPrescriptionIds((prev) =>
      prev.includes(medicationId)
        ? prev.filter((id) => id !== medicationId)
        : [...prev, medicationId]
    );
  }

  async function savePrescriptionIntake() {
    if (!accessToken) return;
    const idsToSave = selectedPrescriptionIds.filter((id) => !hasPrescriptionLogToday(id));
    if (!idsToSave.length) {
      setError("Select prescribed medication to save.");
      prescriptionSave.markError();
      return;
    }

    prescriptionSave.markSaving();
    setSavingPrescriptionIds(idsToSave);
    try {
      const saved = await Promise.all(
        idsToSave.map((medicationId) => api.logMedication(accessToken, medicationId, { skipped: false }))
      );
      setPrescribedMedicationLogs((prev) => [...saved, ...prev]);
      setSelectedPrescriptionIds((prev) => prev.filter((id) => !idsToSave.includes(id)));
      setError("");
      prescriptionSave.markSaved();
      await refreshUnread();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save prescribed medication intake");
      prescriptionSave.markError();
    } finally {
      setSavingPrescriptionIds([]);
    }
  }

  async function logSymptom() {
    if (!accessToken || !selectedSymptom) return;
    symptomSave.markSaving();
    try {
      await api.createPatientSymptom(accessToken, {
        symptom_id: selectedSymptom,
        date: new Date().toISOString().slice(0, 10),
        severity,
      });
      setSelectedSymptom(null);
      symptomSave.markSaved();
      await Promise.all([load(), refreshUnread()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save symptom");
      symptomSave.markError();
    }
  }

  async function logMood() {
    if (!accessToken || todayMoodEntry) return;
    moodSave.markSaving();
    try {
      const savedMood = await api.createMoodEntry(accessToken, {
        date: new Date().toISOString().slice(0, 10),
        mood: selectedMood,
        energy_level: energy,
        stress_level: stress,
        sleep_quality: sleep,
        notes: moodNotes.trim() || undefined,
      });
      setTodayMoodEntry(savedMood);
      setSelectedMood(savedMood.mood);
      setEnergy(savedMood.energy_level);
      setStress(savedMood.stress_level);
      setSleep(savedMood.sleep_quality);
      setMoodNotes(savedMood.notes ?? "");
      moodSave.markSaved();
      await Promise.all([load(), refreshUnread()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save mood");
      moodSave.markError();
    }
  }

  const calendar = useMemo(
    () => buildCalendarMonth(calMonth.year, calMonth.month),
    [calMonth]
  );

  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);

  const lastPeriodStart = useMemo(() => {
    const past = cycles
      .map((c) => c.start_date)
      .filter((s) => s <= todayKey)
      .sort();
    return past[past.length - 1];
  }, [cycles, todayKey]);

  const dayOfCycle = lastPeriodStart
    ? Math.min(avgCycleLength, diffDays(lastPeriodStart, todayKey) + 1)
    : 1;
  const phase = getCyclePhase(dayOfCycle, avgCycleLength);
  const ringPct = Math.min(1, dayOfCycle / avgCycleLength);
  const monthLabel = new Date(calMonth.year, calMonth.month, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const moodDist = moodStats?.mood_distribution ?? {};
  const moodMax = Math.max(1, ...Object.values(moodDist));
  const medicationTakenCount = new Set(
    medicationInputs
      .filter((item) => item.taken && item.name.trim())
      .map((item) => item.name.trim().toLowerCase())
  ).size;
  const hasDraftMedicationInput = medicationInputs.some((item) => !item.locked);

  return (
    <View style={{ flex: 1 }}>
      <AppScreen>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Cycle</Text>
          <NotificationBell color={PERIOD_COLOR} backgroundColor={PERIOD_BG} />
        </View>

        <GlassCard style={styles.heroCard}>
          <View style={styles.ring}>
            <View style={[styles.ringFill, { borderColor: phase.color, opacity: 0.25 }]} />
            <View style={[styles.ringFill, {
              borderColor: phase.color,
              borderTopColor: ringPct > 0.25 ? phase.color : "transparent",
              borderRightColor: ringPct > 0.5 ? phase.color : "transparent",
              borderBottomColor: ringPct > 0.75 ? phase.color : "transparent",
              borderLeftColor: ringPct > 0 ? phase.color : "transparent",
            }]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroEyebrow}>Current Phase</Text>
            <Text style={styles.heroPhase}>{phase.name}</Text>
            <Text style={styles.heroDay}>Day {dayOfCycle} of {avgCycleLength}</Text>
          </View>
        </GlassCard>

        <View style={styles.statRow}>
          <GlassCard style={[styles.statCard, { backgroundColor: PERIOD_BG }]}>
            <Feather name="droplet" size={20} color={PERIOD_COLOR} />
            <Text style={styles.statLabel}>Regularity</Text>
            <Text style={styles.statValue}>{cycles.length >= 2 ? "Good" : "—"}</Text>
          </GlassCard>
          <GlassCard style={[styles.statCard, { backgroundColor: PERIOD_BG }]}>
            <Feather name="meh" size={20} color={PERIOD_COLOR} />
            <Text style={styles.statLabel}>Stress</Text>
            <Text style={styles.statValue}>
              {moodStats?.average_stress
                ? moodStats.average_stress < 2.5
                  ? "Low"
                  : moodStats.average_stress < 3.5
                  ? "Med"
                  : "High"
                : "—"}
            </Text>
          </GlassCard>
        </View>

        <View style={styles.tabBar}>
          {(["overview", "log", "mood"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              style={[styles.tab, tab === t && styles.tabActive]}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "overview" ? "Calendar" : t === "log" ? "Log" : "Mood"}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === "overview" && (
          <GlassCard>
            <View style={styles.calHeader}>
              <Pressable onPress={() => shiftMonth(-1)} style={styles.calNavBtn}>
                <Feather name="chevron-left" size={18} color={PERIOD_COLOR} />
              </Pressable>
              <Text style={styles.cardTitle}>{monthLabel}</Text>
              <Pressable onPress={() => shiftMonth(1)} style={styles.calNavBtn}>
                <Feather name="chevron-right" size={18} color={PERIOD_COLOR} />
              </Pressable>
            </View>
            <View style={styles.weekHeader}>
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <Text key={i} style={styles.weekHeaderCell}>{d}</Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendar.cells.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.dayCell} />;
                const dateKey = `${calendar.year}-${String(calendar.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hasFlow = periodDates.has(dateKey);
                const isToday = dateKey === todayKey;
                const isPredicted = !hasFlow && !isToday && predictedDates.has(dateKey);
                const isPending = pendingDates.includes(dateKey);
                const isDisabled = isPeriodMutating || isPending;
                const colIdx = idx % 7;

                const hasPrev =
                  hasFlow &&
                  periodDates.has(addDays(dateKey, -1)) &&
                  colIdx > 0;
                const hasNext =
                  hasFlow &&
                  periodDates.has(addDays(dateKey, 1)) &&
                  colIdx < 6;

                return (
                  <Pressable
                    key={idx}
                    style={[styles.dayCell, isDisabled && styles.dayCellDisabled]}
                    onPress={() => onDayPress(dateKey)}
                    disabled={isDisabled}
                  >
                    {hasFlow && (
                      <View
                        style={[
                          styles.rangeStrip,
                          !hasPrev && styles.rangeStripStart,
                          !hasNext && styles.rangeStripEnd,
                        ]}
                      />
                    )}
                    <View
                      style={[
                        styles.dayInner,
                        hasFlow && styles.dayConfirmed,
                        isPredicted && styles.dayPredicted,
                        isToday && !hasFlow && styles.dayToday,
                        isPending && styles.dayPending,
                      ]}
                    >
                      {isPending ? (
                        <ActivityIndicator size="small" color={hasFlow ? "#FFFFFF" : PERIOD_COLOR} />
                      ) : (
                        <Text
                          style={[
                            styles.dayText,
                            hasFlow && styles.dayTextLight,
                            isPredicted && styles.dayTextPredicted,
                            isToday && !hasFlow && styles.dayTextToday,
                          ]}
                        >
                          {day}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: PERIOD_COLOR }]} />
                <Text style={styles.legendText}>Logged period</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, styles.legendDotPredicted]} />
                <Text style={styles.legendText}>Predicted</Text>
              </View>
            </View>

            <View style={styles.hintRow}>
              <Feather name="info" size={12} color="#B09ABF" />
              <Text style={styles.hintText}>
                Tap a date to log a 5-day period · Tap marked day to remove
              </Text>
            </View>
            {error ? (
              <View style={styles.inlineErrorBox}>
                <Feather name="alert-circle" size={14} color="#E25555" />
                <Text style={styles.inlineErrorText}>{error}</Text>
              </View>
            ) : null}
          </GlassCard>
        )}

        {tab === "log" && (
          <>
            <GlassCard>
              <View style={styles.medicationHeader}>
                <View>
                  <Text style={styles.cardTitle}>Prescribed medications</Text>
                  <Text style={styles.medicationHint}>Mark today's dose once. Saved doses are locked.</Text>
                </View>
                <Text style={styles.medicationCounter}>
                  {prescribedMedications.filter((item) => hasPrescriptionLogToday(item.id)).length}/
                  {prescribedMedications.length}
                </Text>
              </View>

              {prescribedMedications.length ? (
                <View style={styles.prescriptionList}>
                  {prescribedMedications.map((medication) => {
                    const saved = hasPrescriptionLogToday(medication.id);
                    const selected = selectedPrescriptionIds.includes(medication.id);
                    const saving = savingPrescriptionIds.includes(medication.id);
                    return (
                      <Pressable
                        key={medication.id}
                        style={[styles.prescriptionRow, saved && styles.prescriptionRowSaved]}
                        onPress={() => togglePrescription(medication.id)}
                        disabled={saved || saving}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: saved || selected, disabled: saved || saving }}
                      >
                        <View
                          style={[
                            styles.checkBox,
                            styles.prescriptionCheckBox,
                            (saved || selected) && styles.checkBoxActive,
                          ]}
                        >
                          {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : saved || selected ? (
                            <Feather name="check" size={14} color="#FFFFFF" />
                          ) : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prescriptionName}>{medication.name}</Text>
                          <Text style={styles.prescriptionMeta}>
                            {medication.dosage} · {medication.frequency}
                          </Text>
                          {medication.instructions ? (
                            <Text style={styles.prescriptionInstructions}>
                              {medication.instructions}
                            </Text>
                          ) : null}
                        </View>
                        {saved ? (
                          <View style={styles.savedPill}>
                            <Text style={styles.savedPillText}>Saved</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  <PrimaryButton
                    label={saveFeedbackLabel(prescriptionSave.status, "Save prescribed intake")}
                    onPress={savePrescriptionIntake}
                    disabled={!selectedPrescriptionIds.length || prescriptionSave.status === "saving"}
                    feedbackStatus={prescriptionSave.status}
                  />
                </View>
              ) : (
                <Text style={styles.emptyText}>No active prescribed medications yet.</Text>
              )}
            </GlassCard>

            <GlassCard>
              <View style={styles.medicationHeader}>
                <View>
                  <Text style={styles.cardTitle}>Other medication</Text>
                  <Text style={styles.medicationHint}>Use this only for non-prescribed intake.</Text>
                </View>
                <Text style={styles.medicationCounter}>{medicationTakenCount}/5 saved</Text>
              </View>

              <View style={styles.medicationList}>
                {medicationInputs.map((item, index) => (
                  <View key={item.id} style={[styles.medicationRow, item.locked && styles.medicationRowLocked]}>
                    <Pressable
                      style={[styles.checkBox, item.taken && styles.checkBoxActive]}
                      onPress={() => updateMedicationInput(item.id, { taken: !item.taken })}
                      disabled={item.locked}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.taken, disabled: item.locked }}
                    >
                      {item.taken ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
                    </Pressable>
                    <View style={styles.medicationInputWrap}>
                      <AppInput
                        label={index === 0 ? "Medication name" : undefined}
                        value={item.name}
                        onChangeText={(name) => updateMedicationInput(item.id, { name })}
                        placeholder="e.g. Folic Acid"
                        editable={!item.locked}
                      />
                    </View>
                    {item.locked ? (
                      <View style={styles.savedPill}>
                        <Text style={styles.savedPillText}>Saved</Text>
                      </View>
                    ) : null}
                    {medicationInputs.length > 1 ? (
                      <Pressable
                        style={[
                          styles.removeMedicationBtn,
                          item.locked && styles.removeMedicationBtnDisabled,
                        ]}
                        onPress={() => removeMedicationInput(item.id)}
                        disabled={item.locked}
                        accessibilityRole="button"
                        accessibilityLabel="Remove medication"
                      >
                        <Feather name="x" size={16} color="#E25555" />
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.medicationActions}>
                <Pressable
                  style={[
                    styles.addMedicationBtn,
                    medicationInputs.length >= 5 && styles.addMedicationBtnDisabled,
                  ]}
                  onPress={addMedicationInput}
                  disabled={medicationInputs.length >= 5}
                  accessibilityRole="button"
                  accessibilityLabel="Add medication"
                >
                  <Feather name="plus" size={18} color={PERIOD_COLOR} />
                  <Text style={styles.addMedicationText}>Add</Text>
                </Pressable>
                <PrimaryButton
                  label={saveFeedbackLabel(otherMedicationSave.status, "Save medication log")}
                  onPress={saveMedicationIntake}
                  disabled={!hasDraftMedicationInput || otherMedicationSave.status === "saving"}
                  feedbackStatus={otherMedicationSave.status}
                />
              </View>
            </GlassCard>

            <GlassCard>
              <Text style={styles.cardTitle}>Log symptom</Text>
              <View style={styles.chipRow}>
                {catalog.map((symptom) => (
                  <Pressable
                    key={symptom.id}
                    onPress={() => setSelectedSymptom(symptom.id)}
                    style={[styles.chip, selectedSymptom === symptom.id && styles.chipActive]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSymptom === symptom.id && styles.chipTextActive,
                      ]}
                    >
                      {symptom.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.cardLabel}>Severity: {severity}</Text>
              <View style={styles.severityRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSeverity(s)}
                    style={[styles.sevDot, severity >= s && styles.sevDotActive]}
                  />
                ))}
              </View>
              <PrimaryButton
                label={saveFeedbackLabel(symptomSave.status, "Save symptom")}
                onPress={logSymptom}
                disabled={!selectedSymptom || symptomSave.status === "saving"}
                feedbackStatus={symptomSave.status}
              />
            </GlassCard>
          </>
        )}

        {tab === "mood" && (
          <>
            <GlassCard>
              <View>
                <Text style={styles.cardTitle}>Mood Report</Text>
                <Text style={styles.reportRangeText}>Last 7 days</Text>
              </View>
              <View style={styles.moodChart}>
                {moods.map((m) => {
                  const count = moodDist[m] || 0;
                  return (
                    <View key={m} style={styles.barWrap}>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { height: `${(count / moodMax) * 100}%` }]} />
                      </View>
                      <Text style={styles.barLabel}>{moodLabels[m]}</Text>
                      <Text style={styles.barValue}>{count}</Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.miniStatRow}>
                {[
                  { label: "Energy", val: moodStats?.average_energy },
                  { label: "Stress", val: moodStats?.average_stress },
                  { label: "Sleep", val: moodStats?.average_sleep },
                ].map(({ label, val }) => (
                  <View key={label} style={styles.miniStat}>
                    <Text style={styles.miniStatLabel}>{label}</Text>
                    <Text style={styles.miniStatValue}>{val?.toFixed(1) ?? "--"}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>

            <GlassCard>
              <View style={styles.moodHeader}>
                <View>
                  <Text style={styles.cardTitle}>How are you feeling?</Text>
                  {todayMoodEntry ? (
                    <Text style={styles.moodSavedHint}>Today's check-in is saved and locked.</Text>
                  ) : null}
                </View>
                {todayMoodEntry ? (
                  <View style={styles.savedPill}>
                    <Text style={styles.savedPillText}>Saved today</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.chipRow}>
                {moods.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setSelectedMood(m)}
                    disabled={!!todayMoodEntry}
                    style={[styles.chip, selectedMood === m && styles.chipActive]}
                  >
                    <Text
                      style={[styles.chipText, selectedMood === m && styles.chipTextActive]}
                    >
                      {moodLabels[m]}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {[
                { label: "Energy", val: energy, set: setEnergy },
                { label: "Stress", val: stress, set: setStress },
                { label: "Sleep", val: sleep, set: setSleep },
              ].map(({ label, val, set }) => (
                <React.Fragment key={label}>
                  <Text style={styles.cardLabel}>{label}: {val}</Text>
                  <View style={styles.severityRow}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => set(s)}
                        disabled={!!todayMoodEntry}
                        style={[styles.sevDot, val >= s && styles.sevDotActive]}
                      />
                    ))}
                  </View>
                </React.Fragment>
              ))}
              <AppInput
                label="Notes (optional)"
                value={moodNotes}
                onChangeText={setMoodNotes}
                placeholder="Add anything your doctor should know"
                editable={!todayMoodEntry}
                multiline
                style={styles.moodNotesInput}
              />
              {todayMoodEntry ? (
                <View style={styles.todayMoodCard}>
                  <Text style={styles.todayMoodTitle}>Today's entry</Text>
                  <Text style={styles.todayMoodLine}>
                    Mood: {todayMoodEntry.mood} · Energy {todayMoodEntry.energy_level} · Stress{" "}
                    {todayMoodEntry.stress_level} · Sleep {todayMoodEntry.sleep_quality}
                  </Text>
                  {todayMoodEntry.notes ? (
                    <Text style={styles.todayMoodNotes}>{todayMoodEntry.notes}</Text>
                  ) : null}
                </View>
              ) : null}
              <PrimaryButton
                label={saveFeedbackLabel(moodSave.status, "Save mood")}
                onPress={logMood}
                disabled={!!todayMoodEntry || moodSave.status === "saving"}
                feedbackStatus={moodSave.status}
              />
            </GlassCard>
          </>
        )}
      </AppScreen>

      {confirmDelete?.visible && (
        <View style={styles.overlayWrap}>
          <Pressable style={styles.overlayBg} onPress={() => setConfirmDelete(null)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Period logged</Text>
            <Text style={styles.sheetDate}>
              {`${formatDate(confirmDelete.rangeStart)} – ${formatDate(confirmDelete.rangeEnd)} · ${confirmDelete.rangeLength} days`}
            </Text>

            <Pressable style={styles.deleteBtn} onPress={confirmDeletePeriod}>
              <Feather name="trash-2" size={16} color="#E25555" />
              <Text style={styles.deleteBtnText}>Delete period</Text>
            </Pressable>

            <Pressable onPress={() => setConfirmDelete(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: "#231F29" },
  bellPill: { width: 36, height: 36, borderRadius: 18, backgroundColor: PERIOD_BG, alignItems: "center", justifyContent: "center" },
  heroCard: { flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: PERIOD_BG },
  ring: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  ringFill: { position: "absolute", width: 80, height: 80, borderRadius: 40, borderWidth: 6 },
  heroEyebrow: { fontSize: 12, color: "#A94D7A", fontWeight: "700" },
  heroPhase: { fontSize: 20, fontWeight: "800", color: "#231F29", marginTop: 4 },
  heroDay: { fontSize: 12, color: "#7F7486", marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1, alignItems: "flex-start", gap: 6 },
  statLabel: { fontSize: 12, color: "#7F7486" },
  statValue: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  tabBar: { flexDirection: "row", backgroundColor: "#FFF6FA", borderRadius: 999, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
  tabActive: { backgroundColor: PERIOD_COLOR },
  tabText: { fontSize: 13, fontWeight: "700", color: "#7F7486" },
  tabTextActive: { color: "#FFFFFF" },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#231F29", marginBottom: 12 },
  calHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calNavBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: PERIOD_BG, alignItems: "center", justifyContent: "center" },
  cardLabel: { fontSize: 13, color: "#7F7486", fontWeight: "600", marginTop: 8, marginBottom: 6 },
  weekHeader: { flexDirection: "row", marginBottom: 8 },
  weekHeaderCell: { flex: 1, textAlign: "center", fontSize: 11, color: "#7F7486", fontWeight: "700" },
  calendarGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  dayCellDisabled: { opacity: 0.7 },
  rangeStrip: { position: "absolute", top: "20%", bottom: "20%", left: 0, right: 0, backgroundColor: PERIOD_BG },
  rangeStripStart: { left: "50%" },
  rangeStripEnd: { right: "50%" },
  dayInner: { flex: 1, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  dayPending: { borderWidth: 1.5, borderColor: PERIOD_COLOR },
  dayConfirmed: { backgroundColor: PERIOD_COLOR },
  dayPredicted: {
    borderWidth: 1.5,
    borderColor: PERIOD_COLOR,
    borderStyle: "dashed",
    backgroundColor: "transparent",
  },
  dayToday: { borderWidth: 1.5, borderColor: PERIOD_COLOR },
  dayText: { fontSize: 12, color: "#231F29", fontWeight: "600" },
  dayTextLight: { color: "#FFFFFF" },
  dayTextPredicted: { color: PERIOD_COLOR, fontWeight: "700" },
  dayTextToday: { color: PERIOD_COLOR, fontWeight: "800" },
  legendRow: { flexDirection: "row", gap: 16, marginTop: 12, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendDotPredicted: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: PERIOD_COLOR,
    borderStyle: "dashed",
  },
  legendText: { fontSize: 11, color: "#7F7486", fontWeight: "600" },
  hintRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 10 },
  hintText: { fontSize: 11, color: "#B09ABF" },
  flowRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  flowDot: { flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 2, alignItems: "center" },
  flowText: { fontSize: 12, fontWeight: "700", color: "#231F29", textTransform: "capitalize" },
  flowTextActive: { color: "#FFFFFF" },
  medicationHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  medicationHint: { fontSize: 12, color: "#7F7486", marginTop: -6 },
  medicationCounter: { fontSize: 12, color: PERIOD_COLOR, fontWeight: "800" },
  prescriptionList: { gap: 10 },
  prescriptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F0DCE7",
    backgroundColor: "#FFFFFF",
    padding: 12,
  },
  prescriptionRowSaved: { backgroundColor: "#F0F7F2", borderColor: "#C7DDCE" },
  prescriptionCheckBox: { marginTop: 0 },
  prescriptionName: { fontSize: 14, fontWeight: "800", color: "#231F29" },
  prescriptionMeta: { fontSize: 12, color: "#7F7486", marginTop: 2 },
  prescriptionInstructions: { fontSize: 12, color: "#4A4351", marginTop: 4, lineHeight: 17 },
  savedPill: {
    borderRadius: 999,
    backgroundColor: "#F0F7F2",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  savedPillText: { fontSize: 11, color: "#5F8F72", fontWeight: "900" },
  emptyText: { color: "#7F7486", fontSize: 13 },
  medicationList: { gap: 10 },
  medicationRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#F0DCE7",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  checkBoxActive: { backgroundColor: PERIOD_COLOR, borderColor: PERIOD_COLOR },
  medicationInputWrap: { flex: 1 },
  removeMedicationBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#FFF4F4",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  removeMedicationBtnDisabled: { opacity: 0.35 },
  medicationRowLocked: { opacity: 0.95 },
  medicationActions: { gap: 12, marginTop: 12 },
  addMedicationBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#F0DCE7",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  addMedicationBtnDisabled: { opacity: 0.5 },
  addMedicationText: { color: PERIOD_COLOR, fontSize: 13, fontWeight: "800" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: "#FFF6FA", borderWidth: 1, borderColor: "#F0DCE7" },
  chipActive: { backgroundColor: PERIOD_COLOR, borderColor: PERIOD_COLOR },
  chipText: { color: "#7F7486", fontWeight: "600", textTransform: "capitalize", fontSize: 12 },
  chipTextActive: { color: "#FFFFFF" },
  severityRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  sevDot: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#F0DCE7" },
  sevDotActive: { backgroundColor: PERIOD_COLOR },
  moodChart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", height: 140, marginBottom: 12 },
  barWrap: { alignItems: "center", gap: 4, flex: 1 },
  barTrack: { width: 22, height: 100, backgroundColor: PERIOD_BG, borderRadius: 11, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", backgroundColor: PERIOD_COLOR, borderRadius: 11 },
  barLabel: { fontSize: 10, color: "#7F7486", textAlign: "center" },
  barValue: { fontSize: 10, color: "#231F29", fontWeight: "700" },
  reportRangeText: { fontSize: 12, color: "#7F7486", fontWeight: "700", marginTop: -6, marginBottom: 4 },
  miniStatRow: { flexDirection: "row", gap: 8 },
  miniStat: { flex: 1, backgroundColor: "#FFF6FA", padding: 10, borderRadius: 12, alignItems: "center" },
  miniStatLabel: { fontSize: 11, color: "#7F7486" },
  miniStatValue: { fontSize: 16, fontWeight: "800", color: PERIOD_COLOR, marginTop: 2 },
  moodHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  moodSavedHint: { color: "#7F7486", fontSize: 12, marginTop: -6 },
  moodNotesInput: { minHeight: 84, textAlignVertical: "top", paddingTop: 14 },
  todayMoodCard: {
    borderRadius: 14,
    backgroundColor: "#F0F7F2",
    borderWidth: 1,
    borderColor: "#C7DDCE",
    padding: 12,
    gap: 4,
  },
  todayMoodTitle: { color: "#5F8F72", fontSize: 12, fontWeight: "900" },
  todayMoodLine: { color: "#231F29", fontSize: 13, fontWeight: "700", textTransform: "capitalize" },
  todayMoodNotes: { color: "#4A4351", fontSize: 12, lineHeight: 18 },
  error: { color: "#E25555" },
  inlineErrorBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F3B0B0",
    backgroundColor: "#FFF4F4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  inlineErrorText: { flex: 1, color: "#B23A3A", fontSize: 12, lineHeight: 18 },
  overlayWrap: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end", zIndex: 100 },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 48, gap: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E0D5E8", alignSelf: "center", marginBottom: 4 },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#231F29" },
  sheetDate: { fontSize: 14, color: "#7F7486", marginTop: -4 },
  deleteBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#E25555", justifyContent: "center" },
  deleteBtnText: { fontSize: 14, fontWeight: "700", color: "#E25555" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, color: "#7F7486", fontWeight: "600" },
});
