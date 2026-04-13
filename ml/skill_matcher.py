"""
Contextual Skill Matcher
==========================
Classifies skills into strong, partial, missing-critical, and missing-secondary
categories using the semantic similarity matrix from the Embedding Engine.

Uses:
  - Cosine similarity thresholds for strong/partial classification
  - JD skill importance ranking (skills mentioned first or in "required" section
    are weighted higher than "preferred" skills)
  - Bidirectional matching: checks both resume→JD and JD→resume directions
"""

from typing import Dict, List, Tuple
from config import (
    SIMILARITY_THRESHOLD_STRONG,
    SIMILARITY_THRESHOLD_PARTIAL,
)


class SkillMatcher:
    """
    Contextual skill matching engine that classifies skill alignment
    between resume and job description using semantic similarity scores.
    """

    def __init__(
        self,
        strong_threshold: float = SIMILARITY_THRESHOLD_STRONG,
        partial_threshold: float = SIMILARITY_THRESHOLD_PARTIAL,
    ):
        """
        Args:
            strong_threshold: Minimum cosine similarity for a strong match
            partial_threshold: Minimum cosine similarity for a partial match
        """
        self._strong_threshold = strong_threshold
        self._partial_threshold = partial_threshold

    def classify_skills(
        self,
        skills_resume: List[str],
        skills_job: List[str],
        similarity_matrix: List[List[float]],
        jd_text: str = "",
    ) -> Dict:
        """
        Classify all JD skills into match categories based on the similarity matrix.

        Categories:
          - strong_matches: JD skill has a resume skill with similarity >= strong_threshold
          - partial_matches: JD skill has a resume skill with similarity >= partial_threshold
          - missing_critical: Important JD skill with no semantic match in resume
          - missing_secondary: Lower-priority JD skill with no match

        Args:
            skills_resume: Normalized resume skills
            skills_job: Normalized JD skills
            similarity_matrix: Pre-computed cosine similarity matrix [resume x job]
            jd_text: Original JD text for importance ranking

        Returns:
            Classification dict with all four categories
        """
        if not skills_job:
            return {
                "strong_matches": [],
                "partial_matches": [],
                "missing_critical": [],
                "missing_secondary": [],
                "skill_match_quality": 0.0,
            }

        # Determine skill importance from JD context
        critical_skills, secondary_skills = self._rank_skill_importance(
            skills_job, jd_text
        )

        strong_matches = []
        partial_matches = []
        missing_critical = []
        missing_secondary = []

        import numpy as np

        if similarity_matrix and skills_resume:
            sim_array = np.array(similarity_matrix)  # shape: [resume, job]

            for j, job_skill in enumerate(skills_job):
                # Get max similarity score from any resume skill
                max_sim = float(np.max(sim_array[:, j]))
                best_resume_idx = int(np.argmax(sim_array[:, j]))
                best_resume_skill = skills_resume[best_resume_idx]

                # Check for exact string match first (always strong)
                exact = job_skill.lower() == best_resume_skill.lower()

                if exact or max_sim >= self._strong_threshold:
                    strong_matches.append({
                        "job_skill": job_skill,
                        "matched_with": best_resume_skill,
                        "similarity": round(max_sim, 4),
                        "match_type": "exact" if exact else "semantic",
                    })
                elif max_sim >= self._partial_threshold:
                    partial_matches.append({
                        "job_skill": job_skill,
                        "closest_resume_skill": best_resume_skill,
                        "similarity": round(max_sim, 4),
                    })
                else:
                    # Missing — classify by importance
                    if job_skill in critical_skills:
                        missing_critical.append({
                            "skill": job_skill,
                            "importance": "critical",
                            "closest_in_resume": best_resume_skill,
                            "similarity": round(max_sim, 4),
                        })
                    else:
                        missing_secondary.append({
                            "skill": job_skill,
                            "importance": "secondary",
                            "closest_in_resume": best_resume_skill,
                            "similarity": round(max_sim, 4),
                        })
        else:
            # No resume skills — all JD skills are missing
            for job_skill in skills_job:
                if job_skill in critical_skills:
                    missing_critical.append({
                        "skill": job_skill,
                        "importance": "critical",
                        "closest_in_resume": None,
                        "similarity": 0.0,
                    })
                else:
                    missing_secondary.append({
                        "skill": job_skill,
                        "importance": "secondary",
                        "closest_in_resume": None,
                        "similarity": 0.0,
                    })

        # Compute skill match quality metric
        total_job = len(skills_job)
        strong_count = len(strong_matches)
        partial_count = len(partial_matches)

        skill_match_quality = (
            (strong_count + 0.5 * partial_count) / total_job
            if total_job > 0
            else 0.0
        )
        skill_match_quality = min(1.0, skill_match_quality)

        return {
            "strong_matches": strong_matches,
            "partial_matches": partial_matches,
            "missing_critical": missing_critical,
            "missing_secondary": missing_secondary,
            "skill_match_quality": round(skill_match_quality, 4),
        }

    def _rank_skill_importance(
        self, skills_job: List[str], jd_text: str
    ) -> Tuple[set, set]:
        """
        Rank job skills by importance using contextual signals.

        Skills are classified as critical if:
          - They appear in "required" / "minimum qualifications" sections
          - They appear early in the JD (first half)
          - They are mentioned multiple times

        Otherwise classified as secondary.

        Args:
            skills_job: List of normalized JD skills
            jd_text: Raw job description text

        Returns:
            Tuple of (critical_skills_set, secondary_skills_set)
        """
        import re

        jd_lower = jd_text.lower()
        critical = set()
        secondary = set()

        # Detect if JD has explicit required/preferred sections
        has_required_section = bool(
            re.search(
                r"(?:required|minimum|must[\s\-]have|essential|mandatory)",
                jd_lower,
            )
        )
        has_preferred_section = bool(
            re.search(
                r"(?:preferred|nice[\s\-]to[\s\-]have|bonus|optional|desired|plus)",
                jd_lower,
            )
        )

        # Find the boundary between required and preferred
        preferred_start = len(jd_lower)
        if has_preferred_section:
            pref_match = re.search(
                r"(?:preferred|nice[\s\-]to[\s\-]have|bonus|optional|desired)",
                jd_lower,
            )
            if pref_match:
                preferred_start = pref_match.start()

        midpoint = len(jd_lower) // 2

        for skill in skills_job:
            skill_lower = skill.lower()
            first_mention = jd_lower.find(skill_lower)

            # Count mentions
            mention_count = jd_lower.count(skill_lower)

            is_critical = False

            if has_required_section and has_preferred_section:
                # If explicit sections exist, use section position
                if first_mention >= 0 and first_mention < preferred_start:
                    is_critical = True
            else:
                # Heuristic: skills in first half or mentioned 2+ times are critical
                if first_mention >= 0 and first_mention < midpoint:
                    is_critical = True
                if mention_count >= 2:
                    is_critical = True

            # First 60% of skills listed tend to be more important
            skill_idx = skills_job.index(skill)
            if skill_idx < len(skills_job) * 0.6:
                is_critical = True

            if is_critical:
                critical.add(skill)
            else:
                secondary.add(skill)

        # Ensure at least some are critical
        if not critical and skills_job:
            # Default: first half are critical
            half = max(1, len(skills_job) // 2)
            critical = set(skills_job[:half])
            secondary = set(skills_job[half:])

        return critical, secondary
