import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is missing from .env")

# Use the psycopg driver
# Use PostgreSQL as the database and Psycopg 3 as the communication driver.
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)

# Without checking, the application may encounter a connection error.
# pool_pre_ping=True tells SQLAlchemy to check whether a pooled connection is still alive before using it.
# If the connection is invalid, SQLAlchemy can discard it and establish a fresh one.
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base() # Base keeps track of the database tables

def init_db():
    Base.metadata.create_all(bind=engine) # Contains information about all ORM models registered with Base.
    print("Neon database connected successfully!")
