const { allowCors, handleError, sendJson } = require("./_supabase");
const candidates = require("../data/npi-shop-candidates-v2.json");

const CATEGORY_MAP = [
  {
    terms: ["pcba", "electronics", "pcb", "board", "smt", "controller"],
    fits: ["PCBA / electronics NPI", "embedded / industrial computing NPI"],
  },
  {
    terms: ["camera", "vision", "sensor", "lidar", "thermal", "optical", "imu"],
    fits: ["sensor / vision module NPI", "embedded / industrial computing NPI"],
  },
  {
    terms: ["rf", "radio", "wireless", "communication", "antenna", "data-link", "datalink"],
    fits: ["RF / communication module NPI", "PCBA / electronics NPI"],
  },
  {
    terms: ["robot", "joint", "motion", "motor", "actuator", "servo", "power", "battery"],
    fits: ["power / motor module NPI", "CNC / precision mechanical NPI", "embedded / industrial computing NPI"],
  },
  {
    terms: ["enclosure", "housing", "mechanical", "fixture", "jig", "test", "cnc", "machining", "bracket"],
    fits: ["test fixture / validation NPI", "enclosure / tooling pilot build", "CNC / precision mechanical NPI"],
  },
  {
    terms: ["connector", "cable", "harness", "interconnect"],
    fits: ["connector / cable harness NPI", "PCBA / electronics NPI"],
  },
];

function normalize(value) {
  return String(value || "").toLowerCase();
}

function findFits(query) {
  const text = normalize(query);
  const fitWeights = new Map();
  CATEGORY_MAP.forEach((entry) => {
    if (entry.terms.some((term) => text.includes(term))) {
      entry.fits.forEach((fit, index) => {
        const weight = index === 0 ? 420 : 25;
        fitWeights.set(fit, Math.max(fitWeights.get(fit) || 0, weight));
      });
    }
  });
  return fitWeights;
}

function scoreCandidate(candidate, query, requestedFits) {
  const text = normalize([
    candidate.company_name,
    candidate.category,
    candidate.npi_fit_type,
    candidate.use_case,
    candidate.capability_summary,
    candidate.evidence_summary,
  ].join(" "));
  const tokens = normalize(query).split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  const tokenScore = tokens.reduce((score, token) => score + (text.includes(token) ? 8 : 0), 0);
  const fitScore = requestedFits.get(candidate.npi_fit_type) || 0;
  const confidenceScore = candidate.confidence_level === "High" ? 8 : candidate.confidence_level === "Medium" ? 5 : 0;
  return Math.round((candidate.score / 10) + fitScore + tokenScore + confidenceScore);
}

function inferWorkstreams(candidate) {
  const text = normalize([
    candidate.category,
    candidate.npi_fit_type,
    candidate.use_case,
    candidate.capability_summary,
  ].join(" "));
  const workstreams = [];
  if (text.includes("pcba") || text.includes("smt") || text.includes("electronics") || text.includes("controller")) workstreams.push("PCBA / SMT");
  if (text.includes("camera") || text.includes("vision") || text.includes("sensor") || text.includes("lidar")) workstreams.push("RF / camera / sensor integration");
  if (text.includes("rf") || text.includes("communication") || text.includes("antenna") || text.includes("wireless")) workstreams.push("RF / communication module");
  if (text.includes("motor") || text.includes("power") || text.includes("battery") || text.includes("robot")) workstreams.push("Power / motion module");
  if (text.includes("fixture") || text.includes("test") || text.includes("inspection") || text.includes("aoi")) workstreams.push("Fixture / functional test");
  if (text.includes("cnc") || text.includes("machining") || text.includes("enclosure") || text.includes("tooling") || text.includes("3d print")) workstreams.push("Enclosure / CNC / tooling");
  if (text.includes("connector") || text.includes("cable") || text.includes("harness")) workstreams.push("Cable / harness");
  return [...new Set(workstreams.length ? workstreams : [candidate.npi_fit_type || "NPI review"])].slice(0, 4);
}

function inferStageFit(candidate) {
  const text = normalize([candidate.use_case, candidate.capability_summary, candidate.npi_fit_type].join(" "));
  const stages = ["EVT"];
  if (text.includes("dvt") || text.includes("validation") || text.includes("test") || text.includes("fixture") || candidate.score >= 180) stages.push("DVT");
  if (text.includes("pilot") || text.includes("assembly") || text.includes("turnkey") || candidate.score >= 220) stages.push("PVT-readiness");
  return stages;
}

function inferOpsProfile(candidate) {
  const high = candidate.confidence_level === "High";
  const medium = candidate.confidence_level === "Medium";
  return {
    npi_willingness: high ? "verify-positive" : medium ? "candidate-likely" : "unverified",
    moq_fit: candidate.is_small_shop_verified ? "small-batch likely" : "verify sample / pilot MOQ",
    response_time: candidate.is_small_shop_verified ? "target 24-48h after BLNKK contact" : "unknown until phone/email verification",
    english_fae: high ? "likely available / verify owner" : "unknown / BLNKK translation layer needed",
    dfm_quality: medium || high ? "public capability suggests first-pass DFM review" : "unverified",
    compliance_readiness: "Non-PRC / NDAA path requires BLNKK verification",
  };
}

module.exports = async function handler(req, res) {
  if (allowCors(req, res)) return;
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "POST only." });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const query = [
      body.category,
      body.need,
      body.stage,
      body.system,
      body.files,
      body.bottlenecks,
      body.workstreams,
      body.goals,
      body.constraints,
      body.quantity,
    ].filter(Boolean).join(" ");
    const limit = Math.max(3, Math.min(Number(body.limit || 5), 12));
    let requestedFits = findFits(body.category || "");
    if (!requestedFits.size) requestedFits = findFits(query);

    const matches = candidates
      .map((candidate) => ({
        ...candidate,
        match_score: scoreCandidate(candidate, query, requestedFits),
      }))
      .sort((a, b) => b.match_score - a.match_score || a.rank - b.rank)
      .slice(0, limit)
      .map((candidate) => ({
        rank: candidate.rank,
        company_name: candidate.company_name,
        city: candidate.city,
        category: candidate.category,
        npi_fit_type: candidate.npi_fit_type,
        match_score: candidate.match_score,
        use_case: candidate.use_case,
        capability_summary: candidate.capability_summary,
        confidence_level: candidate.confidence_level,
        verification_status: candidate.verification_status,
        is_small_shop_verified: candidate.is_small_shop_verified,
        stage_fit: inferStageFit(candidate),
        workstreams: inferWorkstreams(candidate),
        ops_profile: inferOpsProfile(candidate),
        next_verification: candidate.recommended_next_verification,
        website: candidate.website,
      }));

    return sendJson(res, 200, {
      ok: true,
      source: "BLNKK NPI candidate list v2",
      total_candidates: candidates.length,
      requested_fits: [...requestedFits.keys()],
      data: matches,
    });
  } catch (error) {
    handleError(res, error);
  }
};
