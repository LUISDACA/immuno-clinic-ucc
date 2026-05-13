import asyncio
from app.db.models_registry import * # Ensure all models are imported for relationships
from app.db.session import AsyncSessionLocal
from app.modules.users.models import User
from app.common.enums import Role
from app.core.security import hash_password
from sqlalchemy import select

async def update_admin():
    async with AsyncSessionLocal() as session:
        # Find the admin user
        result = await session.execute(select(User).where(User.role == Role.APP_ADMIN).limit(1))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print("No admin user found in the database. Have you seeded the database yet?")
            return

        print(f"Current Admin Email: {admin.email}")
        new_email = input("Enter new admin email (leave empty to keep current): ").strip()
        new_password = input("Enter new admin password (leave empty to keep current): ").strip()

        if new_email:
            admin.email = new_email
        if new_password:
            admin.hashed_password = hash_password(new_password)

        if new_email or new_password:
            await session.commit()
            print("\n✅ Admin credentials updated successfully!")
            print(f"New Email: {admin.email}")
        else:
            print("\nNo changes made.")

if __name__ == "__main__":
    # Workaround for Windows environments throwing ProactorEventLoop error on close
    try:
        asyncio.run(update_admin())
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
