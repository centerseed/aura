import sys
import os

# Add backend to path (Quick hack for Monolith POC)
sys.path.append(os.path.join(os.getcwd(), 'backend'))

print("Checking imports...")
try:
    import uuid
    import json
    import re
    import streamlit as st
    import asyncio
    print("Standard lib and st imports: OK")
except Exception as e:
    print(f"Standard lib/st import failed: {e}")

try:
    from app.services.librarian import LibrarianService
    print("LibrarianService import: OK")
except Exception as e:
    print(f"LibrarianService import failed: {e}")

try:
    from app.domain.models import User
    print("User model import: OK")
except Exception as e:
    print(f"User model import failed: {e}")

print("Import check complete.")
