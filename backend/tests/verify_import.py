import sys
import os

# Add backend to path
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    from app.services.librarian import LibrarianService
    print("Import LibrarianService SUCCESS")
except Exception as e:
    print(f"Import LibrarianService FAILED: {e}")
    sys.exit(1)

try:
    from app.domain.models import User
    print("Import SQLModel User SUCCESS")
except Exception as e:
    print(f"Import SQLModel User FAILED: {e}")
    sys.exit(1)
