import asyncio

from backend.app.database import AsyncSessionLocal
from backend.app.models.subscription import SubscriptionPlan


PLANS = [
    {
        "name": "Monthly Premium",
        "price": 4.99,
        "duration_days": 30,
        "features": {
            "ai_phase_insights": True,
            "manager_chat": True,
            "premium_articles": True,
        },
    },
    {
        "name": "Yearly Premium",
        "price": 39.99,
        "duration_days": 365,
        "features": {
            "ai_phase_insights": True,
            "manager_chat": True,
            "premium_articles": True,
            "discount_vs_monthly": "~33%",
        },
    },
]


async def seed():
    async with AsyncSessionLocal() as session:
        for data in PLANS:
            session.add(SubscriptionPlan(**data))
        await session.commit()
        print(f"Seed completed: {len(PLANS)} subscription plans")


if __name__ == "__main__":
    asyncio.run(seed())