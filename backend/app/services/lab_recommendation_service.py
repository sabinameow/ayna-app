from collections.abc import Iterable


DISCLAIMER = (
    "These are general suggestions and do not replace medical advice. "
    "Your doctor will confirm what is needed."
)

RECOMMENDATION_LIBRARY = {
    "Complete Blood Count (CBC)": {
        "name": "Complete Blood Count (CBC)",
        "reason": (
            "Checks hemoglobin and blood cell counts. It can help your doctor see whether heavy "
            "or irregular bleeding may be linked to blood loss or anemia."
        ),
        "priority": "high",
    },
    "Ferritin / Iron level": {
        "name": "Ferritin / Iron level",
        "reason": (
            "Measures the body's iron stores. It can help show whether ongoing bleeding may be "
            "affecting your iron levels."
        ),
        "priority": "medium",
    },
    "Pregnancy test": {
        "name": "Pregnancy test",
        "reason": (
            "Checks for pregnancy. Doctors often rule this out first when bleeding patterns, "
            "pelvic symptoms, or missed periods change."
        ),
        "priority": "high",
    },
    "Pelvic ultrasound": {
        "name": "Pelvic ultrasound",
        "reason": (
            "An imaging test that looks at the uterus, ovaries, and nearby pelvic organs. It can "
            "help the doctor look for cysts, fibroids, or other structural changes."
        ),
        "priority": "medium",
    },
    "Urine test": {
        "name": "Urine test",
        "reason": (
            "Checks the urine for signs such as infection, irritation, or other urinary changes "
            "that can overlap with pelvic symptoms."
        ),
        "priority": "medium",
    },
    "CRP or inflammation markers": {
        "name": "CRP or inflammation markers",
        "reason": (
            "A blood test that looks for signs of inflammation. It can give the doctor more "
            "context when pain or infection is being discussed."
        ),
        "priority": "medium",
    },
    "Vaginal swab / microscopy": {
        "name": "Vaginal swab / microscopy",
        "reason": (
            "Collects a small sample of discharge to look for yeast, bacterial imbalance, or "
            "other local causes of discharge and irritation."
        ),
        "priority": "high",
    },
    "STI test panel": {
        "name": "STI test panel",
        "reason": (
            "Checks for common sexually transmitted infections that can sometimes cause discharge, "
            "odor, burning, or irritation."
        ),
        "priority": "medium",
    },
    "hCG blood test": {
        "name": "hCG blood test",
        "reason": (
            "Measures the pregnancy hormone in the blood. It is more precise than a home urine "
            "test and can help clarify missed or delayed periods."
        ),
        "priority": "high",
    },
    "Hormone panel": {
        "name": "Hormone panel",
        "reason": (
            "A group of blood tests that looks at hormone levels linked to ovulation and cycle "
            "patterns. It can help the doctor evaluate irregular periods and related symptoms."
        ),
        "priority": "high",
    },
    "Testosterone": {
        "name": "Testosterone",
        "reason": (
            "Measures testosterone levels in the blood. It can help the doctor assess acne, "
            "increased hair growth, or other signs of androgen imbalance."
        ),
        "priority": "medium",
    },
    "TSH": {
        "name": "TSH",
        "reason": (
            "Checks thyroid-stimulating hormone, which helps show how the thyroid is working. "
            "Thyroid changes can affect periods, energy, and weight."
        ),
        "priority": "medium",
    },
    "Prolactin": {
        "name": "Prolactin",
        "reason": (
            "Measures prolactin in the blood. High prolactin can sometimes affect cycle timing "
            "and ovulation."
        ),
        "priority": "medium",
    },
}


RULES = [
    {
        "symptoms": {
            "irregular bleeding",
            "heavy bleeding",
            "bleeding between periods",
            "spotting between periods",
        },
        "recommendations": [
            RECOMMENDATION_LIBRARY["Complete Blood Count (CBC)"],
            RECOMMENDATION_LIBRARY["Ferritin / Iron level"],
            RECOMMENDATION_LIBRARY["Pregnancy test"],
            RECOMMENDATION_LIBRARY["Pelvic ultrasound"],
        ],
    },
    {
        "symptoms": {
            "pelvic pain",
            "lower abdominal pain",
            "painful periods",
        },
        "recommendations": [
            {**RECOMMENDATION_LIBRARY["Pelvic ultrasound"], "priority": "high"},
            RECOMMENDATION_LIBRARY["Urine test"],
            RECOMMENDATION_LIBRARY["Pregnancy test"],
            RECOMMENDATION_LIBRARY["CRP or inflammation markers"],
        ],
    },
    {
        "symptoms": {
            "unusual discharge",
            "itching",
            "itching or irritation",
            "burning",
            "bad smell",
        },
        "recommendations": [
            RECOMMENDATION_LIBRARY["Vaginal swab / microscopy"],
            RECOMMENDATION_LIBRARY["STI test panel"],
            RECOMMENDATION_LIBRARY["Urine test"],
        ],
    },
    {
        "symptoms": {
            "missed period",
            "delayed period",
            "nausea",
        },
        "recommendations": [
            RECOMMENDATION_LIBRARY["Pregnancy test"],
            RECOMMENDATION_LIBRARY["hCG blood test"],
        ],
    },
    {
        "symptoms": {
            "acne",
            "excessive hair growth",
            "irregular cycle",
            "irregular periods",
            "weight gain",
        },
        "recommendations": [
            RECOMMENDATION_LIBRARY["Hormone panel"],
            RECOMMENDATION_LIBRARY["Testosterone"],
            RECOMMENDATION_LIBRARY["TSH"],
            RECOMMENDATION_LIBRARY["Prolactin"],
            RECOMMENDATION_LIBRARY["Pelvic ultrasound"],
        ],
    },
]


LEGACY_RECOMMENDATION_ALIASES = {
    "общий анализ крови (оак)": RECOMMENDATION_LIBRARY["Complete Blood Count (CBC)"],
    "ферритин / уровень железа": RECOMMENDATION_LIBRARY["Ferritin / Iron level"],
    "тест на беременность": RECOMMENDATION_LIBRARY["Pregnancy test"],
    "узи органов малого таза": RECOMMENDATION_LIBRARY["Pelvic ultrasound"],
    "анализ мочи": RECOMMENDATION_LIBRARY["Urine test"],
    "с-реактивный белок или маркеры воспаления": RECOMMENDATION_LIBRARY["CRP or inflammation markers"],
    "вагинальный мазок / микроскопия": RECOMMENDATION_LIBRARY["Vaginal swab / microscopy"],
    "панель анализов на иппп": RECOMMENDATION_LIBRARY["STI test panel"],
    "анализ крови на хгч": RECOMMENDATION_LIBRARY["hCG blood test"],
    "гормональная панель": RECOMMENDATION_LIBRARY["Hormone panel"],
    "тестостерон": RECOMMENDATION_LIBRARY["Testosterone"],
    "ттг": RECOMMENDATION_LIBRARY["TSH"],
    "пролактин": RECOMMENDATION_LIBRARY["Prolactin"],
}


def normalize_symptom_name(value: str) -> str:
    return " ".join(value.strip().lower().replace("-", " ").split())


def normalize_lab_recommendation_records(
    recommendations: Iterable[object] | None,
) -> list[dict[str, str]]:
    normalized_records: list[dict[str, str]] = []
    seen_names: set[str] = set()

    for item in recommendations or []:
        if isinstance(item, str):
            name = item.strip()
            if not name:
                continue
            normalized_name = name.lower()
            if normalized_name in seen_names:
                continue
            seen_names.add(normalized_name)
            normalized_records.append(
                {
                    "name": name,
                    "reason": "May be helpful to discuss with your doctor before the visit.",
                    "priority": "medium",
                }
            )
            continue

        if not isinstance(item, dict):
            continue

        raw_name = item.get("name") or item.get("test_name")
        if not isinstance(raw_name, str) or not raw_name.strip():
            continue

        normalized_name = raw_name.strip().lower()
        legacy_copy = LEGACY_RECOMMENDATION_ALIASES.get(normalized_name)
        name = legacy_copy["name"] if legacy_copy else raw_name.strip()
        normalized_name = name.lower()
        if normalized_name in seen_names:
            continue

        raw_reason = legacy_copy["reason"] if legacy_copy else item.get("reason") or item.get("test_description")
        raw_priority = legacy_copy["priority"] if legacy_copy else item.get("priority")
        seen_names.add(normalized_name)
        normalized_records.append(
            {
                "name": name,
                "reason": raw_reason.strip()
                if isinstance(raw_reason, str) and raw_reason.strip()
                else "May be helpful to discuss with your doctor before the visit.",
                "priority": raw_priority.strip()
                if isinstance(raw_priority, str) and raw_priority.strip()
                else "medium",
            }
        )

    priority_order = {"high": 0, "medium": 1, "low": 2}
    return sorted(
        normalized_records,
        key=lambda item: (priority_order.get(item.get("priority", "low"), 9), item["name"]),
    )


def get_lab_recommendations(symptoms: Iterable[str]) -> list[dict[str, str]]:
    normalized = {normalize_symptom_name(symptom) for symptom in symptoms if symptom and symptom.strip()}
    recommendations_by_name: dict[str, dict[str, str]] = {}

    for rule in RULES:
        if normalized.intersection(rule["symptoms"]):
            for recommendation in rule["recommendations"]:
                recommendations_by_name.setdefault(recommendation["name"], recommendation)
    return normalize_lab_recommendation_records(recommendations_by_name.values())
