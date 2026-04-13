"""
Semantic Embedding Engine
==========================
Uses Sentence-BERT (all-MiniLM-L6-v2) to generate dense vector embeddings
for resume text, job descriptions, and individual skills.

Computes:
  - Document-level semantic similarity (resume ↔ JD)
  - Skill-level similarity matrix (each resume skill ↔ each JD skill)
  - Domain similarity scores

All similarity computations use cosine similarity over 384-dim embeddings.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from config import SBERT_MODEL_NAME, SKILL_DOMAINS


class EmbeddingEngine:
    """
    Transformer-based embedding engine for semantic analysis.
    Loads Sentence-BERT model and provides methods for encoding
    and comparing text at document and entity level.
    """

    def __init__(self, model_name: str = SBERT_MODEL_NAME):
        """
        Initialize the embedding engine with a Sentence-BERT model.
        
        Args:
            model_name: HuggingFace model identifier for sentence-transformers
        """
        print(f"[EmbeddingEngine] Loading model: {model_name}")
        self._model = SentenceTransformer(model_name)
        self._embedding_dim = self._model.get_sentence_embedding_dimension()
        print(f"[EmbeddingEngine] Model loaded. Embedding dim: {self._embedding_dim}")

        # Cache for embeddings to avoid redundant computation
        self._cache: Dict[str, np.ndarray] = {}

    # ─── Public API ──────────────────────────────────────────────────────────

    def encode(self, texts: List[str], use_cache: bool = True) -> np.ndarray:
        """
        Encode a list of text strings into dense vector embeddings.

        Args:
            texts: List of strings to encode
            use_cache: Whether to use embedding cache

        Returns:
            numpy array of shape (len(texts), embedding_dim)
        """
        if use_cache:
            uncached_indices = []
            uncached_texts = []
            for i, t in enumerate(texts):
                if t not in self._cache:
                    uncached_indices.append(i)
                    uncached_texts.append(t)

            if uncached_texts:
                new_embeddings = self._model.encode(
                    uncached_texts,
                    show_progress_bar=False,
                    convert_to_numpy=True,
                    normalize_embeddings=True,
                )
                for idx, text in zip(uncached_indices, uncached_texts):
                    self._cache[text] = new_embeddings[
                        uncached_indices.index(idx)
                    ]

            result = np.array([self._cache[t] for t in texts])
            return result
        else:
            return self._model.encode(
                texts,
                show_progress_bar=False,
                convert_to_numpy=True,
                normalize_embeddings=True,
            )

    def compute_semantic_similarity(
        self, resume_text: str, jd_text: str
    ) -> float:
        """
        Compute document-level semantic similarity between resume and JD.

        Uses full-text encoding to capture holistic meaning overlap,
        not just keyword intersection.

        Args:
            resume_text: Full resume text
            jd_text: Full job description text

        Returns:
            Cosine similarity score in [0, 1]
        """
        embeddings = self.encode([resume_text, jd_text])
        similarity = cosine_similarity(
            embeddings[0].reshape(1, -1),
            embeddings[1].reshape(1, -1),
        )[0][0]

        # Clamp to [0, 1]
        return float(max(0.0, min(1.0, similarity)))

    def compute_skill_similarity_matrix(
        self,
        skills_resume: List[str],
        skills_job: List[str],
    ) -> Dict:
        """
        Compute pairwise semantic similarity between resume skills and JD skills.

        Generates a full similarity matrix where entry (i, j) represents
        the semantic closeness of resume_skill[i] to job_skill[j].

        This captures relationships like:
          "TensorFlow" ≈ "Deep Learning" (high similarity)
          "Node.js" ≈ "Backend Development" (moderate similarity)

        Args:
            skills_resume: List of normalized resume skills
            skills_job: List of normalized job skills

        Returns:
            Dict containing:
              - matrix: 2D list of similarity scores
              - resume_skills: skill labels for rows
              - job_skills: skill labels for columns
              - best_matches: best JD match for each resume skill
        """
        if not skills_resume or not skills_job:
            return {
                "matrix": [],
                "resume_skills": skills_resume,
                "job_skills": skills_job,
                "best_matches": [],
            }

        # Encode all skills
        resume_embeddings = self.encode(skills_resume)
        job_embeddings = self.encode(skills_job)

        # Compute full cosine similarity matrix
        sim_matrix = cosine_similarity(resume_embeddings, job_embeddings)

        # Find best match for each resume skill
        best_matches = []
        for i, r_skill in enumerate(skills_resume):
            best_idx = int(np.argmax(sim_matrix[i]))
            best_score = float(sim_matrix[i][best_idx])
            best_matches.append({
                "resume_skill": r_skill,
                "best_job_match": skills_job[best_idx],
                "similarity": round(best_score, 4),
            })

        return {
            "matrix": sim_matrix.tolist(),
            "resume_skills": skills_resume,
            "job_skills": skills_job,
            "best_matches": best_matches,
        }

    def compute_domain_similarity(
        self, domain_resume: str, domain_job: str
    ) -> float:
        """
        Compute semantic similarity between inferred domains.

        Args:
            domain_resume: Inferred domain of the resume
            domain_job: Inferred domain from the JD

        Returns:
            Similarity score in [0, 1]
        """
        if not domain_resume or not domain_job:
            return 0.0

        if domain_resume.lower() == domain_job.lower():
            return 1.0

        embeddings = self.encode([domain_resume, domain_job])
        similarity = cosine_similarity(
            embeddings[0].reshape(1, -1),
            embeddings[1].reshape(1, -1),
        )[0][0]

        return float(max(0.0, min(1.0, similarity)))

    def infer_domain(self, skills: List[str]) -> str:
        """
        Infer the professional domain from a list of skills using
        embedding-based similarity against domain archetypes.

        For each domain in the taxonomy, we compute the average
        similarity between the candidate's skills and the domain's
        representative skills.

        Args:
            skills: List of normalized skill names

        Returns:
            Inferred domain name
        """
        if not skills:
            return "General"

        # Create a composite skill description
        skills_text = ", ".join(skills)
        skills_embedding = self.encode([skills_text])

        # Compute similarity against each domain archetype
        domain_scores = {}
        for domain_name, domain_skills in SKILL_DOMAINS.items():
            domain_text = ", ".join(domain_skills[:15])  # Top skills
            domain_embedding = self.encode([domain_text])
            sim = cosine_similarity(
                skills_embedding, domain_embedding
            )[0][0]
            domain_scores[domain_name] = float(sim)

        # Return the best-matching domain
        best_domain = max(domain_scores, key=domain_scores.get)
        return best_domain

    def compute_experience_match_score(
        self,
        resume_level: str,
        jd_level: str,
        resume_years: Optional[List[str]] = None,
        jd_years: Optional[str] = None,
    ) -> float:
        """
        Compute experience match score based on level alignment.

        Uses a graduated scoring model:
          - Exact level match → 1.0
          - One level off → 0.6
          - Two levels off → 0.3
          - Three levels off → 0.1

        Args:
            resume_level: Inferred experience level from resume
            jd_level: Required experience level from JD
            resume_years: Years mentioned in resume
            jd_years: Years required in JD

        Returns:
            Score in [0, 1]
        """
        level_order = ["fresher", "junior", "mid", "senior"]

        r_idx = level_order.index(resume_level) if resume_level in level_order else 0
        j_idx = level_order.index(jd_level) if jd_level in level_order else 0

        diff = abs(r_idx - j_idx)

        level_scores = {0: 1.0, 1: 0.6, 2: 0.3, 3: 0.1}
        score = level_scores.get(diff, 0.1)

        # Bonus for overqualification (slight penalty for underqualification)
        if r_idx > j_idx:
            score = min(1.0, score + 0.1)  # Slight bonus for overqualified
        elif r_idx < j_idx:
            score = max(0.0, score - 0.05)  # Slight penalty for underqualified

        return round(score, 4)

    def clear_cache(self):
        """Clear the embedding cache."""
        self._cache.clear()
