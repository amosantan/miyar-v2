import { describe, it, expect } from "vitest";
import { generateBenchmarkSuggestions } from "./benchmark-calibrator";
import type { OutcomeComparison, Project } from "../../../drizzle/schema";

const createProject = (id: number, typology: string, tier: string): Project => ({
    id,
    ctx01Typology: typology,
    mkt01Tier: tier,
} as Project);

const createComparison = (projectId: number, signals: any[]): OutcomeComparison => ({
    id: Math.random(),
    projectId,
    comparedAt: new Date(),
    learningSignals: signals,
} as any);

describe("Benchmark Calibrator Engine", () => {
    it("should ignore groups with fewer than 3 comparisons", () => {
        const projects = [createProject(1, "Residential", "Mid")];
        const comparisons = [
            createComparison(1, [{ signalType: "cost_under_predicted", magnitude: 10 }]),
            createComparison(1, [{ signalType: "cost_under_predicted", magnitude: 10 }])
        ];

        const suggestions = generateBenchmarkSuggestions(comparisons, projects);
        expect(suggestions.length).toBe(0);
    });

    it("should generate a medium confidence cost suggestion when exactly 3 signals align", () => {
        const projects = [createProject(1, "Residential", "Mid")];
        const comparisons = [
            createComparison(1, [{ signalType: "cost_under_predicted", magnitude: 10 }]),
            createComparison(1, [{ signalType: "cost_under_predicted", magnitude: 15 }]),
            createComparison(1, [{ signalType: "cost_under_predicted", magnitude: 5 }])
        ];

        const suggestions = generateBenchmarkSuggestions(comparisons, projects);

        expect(suggestions.length).toBe(1);
        const suggestion = suggestions[0];

        expect(suggestion.basedOnOutcomesQuery).toBe("typology=Residential&tier=Mid");
        expect(suggestion.confidence).toBe("0.7500"); // medium

        const changes = suggestion.suggestedChanges as any;
        expect(changes.costPerSqftMid).toBe("+10.0%"); // (10 + 15 + 5) / 3
    });

    it("should cap max cost suggestion at 15%", () => {
        const projects = [createProject(2, "Commercial", "Premium")];
        const comparisons = [
            createComparison(2, [{ signalType: "cost_under_predicted", magnitude: 30 }]),
            createComparison(2, [{ signalType: "cost_under_predicted", magnitude: 30 }]),
            createComparison(2, [{ signalType: "cost_under_predicted", magnitude: 30 }])
        ];

        const suggestions = generateBenchmarkSuggestions(comparisons, projects);
        const changes = suggestions[0].suggestedChanges as any;
        expect(changes.costPerSqftMid).toBe("+15.0%");
    });

    it("should generate high confidence risk & cost suggestion with 5+ signals", () => {
        const projects = [createProject(3, "Hospitality", "Luxury")];
        const comparisons: OutcomeComparison[] = [];

        for (let i = 0; i < 5; i++) {
            comparisons.push(createComparison(3, [
                { signalType: "cost_over_predicted", magnitude: 5 },
                { signalType: "risk_under_predicted", magnitude: 10 }
            ]));
        }

        const suggestions = generateBenchmarkSuggestions(comparisons, projects);
        expect(suggestions.length).toBe(1);

        const suggestion = suggestions[0];
        expect(suggestion.confidence).toBe("0.9000"); // high

        const changes = suggestion.suggestedChanges as any;
        expect(changes.costPerSqftMid).toBe("-5.0%");
        expect(changes.timelineRiskMultiplier).toBe("+0.10");
    });
});
