"""
ML-Powered Scorer with Heuristic Fallback & Explainability
============================================================
Primary scoring via trained ML model (model.pkl).
Falls back to weighted heuristic formula when no model is available.

Scoring Modes:
  1. ML Mode: model.predict(features) → score
  2. Heuristic Mode (fallback):
     score = (semantic_similarity * 35) + (skill_match_quality * 30) +
             (experience_match * 20) + (domain_similarity * 15)

Output: Score between 0-100 with feature-level explanations.
"""

import os
import numpy as np
import joblib
from typing import Dict, List, Tuple, Optional

from config import (
    WEIGHT_SEMANTIC_SIMILARITY,
    WEIGHT_SKILL_MATCH,
    WEIGHT_EXPERIENCE_MATCH,
    WEIGHT_DOMAIN_SIMILARITY,
)

# ─── Model Paths ─────────────────────────────────────────────────────────────────
ML_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(ML_DIR, "model.pkl")
SCALER_PATH = os.path.join(ML_DIR, "scaler.pkl")
METADATA_PATH = os.path.join(ML_DIR, "model_metadata.json")

FEATURE_ORDER = ["semantic_similarity", "skill_match", "experience", "domain"]


class Scorer:
    """
    Hybrid scorer: uses trained ML model when available,
    falls back to weighted heuristic formula otherwise.
    Produces SHAP-style explainability in both modes.
    """

    def __init__(self):
        self._weights = {
            "semantic_similarity": WEIGHT_SEMANTIC_SIMILARITY,
            "skill_match_quality": WEIGHT_SKILL_MATCH,
            "experience_match": WEIGHT_EXPERIENCE_MATCH,
            "domain_similarity": WEIGHT_DOMAIN_SIMILARITY,
        }

        # ── Attempt to load trained ML model ──────────────────────────
        self._ml_model = None
        self._scaler = None
        self._scoring_mode = "heuristic"

        self._load_ml_model()

    def _load_ml_model(self) -> None:
        """Attempt to load the trained model and scaler from disk."""
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            try:
                self._ml_model = joblib.load(MODEL_PATH)
                self._scaler = joblib.load(SCALER_PATH)
                self._scoring_mode = "ml_model"
                print(f"[Scorer] ML model loaded from {MODEL_PATH}")
                print(f"[Scorer] Scoring mode: ML MODEL (data-driven)")
            except Exception as e:
                print(f"[Scorer] Failed to load ML model: {e}")
                print(f"[Scorer] Falling back to heuristic scoring.")
                self._ml_model = None
                self._scaler = None
                self._scoring_mode = "heuristic"
        else:
            print(f"[Scorer] No trained model found at {MODEL_PATH}")
            print(f"[Scorer] Scoring mode: HEURISTIC (rule-based)")

    def reload_model(self) -> bool:
        """
        Reload the ML model from disk (e.g., after retraining).

        Returns:
            True if model loaded successfully, False otherwise
        """
        self._load_ml_model()
        return self._scoring_mode == "ml_model"

    def compute_score(
        self,
        semantic_similarity: float,
        skill_match_quality: float,
        experience_match: float,
        domain_similarity: float,
        skill_matching_result: Dict = None,
        entities_resume: Dict = None,
        entities_jd: Dict = None,
    ) -> Dict:
        """
        Compute the final score using ML model or heuristic fallback.

        Args:
            semantic_similarity: Document-level similarity [0,1]
            skill_match_quality: Skill match ratio [0,1]
            experience_match: Experience alignment score [0,1]
            domain_similarity: Domain similarity score [0,1]
            skill_matching_result: Detailed skill matching results
            entities_resume: Extracted resume entities
            entities_jd: Extracted JD entities

        Returns:
            Dict with final_score, score_breakdown, scoring_mode, and explainability
        """
        # ── Build feature vector ──────────────────────────────────────
        features = {
            "semantic_similarity": semantic_similarity,
            "skill_match": skill_match_quality,
            "experience": experience_match,
            "domain": domain_similarity,
        }

        # ── Compute heuristic score (always, for comparison) ──────────
        heuristic_components = self._compute_heuristic(
            semantic_similarity, skill_match_quality,
            experience_match, domain_similarity,
        )
        heuristic_score = sum(c["weighted_score"] for c in heuristic_components.values())
        heuristic_score = round(max(0.0, min(100.0, heuristic_score)), 2)

        # ── Compute ML score if model is available ────────────────────
        ml_score = None
        if self._scoring_mode == "ml_model" and self._ml_model is not None:
            ml_score = self._predict_ml(features)

        # ── Select final score ────────────────────────────────────────
        if ml_score is not None:
            final_score = ml_score
            scoring_mode = "ml_model"
        else:
            final_score = heuristic_score
            scoring_mode = "heuristic"

        # ── Build score breakdown ─────────────────────────────────────
        # Even in ML mode, show component-level breakdown for interpretability
        components = heuristic_components  # Component breakdown always available

        # ── Explainability ────────────────────────────────────────────
        positive_factors, negative_factors = self._generate_explanations(
            components,
            skill_matching_result or {},
            entities_resume or {},
            entities_jd or {},
            final_score=final_score,
        )

        return {
            "final_score": final_score,
            "scoring_mode": scoring_mode,
            "heuristic_score": heuristic_score,
            "ml_score": ml_score,
            "score_breakdown": components,
            "explainability": {
                "positive_factors": positive_factors,
                "negative_factors": negative_factors,
            },
        }

    def _predict_ml(self, features: Dict) -> Optional[float]:
        """
        Run prediction through the trained ML model.

        Args:
            features: Dict with keys matching FEATURE_ORDER

        Returns:
            Predicted score [0, 100] or None on failure
        """
        try:
            # Build feature array in correct order
            feature_array = np.array([[
                features["semantic_similarity"],
                features["skill_match"],
                features["experience"],
                features["domain"],
            ]])

            # Scale features
            feature_scaled = self._scaler.transform(feature_array)

            # Predict
            prediction = self._ml_model.predict(feature_scaled)[0]

            # Clamp to valid range
            prediction = float(max(0.0, min(100.0, prediction)))

            return round(prediction, 2)

        except Exception as e:
            print(f"[Scorer] ML prediction failed: {e}")
            return None

    def _compute_heuristic(
        self,
        semantic_similarity: float,
        skill_match_quality: float,
        experience_match: float,
        domain_similarity: float,
    ) -> Dict:
        """Compute the rule-based weighted score components."""
        return {
            "semantic_similarity": {
                "raw_score": round(semantic_similarity, 4),
                "weight": self._weights["semantic_similarity"],
                "weighted_score": round(
                    semantic_similarity * self._weights["semantic_similarity"], 2
                ),
            },
            "skill_match_quality": {
                "raw_score": round(skill_match_quality, 4),
                "weight": self._weights["skill_match_quality"],
                "weighted_score": round(
                    skill_match_quality * self._weights["skill_match_quality"], 2
                ),
            },
            "experience_match": {
                "raw_score": round(experience_match, 4),
                "weight": self._weights["experience_match"],
                "weighted_score": round(
                    experience_match * self._weights["experience_match"], 2
                ),
            },
            "domain_similarity": {
                "raw_score": round(domain_similarity, 4),
                "weight": self._weights["domain_similarity"],
                "weighted_score": round(
                    domain_similarity * self._weights["domain_similarity"], 2
                ),
            },
        }

    def _generate_explanations(
        self,
        components: Dict,
        skill_matching: Dict,
        entities_resume: Dict,
        entities_jd: Dict,
        final_score: float = 0.0,
    ) -> Tuple[List[str], List[str]]:
        """
        Generate SHAP-style feature contribution explanations.

        Analyzes each scoring component and skill matching result
        to produce human-readable positive/negative factors.

        Returns:
            Tuple of (positive_factors, negative_factors)
        """
        positive = []
        negative = []

        # ── Scoring mode indicator ────────────────────────────────────
        if self._scoring_mode == "ml_model":
            positive.append(
                f"Score computed via trained ML model (data-driven prediction)"
            )

        # ── Semantic Similarity Analysis ──────────────────────────────
        sem_score = components["semantic_similarity"]["raw_score"]
        sem_contrib = components["semantic_similarity"]["weighted_score"]
        if sem_score >= 0.7:
            positive.append(
                f"Strong semantic alignment between resume and job description "
                f"(similarity={sem_score:.2f}, contributing +{sem_contrib:.1f} points)"
            )
        elif sem_score >= 0.4:
            positive.append(
                f"Moderate semantic overlap with job description "
                f"(similarity={sem_score:.2f}, contributing +{sem_contrib:.1f} points)"
            )
        else:
            negative.append(
                f"Low semantic alignment with job description "
                f"(similarity={sem_score:.2f}, only contributing +{sem_contrib:.1f} points). "
                f"Resume content may be in a different domain or focus area."
            )

        # ── Skill Match Analysis ──────────────────────────────────────
        skill_score = components["skill_match_quality"]["raw_score"]
        skill_contrib = components["skill_match_quality"]["weighted_score"]
        strong_matches = skill_matching.get("strong_matches", [])
        partial_matches = skill_matching.get("partial_matches", [])
        missing_critical = skill_matching.get("missing_critical", [])
        missing_secondary = skill_matching.get("missing_secondary", [])

        if strong_matches:
            matched_skills = [m.get("job_skill", m.get("skill", "")) for m in strong_matches]
            positive.append(
                f"Strong skill matches found ({len(strong_matches)}): "
                f"{', '.join(matched_skills[:5])}. "
                f"Skill match quality={skill_score:.2f}, contributing +{skill_contrib:.1f} points."
            )

        if partial_matches:
            partial_skills = [m.get("job_skill", "") for m in partial_matches]
            positive.append(
                f"Partial/related skill matches ({len(partial_matches)}): "
                f"{', '.join(partial_skills[:5])}. "
                f"These show transferable knowledge."
            )

        if missing_critical:
            critical_names = [m.get("skill", "") for m in missing_critical]
            negative.append(
                f"Missing {len(missing_critical)} critical job skills: "
                f"{', '.join(critical_names[:5])}. "
                f"These are high-priority requirements with no semantic match in the resume."
            )

        if missing_secondary:
            secondary_names = [m.get("skill", "") for m in missing_secondary]
            negative.append(
                f"Missing {len(missing_secondary)} secondary/preferred skills: "
                f"{', '.join(secondary_names[:5])}."
            )

        # ── Experience Match Analysis ─────────────────────────────────
        exp_score = components["experience_match"]["raw_score"]
        exp_contrib = components["experience_match"]["weighted_score"]
        if exp_score >= 0.8:
            positive.append(
                f"Experience level aligns well with job requirements "
                f"(match={exp_score:.2f}, contributing +{exp_contrib:.1f} points)"
            )
        elif exp_score >= 0.5:
            negative.append(
                f"Experience level partially matches requirements "
                f"(match={exp_score:.2f}, contributing only +{exp_contrib:.1f} of max {self._weights['experience_match']} points)"
            )
        else:
            negative.append(
                f"Significant experience level gap "
                f"(match={exp_score:.2f}, contributing only +{exp_contrib:.1f} of max {self._weights['experience_match']} points). "
                f"Consider highlighting relevant projects or coursework."
            )

        # ── Domain Similarity Analysis ────────────────────────────────
        dom_score = components["domain_similarity"]["raw_score"]
        dom_contrib = components["domain_similarity"]["weighted_score"]
        if dom_score >= 0.7:
            positive.append(
                f"Strong domain alignment -- resume domain closely matches job domain "
                f"(similarity={dom_score:.2f}, contributing +{dom_contrib:.1f} points)"
            )
        elif dom_score >= 0.4:
            positive.append(
                f"Related domain experience detected "
                f"(similarity={dom_score:.2f}, contributing +{dom_contrib:.1f} points)"
            )
        else:
            negative.append(
                f"Domain mismatch between resume and job "
                f"(similarity={dom_score:.2f}, contributing only +{dom_contrib:.1f} of max {self._weights['domain_similarity']} points). "
                f"The resume focuses on a different professional domain."
            )

        # ── Overall Assessment ────────────────────────────────────────
        if final_score >= 75:
            positive.insert(
                0,
                f"Overall strong candidate match (score: {final_score:.1f}/100)"
            )
        elif final_score >= 50:
            positive.insert(
                0,
                f"Moderate candidate match with room for improvement (score: {final_score:.1f}/100)"
            )
        else:
            negative.insert(
                0,
                f"Below-average match for this position (score: {final_score:.1f}/100). "
                f"Significant gaps in required skills/experience."
            )

        return positive, negative
