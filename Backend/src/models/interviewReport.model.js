const mongoose = require('mongoose')

// 🔹 Technical Questions Schema
const technicalQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Behavioral question is required"],
    },
    intention: {
      type: String,
      required: [true, "Intention is required"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  { _id: false }
);


// 🔹 Behavioral Questions Schema
const behavioralQuestionSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, "Technical question is required"],
    },
    intention: {
      type: String,
      required: [true, "Intention is required"],
    },
    answer: {
      type: String,
      required: [true, "Answer is required"],
    },
  },
  { _id: false }
);


// 🔹 Skill Gap Schema
const skillGapSchema = new mongoose.Schema(
  {
    skill: {
      type: String,
      required: [true, "Skill is required"],
    },
    severity: {
      type: String,
      enum: ["low", "medium", "high"],
      required: [true, "Severity is required"],
    },
  },
  { _id: false }
);


// 🔹 Preparation Plan Schema
const preparationPlanSchema = new mongoose.Schema({
  day: {
    type: Number,
    required: [true, "Day is required"],
  },
  focus: {
    type: String,
    required: [true, "Focus is required"],
  },
  tasks: [
    {
      type: String,
      required: [true, "Task is required"],
    },
  ],
});


// 🔹 ML Analysis Schema (new - stores ML pipeline output)
const mlAnalysisSchema = new mongoose.Schema(
  {
    entities: { type: mongoose.Schema.Types.Mixed },
    semanticAnalysis: { type: mongoose.Schema.Types.Mixed },
    skillMatching: { type: mongoose.Schema.Types.Mixed },
    scoring: { type: mongoose.Schema.Types.Mixed },
    explainability: { type: mongoose.Schema.Types.Mixed },
  },
  { _id: false }
);


// 🔹 Pipeline Metadata Schema (new - tracks which systems contributed)
const pipelineMetaSchema = new mongoose.Schema(
  {
    ml_available: { type: Boolean, default: false },
    llm_available: { type: Boolean, default: false },
    ml_error: { type: String, default: null },
    llm_error: { type: String, default: null },
    scoring_source: {
      type: String,
      enum: ['ml_model', 'llm_fallback', 'error'],
      default: 'llm_fallback',
    },
    ml_score: { type: Number, default: null },
    llm_score: { type: Number, default: null },
  },
  { _id: false }
);


// 🔹 Main Interview Report Schema
const interviewReportSchema = new mongoose.Schema(
  {
    jobDescription: {
      type: String,
      required: [true, "Job description is required"],
    },

    resume: {
      type: String,
    },

    selfDescription: {
      type: String,
    },

    matchScore: {
      type: Number,
      min: 0,
      max: 100,
    },

    // Scoring source: 'ml_model' or 'llm_fallback'
    scoringSource: {
      type: String,
      enum: ['ml_model', 'llm_fallback', 'error'],
      default: 'llm_fallback',
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'user',
      required: true
    },

    technicalQuestions: [technicalQuestionSchema],
    behavioralQuestions: [behavioralQuestionSchema],
    skillGaps: [skillGapSchema],
    preparationPlan: [preparationPlanSchema],

    // ML pipeline detailed analysis
    mlAnalysis: mlAnalysisSchema,

    // Pipeline metadata
    _pipeline: pipelineMetaSchema,
  },
  { timestamps: true }
);


// 🔹 Export Model
const InterviewReport = mongoose.model("InterviewReport", interviewReportSchema);
module.exports = InterviewReport;
