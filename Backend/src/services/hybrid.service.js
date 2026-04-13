/**
 * Hybrid Analysis Service
 * ========================
 * Combines:
 *   - ML Pipeline → scoring, skill matching, semantic analysis (PRIMARY)
 *   - LLM (NVIDIA) → human-readable explanations, interview questions, prep plan (SECONDARY)
 *
 * Architecture:
 *   1. ML pipeline runs first → produces score + skill analysis
 *   2. LLM receives ML results as context → generates explanations & prep material
 *   3. Both outputs are merged into a unified response
 *
 * Fallback: If ML server is down, falls back to LLM-only mode (legacy behavior).
 */

const { analyzeWithML, analyzeWithMLPdf, isMLServerHealthy } = require('./ml.service');
const { generateReport } = require('./ai.service');

/**
 * Run the hybrid analysis pipeline
 *
 * @param {Object} params
 * @param {string} params.resume - Resume text
 * @param {string} params.jobDescription - Job description text
 * @param {string} params.selfDescription - Self description text
 * @param {Buffer} [params.pdfBuffer] - Optional PDF buffer
 * @param {string} [params.pdfFilename] - Optional PDF filename
 * @returns {Object} Unified hybrid analysis result
 */
async function hybridAnalyze({ resume, jobDescription, selfDescription, pdfBuffer, pdfFilename }) {
  let mlResult = null;
  let llmResult = null;
  let mlError = null;
  let llmError = null;

  // ── Step 1: ML Pipeline Analysis (PRIMARY) ─────────────────────────
  try {
    const mlHealthy = await isMLServerHealthy();

    if (mlHealthy) {
      if (pdfBuffer && pdfFilename) {
        // PDF upload path
        mlResult = await analyzeWithMLPdf(pdfBuffer, pdfFilename, jobDescription);
        // Use extracted text from PDF for LLM if resume text is empty
        if (!resume && mlResult.extracted_resume_text) {
          resume = mlResult.extracted_resume_text;
        }
      } else {
        // Text input path
        mlResult = await analyzeWithML(resume, jobDescription);
      }
      console.log(`[Hybrid] ML Pipeline: score=${mlResult.scoring?.final_score}`);
    } else {
      mlError = 'ML Pipeline server is not running';
      console.warn('[Hybrid] ML Pipeline unavailable, falling back to LLM-only');
    }
  } catch (err) {
    mlError = err.message;
    console.error('[Hybrid] ML Pipeline error:', err.message);
  }

  // ── Step 2: LLM Analysis (SECONDARY - for explanations) ────────────
  try {
    // Build enhanced prompt with ML context if available
    const llmInput = {
      resume: resume || 'Not provided',
      selfDescription: selfDescription || 'Not provided',
      jobDescription,
    };

    // If ML results are available, enrich the LLM prompt with ML insights
    if (mlResult) {
      llmInput.mlContext = buildMLContext(mlResult);
    }

    llmResult = await generateReport(llmInput);
    console.log('[Hybrid] LLM Analysis: complete');
  } catch (err) {
    llmError = err.message;
    console.error('[Hybrid] LLM error:', err.message);
  }

  // ── Step 3: Merge Results ──────────────────────────────────────────
  return mergeResults(mlResult, llmResult, mlError, llmError, jobDescription, resume, selfDescription);
}

/**
 * Build ML context string to inject into LLM prompt for better explanations
 */
function buildMLContext(mlResult) {
  const score = mlResult.scoring?.final_score || 'N/A';
  const strongMatches = mlResult.skill_matching?.strong_matches?.map(m => m.job_skill).join(', ') || 'None';
  const missingCritical = mlResult.skill_matching?.missing_critical?.map(m => m.skill).join(', ') || 'None';
  const missingSec = mlResult.skill_matching?.missing_secondary?.map(m => m.skill).join(', ') || 'None';
  const domain = mlResult.entities?.domain_resume || 'Unknown';

  return `
ML ANALYSIS CONTEXT (use this to generate more accurate questions and suggestions):
- Match Score: ${score}/100
- Strong Skill Matches: ${strongMatches}
- Missing Critical Skills: ${missingCritical}
- Missing Secondary Skills: ${missingSec}
- Candidate Domain: ${domain}
- Experience Level: ${mlResult.entities?.experience_level || 'Unknown'}
Focus interview questions on the MISSING skills and the candidate's STRONG areas.
Preparation plan should prioritize MISSING CRITICAL skills.`;
}

/**
 * Merge ML and LLM results into a unified response
 */
function mergeResults(mlResult, llmResult, mlError, llmError, jobDescription, resume, selfDescription) {
  // ── Determine score: ML is primary, LLM is fallback ───────────────
  let matchScore;
  let scoringSource;

  if (mlResult) {
    matchScore = Math.round(mlResult.scoring?.final_score || 0);
    scoringSource = 'ml_model';
  } else if (llmResult) {
    matchScore = llmResult.matchScore || 50;
    scoringSource = 'llm_fallback';
  } else {
    matchScore = 0;
    scoringSource = 'error';
  }

  // ── Build skill gaps from ML missing skills ────────────────────────
  let skillGaps = [];

  if (mlResult) {
    // Missing critical → severity: high
    const critical = mlResult.skill_matching?.missing_critical || [];
    critical.forEach(m => {
      skillGaps.push({ skill: m.skill, severity: 'high' });
    });

    // Missing secondary → severity: medium
    const secondary = mlResult.skill_matching?.missing_secondary || [];
    secondary.forEach(m => {
      skillGaps.push({ skill: m.skill, severity: 'medium' });
    });

    // Partial matches → severity: low
    const partial = mlResult.skill_matching?.partial_matches || [];
    partial.forEach(m => {
      skillGaps.push({ skill: m.job_skill, severity: 'low' });
    });
  } else if (llmResult?.skillGaps) {
    skillGaps = llmResult.skillGaps;
  }

  // ── Build unified output ───────────────────────────────────────────
  const output = {
    // ─ Core fields (backward compatible with existing model) ─
    jobDescription: jobDescription,
    resume: resume || '',
    selfDescription: selfDescription || '',
    matchScore: matchScore,
    scoringSource: scoringSource,

    // ─ From LLM (interview prep material) ─
    technicalQuestions: llmResult?.technicalQuestions || [],
    behavioralQuestions: llmResult?.behavioralQuestions || [],
    preparationPlan: llmResult?.preparationPlan || [],

    // ─ From ML (skill analysis) ─
    skillGaps: skillGaps,

    // ─ ML-specific detailed analysis ─
    mlAnalysis: mlResult ? {
      entities: mlResult.entities || {},
      semanticAnalysis: mlResult.semantic_analysis || {},
      skillMatching: mlResult.skill_matching || {},
      scoring: mlResult.scoring || {},
      explainability: mlResult.explainability || {},
    } : null,

    // ─ Pipeline metadata ─
    _pipeline: {
      ml_available: !!mlResult,
      llm_available: !!llmResult,
      ml_error: mlError || null,
      llm_error: llmError || null,
      scoring_source: scoringSource,
      ml_score: mlResult?.scoring?.final_score || null,
      llm_score: llmResult?.matchScore || null,
    },
  };

  return output;
}

module.exports = { hybridAnalyze };
