"""
Pipeline Validation Script
============================
Tests the full Resume-JD analysis pipeline with sample inputs
and validates ML model predictions against heuristic scores.

Workflow:
  1. Run pipeline with heuristic scoring (no model.pkl)
  2. Train ML model on collected + synthetic data
  3. Re-run pipeline with ML model scoring
  4. Compare heuristic vs ML predicted scores
  5. Verify predictions are reasonable

Usage:
  python test_pipeline.py               # Run basic test
  python test_pipeline.py --validate    # Full validation (train + compare)
"""

import json
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipeline import ResumeJDPipeline


# ─── Sample Resume ───────────────────────────────────────────────────────────────
SAMPLE_RESUME = """
JOHN DOE
Software Engineer | Machine Learning Enthusiast

Email: john.doe@email.com | LinkedIn: linkedin.com/in/johndoe | GitHub: github.com/johndoe

SUMMARY
Passionate software engineer with 2 years of experience in full-stack web development
and a growing interest in machine learning and data science. Skilled in Python, JavaScript,
and cloud technologies.

SKILLS
- Programming: Python, JavaScript, TypeScript, Java, SQL
- Frontend: React, Next.js, HTML, CSS, Tailwind CSS
- Backend: Node.js, Express.js, FastAPI, REST API
- ML/AI: TensorFlow, Scikit-Learn, Pandas, NumPy, NLP
- Database: MongoDB, PostgreSQL, Redis
- Cloud: AWS (EC2, S3, Lambda), Docker, Git, CI/CD
- Tools: VS Code, Postman, Jira, Figma

EXPERIENCE
Software Developer Intern | TechCorp Inc. | June 2024 - Dec 2024
- Developed and deployed 3 microservices using Node.js and Express.js
- Built a real-time dashboard using React and WebSockets
- Implemented CI/CD pipelines using GitHub Actions
- Reduced API response time by 40% through query optimization

Research Assistant | University AI Lab | Jan 2024 - May 2024
- Built a sentiment analysis model using BERT and PyTorch
- Achieved 92% accuracy on the IMDB review dataset
- Implemented data preprocessing pipelines using Pandas and NLTK

PROJECTS
1. AI Resume Analyzer - Built a full-stack application using React, Node.js, and
   TensorFlow to analyze resumes against job descriptions using NLP techniques.
2. E-Commerce Platform - Developed a scalable e-commerce platform with React,
   Node.js, MongoDB, and Stripe API integration. Deployed on AWS.
3. Real-time Chat Application - Created a WebSocket-based chat app with React
   and Socket.io supporting 1000+ concurrent users.

EDUCATION
Bachelor of Technology in Computer Science and Engineering
XYZ University | 2021 - 2025 | GPA: 3.8/4.0

CERTIFICATIONS
- AWS Cloud Practitioner
- Deep Learning Specialization (Coursera - Andrew Ng)
"""

SAMPLE_JD = """
Job Title: Machine Learning Engineer

Company: AI Solutions Inc.

About the Role:
We are looking for a passionate Machine Learning Engineer to join our growing AI team.
You will work on building and deploying production-grade ML models for NLP and
computer vision applications.

Responsibilities:
- Design, develop, and deploy machine learning models for production use
- Build and maintain ML pipelines using Python and cloud infrastructure
- Implement NLP solutions including text classification, NER, and semantic search
- Collaborate with data engineers to build robust data pipelines
- Optimize model performance, latency, and scalability
- Write clean, tested, and well-documented code
- Stay current with latest ML research and techniques

Minimum Qualifications:
- Bachelor's degree in Computer Science, ML, or related field
- 2+ years of experience in machine learning or related role
- Strong proficiency in Python and ML frameworks (PyTorch, TensorFlow)
- Experience with NLP (transformers, BERT, text embeddings)
- Familiarity with cloud platforms (AWS, GCP, or Azure)
- Experience with SQL and NoSQL databases
- Strong understanding of data structures and algorithms

Preferred Qualifications:
- Master's degree in ML/AI
- Experience with MLOps tools (MLflow, Kubeflow, SageMaker)
- Experience with Docker and Kubernetes
- Published research or open-source contributions in ML
- Experience with large language models (LLMs) and generative AI
- Knowledge of system design for ML systems
"""

# ─── Additional test pairs for validation ─────────────────────────────────────────
SAMPLE_RESUME_2 = """
JANE SMITH
Senior Data Scientist | 6 years experience

SKILLS
- Python, R, SQL, Spark, PyTorch, TensorFlow, Scikit-Learn
- Machine Learning, Deep Learning, NLP, Computer Vision
- MLOps, MLflow, Docker, Kubernetes, AWS SageMaker
- Statistical Modeling, A/B Testing, Feature Engineering

EXPERIENCE
Senior Data Scientist | DataCorp | 2020 - Present
- Led ML team of 5, deployed 12 production models
- Built NLP pipeline processing 10M documents/day
- Reduced churn by 15% using gradient boosting models

Data Scientist | Analytics Inc. | 2018 - 2020
- Developed recommendation engine using collaborative filtering
- Built real-time fraud detection system using LSTM networks

EDUCATION
M.S. in Machine Learning, Stanford University
"""

SAMPLE_RESUME_3 = """
ALEX CHEN
Frontend Developer | React Specialist

SKILLS
- JavaScript, TypeScript, HTML, CSS, SASS
- React, Next.js, Redux, Tailwind CSS
- Figma, Adobe XD, Responsive Design
- Jest, Cypress, Git

EXPERIENCE
Frontend Developer | WebStudio | 2023 - Present
- Built 5 responsive web applications using React and Next.js
- Implemented design system used across 3 product teams

EDUCATION
B.S. in Computer Science, UC Berkeley
"""


def run_basic_test():
    """Run a single pipeline test with sample data."""
    print("\n" + "=" * 70)
    print("  PIPELINE BASIC TEST")
    print("=" * 70)

    pipeline = ResumeJDPipeline(collect_data=True)
    result = pipeline.analyze(SAMPLE_RESUME, SAMPLE_JD)

    print_summary(result, "Test 1: ML Engineer JD vs Full-Stack Resume")
    return result


def run_full_validation():
    """
    Full validation: run multiple tests, train model, compare scores.
    
    Steps:
      1. Run pipeline in heuristic mode (collect data)
      2. Generate synthetic training data
      3. Train ML model
      4. Re-run pipeline in ML mode
      5. Compare heuristic vs ML scores
    """
    print("\n" + "=" * 70)
    print("  FULL VALIDATION: HEURISTIC vs ML MODEL")
    print("=" * 70)

    # ── Phase 1: Run pipeline in heuristic mode ───────────────────────
    print("\n>>> PHASE 1: Running pipeline in HEURISTIC mode...")
    pipeline_heuristic = ResumeJDPipeline(collect_data=True)

    test_pairs = [
        ("Test 1: ML Engineer JD vs Full-Stack Resume", SAMPLE_RESUME, SAMPLE_JD),
        ("Test 2: ML Engineer JD vs Senior DS Resume", SAMPLE_RESUME_2, SAMPLE_JD),
        ("Test 3: ML Engineer JD vs Frontend Resume", SAMPLE_RESUME_3, SAMPLE_JD),
    ]

    heuristic_results = []
    for name, resume, jd in test_pairs:
        result = pipeline_heuristic.analyze(resume, jd)
        heuristic_results.append((name, result))

    # ── Phase 2: Generate synthetic data & train model ────────────────
    print("\n\n>>> PHASE 2: Training ML model...")
    print("=" * 70)

    from train_model import main as train_main
    sys.argv = ["train_model.py", "--generate", "500"]
    train_main()

    # ── Phase 3: Re-run with ML model ────────────────────────────────
    print("\n\n>>> PHASE 3: Running pipeline in ML MODEL mode...")
    print("=" * 70)

    pipeline_ml = ResumeJDPipeline(collect_data=True)

    ml_results = []
    for name, resume, jd in test_pairs:
        result = pipeline_ml.analyze(resume, jd)
        ml_results.append((name, result))

    # ── Phase 4: Comparison ──────────────────────────────────────────
    print("\n\n" + "=" * 70)
    print("  VALIDATION RESULTS: HEURISTIC vs ML MODEL")
    print("=" * 70)

    print(f"\n  {'Test Case':<50} {'Heuristic':>10} {'ML Model':>10} {'Delta':>10}")
    print(f"  {'-' * 80}")

    for (name_h, res_h), (name_m, res_m) in zip(heuristic_results, ml_results):
        h_score = res_h["scoring"]["heuristic_score"]
        m_score = res_m["scoring"].get("ml_score") or res_m["scoring"]["final_score"]
        delta = m_score - h_score
        print(f"  {name_h:<50} {h_score:>10.2f} {m_score:>10.2f} {delta:>+10.2f}")

    print(f"\n  Scoring mode for ML runs: {ml_results[0][1]['scoring']['scoring_mode'].upper()}")

    # ── Reasonableness checks ─────────────────────────────────────────
    print(f"\n  Reasonableness Checks:")
    all_reasonable = True

    for name, result in ml_results:
        score = result["scoring"]["final_score"]
        if 0 <= score <= 100:
            print(f"    [PASS] {name}: score {score:.2f} in valid range [0, 100]")
        else:
            print(f"    [FAIL] {name}: score {score:.2f} OUT OF RANGE!")
            all_reasonable = False

    # Senior DS should score higher than Frontend dev for ML Engineer role
    if len(ml_results) >= 3:
        ds_score = ml_results[1][1]["scoring"]["final_score"]
        fe_score = ml_results[2][1]["scoring"]["final_score"]
        if ds_score > fe_score:
            print(f"    [PASS] Senior DS ({ds_score:.2f}) > Frontend Dev ({fe_score:.2f}) for ML role")
        else:
            print(f"    [FAIL] Expected Senior DS > Frontend Dev for ML role")
            all_reasonable = False

    if all_reasonable:
        print(f"\n  >> ALL VALIDATION CHECKS PASSED <<")
    else:
        print(f"\n  >> SOME CHECKS FAILED - Review model quality <<")

    print(f"\n{'=' * 70}")
    print(f"  VALIDATION COMPLETE")
    print(f"{'=' * 70}\n")


def print_summary(result: dict, title: str = ""):
    """Print a formatted summary of pipeline results."""
    print(f"\n{'=' * 70}")
    if title:
        print(f"  {title}")
        print(f"{'=' * 70}")
    print(f"  Final Score:            {result['scoring']['final_score']}/100")
    print(f"  Scoring Mode:           {result['scoring']['scoring_mode']}")
    print(f"  Heuristic Score:        {result['scoring']['heuristic_score']}")
    if result['scoring'].get('ml_score') is not None:
        print(f"  ML Model Score:         {result['scoring']['ml_score']}")
    print(f"  Semantic Similarity:    {result['semantic_analysis']['semantic_similarity_score']}")
    print(f"  Domain Similarity:      {result['semantic_analysis']['domain_similarity']}")
    print(f"  Experience Match:       {result['semantic_analysis']['experience_match_score']}")
    print(f"  Skills (Resume):        {len(result['entities']['skills_resume'])}")
    print(f"  Skills (JD):            {len(result['entities']['skills_job'])}")
    print(f"  Strong Matches:         {len(result['skill_matching']['strong_matches'])}")
    print(f"  Partial Matches:        {len(result['skill_matching']['partial_matches'])}")
    print(f"  Missing Critical:       {len(result['skill_matching']['missing_critical'])}")
    print(f"  Missing Secondary:      {len(result['skill_matching']['missing_secondary'])}")
    print(f"  Resume Domain:          {result['entities']['domain_resume']}")
    print(f"  JD Domain:              {result['entities']['domain_job']}")
    print(f"  Experience Level:       {result['entities']['experience_level']}")

    print(f"\n  Positive Factors:")
    for f in result["explainability"]["positive_factors"]:
        print(f"    [+] {f}")

    print(f"\n  Negative Factors:")
    for f in result["explainability"]["negative_factors"]:
        print(f"    [-] {f}")

    print(f"{'=' * 70}")


def main():
    parser = argparse.ArgumentParser(description="Test Resume-JD Pipeline")
    parser.add_argument(
        "--validate", action="store_true",
        help="Run full validation: train model + compare heuristic vs ML scores",
    )
    args = parser.parse_args()

    if args.validate:
        run_full_validation()
    else:
        run_basic_test()


if __name__ == "__main__":
    main()
