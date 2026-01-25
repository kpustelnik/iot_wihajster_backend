"""
Testy dla funkcjonalności Ownership - izolacja pomiarów między właścicielami urządzenia.
Testy działają na PostgreSQL w Dockerze.
"""
import os
import pytest
import pytest_asyncio
from datetime import datetime
from sqlalchemy import select, and_, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app_common.database import Base
from app_common.models.device import Device, PrivacyLevel, SettingsStatus
from app_common.models.measurement import Measurement
from app_common.models.ownership import Ownership
from app_common.models.user import User, UserType


# Pobierz connection string z zmiennych środowiskowych lub użyj domyślnego
POSTGRES_USER = os.getenv("POSTGRES_USER", "admin")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "admin")
POSTGRES_HOST = os.getenv("POSTGRES_HOSTNAME", "localhost")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")
POSTGRES_DB = os.getenv("POSTGRES_DB", "iot_test")

DATABASE_URL = f"postgresql+asyncpg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"


@pytest_asyncio.fixture(name="session", scope="function")
async def session_fixture():
    """Tworzy izolowaną sesję bazodanową dla testów na PostgreSQL"""
    engine = create_async_engine(DATABASE_URL, echo=False)

    async with engine.begin() as conn:
        # Usuń wszystkie tabele i utwórz od nowa dla czystego testu
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with async_session() as session:
        # Dodaj użytkowników testowych
        users = [
            User(id=1, email="admin@test.com", login="admin", password="admin", type=UserType.ADMIN),
            User(id=2, email="user@test.com", login="user", password="user", type=UserType.CLIENT),
            User(id=3, email="user2@test.com", login="user2", password="user2", type=UserType.CLIENT),
        ]
        for user in users:
            session.add(user)
        
        # Dodaj urządzenia testowe
        devices = [
            Device(id=1, user_id=2, chip_type="esp32", privacy=PrivacyLevel.PROTECTED, status=SettingsStatus.PENDING),
            Device(id=2, user_id=2, chip_type="esp32", privacy=PrivacyLevel.PUBLIC, status=SettingsStatus.ACCEPTED),
            Device(id=3, user_id=3, chip_type="esp32", privacy=PrivacyLevel.PRIVATE, status=SettingsStatus.ACCEPTED),
        ]
        for device in devices:
            session.add(device)
        
        # Dodaj ownerships testowe
        ownerships = [
            Ownership(id=1, user_id=2, device_id=1, is_active=True, created_at=datetime(2025, 10, 1)),
            Ownership(id=2, user_id=2, device_id=2, is_active=True, created_at=datetime(2025, 10, 1)),
            Ownership(id=3, user_id=3, device_id=3, is_active=True, created_at=datetime(2025, 10, 1)),
        ]
        for ownership in ownerships:
            session.add(ownership)
        
        # Dodaj pomiary testowe
        measurements = [
            Measurement(ownership_id=1, time=datetime(2025, 11, 1, 0, 0, 0), humidity=69, temperature=16.75),
            Measurement(ownership_id=1, time=datetime(2025, 11, 1, 1, 0, 0), humidity=70, temperature=15.79),
            Measurement(ownership_id=2, time=datetime(2025, 11, 1, 0, 0, 0), humidity=68, temperature=17.5),
        ]
        for measurement in measurements:
            session.add(measurement)
        
        await session.commit()
        
        # Zresetuj sekwencje dla PostgreSQL żeby uniknąć konfliktów ID
        await session.execute(text("SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))"))
        await session.execute(text("SELECT setval('devices_id_seq', (SELECT MAX(id) FROM devices))"))
        await session.execute(text("SELECT setval('ownerships_id_seq', (SELECT MAX(id) FROM ownerships))"))
        await session.commit()
        
        yield session

    await engine.dispose()


class TestOwnershipModel:
    """Testy modelu Ownership"""

    @pytest.mark.asyncio
    async def test_ownership_exists_for_devices(self, session: AsyncSession):
        """Sprawdź czy ownership istnieje dla urządzeń w bazie testowej"""
        query = select(Ownership)
        ownerships = (await session.scalars(query)).all()
        
        assert len(ownerships) >= 1, "Powinien istnieć przynajmniej jeden ownership"

    @pytest.mark.asyncio
    async def test_ownership_has_required_fields(self, session: AsyncSession):
        """Sprawdź czy ownership ma wszystkie wymagane pola"""
        query = select(Ownership).limit(1)
        ownership = await session.scalar(query)
        
        assert ownership is not None
        assert ownership.id is not None
        assert ownership.user_id is not None
        assert ownership.device_id is not None
        assert ownership.is_active is not None
        assert ownership.created_at is not None

    @pytest.mark.asyncio
    async def test_active_ownership_per_device(self, session: AsyncSession):
        """Sprawdź czy istnieje tylko jeden aktywny ownership per urządzenie"""
        # Pobierz wszystkie urządzenia
        devices_query = select(Device)
        devices = (await session.scalars(devices_query)).all()
        
        for device in devices:
            # Dla każdego urządzenia sprawdź ile jest aktywnych ownership
            active_query = select(Ownership).where(
                and_(
                    Ownership.device_id == device.id,
                    Ownership.is_active == True
                )
            )
            active_ownerships = (await session.scalars(active_query)).all()
            
            # Powinien być co najwyżej jeden aktywny ownership
            assert len(active_ownerships) <= 1, \
                f"Device {device.id} ma więcej niż jeden aktywny ownership"


class TestOwnershipRepo:
    """Testy repozytorium Ownership"""

    @pytest.mark.asyncio
    async def test_get_active_ownership_for_device(self, session: AsyncSession):
        """Test pobierania aktywnego ownership dla urządzenia"""
        from frontend_api.repos.ownership_repo import get_active_ownership_for_device
        
        # Device 1 powinien mieć aktywny ownership
        ownership = await get_active_ownership_for_device(session, device_id=1)
        
        assert ownership is not None
        assert ownership.device_id == 1
        assert ownership.is_active == True

    @pytest.mark.asyncio
    async def test_get_active_ownership_for_nonexistent_device(self, session: AsyncSession):
        """Test pobierania ownership dla nieistniejącego urządzenia"""
        from frontend_api.repos.ownership_repo import get_active_ownership_for_device
        
        ownership = await get_active_ownership_for_device(session, device_id=9999)
        
        assert ownership is None

    @pytest.mark.asyncio
    async def test_get_user_ownerships(self, session: AsyncSession):
        """Test pobierania ownership użytkownika"""
        from frontend_api.repos.ownership_repo import get_user_ownerships
        
        # Pobierz użytkownika (user_id=2 to client w danych testowych)
        user_query = select(User).where(User.id == 2)
        user = await session.scalar(user_query)
        
        result = await get_user_ownerships(session, user, active_only=True)
        
        assert result.total_count >= 1
        assert len(result.content) >= 1
        for ownership in result.content:
            assert ownership.user_id == user.id
            assert ownership.is_active == True

    @pytest.mark.asyncio
    async def test_create_ownership(self, session: AsyncSession):
        """Test tworzenia nowego ownership"""
        from frontend_api.repos.ownership_repo import create_ownership, get_active_ownership_for_device
        
        # Pobierz użytkownika
        user_query = select(User).where(User.id == 3)
        user = await session.scalar(user_query)
        
        # Utwórz nowe urządzenie do testu
        new_device = Device(
            user_id=user.id,
            chip_type="esp32",
            privacy="private",
            status="pending"
        )
        session.add(new_device)
        await session.flush()
        
        # Utwórz ownership
        ownership = await create_ownership(session, user, new_device.id)
        
        assert ownership is not None
        assert ownership.user_id == user.id
        assert ownership.device_id == new_device.id
        assert ownership.is_active == True
        
        # Sprawdź czy można go pobrać
        fetched = await get_active_ownership_for_device(session, new_device.id)
        assert fetched is not None
        assert fetched.id == ownership.id

    @pytest.mark.asyncio
    async def test_deactivate_device_ownership(self, session: AsyncSession):
        """Test dezaktywacji ownership przy zmianie właściciela"""
        from frontend_api.repos.ownership_repo import (
            create_ownership, 
            deactivate_device_ownership,
            get_active_ownership_for_device
        )
        
        # Pobierz użytkownika
        user_query = select(User).where(User.id == 3)
        user = await session.scalar(user_query)
        
        # Utwórz nowe urządzenie
        new_device = Device(
            user_id=user.id,
            chip_type="esp32",
            privacy="private",
            status="pending"
        )
        session.add(new_device)
        await session.flush()
        
        # Utwórz ownership
        ownership = await create_ownership(session, user, new_device.id)
        original_id = ownership.id
        
        # Dezaktywuj
        result = await deactivate_device_ownership(session, new_device.id)
        assert result == True
        
        # Sprawdź czy został dezaktywowany
        await session.refresh(ownership)
        assert ownership.is_active == False
        assert ownership.deactivated_at is not None
        
        # Sprawdź czy nie ma aktywnego ownership
        active = await get_active_ownership_for_device(session, new_device.id)
        assert active is None

    @pytest.mark.asyncio
    async def test_transfer_device_ownership(self, session: AsyncSession):
        """Test przeniesienia własności urządzenia na nowego użytkownika"""
        from frontend_api.repos.ownership_repo import (
            create_ownership,
            transfer_device_ownership,
            get_active_ownership_for_device
        )
        
        # Pobierz dwóch użytkowników
        user1_query = select(User).where(User.id == 2)
        user1 = await session.scalar(user1_query)
        
        user2_query = select(User).where(User.id == 3)
        user2 = await session.scalar(user2_query)
        
        # Utwórz nowe urządzenie
        new_device = Device(
            user_id=user1.id,
            chip_type="esp32",
            privacy="private",
            status="pending"
        )
        session.add(new_device)
        await session.flush()
        
        # Utwórz ownership dla user1
        ownership1 = await create_ownership(session, user1, new_device.id)
        
        # Przenieś na user2
        ownership2 = await transfer_device_ownership(session, new_device.id, user2)
        
        assert ownership2 is not None
        assert ownership2.user_id == user2.id
        assert ownership2.is_active == True
        
        # Sprawdź czy stary ownership jest nieaktywny
        await session.refresh(ownership1)
        assert ownership1.is_active == False
        
        # Sprawdź czy aktywny ownership to ten nowy
        active = await get_active_ownership_for_device(session, new_device.id)
        assert active.id == ownership2.id

    @pytest.mark.asyncio
    async def test_get_device_ownership_history(self, session: AsyncSession):
        """Test pobierania historii ownership dla urządzenia"""
        from frontend_api.repos.ownership_repo import (
            create_ownership,
            transfer_device_ownership,
            get_device_ownership_history
        )
        
        # Pobierz użytkowników
        user1_query = select(User).where(User.id == 2)
        user1 = await session.scalar(user1_query)
        
        user2_query = select(User).where(User.id == 3)
        user2 = await session.scalar(user2_query)
        
        # Utwórz nowe urządzenie
        new_device = Device(
            user_id=user1.id,
            chip_type="esp32",
            privacy="private",
            status="pending"
        )
        session.add(new_device)
        await session.flush()
        
        # Utwórz ownership dla user1
        await create_ownership(session, user1, new_device.id)
        
        # Przenieś na user2
        await transfer_device_ownership(session, new_device.id, user2)
        
        # Pobierz historię
        history = await get_device_ownership_history(session, new_device.id)
        
        assert history.total_count == 2
        assert len(history.content) == 2
        
        # Najnowszy powinien być pierwszy (user2)
        assert history.content[0].user_id == user2.id
        assert history.content[0].is_active == True
        
        # Starszy powinien być nieaktywny (user1)
        assert history.content[1].user_id == user1.id
        assert history.content[1].is_active == False


class TestMeasurementOwnershipIsolation:
    """Testy izolacji pomiarów między właścicielami"""

    @pytest.mark.asyncio
    async def test_measurements_linked_to_ownership(self, session: AsyncSession):
        """Sprawdź czy pomiary są powiązane z ownership a nie device"""
        query = select(Measurement).limit(1)
        measurement = await session.scalar(query)
        
        assert measurement is not None
        assert measurement.ownership_id is not None
        
        # Pobierz ownership dla tego pomiaru
        ownership_query = select(Ownership).where(Ownership.id == measurement.ownership_id)
        ownership = await session.scalar(ownership_query)
        
        assert ownership is not None

    @pytest.mark.asyncio
    async def test_new_owner_cannot_see_old_measurements(self, session: AsyncSession):
        """Test że nowy właściciel nie widzi pomiarów poprzedniego właściciela"""
        from frontend_api.repos.ownership_repo import create_ownership, transfer_device_ownership
        
        # Pobierz użytkowników
        user1_query = select(User).where(User.id == 2)
        user1 = await session.scalar(user1_query)
        
        user2_query = select(User).where(User.id == 3)
        user2 = await session.scalar(user2_query)
        
        # Utwórz nowe urządzenie
        new_device = Device(
            user_id=user1.id,
            chip_type="esp32",
            privacy="private",
            status="pending"
        )
        session.add(new_device)
        await session.flush()
        
        # Utwórz ownership dla user1
        ownership1 = await create_ownership(session, user1, new_device.id)
        
        # Dodaj pomiar dla user1
        measurement1 = Measurement(
            ownership_id=ownership1.id,
            time=datetime.utcnow(),
            temperature=20.5,
            humidity=50
        )
        session.add(measurement1)
        await session.flush()
        
        # Przenieś urządzenie na user2
        ownership2 = await transfer_device_ownership(session, new_device.id, user2)
        
        # Dodaj pomiar dla user2
        measurement2 = Measurement(
            ownership_id=ownership2.id,
            time=datetime.utcnow(),
            temperature=22.0,
            humidity=55
        )
        session.add(measurement2)
        await session.flush()
        
        # Sprawdź że pomiary user1 mają ownership1
        m1_query = select(Measurement).where(Measurement.ownership_id == ownership1.id)
        m1_results = (await session.scalars(m1_query)).all()
        assert len(m1_results) == 1
        assert m1_results[0].temperature == 20.5
        
        # Sprawdź że pomiary user2 mają ownership2
        m2_query = select(Measurement).where(Measurement.ownership_id == ownership2.id)
        m2_results = (await session.scalars(m2_query)).all()
        assert len(m2_results) == 1
        assert m2_results[0].temperature == 22.0
        
        # Sprawdź że ownerships są różne
        assert ownership1.id != ownership2.id
        assert ownership1.user_id != ownership2.user_id
