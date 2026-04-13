import { Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../features/auth/hooks/useAuth';

const ReportDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const response = await fetch(`http://localhost:3000/api/interview/reports/${id}`, {
          credentials: 'include',
        });
        
        let data;
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
        } else {
          // If the backend returns HTML (like a 404 Cannot GET page)
          throw new Error("API endpoint not found. Did you restart the server?");
        }

        if (response.ok && data.success) {
          setReport(data.report);
        } else {
          setError(data.message || 'Failed to load report');
        }
      } catch (err) {
        setError(`Network error: ${err.message}. Ensure the backend is restarted.`);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <div className="text-xl mb-4">⚠️</div>
        <h2 className="text-text-primary mb-2">Could not find report</h2>
        <p className="text-text-secondary text-sm mb-6">{error}</p>
        <Link to="/dashboard" className="btn-ghost">Return to Dashboard</Link>
      </div>
    );
  }

  const mlData = report.mlAnalysis;
  const pipeline = report._pipeline || {};
  const isMLScored = pipeline.scoring_source === 'ml_model' || report.scoringSource === 'ml_model';

  return (
    <div className="min-h-screen bg-black pb-12">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06] sticky top-0 bg-black/80 backdrop-blur z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-xs font-bold">AI</span>
          </div>
          <span className="text-text-primary font-semibold text-sm tracking-tight">Report Details</span>
          <span className="text-text-muted text-[11px] ml-4 hidden sm:block">
            {new Date(report.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex gap-3">
          <button onClick={() => navigate(-1)} className="btn-ghost !py-2 !px-4 text-xs">
            Back
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* ── Score Header ── */}
        <div className="card p-8 mb-8 text-center animate-fade-in relative overflow-hidden">
          {/* Subtle background glow based on score */}
          <div className="absolute inset-0 opacity-5" 
               style={{background: report.matchScore >= 70 ? 'radial-gradient(circle, #4ade80 0%, transparent 70%)' : 'radial-gradient(circle, #c8a84e 0%, transparent 70%)'}} 
          />
          
          <div className="relative z-10">
            <p className="text-xs text-text-secondary uppercase tracking-widest font-medium mb-4">
              Overall Candidate Match
            </p>
            <div className={`w-24 h-24 mx-auto mb-4 rounded-full flex items-center justify-center border-2 border-white/5 shadow-xl
              ${report.matchScore >= 70 ? 'bg-green-400/10' : 'bg-accent/10'}
            `}>
              <span className={`text-4xl font-bold ${report.matchScore >= 70 ? 'text-green-400' : 'text-accent'}`}>
                {Math.round(report.matchScore)}%
              </span>
            </div>

            {/* Scoring source indicator */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className={`badge text-[10px] ${isMLScored ? 'badge-blue' : 'badge-yellow'} font-medium tracking-wide`}>
                {isMLScored ? 'SCORING ENGINE: ADVANCED ML' : 'SCORING ENGINE: STANDARD AI'}
              </span>
            </div>

            <h3 className="text-text-primary font-semibold text-lg mb-2">Job Context</h3>
            <p className="text-sm text-text-secondary max-w-2xl mx-auto leading-relaxed">
              {report.jobDescription?.substring(0, 150)}...
            </p>
          </div>
        </div>

        {/* ── ML Analysis Section (if available) ── */}
        {mlData && (
          <div className="grid lg:grid-cols-3 gap-4 mb-8 animate-slide-up">
            {/* Core Alignment */}
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-4xl">🎯</div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-medium">Core Alignment</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-blue-400">
                  {Math.round((mlData.semanticAnalysis?.semantic_similarity_score || 0) * 100)}%
                </p>
              </div>
              <p className="text-[12px] text-text-secondary mt-2 leading-tight">
                How well the resume content semantically matches the job requirements.
              </p>
            </div>
            
            {/* Industry/Domain Fit */}
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-4xl">🏢</div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-medium">Industry Fit</p>
              <p className="text-3xl font-bold text-purple-400">
                {Math.round((mlData.semanticAnalysis?.domain_similarity || 0) * 100)}%
              </p>
              <p className="text-[12px] text-text-secondary mt-2 leading-tight">
                <span className="text-text-primary font-medium">{mlData.entities?.domain_resume || 'Unknown'}</span> vs required <span className="text-text-primary font-medium">{mlData.entities?.domain_job || 'Unknown'}</span>
              </p>
            </div>
            
            {/* Experience Level */}
            <div className="card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity text-4xl">📈</div>
              <p className="text-[11px] text-text-muted uppercase tracking-wider mb-2 font-medium">Seniority Match</p>
              <p className="text-3xl font-bold text-accent">
                {Math.round((mlData.semanticAnalysis?.experience_match_score || 0) * 100)}%
              </p>
              <p className="text-[12px] text-text-secondary mt-2 leading-tight capitalize">
                Detected Level: <span className="text-text-primary font-medium">{mlData.entities?.experience_level || 'N/A'}</span>
              </p>
            </div>
          </div>
        )}

        {/* ── Candidate Insights (ML SHAP-style Explainability) ── */}
        {mlData?.explainability && (
          <div className="card p-6 mb-8 animate-slide-up">
            <h2 className="text-sm font-semibold text-text-primary mb-5 flex items-center gap-2">
              <span>🧠</span> AI Candidate Insights
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] text-green-400 uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                  <span>✓</span> Key Strengths
                </p>
                <div className="space-y-2.5">
                  {mlData.explainability.positive_factors?.map((f, i) => (
                    <div key={i} className="text-[13px] text-text-secondary leading-relaxed px-4 py-3 rounded-lg bg-green-400/5 border border-green-400/10 shadow-sm shadow-green-900/5">
                      {f}
                    </div>
                  ))}
                  {(!mlData.explainability.positive_factors || mlData.explainability.positive_factors.length === 0) && (
                    <p className="text-xs text-text-muted italic">No specific strengths highlighted.</p>
                  )}
                </div>
              </div>
              <div>
                <p className="text-[11px] text-red-400 uppercase tracking-wider mb-3 font-semibold flex items-center gap-1.5">
                  <span>!</span> Growth Areas & Gaps
                </p>
                <div className="space-y-2.5">
                  {mlData.explainability.negative_factors?.map((f, i) => (
                    <div key={i} className="text-[13px] text-text-secondary leading-relaxed px-4 py-3 rounded-lg bg-red-400/5 border border-red-400/10 shadow-sm shadow-red-900/5">
                      {f}
                    </div>
                  ))}
                  {(!mlData.explainability.negative_factors || mlData.explainability.negative_factors.length === 0) && (
                    <p className="text-xs text-text-muted flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                      No major gaps detected.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-6 animate-slide-up">
            
            {/* Actionable Skill Gaps */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">🎯</span>
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Targeted Skill Gaps</h2>
                  <p className="text-[11px] text-text-muted mt-0.5">Skills required for this role but missing from resume</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {report.skillGaps?.map((gap, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-3.5 rounded-lg bg-surface-400 border border-white/[0.04] transition-colors hover:bg-surface-500">
                    <span className="text-[13px] text-text-primary font-medium tracking-wide">{gap.skill}</span>
                    <span className={`badge text-[10px] uppercase font-bold tracking-wider ${
                      gap.severity === 'high' ? 'bg-red-500/20 text-red-400 border-red-500/20' :
                      gap.severity === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' :
                      'bg-green-500/20 text-green-400 border-green-500/20'
                    }`}>
                      {gap.severity} Priority
                    </span>
                  </div>
                ))}
                {(!report.skillGaps || report.skillGaps.length === 0) && (
                  <div className="text-center py-6 border border-dashed border-white/10 rounded-lg">
                    <p className="text-xs text-text-muted">Perfect match! No missing skills detected.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Supported Skills / Strong Matches */}
            {mlData?.skillMatching?.strong_matches?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">✅</span>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Verified Competencies</h2>
                    <p className="text-[11px] text-text-muted mt-0.5">Required skills found in your profile</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {mlData.skillMatching.strong_matches.map((m, idx) => (
                    <span key={idx} className="px-3 py-1.5 rounded-md bg-green-900/20 border border-green-500/20 text-green-300 text-xs shadow-sm">
                      {m.job_skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Preparation Roadmap */}
            {report.preparationPlan?.length > 0 && (
              <div className="card p-6 border-accent/20">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">🗺️</span>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Actionable Prep Roadmap</h2>
                    <p className="text-[11px] text-text-muted mt-0.5">Custom daily plan to master the missing skills</p>
                  </div>
                </div>
                
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                  {report.preparationPlan?.map((day, idx) => (
                    <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-accent/30 bg-black text-accent shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 text-xs font-bold">
                        D{day.day}
                      </div>
                      <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl bg-surface-400 border border-white/5 shadow-md">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-text-primary text-[13px]">{day.focus}</h3>
                        </div>
                        <ul className="space-y-1.5 text-text-secondary w-full">
                          {day.tasks?.map((task, t) => (
                            <li key={t} className="text-[12px] flex items-start gap-2 leading-tight">
                              <span className="text-accent mt-0.5 shrink-0 opacity-70">•</span>
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            
            {/* Technical Interview Simulator */}
            {report.technicalQuestions?.length > 0 && (
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">💻</span>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Technical Interview Simulator</h2>
                    <p className="text-[11px] text-text-muted mt-0.5">Questions tailored to bridge your specific gaps</p>
                  </div>
                </div>
                
                <div className="space-y-4 pr-1">
                  {report.technicalQuestions?.map((q, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-surface-500 border border-white/5 group hover:border-white/10 transition-all">
                      <h4 className="text-[13px] font-semibold text-accent mb-2 leading-snug">Q: {q.question}</h4>
                      <div className="mb-3 inline-block px-2 py-0.5 rounded text-[10px] bg-white/5 text-text-muted border border-white/10">
                        Purpose: {q.intention}
                      </div>
                      <div className="bg-black/40 p-3 rounded-lg border border-white/5">
                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest block mb-1">Model Answer</span>
                        <p className="text-[12px] text-text-secondary leading-relaxed">{q.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cultural & Behavioral Fit */}
            {report.behavioralQuestions?.length > 0 && (
              <div className="card p-6 mt-6">
                <div className="flex items-center gap-2 mb-5">
                  <span className="text-lg">🤝</span>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Cultural & Behavioral Fit</h2>
                    <p className="text-[11px] text-text-muted mt-0.5">Leadership, teamwork, and situational questions</p>
                  </div>
                </div>
                <div className="space-y-4 pr-1">
                  {report.behavioralQuestions?.map((q, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-surface-500 border border-white/5 group hover:border-white/10 transition-all">
                      <h4 className="text-[13px] font-semibold text-blue-400 mb-2 leading-snug">Q: {q.question}</h4>
                      <div className="bg-black/40 p-3 rounded-lg border border-white/5 mt-3">
                        <span className="text-[10px] font-bold text-blue-400 opacity-80 uppercase tracking-widest block mb-1">How to answer</span>
                        <p className="text-[12px] text-text-secondary leading-relaxed">{q.answer}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportDetails;
