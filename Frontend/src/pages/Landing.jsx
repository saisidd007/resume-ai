import { Link } from 'react-router-dom';

const Landing = () => {
  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
            <span className="text-accent text-sm font-bold">AI</span>
          </div>
          <span className="text-text-primary font-semibold text-sm tracking-tight">Interview Mastery</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-text-secondary text-sm hover:text-text-primary transition-colors">
            Sign in
          </Link>
          <Link
            to="/register"
            className="btn-primary text-sm !py-2 !px-5"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-2xl mx-auto text-center animate-fade-in">
          <div className="inline-flex items-center gap-2 badge-gold mb-8 px-4 py-2 rounded-full text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-subtle"></span>
            Powered by Advanced AI
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold text-text-primary leading-[1.1] tracking-tight mb-6">
            AI Interview Mastery
          </h1>

          <p className="text-lg text-text-secondary leading-relaxed mb-12 max-w-lg mx-auto">
            Get personalized interview reports, skill gap analysis, and a 10-day preparation plan powered by advanced AI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <Link
              to="/login"
              className="btn-primary text-base !py-3.5 !px-10 !rounded-lg"
            >
              Get Started →
            </Link>
            <Link
              to="/register"
              className="btn-ghost text-base !py-3.5 !px-10 !rounded-lg"
            >
              Create Free Account
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-5 max-w-3xl w-full mx-auto animate-slide-up">
          {[
            {
              icon: '⚡',
              title: 'AI Analysis',
              desc: 'Advanced AI analyzes your resume against job requirements'
            },
            {
              icon: '💡',
              title: 'Practice Questions',
              desc: '50+ tailored technical & behavioral questions with answers'
            },
            {
              icon: '📋',
              title: '10-Day Plan',
              desc: 'Personalized preparation roadmap to ace your interview'
            }
          ].map((feature, i) => (
            <div key={i} className="card p-6 group cursor-default">
              <div className="text-2xl mb-4">{feature.icon}</div>
              <h3 className="text-sm font-semibold text-text-primary mb-2">{feature.title}</h3>
              <p className="text-xs text-text-secondary leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 border-t border-white/[0.06]">
        <p className="text-xs text-text-muted">
          © 2026 AI Interview Mastery. Built with intelligence.
        </p>
      </footer>
    </div>
  );
};

export default Landing;
