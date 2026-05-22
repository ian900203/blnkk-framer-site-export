/*
 * BLNKK CSA Chat Intake Flow (V2)
 * ---------------------------------------------------------------
 * Replaces the shallow 3-question Framer chat on /csa with a 7-step
 * ChatGPT/Codex-style conversational sourcing intake. The frontend
 * shows ~7 major chat steps; the backend still stores a complete
 * structured buyerRequirement object.
 *
 * Architecture:
 *  - Waits for [data-framer-root] (Framer uses <div id="main">, not <main>).
 *  - Appends a position:fixed overlay to document.body, z-index 9999.
 *  - Disables pointer-events on Framer root so the old chat is unreachable.
 *  - Calls the existing /api/supplier-match for results.
 *  - Calls the existing /api/buyer-requests on consent + contact.
 *  - Never touches Supabase directly; no service_role; no AI API keys.
 *
 * Reset switches (for debugging from the browser console):
 *   window.__blnkkCsaIntakeV2Disable = true;   // before load → skip mounting
 *   window.__blnkkCsaIntakeReset && window.__blnkkCsaIntakeReset();
 */
(() => {
  if (!/\/csa(?:\/|\.html)?$/.test(location.pathname)) return;
  if (window.__blnkkCsaIntakeV2Disable) return;
  if (window.__blnkkCsaIntakeV2) return;
  window.__blnkkCsaIntakeV2 = 1;

  // ============================================================
  // CONSTANTS - taxonomy + options
  // ============================================================

  const STAGE_OPTIONS = [
    "Early feasibility",
    "Prototype / sample build",
    "Small-batch validation",
    "Production sourcing",
    "Alternative supplier replacement",
    "Compliance / origin review",
    "Market research only",
  ];

  const STAGE_TO_REQ_TYPE = {
    "Early feasibility": "New Product Development / Design-in",
    "Prototype / sample build": "Prototype / Small-Batch Validation",
    "Small-batch validation": "Prototype / Small-Batch Validation",
    "Production sourcing": "Production Procurement",
    "Alternative supplier replacement": "Alternative Supplier Sourcing",
    "Compliance / origin review": "Compliance / Origin Review",
    "Market research only": "Market Research / Supply Chain Mapping",
  };

  const CATEGORY_OPTIONS = [
    "RF / Data Link",
    "PCBA / EMS",
    "Motor / Propulsion",
    "Battery / Power",
    "Flight electronics",
    "Navigation / GNSS",
    "Payload / Camera / Sensor",
    "Wire harness / Connector",
    "Mechanical / Airframe",
    "C-UAS / RF detection",
    "C-UAS / RF spectrum hardware",
    "C-UAS / C2 edge systems",
    "Ground control / field deployment",
    "Software / Firmware",
    "Materials / critical inputs",
    "Other",
  ];

  const CATEGORY_TO_DOMAIN = {
    "RF / Data Link": "UAS Communication & Data Link",
    "PCBA / EMS": "Manufacturing, EMS & Validation Services",
    "Motor / Propulsion": "UAS Propulsion & Power",
    "Battery / Power": "UAS Propulsion & Power",
    "Flight electronics": "UAS Flight Electronics & Autonomy",
    "Navigation / GNSS": "UAS Navigation & Positioning",
    "Payload / Camera / Sensor": "UAS Payload & Mission Systems",
    "Wire harness / Connector": "Wire Harness & Interconnects",
    "Mechanical / Airframe": "UAS Airframe & Mechanical Structures",
    "C-UAS / RF detection": "Counter-UAS Detection Sensors",
    "C-UAS / RF spectrum hardware": "Counter-UAS RF & Spectrum Hardware",
    "C-UAS / C2 edge systems": "Counter-UAS C2 & Edge Systems",
    "Ground control / field deployment": "Ground Control & Field Deployment",
    "Software / Firmware": "Software, Firmware & Cybersecurity",
    "Materials / critical inputs": "Materials & Critical Inputs",
    "Other": "Other / Custom Requirement",
  };

  const SUBSYSTEMS_BY_CATEGORY = {
    "RF / Data Link": [
      "Telemetry Radio Module",
      "Encrypted Data Link Subsystem",
      "Video Transmission Module",
      "Command & Control Link",
      "LTE / 5G Communication Module",
      "SATCOM Terminal / Module",
      "Mesh Network Module",
      "Antenna",
      "RF Cable Assembly",
      "RF Front-End Module",
      "Communication Subsystem",
      "Other RF requirement",
    ],
    "PCBA / EMS": [
      "PCB Fabrication",
      "PCBA Assembly",
      "EMS / Contract Manufacturing",
      "Box Build Assembly",
      "Cable Harness Manufacturing",
      "Mechanical Assembly",
      "RF Testing & Calibration",
      "Environmental Testing",
      "EMI / EMC Testing",
      "NPI Engineering Support",
      "Other / Custom Requirement",
    ],
    "Motor / Propulsion": [
      "BLDC Motor / Coreless Motor",
      "ESC (Electronic Speed Controller)",
      "Propeller / Rotor Blade",
      "Ducted Fan / EDF Module",
      "Propulsion Subsystem",
      "Other / Custom Requirement",
    ],
    "Battery / Power": [
      "Battery Cell / Battery Pack",
      "BMS (Battery Management System)",
      "Power Distribution Board (PDB)",
      "DC-DC Converter / Power Module",
      "Charging Station / Charger",
      "Thermal Management Component",
      "Power Distribution Subsystem",
      "Other / Custom Requirement",
    ],
    "Flight electronics": [
      "Flight Controller / Autopilot",
      "Companion Computer / Edge AI Computer",
      "MCU / Microcontroller Board",
      "GPU / NPU / AI Accelerator Module",
      "FPGA / ASIC / CPLD Module",
      "IMU / Gyroscope / Accelerometer",
      "Barometer / Altimeter",
      "Magnetometer / Compass Module",
      "Sensor Fusion Board",
      "Firmware / RTOS / Flight Software",
      "Autonomy Subsystem",
      "Other / Custom Requirement",
    ],
    "Navigation / GNSS": [
      "GNSS / GPS Receiver Module",
      "RTK / PPK Positioning Module",
      "INS / Inertial Navigation System",
      "Visual Odometry / Optical Flow Module",
      "SLAM / Obstacle Avoidance Module",
      "Anti-Jamming / Anti-Spoofing Navigation Module",
      "Navigation Subsystem",
      "Other / Custom Requirement",
    ],
    "Payload / Camera / Sensor": [
      "EO Camera Module",
      "IR / Thermal Imaging Module",
      "Gimbal Camera System",
      "LiDAR / Laser Scanner",
      "Mapping / Survey Camera",
      "Radar Payload",
      "Laser Rangefinder",
      "Multispectral / Hyperspectral Sensor",
      "Payload Controller Board",
      "Payload Delivery / Release Mechanism",
      "Mission Payload Subsystem",
      "Other / Custom Requirement",
    ],
    "Wire harness / Connector": [
      "Power Cable Assembly",
      "Signal Cable Assembly",
      "RF Cable Assembly",
      "Coaxial Cable Assembly",
      "Waterproof Connector",
      "Board-to-Board Connector",
      "FPC / FFC Cable",
      "Military-Grade Connector",
      "Custom UAV Harness",
      "Custom C-UAS Harness",
      "Interconnect Subsystem",
      "Other / Custom Requirement",
    ],
    "Mechanical / Airframe": [
      "Carbon Fiber / Composite Airframe",
      "CNC Machined Structural Component",
      "Fuselage / Wing / Arm Structure",
      "Landing Gear / Deployment Mechanism",
      "Gimbal / Stabilizer Mechanical Assembly",
      "Payload Mount / Release Mechanism",
      "Fasteners / Precision Hardware",
      "Ruggedized Enclosure / IP-Rated Housing",
      "Heat Sink / Thermal Structure",
      "Mechanical Structure Subsystem",
      "Other / Custom Requirement",
    ],
    "C-UAS / RF detection": [
      "AESA Radar Module",
      "mmWave Radar Module",
      "Passive RF Detection Sensor",
      "RF Scanner / Spectrum Monitoring Module",
      "Direction-Finding Antenna Array",
      "EO Camera Tracking Module",
      "IR / Thermal Tracking Module",
      "Acoustic Detection Sensor",
      "Remote ID Receiver",
      "Sensor Fusion Hardware",
      "Detection Sensor Subsystem",
      "Other / Custom Requirement",
    ],
    "C-UAS / RF spectrum hardware": [
      "SDR (Software Defined Radio)",
      "RF Front-End Module",
      "Power Amplifier",
      "Low Noise Amplifier",
      "Filter / Duplexer / RF Switch",
      "Direction-Finding Antenna",
      "Wideband Antenna",
      "RF Cable Assembly",
      "Spectrum Analysis Board",
      "Signal Processing Board",
      "RF Spectrum Subsystem",
      "Other / Custom Requirement",
    ],
    "C-UAS / C2 edge systems": [
      "C-UAS Command & Control Console",
      "Operator Control Unit",
      "Rugged Edge AI Computer",
      "Sensor Fusion Edge Server",
      "Threat Classification Module",
      "Alert / Battle Management Hardware",
      "Secure Router / Network Appliance",
      "Encrypted Communication Gateway",
      "Rugged Display / Field Terminal",
      "C2 Edge Subsystem",
      "Other / Custom Requirement",
    ],
    "Ground control / field deployment": [
      "Ground Control Station",
      "Rugged Tablet / Rugged Laptop",
      "Operator Console",
      "Ground Antenna System",
      "Tripod / Mast / Mobile Mount",
      "Weatherproof Field Enclosure",
      "Portable Power Station / UPS",
      "Charging Case / Transport Case",
      "Launch / Recovery Support Equipment",
      "Test Fixture / Calibration Tool",
      "Field Deployment Subsystem",
      "Other / Custom Requirement",
    ],
    "Software / Firmware": [
      "Flight Firmware",
      "Ground Control Software",
      "Mission Planning Software",
      "Computer Vision / AI Algorithm",
      "C-UAS Detection Software",
      "Sensor Fusion Software",
      "Threat Classification Software",
      "OTA / Firmware Update System",
      "SBOM / Software Supply Chain Review",
      "Secure Logging / Access Control",
      "Other / Custom Requirement",
    ],
    "Materials / critical inputs": [
      "Carbon Fiber / Composite Material",
      "Battery Cell Material",
      "Thermal Interface Material",
      "RF / Microwave Substrate",
      "Rare Earth Magnetic Material",
      "Aerospace-Grade Fastener Material",
      "Conformal Coating / Potting Material",
      "Other / Custom Requirement",
    ],
    "Other": [
      "Other / Custom Requirement",
    ],
  };

  const BUDGET_OPTIONS = [
    "Not defined yet",
    "Under US$5,000",
    "US$5,000–25,000",
    "US$25,000–100,000",
    "US$100,000–500,000",
    "US$500,000–1M",
    "Over US$1M",
    "Prefer not to say",
  ];

  const COMPLIANCE_OPTIONS = [
    { id: "non_prc", label: "Non-PRC supply chain" },
    { id: "ndaa", label: "NDAA-aware sourcing" },
    { id: "origin", label: "Country-of-origin evidence" },
    { id: "bom", label: "BOM / component traceability" },
    { id: "cybersecurity", label: "Cybersecurity review" },
    { id: "itar", label: "ITAR / export sensitivity" },
    { id: "field", label: "Field-rugged / defense use" },
    { id: "documentation", label: "Datasheet / test report required" },
    { id: "not_sure", label: "Not sure yet" },
  ];

  const COMPLIANCE_NOTES_TRIGGERS = ["origin", "bom", "cybersecurity", "itar", "documentation"];

  const ATTRIBUTE_PROMPTS = {
    "ESC (Electronic Speed Controller)":
      "Voltage range, continuous/peak current, control protocol, cooling method, firmware configurability, target aircraft class, and quantity expectations.",
    "BLDC Motor / Coreless Motor":
      "KV rating, thrust range, voltage range, shaft/mounting pattern, bearing type, operating temperature, and target payload class.",
    "Battery Cell / Battery Pack":
      "Chemistry, voltage, capacity, C-rate, BMS integration, safety certifications, transport status, and target endurance.",
    "Telemetry Radio Module":
      "Frequency band, target range, data rate, encryption needs, antenna interface, regulatory requirements, and operating environment.",
    "Encrypted Data Link Subsystem":
      "Range, throughput, encryption expectations, interface, key management, ruggedization, and command/control architecture.",
    "Flight Controller / Autopilot":
      "Supported aircraft type, interfaces, redundancy expectations, firmware compatibility, safety requirements, and integration assumptions.",
    "EO Camera Module":
      "Resolution, sensor size, interface, low-light needs, stabilization, size/weight limits, and target use case.",
    "IR / Thermal Imaging Module":
      "Resolution, frame rate, wavelength, detection range, interface, cooling, export sensitivity, and integration constraints.",
    "RF Cable Assembly":
      "Frequency range, impedance, connector type, insertion loss, shielding, length options, environmental rating, and expected volume.",
    "PCBA Assembly":
      "Board complexity, volume, compliance needs, testing requirements, NPI support, box-build needs, and target timeline.",
  };

  const DEFAULT_HELPER =
    "Useful details include performance target, interface, frequency band, voltage/current, size/weight limits, operating environment, integration boundary, testing needs, and what the supplier is expected to provide.";

  const BUYER_ROLES = [
    "Decision Maker",
    "Sourcing Lead",
    "Procurement Manager",
    "Engineering Lead",
    "Technical Evaluator",
    "Founder / Executive",
    "Program Manager",
    "Consultant / Advisor",
    "Other",
  ];

  // Quantity/timeline branch options keyed by Q1 stage.
  const QUANTITY_TIMELINE_BRANCHES = {
    "Prototype / sample build": {
      prompt: "How many samples or prototype units do you need, and when?",
      options: [
        "1–10 samples / <4 weeks",
        "1–10 samples / 1–3 months",
        "10–50 units / 1–3 months",
        "50–250 units / 3–6 months",
        "Not sure yet",
      ],
    },
    "Small-batch validation": {
      prompt: "What validation quantity and timing are you targeting?",
      options: [
        "10–50 units / <4 weeks",
        "10–50 units / 1–3 months",
        "50–250 units / 1–3 months",
        "50–250 units / 3–6 months",
        "Not sure yet",
      ],
    },
    "Production sourcing": {
      prompt: "What production volume range are you planning for?",
      options: [
        "250–1,000 units",
        "1,000–10,000 units",
        "10,000+ units",
        "Annual forecast TBD",
        "2026 production planning",
      ],
      followupTimeline: {
        prompt: "And what is the target production window?",
        options: [
          "Immediate / urgent",
          "1–3 months",
          "3–6 months",
          "6–12 months",
          "2026 production planning",
        ],
      },
    },
    "Early feasibility": {
      prompt: "How early-stage is this, and what's your expected timeline?",
      options: [
        "Concept only / <4 weeks",
        "Concept only / 1–3 months",
        "Spec defined / 1–3 months",
        "Spec defined / 3–6 months",
        "Not sure yet",
      ],
    },
    "Alternative supplier replacement": {
      prompt: "What replacement volume and timing are you targeting?",
      options: [
        "Drop-in 1–10 / <4 weeks",
        "Drop-in 10–50 / 1–3 months",
        "10–250 / 3–6 months",
        "250–1,000 / 6–12 months",
        "Not sure yet",
      ],
    },
    "Market research only": {
      prompt: "Is this for a near-term shortlist or market mapping?",
      options: [
        "Need shortlist this month",
        "Need options in 1–3 months",
        "2026 planning",
        "Market mapping only",
      ],
    },
    "Compliance / origin review": {
      prompt: "What is the review timeline and documentation scope?",
      options: [
        "Urgent review / <4 weeks",
        "1–3 months",
        "2026 planning",
        "Origin documentation only",
        "BOM / component traceability review",
        "Not sure yet",
      ],
    },
  };

  // ============================================================
  // STATE
  // ============================================================

  function emptyBuyerRequirement() {
    return {
      initialMessage: "",
      requirementType: "",
      sourcingStage: "",
      category: "",
      domain: "",
      subsystem: "",
      customSubsystem: "",
      budget: "",
      timeline: "",
      volume: "",
      sampleQuantity: "",
      productionForecast: "",
      complianceFlags: [],
      complianceNotes: "",
      specs: "",
      interfaces: "",
      environment: "",
      integration: "",
      supplierBoundary: "",
      supplierPreference: "",
      notes: "",
      matchConfidence: "low",
      missingSignals: [],
      createdAt: new Date().toISOString(),
    };
  }

  const session = {
    step: "initial_need",
    requirement: emptyBuyerRequirement(),
    contact: {},
    transcript: [],
    matches: [],
    targetedFollowupAsked: false,
    multiSelectBuffer: [],
    matchOk: null,
  };

  function pushTranscript(role, text) {
    if (!text) return;
    session.transcript.push({
      role,
      message: text,
      message_order: session.transcript.length + 1,
    });
  }

  // ============================================================
  // UI MOUNT
  // ============================================================

  const CSS = `
    /* Framer uses <div data-framer-root> not <main> — disable native chat when overlay active */
    body.blnkk-csa-intake-on [data-framer-root] {
      pointer-events: none !important;
      user-select: none !important;
    }
    #blnkk-csa-intake-root {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      background: #f6f7f9;
      font-family: -apple-system, "SF Pro Text", "Inter", system-ui, sans-serif;
    }
    .blnkk-intake__header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 24px;
      height: 52px;
      border-bottom: 1px solid #e5e7eb;
      background: #fff;
      flex-shrink: 0;
    }
    .blnkk-intake__header-logo {
      font-size: 14px;
      font-weight: 800;
      letter-spacing: .08em;
      color: #0b1020;
    }
    .blnkk-intake__header-sub {
      font-size: 12px;
      color: #9ca3af;
    }
    .blnkk-intake__scroll {
      flex: 1 1 auto;
      overflow-y: auto;
      padding: 24px 28px 16px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .blnkk-intake__msg { display: flex; }
    .blnkk-intake__msg--assistant { justify-content: flex-start; }
    .blnkk-intake__msg--user { justify-content: flex-end; }
    .blnkk-intake__bubble {
      max-width: 78%;
      background: #fff;
      border: 1px solid #ecedf0;
      border-radius: 20px;
      padding: 14px 18px;
      box-shadow: 0 1px 2px rgba(15,23,42,.04);
      color: #111827;
      font-size: 14.5px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .blnkk-intake__msg--user .blnkk-intake__bubble {
      background: #0b1020;
      color: #fff;
      border-color: #0b1020;
    }
    .blnkk-intake__brand {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: .16em;
      color: #2563eb;
      margin-bottom: 6px;
    }
    .blnkk-intake__helper {
      margin-top: 8px;
      font-size: 12.5px;
      color: #6b7280;
      line-height: 1.5;
    }
    .blnkk-intake__results {
      max-width: 92%;
      background: #fff;
      border: 1px solid #ecedf0;
      border-radius: 20px;
      padding: 16px 18px;
      box-shadow: 0 1px 2px rgba(15,23,42,.04);
    }
    .blnkk-intake__results-title {
      font-weight: 700;
      font-size: 17px;
      color: #0b1020;
      margin-bottom: 4px;
    }
    .blnkk-intake__results-intro {
      color: #4b5563;
      font-size: 13.5px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .blnkk-intake__results-list {
      list-style: none;
      padding: 0;
      margin: 0;
      border-top: 1px solid #edf0f4;
    }
    .blnkk-intake__results-list > li {
      padding: 12px 0;
      border-bottom: 1px solid #edf0f4;
      display: grid;
      gap: 4px;
    }
    .blnkk-intake__result-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .blnkk-intake__result-head b {
      font-size: 14px;
      font-weight: 700;
      color: #111827;
    }
    .blnkk-intake__result-fit {
      border: 1px solid #dbeafe;
      background: #eff6ff;
      color: #1d4ed8;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 11px;
      font-weight: 700;
      white-space: nowrap;
    }
    .blnkk-intake__result-meta { color: #4b5563; font-size: 12.5px; line-height: 1.55; }
    .blnkk-intake__result-why { color: #111827; font-size: 13px; line-height: 1.55; }
    .blnkk-intake__result-tags { color: #475569; font-size: 12px; line-height: 1.5; }
    .blnkk-intake__result-cta {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }
    .blnkk-intake__result-cta button {
      border: 1px solid #d4d4d8;
      background: #fff;
      color: #111827;
      border-radius: 999px;
      padding: 6px 11px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 600;
    }
    .blnkk-intake__result-cta button:hover { background: #f3f4f6; }
    .blnkk-intake__results-note {
      color: #6b7280;
      font-size: 12px;
      line-height: 1.55;
      margin-top: 10px;
    }
    .blnkk-intake__input-wrap {
      border-top: 1px solid #e5e7eb;
      background: #fff;
      padding: 12px 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex-shrink: 0;
    }
    .blnkk-intake__chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .blnkk-intake__chip {
      border: 1px solid #d4d4d8;
      background: #fff;
      color: #111827;
      border-radius: 999px;
      padding: 9px 15px;
      font-size: 13.5px;
      cursor: pointer;
      font-weight: 500;
      transition: background .12s, color .12s, border-color .12s;
    }
    .blnkk-intake__chip:hover { background: #f3f4f6; }
    .blnkk-intake__chip.is-selected {
      background: #0b1020;
      color: #fff;
      border-color: #0b1020;
    }
    .blnkk-intake__chip--primary {
      background: #0b1020;
      color: #fff;
      border-color: #0b1020;
    }
    .blnkk-intake__chip--primary:hover { background: #1f2937; color: #fff; }
    .blnkk-intake__chip--skip { color: #6b7280; }
    .blnkk-intake__textbar {
      display: flex;
      align-items: flex-end;
      gap: 10px;
    }
    .blnkk-intake__textarea {
      flex: 1 1 auto;
      resize: none;
      border: 1px solid #e5e7eb;
      border-radius: 14px;
      padding: 12px 14px;
      font-size: 15px;
      line-height: 1.5;
      font-family: inherit;
      outline: none;
      max-height: 160px;
      min-height: 46px;
      background: #fafafa;
      color: #111827;
    }
    .blnkk-intake__textarea:focus { border-color: #94a3b8; background: #fff; }
    .blnkk-intake__send {
      background: #0b1020;
      color: #fff;
      border: none;
      border-radius: 14px;
      padding: 0 18px;
      height: 46px;
      font-size: 14.5px;
      cursor: pointer;
      font-weight: 600;
    }
    .blnkk-intake__send:disabled { opacity: .5; cursor: not-allowed; }
    .blnkk-intake__send:hover:not(:disabled) { background: #1f2937; }
    .blnkk-intake__typing {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .blnkk-intake__typing span {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #94a3b8;
      animation: blnkkIntakeDot 1.1s infinite ease-in-out;
    }
    .blnkk-intake__typing span:nth-child(2) { animation-delay: .15s; }
    .blnkk-intake__typing span:nth-child(3) { animation-delay: .30s; }
    @keyframes blnkkIntakeDot {
      0%, 80%, 100% { transform: scale(.6); opacity: .4; }
      40% { transform: scale(1); opacity: 1; }
    }
    @media (max-width: 809.98px) {
      .blnkk-intake__header { padding: 0 14px; }
      .blnkk-intake__scroll { padding: 16px 14px 10px; gap: 12px; }
      .blnkk-intake__bubble { max-width: 92%; font-size: 14.5px; padding: 13px 15px; }
      .blnkk-intake__input-wrap { padding: 10px 12px 14px; }
      .blnkk-intake__chip { padding: 10px 16px; min-height: 42px; }
      .blnkk-intake__textarea { font-size: 16px; }
    }
  `;

  function injectCss() {
    if (document.getElementById("blnkk-csa-intake-css")) return;
    const s = document.createElement("style");
    s.id = "blnkk-csa-intake-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  let rootEl = null;
  let scrollEl = null;
  let chipsEl = null;
  let textareaEl = null;
  let sendBtnEl = null;
  let mountAttempts = 0;

  function mount() {
    if (rootEl) return true;
    injectCss();
    // Framer uses <div data-framer-root>, not <main> – wait for hydration.
    const framerRoot = document.querySelector("[data-framer-root]");
    if (!framerRoot) return false;

    rootEl = document.createElement("div");
    rootEl.id = "blnkk-csa-intake-root";
    rootEl.innerHTML = `
      <div class="blnkk-intake__header">
        <span class="blnkk-intake__header-logo">BLNKK CSA</span>
        <span class="blnkk-intake__header-sub">Taiwan Supplier Sourcing Agent</span>
      </div>
      <div class="blnkk-intake__scroll" id="blnkk-csa-intake-scroll"></div>
      <div class="blnkk-intake__input-wrap">
        <div class="blnkk-intake__chips" id="blnkk-csa-intake-chips"></div>
        <div class="blnkk-intake__textbar">
          <textarea class="blnkk-intake__textarea" id="blnkk-csa-intake-textarea" rows="1" placeholder="Type your answer…"></textarea>
          <button class="blnkk-intake__send" id="blnkk-csa-intake-send">Send</button>
        </div>
      </div>
    `;
    // Inject into body (fixed overlay) so Framer DOM structure doesn't matter.
    document.body.appendChild(rootEl);

    scrollEl = rootEl.querySelector("#blnkk-csa-intake-scroll");
    chipsEl = rootEl.querySelector("#blnkk-csa-intake-chips");
    textareaEl = rootEl.querySelector("#blnkk-csa-intake-textarea");
    sendBtnEl = rootEl.querySelector("#blnkk-csa-intake-send");

    textareaEl.addEventListener("input", autoResize);
    textareaEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendClick();
      }
    });
    sendBtnEl.addEventListener("click", handleSendClick);

    document.body.classList.add("blnkk-csa-intake-on");
    return true;
  }

  function autoResize() {
    if (!textareaEl) return;
    textareaEl.style.height = "auto";
    textareaEl.style.height = Math.min(textareaEl.scrollHeight, 160) + "px";
  }

  function appendAssistant(text, opts = {}) {
    const msg = document.createElement("div");
    msg.className = "blnkk-intake__msg blnkk-intake__msg--assistant";
    const bubble = document.createElement("div");
    bubble.className = "blnkk-intake__bubble";
    bubble.innerHTML = `<div class="blnkk-intake__brand">BLNKK</div>`;
    const body = document.createElement("div");
    body.textContent = text;
    bubble.appendChild(body);
    if (opts.helper) {
      const helper = document.createElement("div");
      helper.className = "blnkk-intake__helper";
      helper.textContent = opts.helper;
      bubble.appendChild(helper);
    }
    msg.appendChild(bubble);
    scrollEl.appendChild(msg);
    scrollToBottom();
    pushTranscript("assistant", text + (opts.helper ? "\n" + opts.helper : ""));
  }

  function appendUser(text) {
    const msg = document.createElement("div");
    msg.className = "blnkk-intake__msg blnkk-intake__msg--user";
    const bubble = document.createElement("div");
    bubble.className = "blnkk-intake__bubble";
    bubble.textContent = text;
    msg.appendChild(bubble);
    scrollEl.appendChild(msg);
    scrollToBottom();
    pushTranscript("user", text);
  }

  function appendCustomBubble(html) {
    const msg = document.createElement("div");
    msg.className = "blnkk-intake__msg blnkk-intake__msg--assistant";
    msg.innerHTML = html;
    scrollEl.appendChild(msg);
    scrollToBottom();
  }

  let typingNode = null;
  function showTyping() {
    if (typingNode) return;
    const msg = document.createElement("div");
    msg.className = "blnkk-intake__msg blnkk-intake__msg--assistant";
    msg.innerHTML = `<div class="blnkk-intake__bubble"><div class="blnkk-intake__brand">BLNKK</div><div class="blnkk-intake__typing"><span></span><span></span><span></span></div></div>`;
    scrollEl.appendChild(msg);
    typingNode = msg;
    scrollToBottom();
  }
  function hideTyping() {
    if (typingNode && typingNode.parentNode) typingNode.parentNode.removeChild(typingNode);
    typingNode = null;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }

  function clearChips() {
    if (chipsEl) chipsEl.innerHTML = "";
  }

  function setTextareaMode(opts) {
    opts = opts || {};
    if (!textareaEl || !sendBtnEl) return;
    textareaEl.disabled = !!opts.disabled;
    textareaEl.placeholder = opts.placeholder || "Type your answer…";
    sendBtnEl.disabled = !!opts.disabled;
    sendBtnEl.textContent = opts.sendLabel || "Send";
    if (!opts.disabled && opts.focus !== false) {
      try { textareaEl.focus(); } catch (_) {}
    }
  }

  function renderChips(items, opts) {
    opts = opts || {};
    clearChips();
    items.forEach((item) => {
      const label = typeof item === "string" ? item : item.label;
      const value = typeof item === "string" ? item : (item.id || item.value || item.label);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "blnkk-intake__chip";
      btn.textContent = label;
      btn.dataset.value = value;
      btn.dataset.label = label;
      if (opts.multi && session.multiSelectBuffer.includes(value)) {
        btn.classList.add("is-selected");
      }
      btn.addEventListener("click", () => {
        if (opts.multi) {
          toggleMultiSelect(btn, value);
        } else {
          onChipChoose(label, value);
        }
      });
      chipsEl.appendChild(btn);
    });
    if (opts.multi) {
      const done = document.createElement("button");
      done.type = "button";
      done.className = "blnkk-intake__chip blnkk-intake__chip--primary";
      done.textContent = "Done";
      done.addEventListener("click", () => onMultiDone());
      chipsEl.appendChild(done);
    }
    if (opts.skip) {
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "blnkk-intake__chip blnkk-intake__chip--skip";
      skip.textContent = "Skip";
      skip.addEventListener("click", () => onSkip());
      chipsEl.appendChild(skip);
    }
  }

  function toggleMultiSelect(btn, value) {
    const idx = session.multiSelectBuffer.indexOf(value);
    if (idx >= 0) {
      session.multiSelectBuffer.splice(idx, 1);
      btn.classList.remove("is-selected");
    } else {
      session.multiSelectBuffer.push(value);
      btn.classList.add("is-selected");
    }
  }

  // ============================================================
  // STATE MACHINE
  // ============================================================

  function onChipChoose(label, value) {
    handleAnswer({ label, value, source: "chip" });
  }
  function onMultiDone() {
    handleAnswer({ label: "Done", value: session.multiSelectBuffer.slice(), source: "multi" });
  }
  function onSkip() {
    handleAnswer({ label: "Skip", value: "", source: "skip" });
  }
  function handleSendClick() {
    const raw = (textareaEl.value || "").trim();
    if (!raw) return;
    handleAnswer({ label: raw, value: raw, source: "text" });
    textareaEl.value = "";
    autoResize();
  }

  function handleAnswer(answer) {
    const r = session.requirement;
    switch (session.step) {
      case "initial_need":
        if (answer.source !== "text") return; // ignore non-text in step 0
        r.initialMessage = answer.value;
        appendUser(answer.value);
        applyInitialHeuristics(answer.value);
        return goStage();

      case "stage":
        if (answer.source !== "chip") return;
        r.sourcingStage = answer.value;
        r.requirementType = STAGE_TO_REQ_TYPE[answer.value] || answer.value;
        appendUser(answer.label);
        return goCategory();

      case "category":
        if (answer.source !== "chip") return;
        r.category = answer.value;
        r.domain = CATEGORY_TO_DOMAIN[answer.value] || answer.value;
        appendUser(answer.label);
        return goSubsystem();

      case "subsystem":
        if (answer.source !== "chip") return;
        r.subsystem = answer.value;
        appendUser(answer.label);
        if (/Other/i.test(answer.value)) return goCustomSubsystem();
        return goQuantityTimeline();

      case "custom_subsystem":
        if (answer.source !== "text") return;
        r.customSubsystem = answer.value;
        appendUser(answer.value);
        return goQuantityTimeline();

      case "quantity_timeline":
        if (answer.source !== "chip") return;
        applyQuantityTimeline(r, answer.value);
        appendUser(answer.label);
        // Production sourcing has an optional explicit timeline follow-up.
        if (r.sourcingStage === "Production sourcing"
            && QUANTITY_TIMELINE_BRANCHES[r.sourcingStage].followupTimeline
            && !r.timeline) {
          return goProductionTimeline();
        }
        return goBudget();

      case "production_timeline":
        if (answer.source !== "chip") return;
        r.timeline = answer.value;
        appendUser(answer.label);
        return goBudget();

      case "budget":
        if (answer.source !== "chip") return;
        r.budget = answer.value;
        appendUser(answer.label);
        return goCompliance();

      case "compliance":
        if (answer.source !== "multi") return;
        r.complianceFlags = answer.value || [];
        const labels = COMPLIANCE_OPTIONS
          .filter((c) => r.complianceFlags.includes(c.id))
          .map((c) => c.label);
        appendUser(labels.length ? labels.join(", ") : "(no compliance flags selected)");
        if (r.complianceFlags.some((id) => COMPLIANCE_NOTES_TRIGGERS.includes(id))) {
          return goComplianceNotes();
        }
        return goTechnicalDetails();

      case "compliance_notes":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          r.complianceNotes = answer.value;
          appendUser(answer.value);
        } else {
          return;
        }
        return goTechnicalDetails();

      case "technical_details":
        if (answer.source !== "text") return;
        r.specs = answer.value;
        extractTechnicalSignals(r, answer.value);
        appendUser(answer.value);
        return goAdditionalContext();

      case "additional_context":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          r.notes = answer.value;
          extractSupplierPreference(r, answer.value);
          appendUser(answer.value);
        } else {
          return;
        }
        return goConfidenceGate();

      case "targeted_followup":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          r.specs = (r.specs ? r.specs + "\n\n" : "") + answer.value;
          extractTechnicalSignals(r, answer.value);
          appendUser(answer.value);
        } else {
          return;
        }
        return runMatching();

      case "contact_cta":
        if (answer.source !== "chip") return;
        session.step = "complete"; // lock immediately to prevent double-fire
        clearChips();
        setTextareaMode({ disabled: true, placeholder: "Session complete." });
        appendUser(answer.label);
        if (answer.value === "yes") {
          session.step = "contact_company"; // re-open for contact flow
          return goContactCompany();
        }
        appendAssistant("Got it — your sourcing requirement is logged in BLNKK's review queue. Refresh anytime to start a new search.");
        persistSession({ withContact: false }).catch(() => {});
        return;

      case "contact_company":
        if (answer.source !== "text") return;
        session.contact.company = answer.value;
        appendUser(answer.value);
        return goContactEmail();

      case "contact_email":
        if (answer.source !== "text") return;
        if (!isValidEmail(answer.value)) {
          appendAssistant("That doesn't look like a valid email — please enter a work email I can send the BLNKK follow-up to.");
          return;
        }
        session.contact.email = answer.value;
        appendUser(answer.value);
        return goContactPerson();

      case "contact_person":
        if (answer.source !== "text") return;
        session.contact.contact = answer.value;
        appendUser(answer.value);
        return goContactRole();

      case "contact_role":
        if (answer.source === "chip") {
          session.contact.buyerRole = answer.value;
          appendUser(answer.label);
        } else if (answer.source === "skip") {
          appendUser("(skipped)");
        } else {
          return;
        }
        return goContactWebsite();

      case "contact_website":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          session.contact.website = answer.value;
          appendUser(answer.value);
        } else {
          return;
        }
        return goContactLinkedin();

      case "contact_linkedin":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          session.contact.linkedin = answer.value;
          appendUser(answer.value);
        } else {
          return;
        }
        return goContactPhone();

      case "contact_phone":
        if (answer.source === "skip") {
          appendUser("(skipped)");
        } else if (answer.source === "text") {
          session.contact.phone = answer.value;
          appendUser(answer.value);
        } else {
          return;
        }
        return finalizeContact();
    }
  }

  // -------- step transitions ----------

  function goStage() {
    session.step = "stage";
    appendAssistant("What stage is this sourcing request for?");
    setTextareaMode({ disabled: true, placeholder: "Choose a stage above…" });
    renderChips(STAGE_OPTIONS);
  }

  function goCategory() {
    session.step = "category";
    appendAssistant("Which category best matches what you are sourcing?");
    setTextareaMode({ disabled: true, placeholder: "Choose a category above…" });
    renderChips(CATEGORY_OPTIONS);
  }

  function goSubsystem() {
    session.step = "subsystem";
    const opts = SUBSYSTEMS_BY_CATEGORY[session.requirement.category]
      || ["Other / Custom Requirement"];
    appendAssistant("Which subsystem, component, service, or material best matches?");
    setTextareaMode({ disabled: true, placeholder: "Choose a subsystem above…" });
    renderChips(opts);
  }

  function goCustomSubsystem() {
    session.step = "custom_subsystem";
    appendAssistant("Please describe the custom component, subsystem, service, or material you are sourcing.");
    clearChips();
    setTextareaMode({ placeholder: "Describe what you're sourcing…" });
  }

  function goQuantityTimeline() {
    session.step = "quantity_timeline";
    const branch = QUANTITY_TIMELINE_BRANCHES[session.requirement.sourcingStage]
      || QUANTITY_TIMELINE_BRANCHES["Early feasibility"];
    appendAssistant(branch.prompt);
    setTextareaMode({ disabled: true, placeholder: "Pick one above…" });
    renderChips(branch.options);
  }

  function goProductionTimeline() {
    const branch = QUANTITY_TIMELINE_BRANCHES["Production sourcing"];
    if (!branch.followupTimeline) return goBudget();
    session.step = "production_timeline";
    appendAssistant(branch.followupTimeline.prompt);
    setTextareaMode({ disabled: true, placeholder: "Pick one above…" });
    renderChips(branch.followupTimeline.options);
  }

  function goBudget() {
    session.step = "budget";
    appendAssistant("Do you have an estimated budget or sourcing range?");
    setTextareaMode({ disabled: true, placeholder: "Pick a range above…" });
    renderChips(BUDGET_OPTIONS);
  }

  function goCompliance() {
    session.step = "compliance";
    session.multiSelectBuffer = [];
    appendAssistant("Which compliance or origin requirements matter for this request? Select all that apply, then tap Done.");
    setTextareaMode({ disabled: true, placeholder: "Tap chips, then Done…" });
    renderChips(COMPLIANCE_OPTIONS, { multi: true });
  }

  function goComplianceNotes() {
    session.step = "compliance_notes";
    appendAssistant(
      "Any specific documentation, origin evidence, export, or cybersecurity notes suppliers should know?",
      { helper: "You can type details or tap Skip if not applicable." }
    );
    clearChips();
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "blnkk-intake__chip blnkk-intake__chip--skip";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => onSkip());
    chipsEl.appendChild(skip);
    setTextareaMode({ placeholder: "e.g. CoO letters for all PCB components, NDAA-compliant BOM, ITAR clearance…" });
  }

  function goTechnicalDetails() {
    session.step = "technical_details";
    const subsystem = session.requirement.subsystem;
    const helper = ATTRIBUTE_PROMPTS[subsystem] || DEFAULT_HELPER;
    appendAssistant("Please add the key technical details suppliers must know.", { helper });
    clearChips();
    setTextareaMode({ placeholder: "Describe the technical requirements…" });
  }

  function goAdditionalContext() {
    session.step = "additional_context";
    appendAssistant(
      "Anything else BLNKK should consider before matching suppliers?",
      { helper: "Previous supplier issues, preferred supplier profile, required documents, known constraints, target use case, or next-step expectations." }
    );
    clearChips();
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "blnkk-intake__chip blnkk-intake__chip--skip";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => onSkip());
    chipsEl.appendChild(skip);
    setTextareaMode({ placeholder: "Optional context…" });
  }

  function goConfidenceGate() {
    const r = session.requirement;
    const { score, level, missing } = computeMatchConfidence(r);
    r.matchConfidence = level;
    r.missingSignals = missing;
    if (level === "low" && !session.targetedFollowupAsked) {
      session.targetedFollowupAsked = true;
      return goTargetedFollowup();
    }
    return runMatching();
  }

  function goTargetedFollowup() {
    session.step = "targeted_followup";
    const prompt = targetedFollowupPrompt(session.requirement.category);
    appendAssistant(prompt, { helper: "This will sharpen the BLNKK match. Tap Skip if you'd prefer to see initial signals now." });
    clearChips();
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "blnkk-intake__chip blnkk-intake__chip--skip";
    skip.textContent = "Skip and match";
    skip.addEventListener("click", () => onSkip());
    chipsEl.appendChild(skip);
    setTextareaMode({ placeholder: "Add the missing details…" });
  }

  // ============================================================
  // HEURISTICS + DERIVED FIELDS
  // ============================================================

  function applyInitialHeuristics(text) {
    const lower = (text || "").toLowerCase();
    const flags = new Set(session.requirement.complianceFlags);
    if (/non[-\s]?prc|non[-\s]?china|exclud(e|ing) china/.test(lower)) flags.add("non_prc");
    if (/ndaa/.test(lower)) flags.add("ndaa");
    if (/itar/.test(lower)) flags.add("itar");
    if (/coo|country[-\s]of[-\s]origin|origin\s+evidence/.test(lower)) flags.add("origin");
    if (/bom|traceab/.test(lower)) flags.add("bom");
    if (/cyber|secur/.test(lower)) flags.add("cybersecurity");
    if (/datasheet|test\s+report|certificat/.test(lower)) flags.add("documentation");
    if (/defen[cs]e|military|rugged|mil[-\s]std/.test(lower)) flags.add("field");
    session.requirement.complianceFlags = [...flags];
  }

  function applyQuantityTimeline(r, answer) {
    // Answer formats: "1–10 samples / <4 weeks" or "10,000+ units" or just timeline string.
    const text = String(answer);
    r.volume = text;
    const parts = text.split("/").map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      r.volume = parts[0];
      r.timeline = parts[1];
    }
    if (/sample/i.test(text)) r.sampleQuantity = r.volume || text;
    if (r.sourcingStage === "Production sourcing") {
      r.productionForecast = text;
      if (parts.length < 2) r.timeline = "";
    }
  }

  function extractTechnicalSignals(r, text) {
    const t = String(text || "");
    // Interfaces
    const ifaceTokens = [
      "USB", "UART", "I2C", "SPI", "Ethernet", "CAN", "RS232", "RS485",
      "MIPI", "HDMI", "PCIe", "MIPI CSI", "MIPI DSI", "GPIO",
      "SBUS", "PWM", "DShot", "MAVLink", "CRSF", "ELRS", "PPM",
      "MHz", "GHz", "kHz",
      "AES", "TLS", "VPN", "OpenSSL",
      "REST", "gRPC", "MQTT", "API"
    ];
    const found = ifaceTokens.filter((tok) => new RegExp("\\b" + escapeReg(tok) + "\\b", "i").test(t));
    if (found.length) r.interfaces = found.join(", ");
    // Environment
    if (/(ip6[0-9]|ip5[0-9])/i.test(t)) r.environment = (t.match(/ip6[0-9]|ip5[0-9]/i) || [""])[0].toUpperCase();
    const envHits = [];
    if (/temperature|operating\s+temp|-?\d+\s*°?c|degrees?\s*c/i.test(t)) envHits.push("operating temperature");
    if (/vibration|shock|mil-std-810|mil std 810/i.test(t)) envHits.push("vibration/shock");
    if (/altitude/i.test(t)) envHits.push("altitude");
    if (/water|ip6|ip5|water-?proof|sealed/i.test(t)) envHits.push("ingress");
    if (envHits.length) r.environment = (r.environment ? r.environment + "; " : "") + envHits.join(", ");
    // Integration
    const intHits = [];
    if (/firmware|rtos|api|sdk|reference\s+design/i.test(t)) intHits.push("firmware/reference design");
    if (/fae|design[-\s]in|co[-\s]engineer|integration\s+support|epc|epcm/i.test(t)) intHits.push("design-in / FAE");
    if (/validation|verification|testing|certif/i.test(t)) intHits.push("validation");
    if (intHits.length) r.integration = intHits.join(", ");
    // Supplier boundary
    if (/(turn[-\s]?key|complete\s+module|drop[-\s]?in)/i.test(t)) r.supplierBoundary = "turnkey module";
    else if (/(component\s+only|just\s+the\s+component)/i.test(t)) r.supplierBoundary = "component only";
    else if (/(subsystem|reference\s+platform)/i.test(t)) r.supplierBoundary = "subsystem";
  }

  function extractSupplierPreference(r, text) {
    const t = String(text || "").toLowerCase();
    const prefs = [];
    if (/taiwan/.test(t)) prefs.push("Taiwan-based");
    if (/non[-\s]?prc|non[-\s]?china/.test(t)) prefs.push("Non-PRC");
    if (/ems/.test(t)) prefs.push("EMS capable");
    if (/rf\s+test/.test(t)) prefs.push("RF test capable");
    if (/english/.test(t)) prefs.push("English communication");
    if (/export/.test(t)) prefs.push("Export experience");
    if (/defense|defence|military|mil[-\s]std/.test(t)) prefs.push("Defense-grade documentation");
    if (/uav|uas|drone/.test(t)) prefs.push("UAV/UAS experience");
    if (prefs.length) r.supplierPreference = prefs.join(", ");
  }

  function escapeReg(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function computeMatchConfidence(r) {
    let score = 0;
    const missing = [];
    if (r.initialMessage) score += 10; else missing.push("initialMessage");
    if (r.requirementType) score += 10; else missing.push("requirementType");
    if (r.domain) score += 10; else missing.push("domain");
    if (r.subsystem) score += 15; else missing.push("subsystem");
    if (r.timeline) score += 10; else missing.push("timeline");
    if (r.volume) score += 10; else missing.push("volume");
    if (r.budget) score += 10; else missing.push("budget");
    if (r.complianceFlags && r.complianceFlags.length) score += 10; else missing.push("complianceFlags");
    if (r.specs && r.specs.length >= 40) score += 20; else missing.push("specs");
    if (r.notes && r.notes.length >= 20) score += 5; else missing.push("notes");
    let level = "low";
    if (score >= 75) level = "high";
    else if (score >= 55) level = "medium";
    return { score, level, missing };
  }

  function targetedFollowupPrompt(category) {
    switch (category) {
      case "RF / Data Link":
      case "C-UAS / RF detection":
      case "C-UAS / RF spectrum hardware":
        return "To improve RF supplier matching, can you share the target frequency band, range, throughput, and whether encryption is required?";
      case "Battery / Power":
        return "To improve battery supplier matching, can you share voltage, capacity, chemistry, C-rate, BMS needs, and certification expectations?";
      case "PCBA / EMS":
        return "To improve EMS matching, can you share board complexity, target volume, testing requirements, NPI support, and whether box-build is needed?";
      case "Mechanical / Airframe":
        return "To improve mechanical supplier matching, can you share material, size/weight constraints, manufacturing process, tolerance, and environmental requirements?";
      case "Motor / Propulsion":
        return "To sharpen motor matching, can you share KV rating, thrust, voltage range, mounting pattern, and target payload class?";
      case "Flight electronics":
        return "To sharpen flight electronics matching, can you share aircraft type, interfaces, redundancy needs, firmware compatibility, and safety expectations?";
      case "Navigation / GNSS":
        return "To sharpen navigation matching, can you share required position accuracy, RTK/PPK needs, jamming/spoofing resilience, and interface?";
      case "Payload / Camera / Sensor":
        return "To sharpen payload matching, can you share resolution, frame rate, interface, stabilization, size/weight, and intended mission?";
      default:
        return "To sharpen the match, can you share the most important performance numbers, interfaces, and any non-negotiable supplier capabilities?";
    }
  }

  // ============================================================
  // MATCHING
  // ============================================================

  function buildSearchQuery() {
    const r = session.requirement;
    const subsystemForQuery = r.subsystem && /Other/i.test(r.subsystem) && r.customSubsystem
      ? r.customSubsystem
      : r.subsystem;
    const parts = [
      r.initialMessage,
      subsystemForQuery,
      r.domain,
      r.specs,
      r.interfaces,
      r.environment,
      r.integration,
      r.supplierPreference,
      r.complianceNotes,
      r.notes,
    ].filter((s) => s && String(s).trim());
    const complianceLabels = COMPLIANCE_OPTIONS
      .filter((c) => (r.complianceFlags || []).includes(c.id))
      .map((c) => c.label);
    if (complianceLabels.length) parts.push("Compliance: " + complianceLabels.join(", "));
    return parts.join("\n").slice(0, 1600);
  }

  async function runMatching() {
    session.step = "matching";
    clearChips();
    setTextareaMode({ disabled: true, placeholder: "Matching against BLNKK Taiwan supplier database…" });
    appendAssistant("Thanks. I'm matching your requirement against BLNKK's Taiwan supplier database.");
    showTyping();
    const payload = {
      search_query: buildSearchQuery(),
      limit: 12,
      country: "Taiwan",
      category: session.requirement.domain || null,
    };
    let data = null;
    let okFlag = false;
    try {
      const resp = await fetch("/api/supplier-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      hideTyping();
      okFlag = !!(json && json.ok);
      data = json && (json.data || json.matches || json.results);
    } catch (err) {
      hideTyping();
      console.error("[BLNKK CSA] supplier-match failed:", err);
    }
    session.matchOk = okFlag;
    session.matches = Array.isArray(data) ? data : [];
    renderResults();
    return goContactCta();
  }

  // Pick first truthy value from a list of field names on obj.
  function pick(obj, keys) {
    for (const k of keys) {
      if (obj && obj[k] != null && String(obj[k]).trim()) return String(obj[k]).trim();
    }
    return "";
  }

  function renderResults() {
    const matches = session.matches || [];
    if (!matches.length) {
      appendAssistant("I couldn't find a strong match for this requirement in the BLNKK Taiwan supplier database right now. BLNKK can do a manual signal review if you'd like next steps.");
      return;
    }
    const top = matches.slice(0, 8);
    const r = session.requirement;
    const complianceLabels = COMPLIANCE_OPTIONS
      .filter((c) => (r.complianceFlags || []).includes(c.id))
      .map((c) => c.label);
    const lines = top.map((s, i) => {
      // Use same field-name priority as the existing blnkk-supabase-supplier-match-v2 snippet
      const name = pick(s, ["company_name", "supplier_name", "legal_name", "name", "title"])
        || `Supplier candidate ${i + 1}`;
      const rawFit = s.fit_score ?? s.score ?? s.match_score ?? s.similarity ?? s.confidence;
      const fitNum = rawFit != null ? Number(rawFit) : null;
      const fitDisplay = fitNum != null
        ? (fitNum <= 1 ? Math.round(fitNum * 100) + "%" : Math.round(fitNum) + (fitNum > 1 && fitNum <= 100 ? "%" : ""))
        : "";
      const conf = pick(s, ["confidence_level", "confidence"])
        || (fitNum != null ? (fitNum > 0.75 || fitNum > 75 ? "High" : fitNum > 0.5 || fitNum > 50 ? "Medium" : "Reviewed") : "Reviewed");
      const category = pick(s, ["category", "primary_category", "capability", "capability_group", "sector"])
        || r.subsystem || r.domain || "";
      const country = pick(s, ["country", "region", "location", "factory_location"]) || "Taiwan";
      const why = pick(s, ["why_it_fits", "reason", "match_reason", "summary", "description"])
        || `Matched on ${r.subsystem || r.domain || "your sourcing requirement"}.`;
      const tagArr = Array.isArray(s.tags) ? s.tags
        : Array.isArray(s.signals) ? s.signals
        : Array.isArray(s.compliance_signals) ? s.compliance_signals
        : complianceLabels.slice(0, 3);
      const tagsStr = (tagArr || []).slice(0, 4).join(" · ");
      return `<li>
        <div class="blnkk-intake__result-head"><b>${escapeHtml(name)}</b>${fitDisplay ? `<span class="blnkk-intake__result-fit">Fit ${escapeHtml(fitDisplay)}</span>` : ""}</div>
        <div class="blnkk-intake__result-meta">${escapeHtml(category)}${country ? " · " + escapeHtml(country) : ""}${conf ? " · " + escapeHtml(conf) + " confidence" : ""}</div>
        <div class="blnkk-intake__result-why">${escapeHtml(why)}</div>
        ${tagsStr ? `<div class="blnkk-intake__result-tags">${escapeHtml(tagsStr)}</div>` : ""}
        <div class="blnkk-intake__result-cta">
          <button type="button" data-action="interested" data-name="${escapeHtml(name)}">Interested</button>
          <button type="button" data-action="more-info" data-name="${escapeHtml(name)}">Need more info</button>
        </div>
      </li>`;
    }).join("");
    const html = `<div class="blnkk-intake__results">
      <div class="blnkk-intake__brand">BLNKK</div>
      <div class="blnkk-intake__results-title">First-pass supplier shortlist</div>
      <p class="blnkk-intake__results-intro">Based on your requirement profile, BLNKK matched ${top.length} Taiwan supplier${top.length === 1 ? "" : "s"} that may fit.</p>
      <ol class="blnkk-intake__results-list">${lines}</ol>
      <p class="blnkk-intake__results-note">Contact details and full supplier profiles are shared only after BLNKK confirms the introduction path.</p>
    </div>`;
    appendCustomBubble(html);
    // Wire up Interested / Need more info buttons
    scrollEl.querySelectorAll(".blnkk-intake__result-cta button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const nm = btn.dataset.name;
        appendUser(action === "interested" ? `Interested in ${nm}` : `Need more info on ${nm}`);
        if (action === "interested") {
          appendAssistant(`Noted — ${nm} is queued for the confidential shortlist once you confirm next steps below.`);
        } else {
          appendAssistant(`Got it — BLNKK will include additional detail on ${nm} in the confidential review.`);
        }
      });
    });
  }

  // ============================================================
  // CONTACT FLOW
  // ============================================================

  function goContactCta() {
    session.step = "contact_cta";
    appendAssistant("Would you like BLNKK to prepare a confidential supplier shortlist or intro path for this request?");
    setTextareaMode({ disabled: true, placeholder: "Pick one above…" });
    renderChips([
      { id: "yes", label: "Yes, prepare next steps", value: "yes" },
      { id: "no", label: "Not now, just exploring", value: "no" },
    ]);
  }

  function goContactCompany() {
    session.step = "contact_company";
    appendAssistant("What's your company name?");
    clearChips();
    setTextareaMode({ placeholder: "Company name…" });
  }

  function goContactEmail() {
    session.step = "contact_email";
    appendAssistant("What's the best work email for the BLNKK follow-up?");
    clearChips();
    setTextareaMode({ placeholder: "name@company.com" });
  }

  function goContactPerson() {
    session.step = "contact_person";
    appendAssistant("Who should we address the follow-up to?");
    clearChips();
    setTextareaMode({ placeholder: "Contact person name…" });
  }

  function goContactRole() {
    session.step = "contact_role";
    appendAssistant("What's your role in this sourcing decision? (Optional)");
    setTextareaMode({ disabled: true, placeholder: "Pick a role above…" });
    renderChips(BUYER_ROLES, { skip: true });
  }

  function goContactWebsite() {
    session.step = "contact_website";
    appendAssistant("Company website? (Optional)");
    clearChips();
    appendOptionalSkipChip();
    setTextareaMode({ placeholder: "https://…" });
  }

  function goContactLinkedin() {
    session.step = "contact_linkedin";
    appendAssistant("LinkedIn profile? (Optional)");
    clearChips();
    appendOptionalSkipChip();
    setTextareaMode({ placeholder: "https://linkedin.com/in/…" });
  }

  function goContactPhone() {
    session.step = "contact_phone";
    appendAssistant("Phone number? (Optional)");
    clearChips();
    appendOptionalSkipChip();
    setTextareaMode({ placeholder: "Phone…" });
  }

  function appendOptionalSkipChip() {
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "blnkk-intake__chip blnkk-intake__chip--skip";
    skip.textContent = "Skip";
    skip.addEventListener("click", () => onSkip());
    chipsEl.appendChild(skip);
  }

  function isValidEmail(s) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  }

  async function finalizeContact() {
    // Lock the step immediately — prevents double-fire if user interacts during async fetch.
    session.step = "complete";
    clearChips();
    setTextareaMode({ disabled: true, placeholder: "Saving…" });
    appendAssistant("Thanks — saving your request and notifying BLNKK now.");
    showTyping();
    try {
      const result = await persistSession({ withContact: true });
      hideTyping();
      if (result && result.ok) {
        appendAssistant("Confirmed. BLNKK will reach out with the confidential shortlist and any NDA-gated introduction steps.");
      } else {
        appendAssistant("Saved locally — BLNKK's review queue had a transient issue. We'll retry on our side and follow up by email.");
      }
    } catch (err) {
      hideTyping();
      console.error("[BLNKK CSA] persist failed:", err);
      appendAssistant("Saved locally — BLNKK's review queue had a transient issue. We'll retry on our side and follow up by email.");
    }
    setTextareaMode({ disabled: true, placeholder: "Session complete." });
  }

  // ============================================================
  // PERSISTENCE
  // ============================================================

  function buildRequirementMarkdown() {
    const r = session.requirement;
    const c = session.contact || {};
    const complianceLabels = COMPLIANCE_OPTIONS
      .filter((x) => (r.complianceFlags || []).includes(x.id))
      .map((x) => x.label);
    const lines = [
      `# BLNKK CSA Sourcing Requirement`,
      ``,
      `**Initial Need:** ${r.initialMessage || "N/A"}`,
      `**Sourcing Stage:** ${r.sourcingStage || "N/A"}`,
      `**Requirement Type:** ${r.requirementType || "N/A"}`,
      `**Category:** ${r.category || "N/A"}`,
      `**Domain:** ${r.domain || "N/A"}`,
      `**Subsystem:** ${r.subsystem || "N/A"}${r.customSubsystem ? " (custom: " + r.customSubsystem + ")" : ""}`,
      `**Volume:** ${r.volume || "N/A"}`,
      `**Sample Quantity:** ${r.sampleQuantity || "N/A"}`,
      `**Production Forecast:** ${r.productionForecast || "N/A"}`,
      `**Timeline:** ${r.timeline || "N/A"}`,
      `**Budget:** ${r.budget || "N/A"}`,
      `**Compliance Flags:** ${complianceLabels.length ? complianceLabels.join(", ") : "N/A"}`,
      `**Compliance Notes:** ${r.complianceNotes || "N/A"}`,
      ``,
      `## Technical Specs`,
      r.specs || "N/A",
      ``,
      `## Derived Signals`,
      `- Interfaces: ${r.interfaces || "N/A"}`,
      `- Environment: ${r.environment || "N/A"}`,
      `- Integration: ${r.integration || "N/A"}`,
      `- Supplier boundary: ${r.supplierBoundary || "N/A"}`,
      `- Supplier preference: ${r.supplierPreference || "N/A"}`,
      ``,
      `## Notes`,
      r.notes || "N/A",
      ``,
      `## Match Profile`,
      `- Confidence: ${r.matchConfidence}`,
      `- Missing signals: ${(r.missingSignals || []).join(", ") || "None"}`,
    ];
    if (c.company || c.email) {
      lines.push("", "## Contact");
      if (c.company) lines.push(`- Company: ${c.company}`);
      if (c.website) lines.push(`- Website: ${c.website}`);
      if (c.contact) lines.push(`- Contact: ${c.contact}`);
      if (c.buyerRole) lines.push(`- Role: ${c.buyerRole}`);
      if (c.email) lines.push(`- Email: ${c.email}`);
      if (c.phone) lines.push(`- Phone: ${c.phone}`);
      if (c.linkedin) lines.push(`- LinkedIn: ${c.linkedin}`);
    }
    return lines.join("\n");
  }

  function buildBuyerRequirementCard() {
    return {
      source: "BLNKK_CSA_CHAT",
      collectedAt: new Date().toISOString(),
      buyerRequirement: session.requirement,
      contact: session.contact || {},
      transcript: session.transcript,
      matchOk: session.matchOk,
      matchCount: (session.matches || []).length,
    };
  }

  async function persistSession(opts) {
    opts = opts || {};
    const r = session.requirement;
    const c = session.contact || {};
    const md = buildRequirementMarkdown();
    const card = buildBuyerRequirementCard();
    const complianceLabels = COMPLIANCE_OPTIONS
      .filter((x) => (r.complianceFlags || []).includes(x.id))
      .map((x) => x.label);
    const ndaFlag = (r.complianceFlags || []).some((id) => id === "ndaa" || id === "itar" || id === "non_prc")
      ? "NDAA-aware / non-PRC requested"
      : "";
    const payload = {
      raw_message: r.initialMessage || md.slice(0, 1800),
      ai_summary: JSON.stringify(card).slice(0, 1200),
      sourcing_category: r.domain || r.category || null,
      timeline: r.timeline || null,
      nda_requirement: ndaFlag || null,
      notes: md.slice(0, 1200),
      source_page: "csa_chat_intake_v2",
      messages: session.transcript.slice(0, 30),
      consent_text: "Buyer submitted BLNKK CSA sourcing requirement via /csa chat intake. BLNKK will review and follow up only via the provided channels.",
      agreed: !!opts.withContact,
      consent_version: "csa-intake-v2",
      google_sheet_form_type: "buyer",
    };
    if (opts.withContact) {
      payload.company_name = c.company || null;
      payload.email = c.email || null;
      payload.website = c.website || null;
      payload.contact_person = c.contact || null;
      payload.phone = c.phone || null;
      payload.linkedin = c.linkedin || null;
      payload.buyer_role = c.buyerRole || null;
    }
    const resp = await fetch("/api/buyer-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return resp.json().catch(() => ({ ok: false }));
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[c]);
  }

  // ============================================================
  // BOOT
  // ============================================================

  function boot() {
    if (!mount()) {
      mountAttempts++;
      if (mountAttempts < 50) return setTimeout(boot, 100);
      console.warn("[BLNKK CSA] intake mount: <main> never appeared, skipping.");
      return;
    }
    // Welcome message
    appendAssistant(
      "Hi — I'm BLNKK CSA, your Taiwan sourcing analyst. Tell me what you're trying to source from Taiwan or a non-PRC supply chain. One sentence is fine; I'll guide you through the details.",
      { helper: "Example: We are looking for non-PRC RF data-link suppliers for UAV applications." }
    );
    session.step = "initial_need";
    clearChips();
    setTextareaMode({ placeholder: "Describe your sourcing need…" });
  }

  // Reset helper for debugging (call from browser console).
  window.__blnkkCsaIntakeReset = function () {
    const existing = document.getElementById("blnkk-csa-intake-root");
    if (existing) existing.remove();
    document.body.classList.remove("blnkk-csa-intake-on");
    delete window.__blnkkCsaIntakeV2;
    location.reload();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(boot, 250));
  } else {
    setTimeout(boot, 250);
  }
})();
