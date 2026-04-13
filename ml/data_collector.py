"""
Training Data Collector
========================
Collects feature vectors from every pipeline run and appends them
to a CSV file for model training.

Every run produces one row:
  semantic_similarity, skill_match, experience, domain, score

This module is the bridge between the heuristic pipeline and the ML model:
  - During data collection phase: records heuristic scores as ground truth
  - After model training: the trained model replaces the heuristic scorer

Thread-safe CSV appending with file locking.
"""

import os
import csv
import time
import threading
from typing import Dict, Optional

# ─── Configuration ───────────────────────────────────────────────────────────────
ML_DATA_DIR = os.path.dirname(os.path.abspath(__file__))
TRAINING_CSV = os.path.join(ML_DATA_DIR, "ml_training_data.csv")

CSV_COLUMNS = [
    "semantic_similarity",
    "skill_match",
    "experience",
    "domain",
    "score",
    "timestamp",
]

_write_lock = threading.Lock()


class DataCollector:
    """
    Collects and persists feature vectors from pipeline runs
    into a CSV file for downstream model training.
    """

    def __init__(self, csv_path: str = TRAINING_CSV):
        """
        Args:
            csv_path: Path to the training data CSV file
        """
        self._csv_path = csv_path
        self._ensure_csv_exists()

    def record(
        self,
        semantic_similarity: float,
        skill_match_quality: float,
        experience_match: float,
        domain_similarity: float,
        score: float,
    ) -> None:
        """
        Append a single feature vector + score to the training CSV.

        Args:
            semantic_similarity: Document-level cosine similarity [0,1]
            skill_match_quality: Skill match ratio [0,1]
            experience_match: Experience alignment score [0,1]
            domain_similarity: Domain similarity score [0,1]
            score: Final heuristic score [0,100]
        """
        row = {
            "semantic_similarity": round(semantic_similarity, 6),
            "skill_match": round(skill_match_quality, 6),
            "experience": round(experience_match, 6),
            "domain": round(domain_similarity, 6),
            "score": round(score, 4),
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        }

        with _write_lock:
            with open(self._csv_path, "a", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writerow(row)

        print(f"[DataCollector] Recorded training sample -> {self._csv_path}")
        print(f"  Features: sem={row['semantic_similarity']:.4f} "
              f"skill={row['skill_match']:.4f} "
              f"exp={row['experience']:.4f} "
              f"dom={row['domain']:.4f} "
              f"-> score={row['score']:.2f}")

    def get_sample_count(self) -> int:
        """Return the number of training samples collected so far."""
        if not os.path.exists(self._csv_path):
            return 0
        with open(self._csv_path, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            next(reader, None)  # skip header
            return sum(1 for _ in reader)

    def get_csv_path(self) -> str:
        """Return the path to the training CSV."""
        return self._csv_path

    def _ensure_csv_exists(self) -> None:
        """Create the CSV file with headers if it doesn't exist."""
        if not os.path.exists(self._csv_path):
            with open(self._csv_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()
            print(f"[DataCollector] Created new training CSV: {self._csv_path}")
