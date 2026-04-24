import asyncio

from backend.app.database import AsyncSessionLocal
from backend.app.models.article import Article


ARTICLES = [
    {
        "title": "Understanding your menstrual cycle",
        "summary": "A simple overview of the four phases and what happens in each.",
        "content": (
            "The menstrual cycle is usually 21 to 35 days long and is driven by "
            "hormonal shifts. It is commonly divided into four phases:\n\n"
            "1. Menstrual phase — the uterine lining sheds, energy is often lower.\n"
            "2. Follicular phase — estrogen rises, energy and mood typically lift.\n"
            "3. Ovulation — an egg is released; fertility peaks during this short window.\n"
            "4. Luteal phase — progesterone rises, some people experience PMS-like symptoms.\n\n"
            "Tracking your cycle helps you notice your own patterns. If you notice "
            "large irregularities (cycles shorter than 21 or longer than 35 days, "
            "very heavy bleeding, or prolonged spotting), bring this information "
            "to your gynecologist."
        ),
        "category": "Cycle basics",
        "requires_subscription": False,
    },
    {
        "title": "How to track symptoms without getting overwhelmed",
        "summary": "A minimal-effort approach to symptom tracking that still gives useful data.",
        "content": (
            "You do not need to log everything every day. Focus on the signals "
            "that matter most for you — for many people that is: flow intensity, "
            "cramp severity, mood, and sleep quality. Pick three or four items "
            "and stay consistent for two or three cycles. Patterns usually start "
            "to emerge after the second cycle, and you can bring that data to "
            "your doctor to make appointments much more productive."
        ),
        "category": "Self-care",
        "requires_subscription": False,
    },
    {
        "title": "When to see a gynecologist",
        "summary": "Common signs that deserve a professional opinion rather than waiting.",
        "content": (
            "Most routine cycles do not need medical attention. However, consider "
            "booking an appointment if you experience: missed periods for three "
            "months in a row without pregnancy, very heavy bleeding that soaks "
            "through a pad every hour, severe pain that interferes with daily "
            "life, bleeding between periods, or new symptoms that worry you. "
            "Preventive check-ups are also recommended once a year even when "
            "everything feels fine."
        ),
        "category": "Medical guidance",
        "requires_subscription": False,
    },
    {
        "title": "Sleep and hormonal health",
        "summary": "Why consistent sleep matters for your cycle.",
        "content": (
            "Sleep quality directly affects the hormonal system that regulates "
            "the menstrual cycle. Poor sleep elevates cortisol, which can "
            "interfere with estrogen and progesterone balance. Aim for a "
            "consistent bedtime, reduce screen exposure 30 minutes before sleep, "
            "and keep the bedroom cool and dark. Even small improvements in "
            "sleep routine tend to show up in mood and cycle regularity within "
            "a few weeks."
        ),
        "category": "Self-care",
        "requires_subscription": False,
    },
    {
        "title": "Iron, nutrition, and periods",
        "summary": "Simple nutrition habits that support you through menstruation.",
        "content": (
            "People who menstruate are at higher risk of iron deficiency, "
            "especially with heavier periods. Lean red meat, legumes, tofu, "
            "dark leafy greens, and fortified cereals all contribute iron. "
            "Pairing plant sources of iron with vitamin C (citrus, bell peppers) "
            "improves absorption. If you feel consistently exhausted, short of "
            "breath on mild activity, or notice pale skin, ask your doctor for "
            "a ferritin test."
        ),
        "category": "Nutrition",
        "requires_subscription": False,
    },

    {
        "title": "Decoding PMS vs PMDD",
        "summary": "What is normal, what is not, and what to do about it.",
        "content": (
            "Premenstrual syndrome (PMS) affects most menstruating people to "
            "some degree — mood shifts, bloating, breast tenderness in the luteal "
            "phase. Premenstrual dysphoric disorder (PMDD) is a much more severe, "
            "clinically recognised condition: intense irritability, depression, "
            "or anxiety that significantly disrupts life, consistently in the "
            "week or two before menstruation. PMDD is underdiagnosed. If your "
            "symptoms feel disproportionate, track them for two cycles and show "
            "your gynecologist — treatment options exist and they work."
        ),
        "category": "Medical guidance",
        "requires_subscription": True,
    },
    {
        "title": "PCOS: what the diagnosis really means",
        "summary": "A practical, non-alarmist guide for people who just heard the term PCOS.",
        "content": (
            "Polycystic ovary syndrome is common and highly manageable. A "
            "diagnosis usually requires two of three: irregular cycles, signs "
            "of elevated androgens (acne, excess hair growth), and polycystic "
            "ovaries on ultrasound. PCOS is not an endpoint — it is a label "
            "that opens up specific treatment paths. Lifestyle changes "
            "(consistent sleep, balanced nutrition, strength training), "
            "targeted supplements, and in some cases medication can "
            "significantly improve symptoms and cycle regularity. Work "
            "with a gynecologist you trust — PCOS responds well to a plan."
        ),
        "category": "Conditions",
        "requires_subscription": True,
    },
    {
        "title": "Stress, cortisol, and cycle length",
        "summary": "Why chronic stress shortens or lengthens your cycle — and what helps.",
        "content": (
            "Chronic stress elevates cortisol, which competes with "
            "reproductive hormones for the same biochemical precursors. The "
            "result can be delayed ovulation (longer cycles), skipped cycles, "
            "or more intense PMS. Relief does not require a silent retreat — "
            "ten minutes of daily slow breathing, regular walks outside, "
            "limiting caffeine after 2 PM, and protecting sleep already shift "
            "the baseline. If stress is persistent and overwhelming, a "
            "conversation with a therapist is as clinically relevant as any "
            "medication for cycle health."
        ),
        "category": "Self-care",
        "requires_subscription": True,
    },
]


async def seed():
    async with AsyncSessionLocal() as session:
        for data in ARTICLES:
            session.add(Article(**data))
        await session.commit()
        free = sum(1 for a in ARTICLES if not a["requires_subscription"])
        premium = sum(1 for a in ARTICLES if a["requires_subscription"])
        print(
            f"Seed completed: {len(ARTICLES)} articles "
            f"({free} free, {premium} premium)"
        )


if __name__ == "__main__":
    asyncio.run(seed())