const InterviewReport = require('../models/interviewReport.model');
const { generateReport } = require('../services/ai.service');
const { hybridAnalyze } = require('../services/hybrid.service');
const { isMLServerHealthy } = require('../services/ml.service');
const multer = require('multer');

// ─── Multer config for PDF uploads (memory storage) ─────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
}).single('resumeFile');

/**
 * Generate interview report using HYBRID pipeline (ML + LLM)
 * Supports both text input and PDF file upload.
 *
 * POST /api/interview/generate
 * Body (JSON): { jobDescription, resume, selfDescription }
 *   OR
 * Body (multipart): resumeFile (PDF) + jobDescription + selfDescription
 */
const generateInterviewReport = async (req, res) => {
  try {
    const userId = req.user.id;

    const { jobDescription, resume, selfDescription } = req.body;

    if (!jobDescription) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: jobDescription'
      });
    }

    if (!resume && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Missing required field: resume (text or PDF file)'
      });
    }

    // ── Run hybrid analysis pipeline ─────────────────────────────
    const reportData = await hybridAnalyze({
      resume: resume || '',
      jobDescription,
      selfDescription: selfDescription || '',
      pdfBuffer: req.file ? req.file.buffer : null,
      pdfFilename: req.file ? req.file.originalname : null,
    });

    // ── Save to database ─────────────────────────────────────────
    const report = new InterviewReport({
      ...reportData,
      userId,
    });

    await report.save();

    res.status(201).json({
      success: true,
      report,
    });
  } catch (error) {
    console.error('Interview generation error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Generate report with PDF upload
 * Uses multer middleware to handle file upload
 *
 * POST /api/interview/generate-pdf
 * Body (multipart/form-data): resumeFile, jobDescription, selfDescription
 */
const generateWithPdf = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message || 'File upload failed',
      });
    }

    try {
      const userId = req.user.id;
      const { jobDescription, selfDescription } = req.body;

      if (!jobDescription) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: jobDescription',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'PDF file is required',
        });
      }

      // ── Run hybrid analysis with PDF ───────────────────────────
      const reportData = await hybridAnalyze({
        resume: '',
        jobDescription,
        selfDescription: selfDescription || '',
        pdfBuffer: req.file.buffer,
        pdfFilename: req.file.originalname,
      });

      // ── Save to database ───────────────────────────────────────
      const report = new InterviewReport({
        ...reportData,
        userId,
      });

      await report.save();

      res.status(201).json({
        success: true,
        report,
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  });
};

/**
 * Get ML pipeline health status
 * GET /api/interview/ml-status
 */
const getMLStatus = async (req, res) => {
  try {
    const healthy = await isMLServerHealthy();
    res.json({
      success: true,
      ml_server: healthy ? 'online' : 'offline',
      ml_url: process.env.ML_API_URL || 'http://127.0.0.1:5050',
    });
  } catch (error) {
    res.json({
      success: true,
      ml_server: 'offline',
      error: error.message,
    });
  }
};

/**
 * Get user's reports
 * GET /api/interview/reports
 */
const getUserReports = async (req, res) => {
  try {
    const reports = await InterviewReport.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, reports });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Get a specific report by ID
 * GET /api/interview/reports/:id
 */
const getReportById = async (req, res) => {
  try {
    const report = await InterviewReport.findOne({ 
      _id: req.params.id,
      userId: req.user.id 
    }).lean();

    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    res.json({ success: true, report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  generateInterviewReport,
  generateWithPdf,
  getMLStatus,
  getUserReports,
  getReportById,
};
