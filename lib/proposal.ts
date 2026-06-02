/**
 * Pilot-proposal economics: turns a prospect's current material-handling cost
 * and an expected improvement into the numbers a buyer needs — first-year cost
 * under GalvBot pricing, net savings, payback period, and 3-year value.
 * Pricing mirrors the product: $500/mo per layout, 12-month term, $5k onboarding.
 */
export const PRICING = {
  monthlyPerLayout: 500,
  onboardingOneTime: 5000,
  termMonths: 12,
};

export interface ProposalInputs {
  company: string;
  /** Current annual material-handling labor cost ($/yr). */
  annualTransportCost: number;
  /** Expected reduction from optimization (0..1). */
  savingsPct: number;
  /** Number of factory layouts under contract. */
  layouts: number;
}

export interface ProposalEconomics {
  annualSavings: number;
  firstYearCost: number; // 12mo subscription + one-time onboarding
  recurringAnnualCost: number; // subscription only
  firstYearNet: number; // savings - firstYearCost
  paybackMonths: number; // months for savings to cover first-year cost
  threeYearNet: number;
  roiPct: number; // first-year ROI on spend
}

export function computeProposalEconomics(
  i: ProposalInputs
): ProposalEconomics {
  const layouts = Math.max(1, Math.floor(i.layouts));
  const annualSavings = Math.max(0, i.annualTransportCost * i.savingsPct);
  const recurringAnnualCost =
    PRICING.monthlyPerLayout * PRICING.termMonths * layouts;
  const firstYearCost = recurringAnnualCost + PRICING.onboardingOneTime;
  const firstYearNet = annualSavings - firstYearCost;
  const monthlySavings = annualSavings / 12;
  const paybackMonths =
    monthlySavings > 0 ? firstYearCost / monthlySavings : Infinity;
  const threeYearCost = firstYearCost + recurringAnnualCost * 2;
  const threeYearNet = annualSavings * 3 - threeYearCost;
  const roiPct = firstYearCost > 0 ? (firstYearNet / firstYearCost) * 100 : 0;

  return {
    annualSavings: Math.round(annualSavings),
    firstYearCost: Math.round(firstYearCost),
    recurringAnnualCost: Math.round(recurringAnnualCost),
    firstYearNet: Math.round(firstYearNet),
    paybackMonths: Math.round(paybackMonths * 10) / 10,
    threeYearNet: Math.round(threeYearNet),
    roiPct: Math.round(roiPct),
  };
}

const money = (n: number) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

/** Generate and download a branded one-page pilot proposal PDF. */
export async function generateProposalPdf(i: ProposalInputs): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const e = computeProposalEconomics(i);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const margin = 18;
  let y = margin;

  // Header band
  doc.setFillColor(249, 115, 22);
  doc.rect(0, 0, W, 4, "F");
  doc.setFontSize(22);
  doc.text("GalvBot", margin, (y += 6));
  doc.setFontSize(12);
  doc.setTextColor(110);
  doc.text("Factory Layout Optimization — Pilot Proposal", margin, (y += 7));
  doc.setTextColor(0);
  doc.setFontSize(11);
  doc.text(`Prepared for: ${i.company || "Your facility"}`, margin, (y += 8));
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(new Date().toLocaleDateString(), margin, (y += 5));
  doc.setTextColor(0);

  // Summary line
  y += 6;
  doc.setFontSize(13);
  doc.text("The opportunity", margin, y);
  y += 6;
  doc.setFontSize(10.5);
  const intro = doc.splitTextToSize(
    `GalvBot re-optimizes your floor for material flow, worker safety, and equipment utilization. Based on an estimated ${money(
      i.annualTransportCost
    )}/yr in material-handling labor and a ${Math.round(
      i.savingsPct * 100
    )}% reduction target, the projected impact across ${Math.max(
      1,
      Math.floor(i.layouts)
    )} layout(s) is below.`,
    W - margin * 2
  );
  doc.text(intro, margin, y);
  y += intro.length * 5 + 4;

  // Economics table
  const rows: [string, string][] = [
    ["Projected annual savings", `${money(e.annualSavings)}/yr`],
    [
      "GalvBot first-year cost",
      `${money(e.firstYearCost)} (incl. ${money(
        PRICING.onboardingOneTime
      )} onboarding)`,
    ],
    ["Recurring annual cost", `${money(e.recurringAnnualCost)}/yr`],
    [
      "Payback period",
      Number.isFinite(e.paybackMonths)
        ? `${e.paybackMonths} months`
        : "n/a (no modeled savings)",
    ],
    ["First-year net", `${money(e.firstYearNet)}`],
    ["3-year net value", `${money(e.threeYearNet)}`],
    ["First-year ROI", `${e.roiPct}%`],
  ];
  doc.setFontSize(11);
  for (const [label, val] of rows) {
    doc.setTextColor(80);
    doc.text(label, margin, y);
    doc.setTextColor(0);
    doc.text(val, margin + 80, y);
    y += 7;
  }

  // What the pilot includes
  y += 4;
  doc.setFontSize(13);
  doc.text("What the pilot includes", margin, y);
  y += 6;
  doc.setFontSize(10.5);
  const bullets = [
    "Floor capture (blueprint/scan import or guided manual build) to scale",
    "Optimized layout with before/after material-flow scoring",
    "Egress & aisle compliance review and capacity/bottleneck analysis",
    "One-page management report (this economic case + the layout)",
    "Onboarding, equipment library setup, and a team training session",
  ];
  for (const b of bullets) {
    doc.text(`•  ${b}`, margin, y);
    y += 6;
  }

  // Terms + disclaimer
  y += 2;
  doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(
    doc.splitTextToSize(
      `Pricing: ${money(PRICING.monthlyPerLayout)}/mo per layout, ${
        PRICING.termMonths
      }-month term, ${money(
        PRICING.onboardingOneTime
      )} one-time onboarding. Savings are estimates from your inputs and routed travel distances. GalvBot is decision-support tooling and provides advisory analysis — not a stamped code-compliance or safety determination. Validate against your governing codes and AHJ.`,
      W - margin * 2
    ),
    margin,
    y
  );

  const slug = (i.company || "galvbot").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  doc.save(`${slug}-pilot-proposal.pdf`);
}
