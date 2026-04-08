import asyncio
import uuid
from datetime import date

from backend.app.database import AsyncSessionLocal
from backend.app.models.user import User
from backend.app.models.patient import Patient
from backend.app.models.doctor import Doctor
from backend.app.models.manager import Manager
from backend.app.auth.service import hash_password


async def seed():
    async with AsyncSessionLocal() as session:
        doctor1_user_id = uuid.uuid4()
        doctor1_id = uuid.uuid4()
        doctor2_user_id = uuid.uuid4()
        doctor2_id = uuid.uuid4()

        session.add_all([
            User(
                id=doctor1_user_id,
                email="doctor1@ayna.app",
                hashed_password=hash_password("Doctor1Pass"),
                role="doctor",
                is_active=True,
                is_verified=True,
            ),
            Doctor(
                id=doctor1_id,
                user_id=doctor1_user_id,
                full_name="Aigul Serikovna",
                specialization="Gynecologist",
                bio="10 years of experience. Specialization in reproductive health.",
                is_available=True,
            ),
            User(
                id=doctor2_user_id,
                email="doctor2@ayna.app",
                hashed_password=hash_password("Doctor2Pass"),
                role="doctor",
                is_active=True,
                is_verified=True,
            ),
            Doctor(
                id=doctor2_id,
                user_id=doctor2_user_id,
                full_name="Madina Kairatovna",
                specialization="Gynecologist-Endocrinologist",
                bio="7 years of experience. Cycle disorders, PCOS, hormone therapy.",
                is_available=True,
            ),
        ])

        patient1_user_id = uuid.uuid4()
        patient2_user_id = uuid.uuid4()
        patient3_user_id = uuid.uuid4()

        session.add_all([
            User(
                id=patient1_user_id,
                email="patient1@ayna.app",
                hashed_password=hash_password("Patient1Pass"),
                role="patient",
                is_active=True,
                is_verified=True,
            ),
            Patient(
                user_id=patient1_user_id,
                full_name="Dana Nurlanova",
                date_of_birth=date(1998, 3, 15),
                doctor_id=doctor1_id,
                average_cycle_length=28,
                average_period_length=5,
            ),
            User(
                id=patient2_user_id,
                email="patient2@ayna.app",
                hashed_password=hash_password("Patient2Pass"),
                role="patient",
                is_active=True,
                is_verified=True,
            ),
            Patient(
                user_id=patient2_user_id,
                full_name="Ayana Bekbolatova",
                date_of_birth=date(2001, 7, 22),
                doctor_id=doctor1_id,
                average_cycle_length=30,
                average_period_length=6,
            ),
            User(
                id=patient3_user_id,
                email="patient3@ayna.app",
                hashed_password=hash_password("Patient3Pass"),
                role="patient",
                is_active=True,
                is_verified=True,
            ),
            Patient(
                user_id=patient3_user_id,
                full_name="Kamila Yerzhanova",
                date_of_birth=date(1995, 11, 3),
                doctor_id=doctor2_id,
                average_cycle_length=26,
                average_period_length=4,
            ),
        ])

        manager_user_id = uuid.uuid4()

        session.add_all([
            User(
                id=manager_user_id,
                email="manager@ayna.app",
                hashed_password=hash_password("Manager1Pass"),
                role="manager",
                is_active=True,
                is_verified=True,
            ),
            Manager(
                user_id=manager_user_id,
                full_name="Zhanna Altynbekova",
                assigned_doctor_id=doctor1_id,
            ),
        ])

        await session.commit()
        print("Seed completed:")
        print("  2 doctors:  doctor1@ayna.app / Doctor1Pass")
        print("              doctor2@ayna.app / Doctor2Pass")
        print("  3 patients: patient1@ayna.app / Patient1Pass")
        print("              patient2@ayna.app / Patient2Pass")
        print("              patient3@ayna.app / Patient3Pass")
        print("  1 manager:  manager@ayna.app / Manager1Pass")


if __name__ == "__main__":
    asyncio.run(seed())