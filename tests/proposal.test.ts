import { describe, it, expect } from "vitest";
import { computeProposalEconomics, PRICING } from "@/lib/proposal";

describe("computeProposalEconomics", () => {
  it("computes first-year cost as subscription + onboarding", () => {
    const e = computeProposalEconomics({
      company: "Acme",
      annualTransportCost: 100_000,
      savingsPct: 0.2,
      layouts: 1,
    });
    expect(e.recurringAnnualCost).toBe(
      PRICING.monthlyPerLayout * PRICING.termMonths
    );
    expect(e.firstYearCost).toBe(
      e.recurringAnnualCost + PRICING.onboardingOneTime
    );
    expect(e.annualSavings).toBe(20_000);
    expect(e.firstYearNet).toBe(e.annualSavings - e.firstYearCost);
  });

  it("scales recurring cost with the number of layouts", () => {
    const one = computeProposalEconomics({
      company: "A",
      annualTransportCost: 0,
      savingsPct: 0,
      layouts: 1,
    });
    const three = computeProposalEconomics({
      company: "A",
      annualTransportCost: 0,
      savingsPct: 0,
      layouts: 3,
    });
    expect(three.recurringAnnualCost).toBe(one.recurringAnnualCost * 3);
  });

  it("reports payback in months and is shorter when savings are larger", () => {
    const lo = computeProposalEconomics({
      company: "A",
      annualTransportCost: 50_000,
      savingsPct: 0.1,
      layouts: 1,
    });
    const hi = computeProposalEconomics({
      company: "A",
      annualTransportCost: 300_000,
      savingsPct: 0.25,
      layouts: 1,
    });
    expect(hi.paybackMonths).toBeLessThan(lo.paybackMonths);
    expect(hi.paybackMonths).toBeGreaterThan(0);
  });

  it("returns Infinity payback when there are no modeled savings", () => {
    const e = computeProposalEconomics({
      company: "A",
      annualTransportCost: 0,
      savingsPct: 0,
      layouts: 1,
    });
    expect(Number.isFinite(e.paybackMonths)).toBe(false);
  });

  it("computes a positive 3-year net for a strong savings case", () => {
    const e = computeProposalEconomics({
      company: "A",
      annualTransportCost: 200_000,
      savingsPct: 0.2,
      layouts: 1,
    });
    expect(e.threeYearNet).toBeGreaterThan(0);
    expect(e.roiPct).toBeGreaterThan(0);
  });
});
