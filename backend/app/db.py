# backend/app/db.py
from sqlmodel import create_engine

engine = create_engine("sqlite:///app/app.db", echo=False)
