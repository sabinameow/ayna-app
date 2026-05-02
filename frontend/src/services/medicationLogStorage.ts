import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ayna.patient.medicationLogs";

export type LocalMedicationLog = {
  id: string;
  date: string;
  name: string;
  taken: boolean;
  createdAt: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function listLocalMedicationLogs(): Promise<LocalMedicationLog[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cleanMedicationNames(names: string[]) {
  const seen = new Set<string>();
  const clean: string[] = [];

  for (const rawName of names) {
    const name = rawName.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    clean.push(name);
    if (clean.length >= 5) break;
  }

  return clean;
}

export async function listLocalMedicationLogsForDate(date: string): Promise<LocalMedicationLog[]> {
  const logs = await listLocalMedicationLogs();
  return logs.filter((log) => log.date === date && log.taken);
}

export async function saveLocalMedicationLogsForDate(
  date: string,
  names: string[]
): Promise<LocalMedicationLog[]> {
  const cleanNames = cleanMedicationNames(names);
  const existing = await listLocalMedicationLogs();
  const createdAt = new Date().toISOString();
  const nextLogs: LocalMedicationLog[] = cleanNames.map((name) => ({
    id: makeId(),
    date,
    name,
    taken: true,
    createdAt,
  }));
  const next = [...nextLogs, ...existing.filter((log) => log.date !== date)].slice(0, 200);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
