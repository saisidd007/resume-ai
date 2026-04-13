/**
 * ML Pipeline Service
 * ====================
 * Calls the local Python ML pipeline (Flask API on port 5050)
 * for resume-JD scoring, skill matching, and semantic analysis.
 *
 * This replaces the LLM for scoring operations.
 * The LLM is kept separately for explanation generation.
 */

const axios = require('axios');
const FormData = require('form-data');

const ML_API_BASE = process.env.ML_API_URL || 'http://127.0.0.1:5050';
const ML_TIMEOUT = 60000; // 60s timeout for ML pipeline

/**
 * Check if ML pipeline server is running
 */
async function isMLServerHealthy() {
  try {
    const response = await axios.get(`${ML_API_BASE}/api/health`, {
      timeout: 5000,
    });
    return response.data.status === 'healthy';
  } catch {
    return false;
  }
}

/**
 * Analyze resume (text) against job description using ML pipeline
 *
 * @param {string} resumeText - Plain text resume content
 * @param {string} jobDescription - Job description text
 * @returns {Object} ML pipeline analysis result
 */
async function analyzeWithML(resumeText, jobDescription) {
  try {
    const response = await axios.post(
      `${ML_API_BASE}/api/analyze`,
      {
        resume_text: resumeText,
        job_description: jobDescription,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: ML_TIMEOUT,
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        'ML Pipeline server is not running. Start it with: cd ml && python api.py'
      );
    }
    throw new Error(
      'ML Pipeline Error: ' + (error.response?.data?.error || error.message)
    );
  }
}

/**
 * Analyze resume (PDF file buffer) against job description using ML pipeline
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - Original filename
 * @param {string} jobDescription - Job description text
 * @returns {Object} ML pipeline analysis result
 */
async function analyzeWithMLPdf(pdfBuffer, filename, jobDescription) {
  try {
    const form = new FormData();
    form.append('resume_file', pdfBuffer, {
      filename: filename,
      contentType: 'application/pdf',
    });
    form.append('job_description', jobDescription);

    const response = await axios.post(
      `${ML_API_BASE}/api/analyze/pdf`,
      form,
      {
        headers: form.getHeaders(),
        timeout: ML_TIMEOUT,
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        'ML Pipeline server is not running. Start it with: cd ml && python api.py'
      );
    }
    throw new Error(
      'ML Pipeline Error: ' + (error.response?.data?.error || error.message)
    );
  }
}

/**
 * Parse PDF and extract text via ML pipeline
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - Original filename
 * @returns {Object} { text, filename, char_count }
 */
async function parsePdf(pdfBuffer, filename) {
  try {
    const form = new FormData();
    form.append('resume_file', pdfBuffer, {
      filename: filename,
      contentType: 'application/pdf',
    });

    const response = await axios.post(
      `${ML_API_BASE}/api/parse-pdf`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000,
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(
      'PDF Parse Error: ' + (error.response?.data?.error || error.message)
    );
  }
}

module.exports = {
  isMLServerHealthy,
  analyzeWithML,
  analyzeWithMLPdf,
  parsePdf,
  ML_API_BASE,
};
