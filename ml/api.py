"""
Flask REST API for Resume-JD Analysis Pipeline
=================================================
Exposes the ML pipeline as HTTP endpoints for integration
with the frontend/backend application.

Endpoints:
  POST /api/analyze           -> Full pipeline analysis (text input)
  POST /api/analyze/pdf       -> Full pipeline analysis (PDF upload)
  POST /api/extract/resume    -> NER extraction from resume only
  POST /api/extract/jd        -> NER extraction from JD only
  POST /api/parse-pdf         -> Extract text from PDF file
  GET  /api/health            -> Health check
"""

import os
import io
import re
import json
import time
import tempfile
from flask import Flask, request, jsonify
from flask_cors import CORS

from pipeline import ResumeJDPipeline
from ner_extractor import NERExtractor


# ─── App Initialization ─────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Max upload size: 10MB
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

# Initialize pipeline (loads Sentence-BERT model on startup)
print("=" * 70)
print("  Resume-JD NLP Pipeline Server")
print("  Loading transformer models...")
print("=" * 70)

pipeline = ResumeJDPipeline()
ner = NERExtractor()

print("\n[OK] Server ready to accept requests.\n")


# ─── PDF Parsing ─────────────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_bytes):
    """
    Extract clean text from a PDF file using pdfplumber.

    Args:
        pdf_bytes: Raw PDF file bytes

    Returns:
        Cleaned text string extracted from all pages
    """
    import pdfplumber

    text_parts = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    raw_text = "\n".join(text_parts)

    # Clean extracted text
    cleaned = _clean_pdf_text(raw_text)

    if not cleaned or len(cleaned.strip()) < 20:
        raise ValueError(
            "Could not extract meaningful text from PDF. "
            "The file may be scanned/image-based or corrupted."
        )

    return cleaned


def _clean_pdf_text(text):
    """Clean text extracted from PDF: fix encoding, spacing, artifacts."""
    # Remove null bytes
    text = text.replace("\x00", "")
    # Normalize unicode whitespace
    text = re.sub(r"[\u00a0\u2000-\u200b\u202f\u205f\u3000]", " ", text)
    # Fix double spaces
    text = re.sub(r"[ \t]+", " ", text)
    # Fix excessive newlines
    text = re.sub(r"\n{3,}", "\n\n", text)
    # Remove lines that are just dashes, dots, or underscores
    text = re.sub(r"^[\-_\.=]{3,}$", "", text, flags=re.MULTILINE)
    # Remove page numbers
    text = re.sub(r"^\s*page\s+\d+\s*$", "", text, flags=re.MULTILINE | re.IGNORECASE)
    text = re.sub(r"^\s*\d+\s*$", "", text, flags=re.MULTILINE)
    return text.strip()


# ─── Endpoints ───────────────────────────────────────────────────────────────────

@app.route("/api/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "service": "resume-jd-nlp-pipeline",
        "model": "all-MiniLM-L6-v2",
        "scoring_mode": pipeline._scorer._scoring_mode,
        "timestamp": time.time(),
    })


@app.route("/api/analyze", methods=["POST"])
def analyze():
    """
    Full pipeline analysis endpoint (text input).

    Expects JSON body:
    {
      "resume_text": "...",
      "job_description": "..."
    }

    Returns: Complete analysis JSON.
    """
    try:
        data = request.get_json(force=True)

        resume_text = data.get("resume_text", "").strip()
        jd_text = data.get("job_description", "").strip()

        if not resume_text:
            return jsonify({"error": "resume_text is required"}), 400
        if not jd_text:
            return jsonify({"error": "job_description is required"}), 400

        # Run the full pipeline
        t0 = time.time()
        result = pipeline.analyze(resume_text, jd_text)
        elapsed = time.time() - t0

        result["_meta"] = {
            "processing_time_seconds": round(elapsed, 3),
            "model": "all-MiniLM-L6-v2",
            "pipeline_version": "2.0.0",
            "input_type": "text",
        }

        return jsonify(result)

    except Exception as e:
        print(f"[ERROR] /api/analyze: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze/pdf", methods=["POST"])
def analyze_pdf():
    """
    Full pipeline analysis with PDF resume upload.

    Expects multipart/form-data:
      - resume_file: PDF file
      - job_description: text string

    Returns: Complete analysis JSON.
    """
    try:
        # Get job description from form data
        jd_text = request.form.get("job_description", "").strip()
        if not jd_text:
            return jsonify({"error": "job_description is required"}), 400

        # Get PDF file
        if "resume_file" not in request.files:
            return jsonify({"error": "resume_file (PDF) is required"}), 400

        pdf_file = request.files["resume_file"]

        if pdf_file.filename == "":
            return jsonify({"error": "No file selected"}), 400

        if not pdf_file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400

        # Extract text from PDF
        pdf_bytes = pdf_file.read()
        try:
            resume_text = extract_text_from_pdf(pdf_bytes)
        except ValueError as ve:
            return jsonify({"error": str(ve)}), 400
        except Exception as pe:
            return jsonify({
                "error": f"Failed to parse PDF: {str(pe)}"
            }), 400

        # Run the full pipeline
        t0 = time.time()
        result = pipeline.analyze(resume_text, jd_text)
        elapsed = time.time() - t0

        result["_meta"] = {
            "processing_time_seconds": round(elapsed, 3),
            "model": "all-MiniLM-L6-v2",
            "pipeline_version": "2.0.0",
            "input_type": "pdf",
            "pdf_filename": pdf_file.filename,
            "extracted_text_length": len(resume_text),
        }

        # Include extracted text for transparency
        result["extracted_resume_text"] = resume_text[:2000]

        return jsonify(result)

    except Exception as e:
        print(f"[ERROR] /api/analyze/pdf: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/parse-pdf", methods=["POST"])
def parse_pdf():
    """
    Extract text from a PDF file without running analysis.

    Expects multipart/form-data:
      - resume_file: PDF file

    Returns: Extracted text.
    """
    try:
        if "resume_file" not in request.files:
            return jsonify({"error": "resume_file (PDF) is required"}), 400

        pdf_file = request.files["resume_file"]

        if not pdf_file.filename.lower().endswith(".pdf"):
            return jsonify({"error": "Only PDF files are supported"}), 400

        pdf_bytes = pdf_file.read()
        text = extract_text_from_pdf(pdf_bytes)

        return jsonify({
            "text": text,
            "filename": pdf_file.filename,
            "char_count": len(text),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/extract/resume", methods=["POST"])
def extract_resume():
    """Extract entities from resume text only."""
    try:
        data = request.get_json(force=True)
        resume_text = data.get("resume_text", "").strip()

        if not resume_text:
            return jsonify({"error": "resume_text is required"}), 400

        entities = ner.extract_from_resume(resume_text)
        return jsonify({"entities": entities})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/extract/jd", methods=["POST"])
def extract_jd():
    """Extract entities from job description text only."""
    try:
        data = request.get_json(force=True)
        jd_text = data.get("job_description", "").strip()

        if not jd_text:
            return jsonify({"error": "job_description is required"}), 400

        entities = ner.extract_from_job_description(jd_text)
        return jsonify({"entities": entities})

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Main ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Render and Heroku pass the port inside 'PORT', not 'ML_PORT'
    port = int(os.environ.get("PORT", os.environ.get("ML_PORT", 5050)))
    print(f"\nStarting ML Pipeline Server on port {port}")
    app.run(
        host="0.0.0.0",
        port=port,
        debug=False,
    )
