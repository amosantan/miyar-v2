import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Sparkles, ArrowRight, BarChart3, Shield, Leaf, X, Check } from "lucide-react";

const ONBOARDING_KEY = "miyar-onboarding-complete";

interface OnboardingStep {
    title: string;
    description: string;
    icon: React.FC<{ className?: string }>;
    action?: string;
    path?: string;
}

const STEPS: OnboardingStep[] = [
    {
        title: "Create Your First Project",
        description: "Start by creating a project with your interior design specifications — location, GFA, spec level, and materials.",
        icon: Sparkles,
        action: "Create Project",
        path: "/projects/new",
    },
    {
        title: "Evaluate & Score",
        description: "MIYAR will score your project across 5 dimensions: Scoring Accuracy, Forecasting, Market Position, Data Strength, and Evidence Reliability.",
        icon: BarChart3,
    },
    {
        title: "Run Scenarios & Simulations",
        description: "Compare what-if scenarios, run Monte Carlo simulations, and stress-test your design decisions with data-driven confidence.",
        icon: Shield,
    },
    {
        title: "Sustainability & Digital Twin",
        description: "Analyze embodied carbon, operational energy, and lifecycle costs with the digital twin engine — optimized for UAE climate.",
        icon: Leaf,
    },
];

export function OnboardingFlow() {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(0);
    const [dismissed, setDismissed] = useState(false);

    // Check if onboarding was already completed
    useEffect(() => {
        const completed = localStorage.getItem(ONBOARDING_KEY);
        if (completed) setDismissed(true);
    }, []);

    const handleComplete = useCallback(() => {
        localStorage.setItem(ONBOARDING_KEY, "true");
        setDismissed(true);
    }, []);

    const handleSkip = useCallback(() => {
        handleComplete();
    }, [handleComplete]);

    const handleNext = useCallback(() => {
        if (currentStep < STEPS.length - 1) {
            setCurrentStep((s) => s + 1);
        } else {
            handleComplete();
        }
    }, [currentStep, handleComplete]);

    if (dismissed || !user) return null;

    const step = STEPS[currentStep];
    const isLast = currentStep === STEPS.length - 1;

    return (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200">
            <div className="relative w-full max-w-lg mx-4 rounded-2xl bg-card border shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">MIYAR</span>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                            Getting Started
                        </span>
                    </div>
                    <button
                        onClick={handleSkip}
                        className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-accent/30 transition-colors"
                    >
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                </div>

                {/* Step indicator */}
                <div className="flex gap-1.5 px-6 py-3">
                    {STEPS.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= currentStep ? "bg-primary" : "bg-muted"
                                }`}
                        />
                    ))}
                </div>

                {/* Step content */}
                <div className="px-6 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <step.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold">{step.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                                {step.description}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-6 pb-6">
                    <button
                        onClick={handleSkip}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Skip tour
                    </button>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            {currentStep + 1} of {STEPS.length}
                        </span>
                        <button
                            onClick={handleNext}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            {isLast ? (
                                <>
                                    <Check className="h-4 w-4" />
                                    Get Started
                                </>
                            ) : (
                                <>
                                    Next
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
