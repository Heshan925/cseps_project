from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# This creates a local SQLite file in your project root
SQLALCHEMY_DATABASE_URL = "sqlite:///./cseps_ledger.sqlite"

# Check_same_thread is set to False because FastAPI can access the DB from multiple workers
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()