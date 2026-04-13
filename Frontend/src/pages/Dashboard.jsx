import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/hooks/useAuth';
import { useState, useEffect } from 'react';

const Dashboard = () => {
  const { user, handleLogout } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/interview/reports', {
        credentials: 'include',
      });
      const data = await response.json();
      if (data.success) {
        setReports(data.reports);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const onLogout = async () => {
    handleLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-black">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-xs font-bold">AI</span>
          </div>
          <span className="text-text-primary font-semibold text-sm tracking-tight">Dashboard</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted">{user?.email}</span>
          <button
            onClick={onLogout}
            className="btn-ghost !py-2 !px-4 text-xs"
            id="logout-btn"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Welcome section */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Welcome back, {user?.username}
          </h1>
          <p className="text-sm text-text-secondary">
            Manage your interview reports and prepare for your next opportunity.
          </p>
        </div>

        {/* Quick action */}
        <div className="card p-6 mb-10 flex items-center justify-between animate-slide-up">
          <div>
            <h2 className="text-sm font-semibold text-text-primary mb-1">Generate New Report</h2>
            <p className="text-xs text-text-secondary">
              Analyze your resume against a job description with AI
            </p>
          </div>
          <Link
            to="/interview"
            className="btn-primary text-sm !py-2.5 !px-6"
            id="new-report-btn"
          >
            New Report +
          </Link>
        </div>

        {/* Reports section */}
        <div className="animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary">
              Your Reports
            </h2>
            <span className="badge badge-gold">{reports.length} total</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="spinner"></div>
            </div>
          ) : reports.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">No reports yet</h3>
              <p className="text-xs text-text-secondary mb-6">
                Generate your first interview report to get started.
              </p>
              <Link to="/interview" className="btn-primary text-sm !py-2.5 !px-6">
                Create First Report
              </Link>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {reports.slice(0, 6).map((report) => (
                <Link to={`/report/${report._id}`} key={report._id} className="card p-5 group block hover:border-accent/30 transition-colors cursor-pointer">
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
                      {report.matchScore ? Math.round(report.matchScore) : 0}%
                    </div>
                    <span className="text-[11px] text-text-muted">
                      {new Date(report.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2 truncate group-hover:text-accent transition-colors">
                    {report.jobDescription ? report.jobDescription.substring(0, 50) : "Report"}...
                  </h3>
                  <p className="text-xs text-text-secondary mb-4">
                    {report.technicalQuestions?.length || 0} Tech · {report.behavioralQuestions?.length || 0} Behavioral
                  </p>
                  <div className="flex gap-2">
                    <span className="badge badge-green text-[11px]">Prep Plan</span>
                    <span className="badge badge-blue text-[11px]">Skill Gaps</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
