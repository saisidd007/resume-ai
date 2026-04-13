"""
Resume-JD Analysis Pipeline Orchestrator
==========================================
End-to-end pipeline that chains:
  1. NER Extraction -> 2. Semantic Embedding -> 3. Skill Matching ->
  4. Experience & Domain Modeling -> 5. ML Model Scoring -> 6. Explainability ->
  7. Data Collection -> 8. JSON Output

Pipeline Flow:
  Resume + Job Description
    -> Feature Extraction (NER + Embeddings)
    -> Feature Vector Creation (semantic_sim, skill_match, exp, domain)
    -> ML Model Prediction (or heuristic fallback)
    -> Data Collection (append to training CSV)
    -> Output Score + Explanations

This is the main entry point for the ML pipeline.
"""

import json
import time
from typing import Dict, Optional

from ner_extractor import NERExtractor
from embedding_engine import EmbeddingEngine
from skill_matcher import SkillMatcher
from scorer import Scorer
from data_collector import DataCollector


class ResumeJDPipeline:
    """
    Orchestrates the full NLP pipeline for resume-to-job-description matching.
    
    Pipeline Stages:
      STEP 1: NER-based entity extraction
      STEP 2: Semantic embedding computation
      STEP 3: Contextual skill matching
      STEP 4: Experience & domain modeling
      STEP 5: ML model scoring (with heuristic fallback)
      STEP 6: Model interpretability
      STEP 7: Data collection for model training
      STEP 8: Strict JSON output
    """

    def __init__(self, collect_data: bool = True):
        """
        Initialize all pipeline components.

        Args:
            collect_data: Whether to record feature vectors for training (default: True)
        """
        print("[Pipeline] Initializing components...")
        t0 = time.time()

        self._ner = NERExtractor()
        self._embedder = EmbeddingEngine()
        self._matcher = SkillMatcher()
        self._scorer = Scorer()
        self._collector = DataCollector() if collect_data else None

        elapsed = time.time() - t0
        print(f"[Pipeline] All components initialized in {elapsed:.2f}s")
        print(f"[Pipeline] Scoring mode: {self._scorer._scoring_mode.upper()}")
        if self._collector:
            print(f"[Pipeline] Data collection: ENABLED ({self._collector.get_sample_count()} samples collected)")

    def analyze(
        self, resume_text: str, job_description_text: str
    ) -> Dict:
        """
        Run the full pipeline on a resume + job description pair.

        Pipeline Flow:
          Resume + JD Text
            -> NER Extraction (skills, roles, projects, education, experience)
            -> Embedding Computation (document & skill-level similarity)
            -> Skill Matching (strong/partial/missing classification)
            -> Domain & Experience Modeling
            -> Feature Vector: [semantic_sim, skill_match, exp_match, domain_sim]
            -> ML Model Prediction (or heuristic fallback)
            -> Data Collection (append row to training CSV)
            -> JSON Output

        Args:
            resume_text: Raw resume text (plain text)
            job_description_text: Raw job description text

        Returns:
            Strict JSON-compatible dict matching the output schema
        """
        t_start = time.time()
        print("\n" + "=" * 70)
        print("[Pipeline] Starting Resume-JD Analysis")
        print("=" * 70)

        # ─────────────────────────────────────────────────────────────
        # STEP 1: NER-BASED EXTRACTION
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 1] NER-Based Entity Extraction...")
        t1 = time.time()

        resume_entities = self._ner.extract_from_resume(resume_text)
        jd_entities = self._ner.extract_from_job_description(job_description_text)

        skills_resume = resume_entities["skills"]
        skills_job = jd_entities["skills"]
        roles = resume_entities["roles"]
        projects = resume_entities["projects"]
        education = resume_entities["education"]
        experience_indicators = resume_entities["experience_indicators"]
        experience_level_resume = experience_indicators["inferred_level"]

        jd_role = jd_entities["role"]
        jd_required_experience = jd_entities["required_experience"]
        experience_level_jd = jd_required_experience.get("level", "unspecified")
        if experience_level_jd == "unspecified":
            experience_level_jd = "mid"  # Default assumption for JDs

        print(f"  Resume skills: {len(skills_resume)} | JD skills: {len(skills_job)}")
        print(f"  Resume level: {experience_level_resume} | JD level: {experience_level_jd}")
        print(f"  Step 1 completed in {time.time() - t1:.3f}s")

        # ─────────────────────────────────────────────────────────────
        # STEP 2: SEMANTIC EMBEDDING COMPUTATION
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 2] Semantic Embedding & Similarity...")
        t2 = time.time()

        # Document-level semantic similarity
        semantic_similarity_score = self._embedder.compute_semantic_similarity(
            resume_text, job_description_text
        )

        # Skill-level similarity matrix
        skill_sim_result = self._embedder.compute_skill_similarity_matrix(
            skills_resume, skills_job
        )

        print(f"  Semantic similarity: {semantic_similarity_score:.4f}")
        print(f"  Similarity matrix: {len(skills_resume)}x{len(skills_job)}")
        print(f"  Step 2 completed in {time.time() - t2:.3f}s")

        # ─────────────────────────────────────────────────────────────
        # STEP 3: CONTEXTUAL SKILL MATCHING
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 3] Contextual Skill Matching...")
        t3 = time.time()

        skill_matching_result = self._matcher.classify_skills(
            skills_resume=skills_resume,
            skills_job=skills_job,
            similarity_matrix=skill_sim_result["matrix"],
            jd_text=job_description_text,
        )

        skill_match_quality = skill_matching_result["skill_match_quality"]

        print(f"  Strong matches:     {len(skill_matching_result['strong_matches'])}")
        print(f"  Partial matches:    {len(skill_matching_result['partial_matches'])}")
        print(f"  Missing critical:   {len(skill_matching_result['missing_critical'])}")
        print(f"  Missing secondary:  {len(skill_matching_result['missing_secondary'])}")
        print(f"  Match quality: {skill_match_quality:.4f}")
        print(f"  Step 3 completed in {time.time() - t3:.3f}s")

        # ─────────────────────────────────────────────────────────────
        # STEP 4: EXPERIENCE & DOMAIN MODELING
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 4] Experience & Domain Modeling...")
        t4 = time.time()

        # Domain inference
        domain_resume = self._embedder.infer_domain(skills_resume)
        domain_job = self._embedder.infer_domain(skills_job)

        # Domain similarity
        domain_similarity = self._embedder.compute_domain_similarity(
            domain_resume, domain_job
        )

        # Experience match
        experience_match_score = self._embedder.compute_experience_match_score(
            resume_level=experience_level_resume,
            jd_level=experience_level_jd,
            resume_years=experience_indicators.get("years_mentioned"),
            jd_years=jd_required_experience.get("years"),
        )

        print(f"  Resume domain: {domain_resume}")
        print(f"  JD domain:     {domain_job}")
        print(f"  Domain similarity:    {domain_similarity:.4f}")
        print(f"  Experience match:     {experience_match_score:.4f}")
        print(f"  Step 4 completed in {time.time() - t4:.3f}s")

        # ─────────────────────────────────────────────────────────────
        # STEP 5: ML MODEL SCORING
        #   Feature Vector -> ML Model -> Predicted Score
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 5] ML Model Scoring...")
        print(f"  Feature Vector: [sem={semantic_similarity_score:.4f}, "
              f"skill={skill_match_quality:.4f}, "
              f"exp={experience_match_score:.4f}, "
              f"dom={domain_similarity:.4f}]")
        t5 = time.time()

        scoring_result = self._scorer.compute_score(
            semantic_similarity=semantic_similarity_score,
            skill_match_quality=skill_match_quality,
            experience_match=experience_match_score,
            domain_similarity=domain_similarity,
            skill_matching_result=skill_matching_result,
            entities_resume=resume_entities,
            entities_jd=jd_entities,
        )

        final_score = scoring_result["final_score"]
        scoring_mode = scoring_result["scoring_mode"]
        heuristic_score = scoring_result["heuristic_score"]
        ml_score = scoring_result.get("ml_score")

        print(f"  Scoring mode: {scoring_mode.upper()}")
        print(f"  Final score: {final_score}/100")
        if ml_score is not None:
            print(f"  ML predicted score:   {ml_score}/100")
            print(f"  Heuristic score:      {heuristic_score}/100")
            print(f"  Delta (ML - Heur):    {ml_score - heuristic_score:+.2f}")
        print(f"  Step 5 completed in {time.time() - t5:.3f}s")

        # ─────────────────────────────────────────────────────────────
        # STEP 6: EXPLAINABILITY
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 6] Generating Explainability Report...")

        explainability = scoring_result["explainability"]

        # ─────────────────────────────────────────────────────────────
        # STEP 7: DATA COLLECTION (append to training CSV)
        # ─────────────────────────────────────────────────────────────
        print("\n[STEP 7] Recording Training Data...")

        if self._collector:
            # Always record using the heuristic score as ground truth
            # (the heuristic is our "label" until human-labeled data is available)
            self._collector.record(
                semantic_similarity=semantic_similarity_score,
                skill_match_quality=skill_match_quality,
                experience_match=experience_match_score,
                domain_similarity=domain_similarity,
                score=heuristic_score,
            )
        else:
            print("  Data collection disabled.")

        # ─────────────────────────────────────────────────────────────
        # STEP 8: STRICT JSON OUTPUT
        # ─────────────────────────────────────────────────────────────
        print("[STEP 8] Assembling Strict JSON Output...")

        output = {
            "entities": {
                "skills_resume": skills_resume,
                "skills_job": skills_job,
                "roles": roles,
                "projects": projects,
                "education": education,
                "experience_level": experience_level_resume,
                "domain_resume": domain_resume,
                "domain_job": domain_job,
            },
            "semantic_analysis": {
                "semantic_similarity_score": round(semantic_similarity_score, 4),
                "domain_similarity": round(domain_similarity, 4),
                "experience_match_score": round(experience_match_score, 4),
                "skill_similarity_matrix": {
                    "best_matches": skill_sim_result.get("best_matches", []),
                },
            },
            "skill_matching": {
                "strong_matches": skill_matching_result["strong_matches"],
                "partial_matches": skill_matching_result["partial_matches"],
                "missing_critical": skill_matching_result["missing_critical"],
                "missing_secondary": skill_matching_result["missing_secondary"],
            },
            "scoring": {
                "final_score": final_score,
                "scoring_mode": scoring_mode,
                "heuristic_score": heuristic_score,
                "ml_score": ml_score,
                "score_breakdown": scoring_result["score_breakdown"],
            },
            "explainability": {
                "positive_factors": explainability["positive_factors"],
                "negative_factors": explainability["negative_factors"],
            },
        }

        elapsed_total = time.time() - t_start
        print(f"\n{'=' * 70}")
        print(f"[Pipeline] Analysis complete in {elapsed_total:.2f}s")
        print(f"[Pipeline] Scoring Mode: {scoring_mode.upper()}")
        print(f"[Pipeline] Final Score: {final_score}/100")
        print(f"{'=' * 70}\n")

        return output

    def analyze_json(
        self, resume_text: str, job_description_text: str
    ) -> str:
        """
        Run the pipeline and return results as a JSON string.
        
        Args:
            resume_text: Raw resume text
            job_description_text: Raw job description text
            
        Returns:
            JSON-formatted string
        """
        result = self.analyze(resume_text, job_description_text)
        return json.dumps(result, indent=2, ensure_ascii=False)
