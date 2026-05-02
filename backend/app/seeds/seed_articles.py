import asyncio

from backend.app.database import AsyncSessionLocal
from backend.app.models.article import Article


ARTICLES = [
    {
        "title": "Understanding your menstrual cycle",
        "summary": "A simple overview of the four phases and what happens in each.",
        "content": (
            "The menstrual cycle is usually 21 to 35 days long and is driven by "
            "hormonal shifts that repeat in a predictable — though not perfectly "
            "identical — pattern each month. Understanding the four phases gives "
            "you a framework to interpret your energy, mood, appetite, and "
            "physical sensations instead of experiencing them as random events.\n\n"
            "1. Menstrual phase (days 1–5 on average) — the uterine lining sheds "
            "because no fertilised egg implanted. Estrogen and progesterone are at "
            "their lowest. Energy and motivation are often reduced, and the body "
            "benefits from rest. Cramps result from prostaglandins signalling the "
            "uterus to contract; this is normal in mild to moderate amounts.\n\n"
            "2. Follicular phase (days 1–13, overlapping with menstruation) — the "
            "pituitary gland releases follicle-stimulating hormone (FSH), which "
            "prompts several follicles in the ovaries to begin maturing. As they "
            "grow, they produce estrogen. Rising estrogen rebuilds the uterine "
            "lining and tends to improve mood, focus, and physical stamina. Many "
            "people feel their sharpest and most sociable during this phase.\n\n"
            "3. Ovulation (around day 14 in a 28-day cycle, but highly variable) — "
            "a surge in luteinising hormone (LH) triggers the dominant follicle to "
            "release an egg. The egg can be fertilised for roughly 12 to 24 hours, "
            "though sperm can survive for several days beforehand, making the "
            "fertile window wider. Some people notice a brief one-sided pelvic "
            "twinge called mittelschmerz, a slight rise in basal body temperature, "
            "or changes in cervical mucus around this time.\n\n"
            "4. Luteal phase (days 15–28) — the empty follicle becomes the corpus "
            "luteum, which produces progesterone to support a potential pregnancy. "
            "If no pregnancy occurs, the corpus luteum breaks down, both hormones "
            "fall, and the cycle restarts. Progesterone has a calming but sometimes "
            "fatigue-inducing effect; the late luteal phase is when PMS symptoms "
            "tend to appear — bloating, breast tenderness, mood sensitivity.\n\n"
            "Tracking your cycle for two or three months helps you recognise your "
            "personal version of these phases, which can differ significantly from "
            "the textbook average. If you notice large irregularities — cycles "
            "consistently shorter than 21 or longer than 35 days, very heavy "
            "bleeding, prolonged spotting between periods, or severe pain — bring "
            "that information to your gynecologist. Your data makes the conversation "
            "much more useful."
        ),
        "category": "Cycle basics",
        "requires_subscription": False,
    },
    {
        "title": "How to track symptoms without getting overwhelmed",
        "summary": "A minimal-effort approach to symptom tracking that still gives useful data.",
        "content": (
            "The idea of tracking every symptom every day can feel like another "
            "task on an already full list — and ironically, that pressure leads "
            "most people to stop entirely after a few days. The good news is that "
            "useful data does not require exhaustive logging. A minimal, consistent "
            "approach almost always beats an ambitious but abandoned one.\n\n"
            "Start by choosing three or four signals that matter most to you. For "
            "many people these are: flow intensity (light / medium / heavy / none), "
            "cramp or pain severity on a simple 1–5 scale, mood (a single word or "
            "emoji works fine), and sleep quality. If headaches or energy crashes "
            "are what trouble you most, track those instead. The exact items matter "
            "less than picking ones you will actually log.\n\n"
            "Timing matters more than frequency. Logging once at the end of the day "
            "is enough — you are capturing a summary, not a real-time feed. If you "
            "miss a day, leave it blank rather than guessing. Gaps in data are "
            "normal and honest; invented data is misleading.\n\n"
            "Patterns usually become visible after two complete cycles. You might "
            "notice that low mood reliably appears three days before bleeding, that "
            "energy peaks mid-cycle, or that sleep suffers in the week before your "
            "period. Once you can see a pattern, you can plan around it — "
            "scheduling demanding work or social events in your higher-energy "
            "phases, and protecting recovery time when you know it will be needed.\n\n"
            "Bringing even two or three cycles of simple logs to a doctor's "
            "appointment makes the visit significantly more productive. Instead of "
            "relying on memory — which is notoriously unreliable for cyclical "
            "symptoms — you arrive with actual data. Doctors can identify patterns "
            "you might not have connected, correlate symptoms with cycle timing, "
            "and make more targeted suggestions. A note app, a basic spreadsheet, "
            "or a period tracking app all work; the format is less important than "
            "the consistency."
        ),
        "category": "Self-care",
        "requires_subscription": False,
    },
    {
        "title": "When to see a gynecologist",
        "summary": "Common signs that deserve a professional opinion rather than waiting.",
        "content": (
            "It can be hard to know when a symptom is worth a doctor's visit and "
            "when it is just a normal variation of your cycle. The general rule is: "
            "if something is new, worsening, significantly disruptive to your daily "
            "life, or persistent across multiple cycles, it deserves professional "
            "attention. Waiting and hoping it resolves on its own often delays "
            "diagnosis of treatable conditions.\n\n"
            "Consider booking an appointment if you experience any of the following:\n\n"
            "Missed periods for three consecutive months without pregnancy. This "
            "can indicate hormonal disruption from stress, significant weight "
            "changes, thyroid issues, or conditions like PCOS.\n\n"
            "Very heavy bleeding — soaking through a full pad or tampon every hour "
            "for two or more consecutive hours, or passing clots larger than a "
            "quarter. Heavy bleeding can lead to iron deficiency anaemia even when "
            "it does not feel dramatic.\n\n"
            "Severe pain that interferes with daily activities. Mild to moderate "
            "cramps are common, but pain that prevents you from working, studying, "
            "or functioning for a day or more is not something to simply tolerate. "
            "Conditions like endometriosis and adenomyosis are often under-diagnosed "
            "for years because people assume that level of pain is normal.\n\n"
            "Bleeding between periods, especially if it is new, happening after sex, "
            "or persisting for more than a cycle or two.\n\n"
            "New or unusual symptoms that worry you — even if you cannot fully "
            "articulate why. Your sense that something feels different from your "
            "baseline is a valid reason to seek a professional opinion.\n\n"
            "Preventive check-ups are also recommended once a year even when "
            "everything feels fine. Routine pelvic exams and cervical screenings "
            "catch changes before they become problems. If you are not sure when "
            "you are due for a screening, your gynecologist can advise based on "
            "your age and history."
        ),
        "category": "Medical guidance",
        "requires_subscription": False,
    },
    {
        "title": "Sleep and hormonal health",
        "summary": "Why consistent sleep matters for your cycle.",
        "content": (
            "Sleep is not a passive state — it is one of the most active periods "
            "of hormonal regulation your body undergoes. The relationship between "
            "sleep and reproductive health is bidirectional: poor sleep disrupts "
            "hormones, and hormonal fluctuations across the cycle can in turn "
            "affect sleep quality. Understanding both directions helps explain "
            "why improving sleep often produces noticeable changes in cycle "
            "regularity and symptom severity within just a few weeks.\n\n"
            "On the hormonal side, insufficient or irregular sleep elevates "
            "cortisol, the primary stress hormone. Chronically elevated cortisol "
            "interferes with the hypothalamic-pituitary-ovarian axis — the "
            "hormonal communication chain that regulates your cycle. The practical "
            "effects can include delayed ovulation, shortened or lengthened cycles, "
            "more intense PMS in the luteal phase, or in severe cases, missed "
            "periods altogether.\n\n"
            "On the sleep side, the luteal phase (the two weeks before "
            "menstruation) is the phase most likely to disrupt sleep. Rising "
            "progesterone can cause drowsiness but also more fragmented night "
            "sleep. Body temperature rises slightly after ovulation and stays "
            "higher until menstruation, which can make it harder to fall or stay "
            "asleep. Some people also experience vivid dreams, anxiety, or "
            "night sweats in the late luteal phase.\n\n"
            "Practical steps that consistently help:\n\n"
            "Consistent sleep and wake times — even on weekends — anchor your "
            "circadian rhythm. Your hormonal system runs partly on this internal "
            "clock, so irregular schedules create a form of chronic low-grade "
            "disruption.\n\n"
            "Reducing screen exposure 30 to 60 minutes before bed limits blue "
            "light, which suppresses melatonin onset. Dimming overhead lighting "
            "in the evening has a similar effect.\n\n"
            "Keeping the bedroom cool (around 16–19°C / 61–67°F) supports the "
            "drop in core body temperature that signals sleep onset — especially "
            "useful in the luteal phase when baseline temperature is slightly "
            "elevated.\n\n"
            "Limiting caffeine after early afternoon prevents it from interfering "
            "with adenosine build-up, the biological pressure that makes you "
            "feel sleepy.\n\n"
            "Even modest, consistent improvements in sleep — gaining one extra "
            "hour of quality sleep several nights per week — tend to show up in "
            "mood stability, reduced PMS intensity, and more regular cycle timing "
            "within one to two cycles."
        ),
        "category": "Self-care",
        "requires_subscription": False,
    },
    {
        "title": "Iron, nutrition, and periods",
        "summary": "Simple nutrition habits that support you through menstruation.",
        "content": (
            "Menstruation involves blood loss, and blood contains iron. This "
            "straightforward fact makes people who menstruate significantly more "
            "vulnerable to iron deficiency than those who do not — and yet the "
            "connection between low iron and cycle-related symptoms is frequently "
            "overlooked, both by individuals and in clinical settings.\n\n"
            "Iron deficiency (even before it reaches anaemia) causes fatigue, "
            "difficulty concentrating, reduced exercise tolerance, and pale skin. "
            "These symptoms are easy to attribute to period pain or general stress, "
            "which is why deficiency often goes undetected for months or years. "
            "If you feel consistently exhausted in the days around your period — "
            "or throughout the month — low iron is worth investigating. Ask your "
            "doctor for a ferritin test (ferritin measures stored iron and is a "
            "more sensitive early marker than the standard haemoglobin check).\n\n"
            "Dietary sources of iron fall into two categories:\n\n"
            "Haem iron, found in animal products (lean red meat, poultry, fish, "
            "shellfish), is the most efficiently absorbed form — around 15–35% "
            "of it is taken up regardless of what else you eat.\n\n"
            "Non-haem iron, found in plant foods (legumes, tofu, dark leafy "
            "greens like spinach and kale, pumpkin seeds, fortified cereals and "
            "breads), is absorbed at a lower rate — around 2–20%. The rate can "
            "be meaningfully improved by pairing these foods with a source of "
            "vitamin C (citrus fruit, bell peppers, tomatoes, broccoli) in the "
            "same meal. A bowl of lentil soup with a squeeze of lemon, or "
            "spinach with sliced red pepper, are practical examples.\n\n"
            "Certain compounds reduce iron absorption and are worth spacing out "
            "from iron-rich meals: tannins in tea and coffee, calcium from dairy, "
            "and phytates in raw bran. This does not mean avoiding these foods — "
            "just not combining them with the meal you are relying on for iron.\n\n"
            "Beyond iron, general nutrition habits that support hormonal health "
            "include eating enough total calories (chronic undereating disrupts "
            "ovulation), prioritising fibre for oestrogen regulation, and "
            "maintaining adequate magnesium — found in dark chocolate, nuts, "
            "and seeds — which has modest evidence for reducing cramp severity "
            "and improving sleep in the luteal phase."
        ),
        "category": "Nutrition",
        "requires_subscription": False,
    },
    {
        "title": "Decoding PMS vs PMDD",
        "summary": "What is normal, what is not, and what to do about it.",
        "content": (
            "Premenstrual syndrome (PMS) is so common that it has become culturally "
            "normalised to the point of being dismissed — but that normalisation "
            "has a cost: it makes it genuinely harder for people to recognise when "
            "their symptoms have crossed into something clinically significant. "
            "Understanding where PMS ends and premenstrual dysphoric disorder "
            "(PMDD) begins is not about pathologising normal experience; it is "
            "about ensuring that people with treatable conditions actually get "
            "access to treatment.\n\n"
            "PMS affects up to 75% of menstruating people to some degree. Typical "
            "symptoms appear in the luteal phase (the week or two before "
            "menstruation) and resolve within a few days of bleeding starting. "
            "They include bloating, breast tenderness, headaches, mild mood "
            "changes, irritability, and food cravings. These are real and "
            "sometimes significant, but they do not prevent normal functioning.\n\n"
            "PMDD is a distinct, clinically recognised condition classified in the "
            "DSM-5. It affects approximately 3–8% of menstruating people. The "
            "hallmark is not just worse symptoms — it is symptoms severe enough "
            "to significantly disrupt work, relationships, or daily life, "
            "consistently in the late luteal phase. Core PMDD symptoms include "
            "intense irritability or anger, marked depression or hopelessness, "
            "severe anxiety or tension, and a subjective sense of feeling out of "
            "control. These are not simply 'bad PMS' — they represent a "
            "clinically meaningful disruption that recurs predictably with the "
            "hormonal cycle.\n\n"
            "PMDD is substantially underdiagnosed, partly because symptoms occur "
            "cyclically and may seem to disappear between episodes, and partly "
            "because people are often told their experience is normal when it is "
            "not. The key diagnostic feature is the timing: symptoms must be "
            "confirmed as occurring specifically in the luteal phase — which is "
            "why symptom tracking across two or more cycles is the standard "
            "first step.\n\n"
            "Effective treatment options exist. These include SSRIs (which can be "
            "taken continuously or only during the luteal phase), hormonal "
            "contraception in some cases, lifestyle interventions such as regular "
            "aerobic exercise and calcium supplementation, and cognitive "
            "behavioural therapy. If your symptoms feel disproportionate to what "
            "you are told is normal, track them for two cycles — noting severity, "
            "timing, and specific impact on your functioning — and bring that "
            "record to your gynecologist or GP."
        ),
        "category": "Medical guidance",
        "requires_subscription": True,
    },
    {
        "title": "PCOS: what the diagnosis really means",
        "summary": "A practical, non-alarmist guide for people who just heard the term PCOS.",
        "content": (
            "Polycystic ovary syndrome is one of the most common hormonal "
            "conditions affecting people of reproductive age — estimates range "
            "from 6–12% depending on the diagnostic criteria used — yet it is "
            "frequently surrounded by confusion, alarm, and conflicting "
            "information. A PCOS diagnosis is not a crisis. It is a label that "
            "opens up specific, effective treatment pathways.\n\n"
            "The diagnosis requires two out of three criteria (the Rotterdam "
            "criteria, used internationally): irregular or absent ovulation "
            "reflected in irregular cycles; clinical or biochemical signs of "
            "elevated androgens such as acne, excess facial or body hair, or "
            "elevated testosterone on a blood test; and polycystic ovaries on "
            "ultrasound — which means enlarged ovaries with multiple small "
            "follicles, not cysts in the medical sense of the word. You do not "
            "need all three to receive the diagnosis.\n\n"
            "PCOS is not a single condition but a spectrum. Some people have "
            "primarily metabolic features (insulin resistance, weight changes), "
            "others have predominantly androgenic features (acne, hair changes), "
            "and some have mainly reproductive features (irregular cycles, "
            "difficulty conceiving). Your specific presentation shapes which "
            "interventions are most relevant to you.\n\n"
            "Lifestyle factors have a meaningful and well-documented impact on "
            "PCOS. Consistent sleep stabilises insulin sensitivity and cortisol. "
            "Balanced nutrition — prioritising protein, fibre, and complex "
            "carbohydrates over highly processed foods — improves insulin response. "
            "Strength training in particular has evidence for improving androgen "
            "levels and cycle regularity. None of this means the condition is "
            "'your fault' or purely lifestyle-driven; it means lifestyle is a "
            "lever worth using because it genuinely helps.\n\n"
            "Medical options include metformin (for insulin resistance), "
            "hormonal contraception (to regulate cycles and reduce androgen "
            "effects), and in some cases targeted supplements such as inositol, "
            "which has reasonable evidence for improving cycle regularity and "
            "insulin sensitivity. If fertility is a concern, specific pathways "
            "exist and are often effective. Work with a gynecologist you trust — "
            "PCOS responds well to a personalised plan."
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
            "result can be delayed ovulation, longer cycles, skipped cycles, "
            "or more intense PMS. This is not a character flaw or a sign of "
            "low resilience — it is the body prioritising immediate survival "
            "over reproduction, a mechanism that evolved when stress meant "
            "genuine physical danger.\n\n"
            "The most common stress-related cycle change is delayed ovulation. "
            "When cortisol stays elevated, the hypothalamus — the brain region "
            "that initiates the hormonal cascade of the cycle — can suppress "
            "the release of GnRH, the hormone that starts the whole process. "
            "This pushes ovulation later in the cycle, which means menstruation "
            "also arrives later. The period itself may be heavier or more "
            "crampy because the uterine lining has had more time to build up. "
            "In cases of severe or prolonged stress, ovulation can be skipped "
            "entirely for one or more cycles.\n\n"
            "The luteal phase is also affected. High cortisol can suppress "
            "progesterone output from the corpus luteum, which contributes to "
            "a shorter luteal phase, spotting before menstruation, and more "
            "pronounced PMS symptoms. The irritability, low mood, and "
            "sleep disruption that many people attribute purely to hormones "
            "often have stress as a significant contributing factor.\n\n"
            "Practical stress reduction does not require major life changes. "
            "Ten minutes of daily slow breathing (extending the exhale to "
            "roughly twice the length of the inhale) activates the "
            "parasympathetic nervous system and measurably reduces cortisol "
            "over time. Regular walks outside — particularly in daylight — "
            "combine light exposure, mild movement, and environmental novelty "
            "in a way that is unusually effective at shifting stress baseline. "
            "Limiting caffeine after early afternoon removes a stimulant that "
            "keeps the nervous system in a mild alert state. Protecting sleep "
            "consistency is probably the single highest-leverage intervention, "
            "since sleep deprivation is itself a cortisol driver.\n\n"
            "If stress is persistent, overwhelming, or connected to anxiety or "
            "depression, a conversation with a therapist is as clinically "
            "relevant as any hormonal intervention for cycle health. Cognitive "
            "behavioural therapy and other evidence-based modalities have "
            "documented effects on both psychological stress and physiological "
            "cortisol levels — and by extension, on cycle regularity."
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