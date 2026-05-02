import type { Feather } from "@expo/vector-icons";

export type MedicationGuide = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  description: string;
  purpose: string;
  instructions: string[];
  contraindications: string[];
};

export const medicationGuides: MedicationGuide[] = [
  {
    id: "ketonal",
    name: "Ketonal",
    subtitle: "100 mg",
    category: "Pain relief",
    icon: "activity",
    color: "#3F6CF6",
    description:
      "Ketonal contains ketoprofen, a non-steroidal anti-inflammatory drug used for short-term pain and inflammation relief.",
    purpose:
      "May be used for strong menstrual cramps, pelvic pain, or inflammatory pain when recommended by a clinician.",
    instructions: [
      "Take after food with a full glass of water.",
      "Use the lowest effective dose for the shortest time.",
      "Do not combine with other NSAIDs such as ibuprofen, naproxen, or aspirin unless a doctor tells you to.",
    ],
    contraindications: [
      "Allergy to ketoprofen, aspirin, or other NSAIDs.",
      "Active stomach ulcer, gastrointestinal bleeding, or severe kidney disease.",
      "Late pregnancy unless specifically prescribed by a doctor.",
    ],
  },
  {
    id: "duphaston",
    name: "Duphaston",
    subtitle: "10 mg",
    category: "Hormonal therapy",
    icon: "heart",
    color: "#E53F8F",
    description:
      "Duphaston contains dydrogesterone, a synthetic progesterone used in several gynecological treatment plans.",
    purpose:
      "May be prescribed for cycle irregularity, luteal phase support, endometriosis-related symptoms, or other progesterone-related conditions.",
    instructions: [
      "Take only according to the schedule prescribed by your doctor.",
      "Try to take each dose at the same time every day.",
      "Do not stop suddenly without discussing it with your clinician.",
    ],
    contraindications: [
      "Known allergy to dydrogesterone or any component of the tablet.",
      "Unexplained vaginal bleeding that has not been evaluated by a doctor.",
      "Known or suspected progesterone-dependent tumors unless cleared by a specialist.",
    ],
  },
  {
    id: "ferretab",
    name: "Ferretab",
    subtitle: "Iron + folic acid",
    category: "Iron support",
    icon: "droplet",
    color: "#C8486D",
    description:
      "Ferretab is an iron supplement combined with folic acid, commonly used to support low iron stores.",
    purpose:
      "May be recommended for iron deficiency, heavy periods, low ferritin, or increased iron needs.",
    instructions: [
      "Take with water, preferably away from tea, coffee, and dairy products.",
      "Vitamin C may help iron absorption.",
      "Dark stool can happen while taking iron and is usually expected.",
    ],
    contraindications: [
      "Iron overload conditions such as hemochromatosis.",
      "Anemia not caused by iron deficiency unless a doctor prescribed it.",
      "Known allergy to any ingredient in the product.",
    ],
  },
  {
    id: "canesten",
    name: "Canesten",
    subtitle: "Clotrimazole",
    category: "Antifungal",
    icon: "shield",
    color: "#38A169",
    description:
      "Canesten contains clotrimazole, an antifungal medicine used for yeast infections.",
    purpose:
      "May be used for vaginal thrush symptoms such as itching, irritation, and thick white discharge when appropriate.",
    instructions: [
      "Use exactly as described on the package or by your clinician.",
      "Complete the full course even if symptoms improve earlier.",
      "Avoid using tampons during vaginal treatment unless your clinician says it is okay.",
    ],
    contraindications: [
      "Allergy to clotrimazole or other azole antifungals.",
      "First episode of vaginal symptoms without medical evaluation.",
      "Fever, pelvic pain, foul-smelling discharge, or bleeding needs medical review before use.",
    ],
  },
  {
    id: "magnerot",
    name: "Magnerot",
    subtitle: "Magnesium orotate",
    category: "Cycle support",
    icon: "moon",
    color: "#7C6CF3",
    description:
      "Magnerot is a magnesium preparation that supports muscle and nervous system function.",
    purpose:
      "May be used as supportive care for PMS discomfort, muscle tension, stress, or cramps when suitable.",
    instructions: [
      "Take as directed, often with water before or after meals depending on tolerance.",
      "Use consistently if it is part of a longer support plan.",
      "Reduce dose and contact a clinician if diarrhea or stomach upset appears.",
    ],
    contraindications: [
      "Severe kidney disease unless prescribed and monitored.",
      "Known allergy to magnesium orotate or product ingredients.",
      "Use caution with medicines affected by magnesium, such as some antibiotics.",
    ],
  },
  {
    id: "nurofen",
    name: "Nurofen",
    subtitle: "Ibuprofen 200 mg",
    category: "Pain relief",
    icon: "activity",
    color: "#DD8A29",
    description:
      "Nurofen contains ibuprofen, an NSAID used for pain, fever, and inflammation.",
    purpose:
      "Can help with menstrual cramps and short-term pain when there are no contraindications.",
    instructions: [
      "Take with food or milk to reduce stomach irritation.",
      "Follow the dose on the package or your doctor's instructions.",
      "Do not combine with Ketonal or other NSAIDs unless your doctor says so.",
    ],
    contraindications: [
      "Allergy to ibuprofen, aspirin, or other NSAIDs.",
      "Active stomach ulcer, severe heart, liver, or kidney disease.",
      "Late pregnancy unless specifically prescribed by a doctor.",
    ],
  },
  {
    id: "utrogestan",
    name: "Utrogestan",
    subtitle: "Progesterone",
    category: "Hormonal therapy",
    icon: "sun",
    color: "#A94D7A",
    description:
      "Utrogestan contains micronized progesterone and is used in specific gynecological and fertility-related treatment plans.",
    purpose:
      "May be prescribed for progesterone support, cycle-related indications, or assisted reproduction protocols.",
    instructions: [
      "Use only as prescribed; it may be taken orally or vaginally depending on the plan.",
      "Follow the exact timing and route given by your clinician.",
      "It may cause sleepiness, so ask your doctor about the best time to take it.",
    ],
    contraindications: [
      "Allergy to progesterone or product ingredients.",
      "Unexplained vaginal bleeding, severe liver disease, or active blood clotting disorder.",
      "Known or suspected hormone-dependent cancer unless approved by a specialist.",
    ],
  },
];

export function getMedicationGuide(id: string) {
  return medicationGuides.find((medication) => medication.id === id);
}
