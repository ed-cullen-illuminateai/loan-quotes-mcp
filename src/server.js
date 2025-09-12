import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

const RATEBOOK_URL =
  process.env.RATEBOOK_URL ||
  "https://raw.githubusercontent.com/ed-cullen-illuminateai/loan-quotes-mcp/main/data/ratebook.v1.json";

async function loadRatebook() {
  const res = await fetch(RATEBOOK_URL);
  if (!res.ok) throw new Error("Failed to load ratebook");
  return res.json();
}
app.get("/", (_req, res) => res.send("OK"));
app.post("/get-loan-quotes", async (req, res) => {
  try {
    const { propertyValue, deposit, loanTermYears, repaymentType } = req.body;
    const ratebook = await loadRatebook();

    const loanAmount = propertyValue - deposit;
    const ltv = loanAmount / propertyValue;

    const quotes = ratebook
      .filter((p) => ltv <= p.maxLtv)
      .map((p) => {
        const rate = p.fixedRatePct / 100;
        const n = loanTermYears * 12;
        const monthlyRate = rate / 12;
        const monthly =
          repaymentType === "capital_and_interest"
            ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n))
            : loanAmount * monthlyRate;

        const fees =
          (p.arrangementFeePct / 100) * loanAmount + p.bookingFeeFixed;

        return {
          provider: p.provider,
          ltv: ltv.toFixed(2),
          interestRatePct: p.fixedRatePct,
          monthlyRepayment: monthly.toFixed(2),
          fees,
          notes: "Demo quote only"
        };
      });

    res.json({ quotes, assumptions: ["Demo rates from GitHub JSON"] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`MCP server running on port ${port}`);
});
