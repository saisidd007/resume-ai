import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import PipelineLoader from '../components/PipelineLoader';

const AnimatedScore = ({ score, isMLScored }) => {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1500; // 1.5 seconds

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // easeOutExpo curve
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayScore(Math.floor(easeProgress * score));

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [score]);

  return (
    <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-white/5 shadow-xl transition-all duration-700
      ${displayScore >= 70 ? 'bg-green-400/10' : 'bg-accent/10'}
    `}>
      <span className={`text-4xl font-bold ${displayScore >= 70 ? 'text-green-400' : 'text-accent'}`}>
        {displayScore}%
      </span>
    </div>
  );
};

const Interview = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    jobDescription: '',
    resume: '',
    selfDescription: ''
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [inputMode, setInputMode] = useState('text'); // 'text' or 'pdf'
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  
  // Controls when loader is visible and when the ML API has responded
  const [pipelineFinished, setPipelineFinished] = useState(false);
  const [showResultView, setShowResultView] = useState(false);

  const handlePdfSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        setError('Only PDF files are supported');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setPdfFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let response;
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

      if (inputMode === 'pdf' && pdfFile) {
        // ── PDF upload flow ──────────────────────────────────────
        const formData = new FormData();
        formData.append('resumeFile', pdfFile);
        formData.append('jobDescription', form.jobDescription);
        formData.append('selfDescription', form.selfDescription);

        response = await fetch(`${API_BASE}/api/interview/generate-pdf`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
      } else {
        // ── Text input flow ──────────────────────────────────────
        response = await fetch(`${API_BASE}/api/interview/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(form),
        });
      }

      const data = await response.json();

      if (data.success) {
        setReport(data.report);
      } else {
        setError(data.message || 'Failed to generate report');
        setLoading(false); // only stop here on error immediately
      }
    } catch (err) {
      setError('Network error. Please try again.');
      setLoading(false);
    } finally {
      // Trigger the rapid finish animation sequence
      setPipelineFinished(true);
    }
  };

  const onLoaderComplete = () => {
    // Only transition AFTER the loader completes its 100% animation smoothing
    if (!error && report) {
      setShowResultView(true);
    }
    setLoading(false);
    setPipelineFinished(false);
  };

  /* ═══════════════════════════════════════════════════════════════════
     REPORT VIEW - Hybrid ML + LLM Results
     ═══════════════════════════════════════════════════════════════════ */
  if (showResultView && report) {
    const mlData = report.mlAnalysis;
    const pipeline = report._pipeline || {};
    const isMLScored = pipeline.scoring_source === 'ml_model' || report.scoringSource === 'ml_model';

    return (
      <div className="min-h-screen bg-black">
        {/* Nav */}
        <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <span className="text-accent text-xs font-bold">AI</span>
            </div>
            <span className="text-text-primary font-semibold text-sm tracking-tight">Report</span>
            {isMLScored && (
              <span className="badge badge-green text-[10px] ml-2">ML Scored</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setReport(null)} className="btn-ghost !py-2 !px-4 text-xs">
              Generate Another
            </button>
            <Link to="/dashboard" className="btn-ghost !py-2 !px-4 text-xs">
              Dashboard
            </Link>
          </div>
        </nav>

        <div className="max-w-5xl mx-auto px-6 py-10">
          {/* ── Score Header ── */}
          <div className="card p-8 mb-8 text-center animate-fade-in">
            <p className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-4">
              Overall Match Score
            </p>
            <AnimatedScore score={Math.round(report.matchScore)} isMLScored={isMLScored} />

            {/* Scoring source indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className={`badge text-[10px] ${isMLScored ? 'badge-green' : 'badge-yellow'}`}>
                {isMLScored ? 'ML Model Score' : 'LLM Score'}
              </span>
              {pipeline.ml_score != null && pipeline.llm_score != null && (
                <span className="text-[11px] text-text-muted">
                  ML: {Math.round(pipeline.ml_score)} | LLM: {pipeline.llm_score}
                </span>
              )}
            </div>

            <p className="text-sm text-text-secondary max-w-md mx-auto">
              {report.jobDescription?.substring(0, 100)}...
            </p>
          </div>

          {/* ── ML Analysis Section (if available) ── */}
          {mlData && (
            <div className="grid lg:grid-cols-3 gap-4 mb-8 animate-slide-up">
              {/* Semantic Similarity */}
              <div className="card p-5">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Semantic Match</p>
                <p className="text-2xl font-bold text-accent">
                  {Math.round((mlData.semanticAnalysis?.semantic_similarity_score || 0) * 100)}%
                </p>
                <p className="text-[11px] text-text-secondary mt-1">Resume-JD alignment</p>
              </div>
              {/* Domain Similarity */}
              <div className="card p-5">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Domain Match</p>
                <p className="text-2xl font-bold text-green-400">
                  {Math.round((mlData.semanticAnalysis?.domain_similarity || 0) * 100)}%
                </p>
                <p className="text-[11px] text-text-secondary mt-1">
                  {mlData.entities?.domain_resume || '?'} → {mlData.entities?.domain_job || '?'}
                </p>
              </div>
              {/* Experience */}
              <div className="card p-5">
                <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2">Experience Fit</p>
                <p className="text-2xl font-bold text-blue-400">
                  {Math.round((mlData.semanticAnalysis?.experience_match_score || 0) * 100)}%
                </p>
                <p className="text-[11px] text-text-secondary mt-1">
                  Level: {mlData.entities?.experience_level || 'N/A'}
                </p>
              </div>
            </div>
          )}

          {/* ── Explainability (ML SHAP-style) ── */}
          {mlData?.explainability && (
            <div className="card p-6 mb-8 animate-slide-up">
              <h2 className="text-sm font-semibold text-text-primary mb-4">ML Model Explainability</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] text-green-400 uppercase tracking-wider mb-2 font-semibold">
                    Positive Factors
                  </p>
                  <div className="space-y-2">
                    {mlData.explainability.positive_factors?.map((f, i) => (
                      <div key={i} className="text-xs text-text-secondary leading-relaxed px-3 py-2 rounded-lg bg-green-400/5 border border-green-400/10">
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-red-400 uppercase tracking-wider mb-2 font-semibold">
                    Areas for Improvement
                  </p>
                  <div className="space-y-2">
                    {mlData.explainability.negative_factors?.map((f, i) => (
                      <div key={i} className="text-xs text-text-secondary leading-relaxed px-3 py-2 rounded-lg bg-red-400/5 border border-red-400/10">
                        {f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-6 animate-slide-up">
              {/* Skill Gaps (ML-powered) */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-base">&#9888;&#65039;</span>
                  <h2 className="text-sm font-semibold text-text-primary">
                    Skill Gaps ({report.skillGaps?.length || 0})
                  </h2>
                </div>
                <div className="space-y-2">
                  {report.skillGaps?.map((gap, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3 rounded-lg bg-surface-400 border border-white/[0.04]">
                      <span className="text-sm text-text-primary font-medium">{gap.skill}</span>
                      <span className={`badge text-[11px] ${
                        gap.severity === 'high' ? 'badge-red' :
                        gap.severity === 'medium' ? 'badge-yellow' :
                        'badge-green'
                      }`}>
                        {gap.severity?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                  {(!report.skillGaps || report.skillGaps.length === 0) && (
                    <p className="text-xs text-text-muted text-center py-4">No skill gaps detected</p>
                  )}
                </div>
              </div>

              {/* Strong Matches (ML) */}
              {mlData?.skillMatching?.strong_matches?.length > 0 && (
                <div className="card p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <span className="text-base">&#9989;</span>
                    <h2 className="text-sm font-semibold text-text-primary">
                      Strong Matches ({mlData.skillMatching.strong_matches.length})
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mlData.skillMatching.strong_matches.map((m, idx) => (
                      <span key={idx} className="badge badge-green text-[11px]">
                        {m.job_skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Prep Plan (LLM) */}
              {report.preparationPlan?.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-sm font-semibold text-text-primary mb-5">Preparation Plan</h2>
                  <div className="grid grid-cols-2 gap-3">
                    {report.preparationPlan?.slice(0, 6).map((day, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-surface-400 border border-white/[0.04]">
                        <h3 className="text-xs font-bold text-accent mb-1">Day {day.day}</h3>
                        <p className="text-xs text-text-secondary mb-2">{day.focus}</p>
                        <ul className="space-y-1">
                          {day.tasks?.map((task, t) => (
                            <li key={t} className="text-[11px] text-text-muted flex items-start gap-1.5">
                              <span className="w-1 h-1 bg-accent rounded-full mt-1.5 shrink-0"></span>
                              {task}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right column */}
            <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
              {/* Technical Questions (LLM) */}
              {report.technicalQuestions?.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-sm font-semibold text-text-primary mb-4">
                    Technical Questions ({report.technicalQuestions?.length || 0})
                  </h2>
                  <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
                    {report.technicalQuestions?.slice(0, 4).map((q, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-surface-400 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                        <h4 className="text-xs font-semibold text-accent mb-1.5">Q: {q.question}</h4>
                        <p className="text-[11px] text-text-muted italic mb-2">Intention: {q.intention}</p>
                        <p className="text-xs text-text-secondary leading-relaxed">{q.answer?.substring(0, 150)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Behavioral Questions (LLM) */}
              {report.behavioralQuestions?.length > 0 && (
                <div className="card p-6">
                  <h2 className="text-sm font-semibold text-text-primary mb-4">
                    Behavioral Questions ({report.behavioralQuestions?.length || 0})
                  </h2>
                  <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                    {report.behavioralQuestions?.slice(0, 3).map((q, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-surface-400 border border-white/[0.04] hover:border-white/[0.08] transition-colors">
                        <h4 className="text-xs font-semibold text-green-400 mb-1">Q: {q.question}</h4>
                        <p className="text-[11px] text-text-secondary">{q.answer?.substring(0, 120)}...</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pipeline Info */}
              <div className="card p-5">
                <h2 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pipeline Info</h2>
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-text-muted">ML Pipeline</span>
                    <span className={pipeline.ml_available ? 'text-green-400' : 'text-red-400'}>
                      {pipeline.ml_available ? 'Active' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">LLM Engine</span>
                    <span className={pipeline.llm_available ? 'text-green-400' : 'text-red-400'}>
                      {pipeline.llm_available ? 'Active' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Score Source</span>
                    <span className="text-text-secondary">{pipeline.scoring_source || report.scoringSource || 'N/A'}</span>
                  </div>
                  {pipeline.ml_error && (
                    <p className="text-red-400/70 text-[10px] mt-1">ML: {pipeline.ml_error}</p>
                  )}
                  {pipeline.llm_error && (
                    <p className="text-red-400/70 text-[10px] mt-1">LLM: {pipeline.llm_error}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════════
     FORM VIEW - Resume Input (Text + PDF Upload)
     ═══════════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-black">
      {/* Pipeline Loader Overlay */}
      {loading && (
        <PipelineLoader 
          isComplete={pipelineFinished} 
          onAnimationComplete={onLoaderComplete} 
        />
      )}
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-xs font-bold">AI</span>
          </div>
          <span className="text-text-primary font-semibold text-sm tracking-tight">New Report</span>
        </div>
        <Link to="/dashboard" className="btn-ghost !py-2 !px-4 text-xs">
          &larr; Back to Dashboard
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-10 animate-fade-in">
          <h1 className="text-2xl font-bold text-text-primary mb-2">Generate Interview Report</h1>
          <p className="text-sm text-text-secondary">
            Upload your resume (PDF or text) and job description for AI-powered analysis with ML scoring.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-slide-up">
          {/* Job Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              Job Description
            </label>
            <textarea
              value={form.jobDescription}
              onChange={(e) => setForm({...form, jobDescription: e.target.value})}
              required
              rows={4}
              className="textarea-field"
              placeholder="Paste the full job description here..."
              id="job-description"
            />
          </div>

          {/* Resume Input Mode Toggle */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-3">
              Your Resume
            </label>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`text-xs px-4 py-2 rounded-lg border transition-all ${
                  inputMode === 'text'
                    ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                    : 'bg-transparent border-white/10 text-text-muted hover:border-white/20'
                }`}
              >
                Paste Text
              </button>
              <button
                type="button"
                onClick={() => setInputMode('pdf')}
                className={`text-xs px-4 py-2 rounded-lg border transition-all ${
                  inputMode === 'pdf'
                    ? 'bg-accent/15 border-accent/30 text-accent font-semibold'
                    : 'bg-transparent border-white/10 text-text-muted hover:border-white/20'
                }`}
              >
                Upload PDF
              </button>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={form.resume}
                onChange={(e) => setForm({...form, resume: e.target.value})}
                required={inputMode === 'text'}
                rows={6}
                className="textarea-field"
                placeholder="Paste your resume content..."
                id="resume-content"
              />
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handlePdfSelect}
                  className="hidden"
                  id="resume-pdf-upload"
                />
                {pdfFile ? (
                  <div>
                    <div className="text-accent text-2xl mb-2">&#128196;</div>
                    <p className="text-sm text-text-primary font-medium">{pdfFile.name}</p>
                    <p className="text-[11px] text-text-muted mt-1">
                      {(pdfFile.size / 1024).toFixed(1)} KB &middot; Click to change
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="text-text-muted text-2xl mb-2">&#128196;</div>
                    <p className="text-sm text-text-secondary">Click to upload PDF resume</p>
                    <p className="text-[11px] text-text-muted mt-1">Max 10MB</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Self Description */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              About You
            </label>
            <textarea
              value={form.selfDescription}
              onChange={(e) => setForm({...form, selfDescription: e.target.value})}
              rows={4}
              className="textarea-field"
              placeholder="Tell us about yourself, your experience, strengths... (optional)"
              id="self-description"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || (!form.resume && inputMode === 'text') || (!pdfFile && inputMode === 'pdf') || !form.jobDescription}
            className="btn-primary w-full !py-4 text-base"
            id="generate-report-btn"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="spinner !w-5 !h-5"></span>
                Analyzing with ML + AI...
              </span>
            ) : (
              'Generate Interview Report \u2192'
            )}
          </button>

          {/* ML Pipeline Status Indicator */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
            Hybrid ML + LLM Pipeline
          </div>
        </form>
      </div>
    </div>
  );
};

export default Interview;
