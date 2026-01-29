from datetime import datetime
from typing import Optional

from sqlalchemy import select, and_, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app_common.models.device import Device
from app_common.models.ownership import Ownership
from app_common.models.user import User
from app_common.schemas.default import LimitedResponse
from app_common.schemas.ownership import OwnershipCreate, OwnershipModel


async def get_active_ownership_for_device(
        db: AsyncSession,
        device_id: int
) -> Optional[Ownership]:
    """Pobiera aktywny ownership dla urządzenia"""
    query = select(Ownership).where(
        and_(
            Ownership.device_id == device_id,
            Ownership.is_active == True
        )
    )
    return await db.scalar(query)


async def get_user_ownerships(
        db: AsyncSession,
        user: User,
        active_only: bool = True,
        offset: int = 0,
        limit: int = 100
) -> LimitedResponse[OwnershipModel]:
    """Pobiera wszystkie ownerships użytkownika"""
    from sqlalchemy import func
    
    base_where = Ownership.user_id == user.id
    if active_only:
        base_where = and_(base_where, Ownership.is_active == True)
    
    count_query = select(func.count(Ownership.id)).where(base_where)
    query = (
        select(Ownership)
        .where(base_where)
        .order_by(Ownership.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    
    count = await db.scalar(count_query)
    ownerships = (await db.scalars(query)).all()
    
    return LimitedResponse(
        offset=offset,
        limit=limit,
        total_count=count,
        content=[*ownerships]
    )


async def get_existing_ownership_for_user_and_device(
        db: AsyncSession,
        user_id: int,
        device_id: int
) -> Optional[Ownership]:
    """Pobiera istniejący ownership (aktywny lub nieaktywny) dla danego użytkownika i urządzenia"""
    query = select(Ownership).where(
        and_(
            Ownership.user_id == user_id,
            Ownership.device_id == device_id
        )
    )
    return await db.scalar(query)


async def create_ownership(
        db: AsyncSession,
        user: User,
        device_id: int
) -> Ownership:
    """
    Tworzy nowy ownership dla użytkownika i urządzenia.
    Jeśli użytkownik już miał ownership do tego urządzenia (nieaktywny) - reaktywuje go.
    Dezaktywuje poprzedni aktywny ownership jeśli istnieje.
    """
    # Zapisz user_id na początku - po operacjach DB obiekt user może być expired
    user_id = user.id
    
    # Sprawdź czy użytkownik już miał ownership do tego urządzenia
    existing_ownership = await get_existing_ownership_for_user_and_device(db, user_id, device_id)
    
    if existing_ownership is not None:
        # Reaktywuj istniejący ownership (dzięki temu użytkownik zobaczy swoje stare pomiary)
        # Najpierw dezaktywuj inny aktywny ownership jeśli istnieje
        await deactivate_device_ownership(db, device_id)
        
        existing_ownership.is_active = True
        existing_ownership.deactivated_at = None
        await db.commit()
        await db.refresh(existing_ownership)
        return existing_ownership
    
    # Nie ma istniejącego ownership - dezaktywuj poprzedni i utwórz nowy
    await deactivate_device_ownership(db, device_id)
    
    # Utwórz nowy ownership
    ownership = Ownership(
        user_id=user_id,
        device_id=device_id,
        is_active=True,
        created_at=datetime.utcnow()
    )
    
    try:
        db.add(ownership)
        await db.commit()
        await db.refresh(ownership)
        return ownership
    except IntegrityError as e:
        await db.rollback()
        raise ValueError(f"Database error: {str(e)}")


async def deactivate_device_ownership(
        db: AsyncSession,
        device_id: int
) -> bool:
    """Dezaktywuje aktualny ownership dla urządzenia (przy zmianie właściciela)"""
    stmt = (
        update(Ownership)
        .where(
            and_(
                Ownership.device_id == device_id,
                Ownership.is_active == True
            )
        )
        .values(
            is_active=False,
            deactivated_at=datetime.utcnow()
        )
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount > 0


async def transfer_device_ownership(
        db: AsyncSession,
        device_id: int,
        new_user: User
) -> Ownership:
    """
    Przenosi własność urządzenia na nowego użytkownika.
    Dezaktywuje stary ownership i tworzy nowy.
    """
    # Sprawdź czy urządzenie istnieje
    device_query = select(Device).where(Device.id == device_id)
    device = await db.scalar(device_query)
    if device is None:
        raise ValueError(f"Device with id {device_id} not found")
    
    # Utwórz nowy ownership (poprzedni zostanie dezaktywowany)
    return await create_ownership(db, new_user, device_id)


async def get_device_ownership_history(
        db: AsyncSession,
        device_id: int,
        offset: int = 0,
        limit: int = 100
) -> LimitedResponse[OwnershipModel]:
    """Pobiera historię wszystkich ownership dla urządzenia"""
    from sqlalchemy import func
    
    count_query = select(func.count(Ownership.id)).where(Ownership.device_id == device_id)
    query = (
        select(Ownership)
        .where(Ownership.device_id == device_id)
        .order_by(Ownership.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    
    count = await db.scalar(count_query)
    ownerships = (await db.scalars(query)).all()
    
    return LimitedResponse(
        offset=offset,
        limit=limit,
        total_count=count,
        content=[*ownerships]
    )
