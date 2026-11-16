from sqlalchemy import Column, String, Integer, DateTime, JSON
from sqlalchemy.sql import func

from backend.database import Base

class AnalysisHistory(Base):
    __tablename__ = "analysis_history"

    analysis_id = Column(String(32), primary_key=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    analysis_type = Column(String(30))
    filename = Column(String(255), nullable=True)

    total_flows = Column(Integer, default=0)
    attack_flows = Column(Integer, default=0)
    benign_flows = Column(Integer, default=0)

    attack_types = Column(JSON, default=list)
    severity = Column(String(30), nullable=True)

    source_ip = Column(String(100), nullable=True)
    target_ip = Column(String(100), nullable=True)

    report_path = Column(String(500))
