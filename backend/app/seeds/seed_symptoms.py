import asyncio
import uuid

from backend.app.database import AsyncSessionLocal
from backend.app.models.symptom import Symptom
from backend.app.models.test_requirement import SymptomTestMapping


SYMPTOMS = [
    ("Lower abdominal pain", "Pain"),
    ("Lower back pain", "Pain"),
    ("Headache", "Pain"),
    ("Breast tenderness", "Pain"),
    ("Pelvic pain", "Pain"),

    ("Heavy bleeding", "Menstrual"),
    ("Irregular periods", "Menstrual"),
    ("Spotting between periods", "Menstrual"),
    ("Missed period", "Menstrual"),
    ("Prolonged period", "Menstrual"),

    ("Fatigue", "General"),
    ("Nausea", "General"),
    ("Dizziness", "General"),
    ("Bloating", "General"),
    ("Mood swings", "General"),

    ("Acne", "Skin & Hair"),
    ("Hair loss", "Skin & Hair"),
    ("Excessive hair growth", "Skin & Hair"),

    ("Unusual discharge", "Reproductive"),
    ("Itching or irritation", "Reproductive"),
]

TEST_MAPPINGS = {
    "Heavy bleeding": [
        ("Complete blood count (CBC)", "Check for anemia and blood disorders", True, 1),
        ("Pelvic ultrasound", "Evaluate uterine structure", True, 2),
        ("Thyroid panel (TSH, T3, T4)", "Rule out thyroid dysfunction", False, 3),
    ],
    "Irregular periods": [
        ("Hormone panel (FSH, LH, Estradiol)", "Evaluate hormonal balance", True, 1),
        ("Thyroid panel (TSH, T3, T4)", "Rule out thyroid issues", True, 2),
        ("Pelvic ultrasound", "Check for PCOS or structural issues", True, 3),
        ("Prolactin level", "Rule out hyperprolactinemia", False, 4),
    ],
    "Missed period": [
        ("Pregnancy test (hCG)", "Confirm or rule out pregnancy", True, 1),
        ("Hormone panel (FSH, LH, Estradiol)", "Evaluate hormonal status", True, 2),
        ("Thyroid panel (TSH, T3, T4)", "Rule out thyroid dysfunction", False, 3),
    ],
    "Excessive hair growth": [
        ("Testosterone (total and free)", "Check for androgen excess", True, 1),
        ("DHEA-S", "Evaluate adrenal androgen production", True, 2),
        ("Pelvic ultrasound", "Screen for PCOS", True, 3),
    ],
    "Hair loss": [
        ("Ferritin", "Check iron stores", True, 1),
        ("Thyroid panel (TSH, T3, T4)", "Rule out thyroid disorders", True, 2),
        ("Testosterone (total and free)", "Check for androgen imbalance", False, 3),
    ],
    "Acne": [
        ("Testosterone (total and free)", "Check androgen levels", True, 1),
        ("DHEA-S", "Evaluate adrenal function", False, 2),
    ],
    "Unusual discharge": [
        ("Vaginal swab culture", "Identify infection", True, 1),
        ("STI panel", "Screen for sexually transmitted infections", True, 2),
    ],
    "Pelvic pain": [
        ("Pelvic ultrasound", "Evaluate pelvic organs", True, 1),
        ("Complete blood count (CBC)", "Check for infection markers", True, 2),
        ("Urinalysis", "Rule out urinary tract issues", False, 3),
    ],
}


async def seed():
    async with AsyncSessionLocal() as session:
        symptom_map = {}

        for name, category in SYMPTOMS:
            symptom_id = uuid.uuid4()
            session.add(Symptom(id=symptom_id, name=name, category=category))
            symptom_map[name] = symptom_id

        for symptom_name, tests in TEST_MAPPINGS.items():
            if symptom_name not in symptom_map:
                continue
            for test_name, description, mandatory, priority in tests:
                session.add(SymptomTestMapping(
                    symptom_id=symptom_map[symptom_name],
                    test_name=test_name,
                    test_description=description,
                    is_mandatory=mandatory,
                    priority=priority,
                ))

        await session.commit()
        print(f"Seed completed: {len(SYMPTOMS)} symptoms, {sum(len(v) for v in TEST_MAPPINGS.values())} test mappings")


if __name__ == "__main__":
    asyncio.run(seed())