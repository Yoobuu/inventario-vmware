# scripts/init_user.py
import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, Session, create_engine
from passlib.hash import bcrypt
from app.auth.user_model import User

load_dotenv()

engine = create_engine("sqlite:///app/app.db")
SQLModel.metadata.create_all(engine)

def create_initial_user():
    with Session(engine) as session:
        password = os.getenv("INITIAL_ADMIN_PASS", "changeme")
        hashed_password = bcrypt.hash(password)
        user = User(username="api-inventory@vsphere.local", hashed_password=hashed_password)
        session.add(user)
        session.commit()
        print("Usuario único creado")

create_initial_user()
