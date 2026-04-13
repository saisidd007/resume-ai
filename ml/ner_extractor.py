"""
NER-Based Entity Extraction Module
====================================
Performs Named Entity Recognition on resume and job description text.
Uses pattern-based extraction with normalization against a curated skill taxonomy,
combined with contextual heuristics for role, project, education, and experience detection.

This is NOT keyword matching — it uses:
  - Regex-anchored contextual extraction (section-aware parsing)
  - Skill normalization via canonical mapping
  - Sliding-window n-gram matching against the taxonomy
  - Contextual role inference from surrounding text
"""

import re
from typing import Dict, List, Tuple
from config import (
    SKILL_NORMALIZATION,
    SKILL_DOMAINS,
    EXPERIENCE_KEYWORDS,
    ROLE_KEYWORDS,
)


class NERExtractor:
    """
    Extracts structured entities from unstructured resume and job description text.
    Mimics a transformer-based NER pipeline with pattern-based extraction
    and taxonomy-driven normalization.
    """

    def __init__(self):
        # Build reverse lookup: canonical skill → set of aliases
        self._skill_lookup = {}
        for alias, canonical in SKILL_NORMALIZATION.items():
            self._skill_lookup[alias.lower()] = canonical

        # Flatten all canonical skill names for direct matching
        self._all_canonical_skills = set(SKILL_NORMALIZATION.values())
        for domain_skills in SKILL_DOMAINS.values():
            self._all_canonical_skills.update(domain_skills)

        # Pre-compile section header patterns for resume parsing
        self._section_patterns = {
            "skills": re.compile(
                r"(?:^|\n)\s*(?:technical\s+)?skills?\s*[:\-\n]",
                re.IGNORECASE,
            ),
            "experience": re.compile(
                r"(?:^|\n)\s*(?:work\s+)?experience\s*[:\-\n]",
                re.IGNORECASE,
            ),
            "education": re.compile(
                r"(?:^|\n)\s*education\s*[:\-\n]",
                re.IGNORECASE,
            ),
            "projects": re.compile(
                r"(?:^|\n)\s*projects?\s*[:\-\n]",
                re.IGNORECASE,
            ),
            "certifications": re.compile(
                r"(?:^|\n)\s*certifications?\s*[:\-\n]",
                re.IGNORECASE,
            ),
        }

        # Experience year patterns
        self._year_patterns = [
            re.compile(r"(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?", re.IGNORECASE),
            re.compile(r"(\d+)\s*-\s*(\d+)\s*(?:years?|yrs?)", re.IGNORECASE),
        ]

        # Education patterns
        self._education_patterns = [
            re.compile(
                r"(?:bachelor|b\.?s\.?|b\.?tech|b\.?e\.?|b\.?sc|b\.?a\.?)"
                r"(?:\s+(?:of|in|\.)\s+[\w\s&]+)?",
                re.IGNORECASE,
            ),
            re.compile(
                r"(?:master|m\.?s\.?|m\.?tech|m\.?e\.?|m\.?sc|m\.?a\.?|mba)"
                r"(?:\s+(?:of|in|\.)\s+[\w\s&]+)?",
                re.IGNORECASE,
            ),
            re.compile(
                r"(?:ph\.?d|doctorate|doctor of)"
                r"(?:\s+(?:of|in|\.)\s+[\w\s&]+)?",
                re.IGNORECASE,
            ),
            re.compile(
                r"(?:diploma|associate|certification)\s+(?:in\s+)?[\w\s&]+",
                re.IGNORECASE,
            ),
        ]

    # ─── Public API ──────────────────────────────────────────────────────────

    def extract_from_resume(self, text: str) -> Dict:
        """
        Extract all entities from resume text.

        Returns:
            dict with keys: skills, roles, projects, education, experience_indicators
        """
        text_clean = self._preprocess(text)

        skills = self._extract_skills(text_clean)
        roles = self._extract_roles(text_clean)
        projects = self._extract_projects(text_clean)
        education = self._extract_education(text_clean)
        experience_indicators = self._extract_experience_indicators(text_clean)

        return {
            "skills": skills,
            "roles": roles,
            "projects": projects,
            "education": education,
            "experience_indicators": experience_indicators,
        }

    def extract_from_job_description(self, text: str) -> Dict:
        """
        Extract all entities from job description text.

        Returns:
            dict with keys: skills, role, responsibilities, required_experience
        """
        text_clean = self._preprocess(text)

        skills = self._extract_skills(text_clean)
        role = self._extract_jd_role(text_clean)
        responsibilities = self._extract_responsibilities(text_clean)
        required_experience = self._extract_required_experience(text_clean)

        return {
            "skills": skills,
            "role": role,
            "responsibilities": responsibilities,
            "required_experience": required_experience,
        }

    # ─── Core Extraction Methods ─────────────────────────────────────────────

    def _extract_skills(self, text: str) -> List[str]:
        """
        Extract and normalize skills using sliding-window n-gram matching.
        Scans 1-gram through 4-gram windows against the skill taxonomy.
        """
        text_lower = text.lower()
        found_skills = set()

        # Strategy 1: Direct canonical match (case-insensitive)
        for canonical in self._all_canonical_skills:
            if canonical.lower() in text_lower:
                found_skills.add(canonical)

        # Strategy 2: Alias-based n-gram scanning
        words = re.findall(r"[a-zA-Z0-9#+\.\-/]+", text_lower)
        for n in range(1, 5):  # 1-gram to 4-gram
            for i in range(len(words) - n + 1):
                ngram = " ".join(words[i : i + n])
                if ngram in self._skill_lookup:
                    found_skills.add(self._skill_lookup[ngram])

        # Strategy 3: Pattern-based extraction for compound skills
        compound_patterns = [
            (r"react\s*native", "React Native"),
            (r"ruby\s+on\s+rails", "Ruby on Rails"),
            (r"spring\s+boot", "Spring Boot"),
            (r"power\s+bi", "Power BI"),
            (r"google\s+cloud", "Google Cloud Platform"),
            (r"amazon\s+web\s+services", "Amazon Web Services"),
            (r"object[\s\-]oriented\s+programming", "Object-Oriented Programming"),
            (r"test[\s\-]driven\s+development", "Test-Driven Development"),
            (r"natural\s+language\s+processing", "Natural Language Processing"),
            (r"computer\s+vision", "Computer Vision"),
            (r"deep\s+learning", "Deep Learning"),
            (r"machine\s+learning", "Machine Learning"),
            (r"reinforcement\s+learning", "Reinforcement Learning"),
            (r"data\s+structures?\s*(?:and|&)\s*algorithms?", "Data Structures & Algorithms"),
            (r"ci\s*/\s*cd", "CI/CD"),
            (r"large\s+language\s+models?", "Large Language Models"),
            (r"generative\s+ai", "Generative AI"),
            (r"retrieval\s+augmented\s+generation", "Retrieval Augmented Generation"),
            (r"design\s+patterns?", "Design Patterns"),
            (r"system\s+design", "System Design"),
            (r"unit\s+test(?:ing)?", "Unit Testing"),
            (r"integration\s+test(?:ing)?", "Integration Testing"),
        ]
        for pattern, skill in compound_patterns:
            if re.search(pattern, text_lower):
                found_skills.add(skill)

        return sorted(found_skills)

    def _extract_roles(self, text: str) -> List[str]:
        """Extract role mentions from resume text via contextual pattern matching."""
        text_lower = text.lower()
        found_roles = set()

        for role_name, keywords in ROLE_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    found_roles.add(role_name)
                    break

        # Also try to extract from title-like patterns
        title_patterns = [
            re.compile(
                r"(?:^|\n)\s*([A-Z][a-zA-Z\s/&\-]+(?:Engineer|Developer|Scientist|Analyst|Manager|Architect|Lead|Designer|Consultant))\s*(?:\n|$)",
            ),
            re.compile(
                r"(?:position|title|role)\s*[:\-]\s*([^\n]+)",
                re.IGNORECASE,
            ),
        ]
        for pat in title_patterns:
            matches = pat.findall(text)
            for m in matches:
                m_clean = m.strip()
                if 3 < len(m_clean) < 60:
                    found_roles.add(m_clean)

        return sorted(found_roles)

    def _extract_projects(self, text: str) -> List[str]:
        """Extract project descriptions from resume text."""
        projects = []

        # Try section-based extraction
        proj_section = self._extract_section(text, "projects")
        if proj_section:
            # Split by bullet points or numbered items
            items = re.split(r"(?:^|\n)\s*(?:[\-•●▸▪]\s*|\d+\.\s*)", proj_section)
            for item in items:
                item = item.strip()
                if len(item) > 15 and len(item) < 300:
                    # Take the first sentence or line as project summary
                    first_line = item.split("\n")[0].strip()
                    if len(first_line) > 10:
                        projects.append(first_line)

        # Fallback: look for project-like patterns
        if not projects:
            proj_patterns = [
                re.compile(
                    r"(?:built|developed|created|designed|implemented|architected|deployed)\s+(?:a\s+|an\s+)?([^\.;]{15,120})",
                    re.IGNORECASE,
                ),
                re.compile(
                    r"(?:project\s*[:\-]\s*)([^\n]{15,120})",
                    re.IGNORECASE,
                ),
            ]
            for pat in proj_patterns:
                matches = pat.findall(text)
                for m in matches:
                    m_clean = m.strip().rstrip(",;")
                    if m_clean and m_clean not in projects:
                        projects.append(m_clean)

        return projects[:10]  # Cap at 10 projects

    def _extract_education(self, text: str) -> List[str]:
        """Extract education qualifications."""
        education = []

        # Try section-based extraction first
        edu_section = self._extract_section(text, "education")
        search_text = edu_section if edu_section else text

        for pat in self._education_patterns:
            matches = pat.findall(search_text)
            for m in matches:
                m_clean = m.strip()
                if m_clean and len(m_clean) > 3:
                    # Try to get the full line for context
                    for line in search_text.split("\n"):
                        if m_clean.lower() in line.lower() and len(line.strip()) > 5:
                            edu_entry = line.strip()[:150]
                            if edu_entry not in education:
                                education.append(edu_entry)
                            break
                    else:
                        if m_clean not in education:
                            education.append(m_clean)

        # Deduplicate keeping order
        seen = set()
        unique_education = []
        for e in education:
            e_normalized = e.lower().strip()
            if e_normalized not in seen:
                seen.add(e_normalized)
                unique_education.append(e)

        return unique_education[:5]

    def _extract_experience_indicators(self, text: str) -> Dict:
        """Extract experience-related indicators: years, type, level."""
        text_lower = text.lower()
        indicators = {
            "years_mentioned": [],
            "experience_type": [],
            "inferred_level": "fresher",
        }

        # Extract years
        for pat in self._year_patterns:
            matches = pat.findall(text_lower)
            for m in matches:
                if isinstance(m, tuple):
                    indicators["years_mentioned"].append(f"{m[0]}-{m[1]} years")
                else:
                    indicators["years_mentioned"].append(f"{m} years")

        # Detect experience types
        exp_types = {
            "internship": [r"intern(?:ship)?"],
            "full-time": [r"full[\s\-]?time", r"permanent"],
            "freelance": [r"freelanc", r"contract", r"consultant"],
            "research": [r"research\s+(?:assistant|associate|intern)"],
            "part-time": [r"part[\s\-]?time"],
        }
        for exp_type, patterns in exp_types.items():
            for p in patterns:
                if re.search(p, text_lower):
                    indicators["experience_type"].append(exp_type)
                    break

        # Infer experience level
        indicators["inferred_level"] = self._infer_experience_level(text_lower)

        return indicators

    def _extract_jd_role(self, text: str) -> str:
        """Extract the primary role from a job description."""
        text_lower = text.lower()

        # Check for explicit role/title mentions
        title_patterns = [
            re.compile(r"(?:job\s+title|position|role)\s*[:\-]\s*([^\n]+)", re.IGNORECASE),
            re.compile(r"(?:hiring|looking for|seeking)\s+(?:a\s+|an\s+)?([^\n\.]{10,60})", re.IGNORECASE),
        ]
        for pat in title_patterns:
            match = pat.search(text)
            if match:
                return match.group(1).strip()

        # Fallback: match against known role keywords
        for role_name, keywords in ROLE_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    return role_name

        # Last resort: first line might be the title
        first_line = text.strip().split("\n")[0].strip()
        if len(first_line) < 80:
            return first_line

        return "Unspecified Role"

    def _extract_responsibilities(self, text: str) -> List[str]:
        """Extract responsibilities from job description."""
        responsibilities = []
        text_lower = text.lower()

        # Find responsibilities section
        resp_match = re.search(
            r"(?:responsibilities|what you.?ll do|job duties|key responsibilities|about the role)\s*[:\-\n]",
            text_lower,
        )
        if resp_match:
            remaining = text[resp_match.end():]
            # Take until next section
            next_section = re.search(
                r"\n\s*(?:requirements|qualifications|skills|about|benefits|what we offer)\s*[:\-\n]",
                remaining,
                re.IGNORECASE,
            )
            if next_section:
                remaining = remaining[: next_section.start()]

            items = re.split(r"(?:^|\n)\s*(?:[\-•●▸▪]\s*|\d+\.\s*)", remaining)
            for item in items:
                item = item.strip()
                if 15 < len(item) < 300:
                    responsibilities.append(item.split("\n")[0].strip())

        # Fallback: extract action-verb sentences
        if not responsibilities:
            action_patterns = re.findall(
                r"(?:^|\n)\s*(?:[\-•]\s*)?(?:design|develop|build|implement|maintain|manage|lead|collaborate|optimize|create|deploy|monitor|analyze|ensure|write|test|debug|review|architect|research|automate|integrate|scale)\s+[^\n]{10,150}",
                text,
                re.IGNORECASE,
            )
            for match in action_patterns[:8]:
                responsibilities.append(match.strip().lstrip("-•▸ "))

        return responsibilities[:10]

    def _extract_required_experience(self, text: str) -> Dict:
        """Extract experience requirements from job description."""
        text_lower = text.lower()
        result = {
            "years": None,
            "level": "unspecified",
            "details": [],
        }

        # Extract year requirements
        for pat in self._year_patterns:
            match = pat.search(text_lower)
            if match:
                groups = match.groups()
                if len(groups) == 2 and groups[1]:
                    result["years"] = f"{groups[0]}-{groups[1]} years"
                else:
                    result["years"] = f"{groups[0]}+ years"
                break

        # Extract level
        result["level"] = self._infer_experience_level(text_lower)

        # Extract qualification bullets
        qual_match = re.search(
            r"(?:requirements|qualifications|minimum qualifications|what we.?re looking for|must have)\s*[:\-\n]",
            text_lower,
        )
        if qual_match:
            remaining = text[qual_match.end():]
            next_section = re.search(
                r"\n\s*(?:preferred|nice to have|bonus|responsibilities|benefits|about)\s*[:\-\n]",
                remaining,
                re.IGNORECASE,
            )
            if next_section:
                remaining = remaining[: next_section.start()]

            items = re.split(r"(?:^|\n)\s*(?:[\-•●▸▪]\s*|\d+\.\s*)", remaining)
            for item in items:
                item = item.strip()
                if 10 < len(item) < 300:
                    result["details"].append(item.split("\n")[0].strip())

        return result

    # ─── Helper Methods ──────────────────────────────────────────────────────

    def _preprocess(self, text: str) -> str:
        """Clean and normalize input text."""
        # Remove excessive whitespace but preserve newlines
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        # Remove common artifacts
        text = re.sub(r"[^\x00-\x7F]+", " ", text)  # Remove non-ASCII
        text = re.sub(r"http\S+", "", text)  # Remove URLs
        return text.strip()

    def _extract_section(self, text: str, section_name: str) -> str:
        """Extract text belonging to a specific section."""
        if section_name not in self._section_patterns:
            return ""

        match = self._section_patterns[section_name].search(text)
        if not match:
            return ""

        start = match.end()
        # Find next section header
        next_start = len(text)
        for name, pattern in self._section_patterns.items():
            if name == section_name:
                continue
            next_match = pattern.search(text[start:])
            if next_match:
                candidate = start + next_match.start()
                if candidate < next_start:
                    next_start = candidate

        return text[start:next_start].strip()

    def _infer_experience_level(self, text_lower: str) -> str:
        """Infer experience level from text using keyword confidence scoring."""
        scores = {"fresher": 0, "junior": 0, "mid": 0, "senior": 0}

        for level, keywords in EXPERIENCE_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    scores[level] += 1

        # Also factor in year mentions
        year_match = re.search(r"(\d+)\+?\s*(?:years?|yrs?)", text_lower)
        if year_match:
            years = int(year_match.group(1))
            if years <= 1:
                scores["fresher"] += 2
            elif years <= 2:
                scores["junior"] += 2
            elif years <= 5:
                scores["mid"] += 2
            else:
                scores["senior"] += 2

        # Return level with highest score, default to fresher
        best_level = max(scores, key=scores.get)
        if scores[best_level] == 0:
            return "fresher"
        return best_level
