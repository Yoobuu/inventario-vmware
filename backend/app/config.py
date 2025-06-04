from dotenv import load_dotenv
load_dotenv()
import os
VCENTER_HOST = os.getenv("VCENTER_HOST")
VCENTER_USER = os.getenv("VCENTER_USER")
VCENTER_PASS = os.getenv("VCENTER_PASS")
SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
