const express = require('express');
const {
  generateInterviewReport,
  generateWithPdf,
  getMLStatus,
  getUserReports,
  getReportById,
} = require('../controller/interview.controller');
const authMiddleware = require('../middleware/auth.middleware');

const router = express.Router();

// Existing routes (backward compatible)
router.post('/generate', authMiddleware.authUser, generateInterviewReport);
router.get('/reports', authMiddleware.authUser, getUserReports);
router.get('/reports/:id', authMiddleware.authUser, getReportById);

// New routes for hybrid ML + LLM pipeline
router.post('/generate-pdf', authMiddleware.authUser, generateWithPdf);
router.get('/ml-status', authMiddleware.authUser, getMLStatus);

module.exports = router;
