from fileinput import filename

from flask import Flask, request, jsonify
from flask_cors import CORS
from pathlib import Path
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
import pandas as pd
import json
import uuid
import threading
from concurrent.futures import ThreadPoolExecutor
from threading import RLock
import traceback
from sqlalchemy import text

from agents.coordinator_agent import CoordinatorAgent
from backend.flow_extractor import extract_flows, save_flow_summary
from backend.pcap_attack_detector import analyze_pcap
from backend.database import init_db, SessionLocal
from backend.db_models import AnalysisHistory
from backend.db_history import save_history

app = Flask(__name__)
CORS(
    app,
    resources={
        r"/api/*": {"origins": ["http://localhost:5173", "http://127.0.0.1:5173"]}
    },
    supports_credentials=False,
)

# configuration  
BASE_DIR = Path(__file__).resolve().parents[1]
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
REPORT_DIR = BASE_DIR / "results" / "pcap"
ALLOWED_EXTENSIONS = {".pcap", ".pcapng"}
MAX_UPLOAD_SIZE = 100 * 1024 * 1024
MAX_BATCH_SIZE = 2000

app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_SIZE

coordinator = None
coordinator_lock = threading.Lock()
analysis_lock = threading.Lock()

# Background analysis executor
job_executor = ThreadPoolExecutor(max_workers=2)

# In-memory job registry
analysis_jobs = {}
jobs_lock = RLock()

init_db()

def update_job(job_id, **updates):
    with jobs_lock:
        if job_id in analysis_jobs:
            analysis_jobs[job_id].update(updates)


def run_background_job(job_id, task):
    try:
        update_job(
            job_id, status="processing", progress=10, message="Initializing analysis..."
        )

        result = task(
            lambda progress, message: update_job(
                job_id, progress=progress, message=message
            )
        )

        update_job(
            job_id,
            status="completed",
            progress=100,
            message="Analysis completed successfully.",
            result=json_safe(result),
        )

    except Exception as exc:
        app.logger.exception("Background job failed: %s", job_id)

        update_job(
            job_id,
            status="failed",
            progress=0,
            message="Analysis failed.",
            error=str(exc),
        )


def create_analysis_job(task):
    job_id = uuid.uuid4().hex

    with jobs_lock:
        analysis_jobs[job_id] = {
            "job_id": job_id,
            "status": "queued",
            "progress": 0,
            "message": "Waiting for analysis worker...",
            "result": None,
            "error": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    job_executor.submit(run_background_job, job_id, task)

    return job_id


# initialization 
def get_coordinator():
    global coordinator

    with coordinator_lock:
        if coordinator is None:
            print("Initializing Coordinator Agent...")
            coordinator = CoordinatorAgent()
            print("Coordinator Agent initialized.")

    return coordinator


# helpers 
def error_response(message, status=400):
    return jsonify({"status": "error", "message": message}), status


def json_safe(data):
    if isinstance(data, dict):
        return {str(k): json_safe(v) for k, v in data.items()}

    if isinstance(data, (list, tuple)):
        return [json_safe(v) for v in data]

    if hasattr(data, "item"):
        try:
            return data.item()
        except (ValueError, TypeError):
            pass

    if data is None:
        return None

    try:
        if pd.isna(data):
            return None
    except (ValueError, TypeError):
        pass

    return data


def save_report(report_id, report):
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    report_path = REPORT_DIR / f"{report_id}.json"

    with open(report_path, "w", encoding="utf-8") as file:
        json.dump(json_safe(report), file, indent=4, ensure_ascii=False)

    return report_path


# home page
@app.route("/", methods=["GET"])
def home():
    return jsonify(
        {
            "status": "running",
            "service": "Multi-Agent Cybersecurity Backend",
            "version": "1.0",
        }
    )


# health check
@app.route("/api/health", methods=["GET"])
def health():
    # Check database connectivity
    session = None
    try:
        session = SessionLocal()
        session.execute(text("SELECT 1"))
        database_status = "healthy"
    except Exception:
        database_status = "unhealthy"
        app.logger.exception("Database health check failed.")
    finally:
        if session:
            session.close()

    # Check whether trained model files are present.
    model_files = {
        "detection": [
            BASE_DIR / "results/anomaly/random_forest_anomaly.pkl",
            BASE_DIR / "results/anomaly/anomaly_imputer.pkl",
        ],
        "classification": [
            BASE_DIR / "results/classification/random_forest_attack.pkl",
            BASE_DIR / "results/classification/random_forest_attack_imputer.pkl",
        ],
    }

    detection_available = all(p.is_file() for p in model_files["detection"])
    classification_available = all(p.is_file() for p in model_files["classification"])

    # Check whether the RAG knowledge source exists and contains data.
    knowledge_file = BASE_DIR / "rag/data/cybersecurity.txt"
    rag_available = knowledge_file.is_file() and knowledge_file.stat().st_size > 0

    # lazy loaded agents
    coordinator_ready = coordinator is not None
    threat_agent_loaded = coordinator_ready and coordinator.threat_agent is not None

    checks = {
        "database": database_status,
        "job_executor": ("available" if not job_executor._shutdown else "unavailable"),
        "coordinator": ("initialized" if coordinator_ready else "not_initialized"),
        "detection": ("available" if detection_available else "unavailable"),
        "classification": ("available" if classification_available else "unavailable"),
        "threat_intelligence": (
            "loaded"
            if threat_agent_loaded
            else "available" if rag_available else "unavailable"
        ),
        "rag": "available" if rag_available else "unavailable",
        "models": (
            "available"
            if detection_available and classification_available
            else "unavailable"
        ),
    }

    overall = (
        "healthy"
        if database_status == "healthy" and checks["job_executor"] == "available"
        else "degraded"
    )

    active_jobs = sum(
        1 for job in analysis_jobs.values() if job["status"] in ("queued", "processing")
    )

    return jsonify(
        {
            "status": overall,
            "version": "1.0",
            "checks": checks,
            "coordinator_initialized": coordinator_ready,
            "active_jobs": active_jobs,
        }
    )


@app.route("/api/jobs/<job_id>", methods=["GET"])
def get_job_status(job_id):
    with jobs_lock:
        job = analysis_jobs.get(job_id)

        if not job:
            return error_response("Job not found.", 404)

        return jsonify(json_safe(job))


# single flow analysis
@app.route("/api/analyze", methods=["POST"])
def analyze_flow():

    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return error_response("Expected JSON input.")

    flow = data.get("flow")
    if not isinstance(flow, dict) or not flow:
        return error_response("Please provide a valid flow.")

    def task(progress):
        progress(20, "Initializing Coordinator Agent...")
        agent = get_coordinator()

        progress(40, "Running multi-agent analysis...")
        with analysis_lock:
            result = agent.process(flow)

        progress(85, "Saving analysis report...")
        analysis_id = uuid.uuid4().hex

        report = {
            "status": "success",
            "analysis_id": analysis_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "analysis_type": "single",
            "analysis": json_safe(result),
        }

        report_path = save_report(analysis_id, report)
        save_history(analysis_id, "single", report_path, result)

        return {
            "status": "success",
            "analysis_id": analysis_id,
            "analysis": json_safe(result),
        }

    job_id = create_analysis_job(task)

    return (
        jsonify(
            {
                "status": "accepted",
                "job_id": job_id,
                "message": "Single-flow analysis started.",
            }
        ),
        202,
    )


# batch analysis
@app.route("/api/analyze-batch", methods=["POST"])
def analyze_batch():
    try:
        if "file" in request.files:
            uploaded_file = request.files["file"]

            if not uploaded_file.filename.lower().endswith(".csv"):
                return error_response("Only CSV files are supported.")

            frame = pd.read_csv(uploaded_file)

        else:
            data = request.get_json(silent=True)

            if not isinstance(data, dict):
                return error_response("Expected CSV upload or JSON input.")

            flows = data.get("flows")

            if not isinstance(flows, list) or not flows:
                return error_response("Please provide flows.")

            frame = pd.DataFrame(flows)

        if frame.empty:
            return error_response("No flows found.")

        if len(frame) > MAX_BATCH_SIZE:
            return error_response(f"Maximum batch size is {MAX_BATCH_SIZE}.", 413)

    except Exception:
        app.logger.exception("Batch input processing failed.")
        return error_response("Could not read the batch input.")

    def task(progress):
        progress(20, "Initializing batch analysis...")
        agent = get_coordinator()

        progress(40, "Analyzing network flows...")
        with analysis_lock:
            result = agent.process_dataframe(frame)

        progress(85, "Saving batch report...")
        analysis_id = uuid.uuid4().hex

        report = {
            "status": "success",
            "analysis_id": analysis_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "analysis_type": "batch",
            "analysis": json_safe(result),
        }

        report_path = save_report(analysis_id, report)
        save_history(analysis_id, "batch", report_path, result)

        return {
            "status": "success",
            "analysis_id": analysis_id,
            "analysis": json_safe(result),
        }

    job_id = create_analysis_job(task)

    return (
        jsonify(
            {
                "status": "accepted",
                "job_id": job_id,
                "message": "Batch analysis started.",
            }
        ),
        202,
    )


# pcap analysis
@app.route("/api/analyze-pcap", methods=["POST"])
@app.route("/api/upload-pcap", methods=["POST"])
def analyze_pcap_file():
    if "file" not in request.files:
        return error_response("Upload a PCAP file.")

    uploaded_file = request.files["file"]
    if not uploaded_file.filename:
        return error_response("No file selected.")

    filename = secure_filename(uploaded_file.filename)
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        return error_response("Only .pcap and .pcapng files are supported.", 415)

    report_id = uuid.uuid4().hex
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    pcap_path = UPLOAD_DIR / f"{report_id}{extension}"
    csv_path = UPLOAD_DIR / f"{report_id}_flows.csv"

    try:
        uploaded_file.save(pcap_path)

        if pcap_path.stat().st_size == 0:
            pcap_path.unlink(missing_ok=True)
            return error_response("Uploaded file is empty.")

    except Exception:
        pcap_path.unlink(missing_ok=True)
        app.logger.exception("PCAP upload failed.")
        return error_response("Could not save PCAP file.", 500)

    def task(progress):
        try:
            progress(10, "Inspecting packet capture...")

            try:
                aggregate_result = analyze_pcap(pcap_path)
            except ValueError as exc:
                aggregate_result = {"status": "not_available", "message": str(exc)}

            progress(30, "Extracting network flows...")

            flows = extract_flows(pcap_path)
            if not flows:
                raise ValueError("No supported network flows found.")

            save_flow_summary(flows, csv_path)
            flow_df = pd.read_csv(csv_path)
            progress(50, "Initializing Coordinator Agent...")

            agent = get_coordinator()
            progress(60, "Running multi-agent analysis...")

            with analysis_lock:
                flow_result = agent.process_dataframe(flow_df)

            progress(90, "Saving PCAP report...")
            report = {
                "status": "success",
                "analysis_id": report_id,
                "filename": filename,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "analysis_type": "pcap",
                "pcap_summary": {
                    "total_flows": len(flow_df),
                    "total_features": len(flow_df.columns),
                },
                "aggregate_detection": aggregate_result,
                "flow_analysis": flow_result,
            }

            report_path = save_report(report_id, report)
            save_history(report_id, "pcap", report_path, report, filename)
            return {
                "status": "success",
                "analysis_id": report_id,
                "report": json_safe(report),
            }

        finally:
            pcap_path.unlink(missing_ok=True)
            csv_path.unlink(missing_ok=True)

    job_id = create_analysis_job(task)

    return (
        jsonify(
            {
                "status": "accepted",
                "job_id": job_id,
                "message": "PCAP analysis started.",
            }
        ),
        202,
    )


# get analysis report
@app.route("/api/analysis/<analysis_id>", methods=["GET"])
def get_analysis(analysis_id):
    session = SessionLocal()

    try:
        record = (
            session.query(AnalysisHistory).filter_by(analysis_id=analysis_id).first()
        )

        if not record:
            return error_response("Analysis not found.", 404)

        report_path = Path(record.report_path)
        if not report_path.exists():
            return error_response("Detailed report file not found.", 404)

        with open(report_path, "r", encoding="utf-8") as file:
            report = json.load(file)

        return jsonify({"status": "success", "report": report})

    except Exception:
        app.logger.exception("Report retrieval failed.")
        return error_response("Could not retrieve report.", 500)

    finally:
        session.close()


# analysis history
@app.route("/api/history", methods=["GET"])
def get_history():
    limit = request.args.get("limit", 20, type=int)
    limit = max(1, min(limit or 20, 100))

    session = SessionLocal()

    try:
        records = (
            session.query(AnalysisHistory)
            .order_by(AnalysisHistory.created_at.desc())
            .limit(limit)
            .all()
        )

        history = []

        for record in records:
            history.append(
                {
                    "analysis_id": record.analysis_id,
                    "created_at": (
                        record.created_at.isoformat() if record.created_at else None
                    ),
                    "analysis_type": record.analysis_type,
                    "filename": record.filename,
                    "total_flows": record.total_flows,
                    "attack_flows": record.attack_flows,
                    "benign_flows": record.benign_flows,
                    "attack_types": record.attack_types,
                    "severity": record.severity,
                    "source_ip": record.source_ip,
                    "target_ip": record.target_ip,
                }
            )

        return jsonify({"status": "success", "count": len(history), "history": history})

    except Exception:
        app.logger.exception("History retrieval failed.")
        return error_response("Could not retrieve history.", 500)

    finally:
        session.close()


@app.route("/api/knowledge-base", methods=["GET"])
def get_knowledge_base():
    knowledge_file = BASE_DIR / "rag" / "data" / "cybersecurity.txt"

    try:
        if not knowledge_file.exists():
            return (
                jsonify(
                    {
                        "status": "error",
                        "message": "Knowledge base file not found.",
                        "documents": [],
                    }
                ),
                404,
            )

        content = knowledge_file.read_text(encoding="utf-8")
        chunks = [chunk.strip() for chunk in content.split("\n\n") if chunk.strip()]

        documents = [
            {
                "id": f"kb-{index + 1}",
                "title": (
                    chunk.splitlines()[0].strip("# ").strip()
                    if chunk.splitlines()
                    else f"Cybersecurity document {index + 1}"
                ),
                "category": "Cybersecurity",
                "summary": chunk[:250],
                "content": chunk,
                "source": "rag/data/cybersecurity.txt",
            }
            for index, chunk in enumerate(chunks)
        ]

        return jsonify(
            {
                "status": "success",
                "documents": documents,
                "total_documents": len(documents),
                "total_chunks": len(chunks),
            }
        )

    except Exception as error:
        app.logger.exception("Knowledge base loading failed.")
        return (
            jsonify(
                {
                    "status": "error",
                    "message": str(error),
                    "documents": [],
                }
            ),
            500,
        )


# error handling
@app.errorhandler(413)
def file_too_large(error):
    return error_response("File exceeds the maximum upload size of 100 MB.", 413)


# running server
if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False, threaded=True)
