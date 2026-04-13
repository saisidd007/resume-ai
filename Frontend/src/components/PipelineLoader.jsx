import React, { useState, useEffect } from 'react';

const PIPELINE_STEPS = [
  { id: 1, label: "Extracting skills, roles, and projects...", icon: "🔍", progress: 10, shortLabel: "NER" },
  { id: 2, label: "Generating semantic embeddings...", icon: "🧠", progress: 25, shortLabel: "Embeddings" },
  { id: 3, label: "Matching skills with job requirements...", icon: "⚙️", progress: 45, shortLabel: "Skill Match" },
  { id: 4, label: "Analyzing domain and experience fit...", icon: "📊", progress: 65, shortLabel: "Domain" },
  { id: 5, label: "Running ML model prediction...", icon: "🤖", progress: 85, shortLabel: "ML Model" },
  { id: 6, label: "Generating insights and explanations...", icon: "✨", progress: 100, shortLabel: "Output" }
];

const PipelineLoader = ({ isComplete, onAnimationComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [displayedProgress, setDisplayedProgress] = useState(0);

  useEffect(() => {
    // If complete is triggered early, rapidly finish
    if (isComplete) {
      setCurrentStep(PIPELINE_STEPS.length - 1);
      setDisplayedProgress(100);
      
      const timeout = setTimeout(() => {
        if (onAnimationComplete) onAnimationComplete();
      }, 800);
      return () => clearTimeout(timeout);
    }

    // Normal progression simulation
    if (currentStep < PIPELINE_STEPS.length - 1) {
      // Time between steps: faster at start, slower at LLM (last step)
      const isSlowStep = currentStep >= 4;
      const delay = isSlowStep ? 2500 : 1200;

      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [currentStep, isComplete, onAnimationComplete]);

  // Smooth progress bar animation
  useEffect(() => {
    const targetProgress = isComplete 
      ? 100 
      : PIPELINE_STEPS[currentStep]?.progress || 0;

    // Smoothly interpolate to target progress
    const interval = setInterval(() => {
      setDisplayedProgress(prev => {
        if (prev >= targetProgress) return targetProgress;
        return prev + 1;
      });
    }, 20); // updates every 20ms for smooth 60fps feel

    return () => clearInterval(interval);
  }, [currentStep, isComplete]);

  const activeStep = PIPELINE_STEPS[Math.min(currentStep, PIPELINE_STEPS.length - 1)];

  // Fallback state if stuck at end but API hasn't returned
  const showFinalizing = currentStep === PIPELINE_STEPS.length - 1 && !isComplete;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="max-w-2xl w-full mx-4 card p-8 border border-white/10 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow attached to progress */}
        <div 
          className="absolute top-0 left-0 h-1 bg-accent transition-all duration-300 shadow-[0_0_15px_rgba(200,168,78,0.5)]" 
          style={{ width: `${displayedProgress}%` }}
        />

        <div className="text-center mb-10">
          <h2 className="text-xl font-bold text-text-primary mb-2">Analyzing Candidate Profile</h2>
          <p className="text-sm text-text-secondary h-6 animate-pulse">
            {showFinalizing ? "🔄 Finalizing results..." : (
              <span className="flex items-center justify-center gap-2">
                <span className="text-lg">{activeStep?.icon}</span>
                {activeStep?.label}
              </span>
            )}
          </p>
        </div>

        {/* Visual Pipeline UI */}
        <div className="flex items-center justify-between mb-12 relative">
          {/* Connecting Line */}
          <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5 bg-white/5 z-0" />
          
          {/* Active Connecting Line */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-accent/50 z-0 transition-all duration-500" 
            style={{ 
              width: `${(Math.min(currentStep, PIPELINE_STEPS.length - 1) / (PIPELINE_STEPS.length - 1)) * 100}%` 
            }} 
          />

          {/* Start Node */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 border-accent bg-accent/20 text-accent`}>
              📄
            </div>
            <span className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Resume</span>
          </div>

          {/* Pipeline Nodes */}
          {PIPELINE_STEPS.map((step, index) => {
            const isCompleted = index < currentStep || isComplete;
            const isActive = index === currentStep && !isComplete;
            const isPending = index > currentStep && !isComplete;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center gap-2">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300
                    ${isCompleted ? 'border-green-400 bg-green-400/20 text-green-400' : ''}
                    ${isActive ? 'border-accent bg-accent/20 text-accent shadow-[0_0_15px_rgba(200,168,78,0.4)] animate-pulse' : ''}
                    ${isPending ? 'border-white/10 bg-black text-text-muted' : ''}
                  `}
                >
                  {isCompleted ? '✓' : step.id}
                </div>
                <span className={`text-[10px] font-medium uppercase tracking-wider absolute -bottom-6 w-max text-center
                  ${isActive ? 'text-accent' : (isCompleted ? 'text-green-400/70' : 'text-text-muted/50')}
                `}>
                  {step.shortLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Global Progress Bar */}
        <div className="mt-8">
          <div className="flex justify-between text-[11px] font-bold text-text-muted uppercase tracking-widest mb-2">
            <span>Overall Progress</span>
            <span>{Math.round(displayedProgress)}%</span>
          </div>
          <div className="w-full bg-surface-500 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-accent to-yellow-300 transition-all duration-200 ease-linear rounded-full"
              style={{ width: `${displayedProgress}%` }}
            />
          </div>
        </div>

      </div>
    </div>
  );
};

export default PipelineLoader;
