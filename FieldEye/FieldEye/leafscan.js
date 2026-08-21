(() => {
  "use strict";

  // ---------- DOM refs ----------
  const cameraInput =
    document.getElementById("cameraInput");
  const uploadInput =
    document.getElementById("uploadInput");
  const sampleBtn =
    document.getElementById("sampleBtn");
  const scanBtn =
    document.getElementById("scanBtn");
  const rescanBtn =
    document.getElementById("rescanBtn");
  const viewfinderEmpty =
    document.getElementById("viewfinderEmpty");
  const previewImg =
    document.getElementById("previewImg");
  const scanline =
    document.getElementById("scanline");
  const readout =
    document.getElementById("readout");
  const resultSection =
    document.getElementById("result");
  const resultName =
    document.getElementById("resultName");
  const resultCrop =
    document.getElementById("resultCrop");
  const resultSeverityLabel =
    document.getElementById("resultSeverityLabel");
  const resultDesc =
    document.getElementById("resultDesc");
  const confidenceFill =
    document.getElementById("confidenceFill");
  const confidenceValue =
    document.getElementById("confidenceValue");
  const treatmentSteps =
    document.getElementById("treatmentSteps");
  const settingsToggle =
    document.getElementById("settingsToggle");
  const settingsPanel =
    document.getElementById("settingsPanel");
  const settingsStatus =
    document.getElementById("settingsStatus");
  const apiKeyInput =
    document.getElementById("apiKeyInput");
  const apiKeySave =
    document.getElementById("apiKeySave");
  const modeFlag =
    document.getElementById("modeFlag");
  const creditDisplay =
    document.getElementById("creditDisplay");

  let loadedImage = null;
  let loadedDataUrl = null;

  // ---------- API key handling ----------
  const API_KEY_STORAGE =
    "leafscan_kindwise_api_key";

  function getApiKey() {
    return localStorage.getItem(API_KEY_STORAGE) || "";
  }

  function refreshModeUI() {
    const hasKey = !!getApiKey();

    settingsStatus.textContent = hasKey
      ? "API key set — using Kindwise plant.id"
      : "API key not set — running on local heuristic";

    modeFlag.textContent = hasKey
      ? "LIVE MODE — diagnoses come from the Kindwise plant.id API."
      : "NO API KEY SET — using a rough on-device color heuristic. Add your Kindwise API key above for real diagnoses.";
  }

  settingsToggle.addEventListener("click", () => {
    const expanded =
      settingsToggle.getAttribute("aria-expanded") === "true";

    settingsToggle.setAttribute(
      "aria-expanded",
      String(!expanded)
    );

    settingsPanel.hidden = expanded;
  });

  apiKeySave.addEventListener("click", () => {
    const val = apiKeyInput.value.trim();

    if (val) {
      localStorage.setItem(API_KEY_STORAGE, val);
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
    }

    apiKeyInput.value = "";
    apiKeyInput.placeholder =
      val ? "Key saved ✓" : "Paste your API key";

    refreshModeUI();
    checkCredits();
  });

  refreshModeUI();

  // ---------- Credit balance ----------
  const LOW_CREDIT_THRESHOLD = 4;

  async function checkCredits() {
    const apiKey = getApiKey();

    if (!apiKey) {
      creditDisplay.hidden = true;
      return;
    }

    try {
      const res = await fetch(
        "https://api.plant.id/v3/usage_info",
        {
          headers: {
            "Api-Key": apiKey
          }
        }
      );

      if (!res.ok) {
        creditDisplay.hidden = true;
        return;
      }

      const data = await res.json();

      const remaining =
        data.remaining_total ??
        data.remaining ??
        data.credits_remaining ??
        data.balance ??
        (
          data.total_limit != null &&
          data.used_total != null
            ? data.total_limit - data.used_total
            : null
        );

      if (remaining == null) {
        creditDisplay.hidden = true;
        return;
      }

      creditDisplay.hidden = false;

      creditDisplay.textContent =
        `${remaining} credits remaining (~${Math.floor(
          remaining / 2
        )} scans)`;

      creditDisplay.classList.toggle(
        "is-low",
        remaining < LOW_CREDIT_THRESHOLD
      );
    } catch {
      creditDisplay.hidden = true;
    }
  }

  checkCredits();

  // ---------- Disease knowledge base ----------
  const PROFILES = {
    healthy: {
      name: "Healthy Leaf",
      severity: "NONE",
      desc:
        "No signs of disease detected. Leaf color and texture look consistent with a healthy plant.",
      steps: [
        "No treatment needed.",
        "Recheck this plant again in 7–10 days.",
        "Keep an eye on neighboring plants for early spotting or discoloration."
      ]
    },

    blight: {
      name: "Leaf Blight",
      severity: "MODERATE",
      desc:
        "Irregular brown-to-yellow patches suggest early to moderate leaf blight, often fungal, and it spreads fastest in humid, low-airflow conditions.",
      steps: [
        "Remove and destroy visibly affected leaves to slow spread.",
        "Improve airflow around the plant — space out crowded foliage.",
        "Apply a copper-based fungicide, following local dosage guidance.",
        "Avoid overhead watering; water at the base instead."
      ]
    },

    rust: {
      name: "Leaf Rust",
      severity: "MODERATE",
      desc:
        "Orange-brown pustules typical of rust fungus were detected, most active in warm, moist weather.",
      steps: [
        "Remove heavily rusted leaves and dispose of them away from the field.",
        "Apply a sulfur-based or recommended fungicide at first sign of spread.",
        "Rotate crops next season if rust recurs in the same plot.",
        "Monitor weekly — rust spreads quickly under warm, humid conditions."
      ]
    },

    mildew: {
      name: "Powdery Mildew",
      severity: "LOW",
      desc:
        "A pale, powder-like coating was detected on the leaf surface, characteristic of powdery mildew in its early stage.",
      steps: [
        "Increase sunlight exposure and spacing between plants.",
        "Spray a diluted milk or baking-soda solution as a low-cost early treatment.",
        "Trim affected leaves if coating covers more than a third of the surface.",
        "Recheck in 5 days — mildew spreads fast if untreated."
      ]
    },

    bacterial: {
      name: "Bacterial Leaf Spot",
      severity: "HIGH",
      desc:
        "Small, dark, water-soaked spots with a defined border point to bacterial infection, which can spread quickly to nearby plants.",
      steps: [
        "Isolate or remove severely infected plants to protect the rest of the field.",
        "Avoid working in the field while leaves are wet — this spreads bacteria.",
        "Apply a copper-based bactericide as a preventive measure on nearby plants.",
        "Disinfect tools between plants during pruning."
      ]
    }
  };

  // ---------- Image loading ----------
  function showImage(src) {
    previewImg.src = src;
    previewImg.hidden = false;
    viewfinderEmpty.hidden = true;
    scanBtn.disabled = false;
    resultSection.hidden = true;
    loadedDataUrl = src;

    const img = new Image();

    img.onload = () => {
      loadedImage = img;
    };

    img.src = src;
  }

  function handleFileInput(evt) {
    const file =
      evt.target.files && evt.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) =>
      showImage(e.target.result);

    reader.readAsDataURL(file);
  }

  cameraInput.addEventListener(
    "change",
    handleFileInput
  );

  uploadInput.addEventListener(
    "change",
    handleFileInput
  );

  // ---------- Synthetic sample leaves ----------
  const SAMPLE_KINDS = [
    "healthy",
    "blight",
    "rust"
  ];

  let sampleIndex = 0;

  function drawSampleLeaf(kind) {
    const canvas =
      document.createElement("canvas");

    canvas.width = 400;
    canvas.height = 300;

    const ctx =
      canvas.getContext("2d");

    const bg = {
      healthy: "#274d1f",
      blight: "#3c3418",
      rust: "#4a2c14"
    }[kind];

    ctx.fillStyle = bg;

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    // leaf blade
    ctx.fillStyle = {
      healthy: "#5c8a49",
      blight: "#8a7a3a",
      rust: "#a05a2c"
    }[kind];

    ctx.beginPath();

    ctx.ellipse(
      200,
      150,
      140,
      95,
      0,
      0,
      Math.PI * 2
    );

    ctx.fill();

    // vein
    ctx.strokeStyle =
      "rgba(0,0,0,0.25)";

    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(65, 150);
    ctx.lineTo(335, 150);
    ctx.stroke();

    // disease spots
    const spotColor = {
      healthy: null,
      blight: "#6b5320",
      rust: "#c46a2e"
    }[kind];

    const spotCount = {
      healthy: 0,
      blight: 14,
      rust: 22
    }[kind];

    if (spotColor) {
      ctx.fillStyle = spotColor;

      for (
        let i = 0;
        i < spotCount;
        i++
      ) {
        const x =
          90 + Math.random() * 220;

        const y =
          90 + Math.random() * 120;

        const r =
          4 + Math.random() * 9;

        ctx.beginPath();

        ctx.arc(
          x,
          y,
          r,
          0,
          Math.PI * 2
        );

        ctx.fill();
      }
    }

    return canvas.toDataURL(
      "image/png"
    );
  }

  sampleBtn.addEventListener(
    "click",
    () => {
      const kind =
        SAMPLE_KINDS[
          sampleIndex %
          SAMPLE_KINDS.length
        ];

      sampleIndex++;

      showImage(
        drawSampleLeaf(kind)
      );
    }
  );

  // ---------- Heuristic classification ----------
  function analyzeImage(img) {
    const canvas =
      document.createElement("canvas");

    const w =
      (canvas.width = 100);

    const h =
      (canvas.height = 75);

    const ctx =
      canvas.getContext("2d");

    ctx.drawImage(
      img,
      0,
      0,
      w,
      h
    );

    const { data } =
      ctx.getImageData(
        0,
        0,
        w,
        h
      );

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;

    let darkSpots = 0;
    let paleSpots = 0;

    const n = w * h;

    for (
      let i = 0;
      i < data.length;
      i += 4
    ) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      rSum += r;
      gSum += g;
      bSum += b;

      const lum =
        (r + g + b) / 3;

      if (lum < 60)
        darkSpots++;

      if (
        lum > 200 &&
        Math.abs(r - g) < 15 &&
        Math.abs(g - b) < 15
      ) {
        paleSpots++;
      }
    }

    const rAvg = rSum / n;
    const gAvg = gSum / n;
    const bAvg = bSum / n;

    const darkRatio =
      darkSpots / n;

    const paleRatio =
      paleSpots / n;

    let key = "healthy";

    if (paleRatio > 0.12) {
      key = "mildew";
    } else if (darkRatio > 0.1) {
      key = "bacterial";
    } else if (
      rAvg > gAvg * 1.15 &&
      rAvg > bAvg * 1.3
    ) {
      key = "rust";
    } else if (
      rAvg > gAvg * 0.95 &&
      gAvg < 140
    ) {
      key = "blight";
    } else if (
      gAvg > rAvg * 1.05 &&
      gAvg > bAvg * 1.05
    ) {
      key = "healthy";
    } else {
      key = "blight";
    }

    const spread =
      Math.abs(gAvg - rAvg) +
      Math.abs(rAvg - bAvg);

    const confidence =
      Math.min(
        96,
        Math.max(
          58,
          Math.round(62 + spread / 3)
        )
      );

    return {
      key,
      confidence
    };
  }

  // ---------- Real diagnosis via Kindwise plant.id API ----------
  const PLANT_ID_ENDPOINT =
    "https://api.plant.id/v3/identification";

  const DETAIL_FIELDS =
    "common_names,description,severity,treatment,symptoms,url";

  async function diagnoseWithApi(
    dataUrl,
    apiKey
  ) {
    const url =
      `${PLANT_ID_ENDPOINT}?details=${encodeURIComponent(
        DETAIL_FIELDS
      )}`;

    const res =
      await fetch(url, {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",
          "Api-Key": apiKey
        },

        body: JSON.stringify({
          images: [dataUrl],
          health: "all",
          similar_images: true
        })
      });

    if (!res.ok) {
      const text =
        await res
          .text()
          .catch(() => "");

      throw new Error(
        `Kindwise API error ${res.status}: ${
          text || res.statusText
        }`
      );
    }

    const data =
      await res.json();

    return mapApiResult(data);
  }

  function mapApiResult(data) {
    const result =
      data.result || {};

    const isPlant =
      !result.is_plant ||
      result.is_plant.binary !== false;

    const classification =
      (
        result.classification &&
        result.classification.suggestions
      ) || [];

    const topClassification =
      classification.length
        ? classification[0]
        : null;

    const scientificName =
      topClassification
        ? topClassification.name
        : "";

    const commonNames =
      (
        topClassification &&
        topClassification.details &&
        topClassification.details.common_names
      ) || [];

    const cropName =
      commonNames.length
        ? `${commonNames[0]}${
            scientificName
              ? ` (${scientificName})`
              : ""
          }`
        : scientificName;

    if (!isPlant) {
      return {
        cropName: "",
        name: "Not a plant",
        severity: "N/A",
        confidence:
          Math.round(
            (
              (result.is_plant &&
                result.is_plant.probability) ||
              0
            ) * 100
          ),

        desc:
          "The photo doesn't look like it contains a plant. Try a clearer, closer shot of the leaf.",

        steps: [
          "Retake the photo with the leaf filling more of the frame."
        ]
      };
    }

    const isHealthy =
      result.is_healthy &&
      result.is_healthy.binary;

    const suggestions =
      (result.disease &&
        result.disease.suggestions) ||
      [];

    if (
      isHealthy ||
      suggestions.length === 0
    ) {
      return {
        cropName,
        name: "Healthy Plant",
        severity: "NONE",

        confidence:
          Math.round(
            (
              (result.is_healthy &&
                result.is_healthy.probability) ||
              0.9
            ) * 100
          ),

        desc:
          "No disease or pest detected with meaningful confidence.",

        steps: [
          "No treatment needed.",
          "Recheck in 7–10 days."
        ]
      };
    }

    const top =
      suggestions[0];

    const details =
      top.details || {};

    const treatment =
      details.treatment;

    let steps = [];

    if (Array.isArray(treatment)) {
      steps = treatment;
    } else if (
      typeof treatment === "string" &&
      treatment.trim()
    ) {
      steps = [treatment];
    } else if (
      treatment &&
      typeof treatment === "object"
    ) {
      steps = []
        .concat(
          treatment.biological || []
        )
        .concat(
          treatment.chemical || []
        )
        .concat(
          treatment.prevention || []
        );
    }

    return {
      cropName,
      name:
        top.name ||
        "Unknown issue",

      severity:
        (
          details.severity ||
          "UNKNOWN"
        )
          .toString()
          .toUpperCase(),

      confidence:
        Math.round(
          (top.probability || 0) * 100
        ),

      desc:
        details.description ||
        details.symptoms ||
        "See details in your Kindwise dashboard for this class.",

      steps:
        steps.length
          ? steps
          : [
              "Refer to the Kindwise result details for treatment guidance."
            ]
    };
  }

  // ---------- Scan flow ----------
  async function runScan() {
    if (!loadedImage) return;

    scanBtn.disabled = true;
    scanline.hidden = false;
    readout.hidden = false;
    resultSection.hidden = true;

    const apiKey =
      getApiKey();

    try {
      let outcome;

      if (apiKey) {
        readout.textContent =
          "CONTACTING PLANT.ID…";

        try {
          outcome =
            await diagnoseWithApi(
              loadedDataUrl,
              apiKey
            );

          checkCredits();
        } catch (err) {
          const isNetworkFailure =
            err instanceof TypeError ||
            !navigator.onLine;

          if (!isNetworkFailure)
            throw err;

          await new Promise(
            (r) =>
              setTimeout(r, 800)
          );

          const {
            key,
            confidence
          } =
            analyzeImage(
              loadedImage
            );

          const profile =
            PROFILES[key];

          outcome = {
            ...profile,
            confidence,
            offline: true
          };
        }
      } else {
        await new Promise(
          (r) =>
            setTimeout(r, 1200)
        );

        const {
          key,
          confidence
        } =
          analyzeImage(
            loadedImage
          );

        const profile =
          PROFILES[key];

        outcome = {
          ...profile,
          confidence
        };
      }

      renderResult(outcome);
    } catch (err) {
      renderError(
        err.message ||
          "Something went wrong reaching the diagnosis service."
      );
    } finally {
      scanline.hidden = true;
      readout.hidden = true;
      readout.textContent =
        "ANALYZING…";

      scanBtn.disabled = false;
    }
  }

  function renderResult(profile) {
    if (profile.offline) {
      resultCrop.hidden = false;

      resultCrop.textContent =
        "OFFLINE — showing an on-device estimate, not a verified diagnosis";

      resultCrop.classList.add(
        "is-offline"
      );
    } else {
      resultCrop.hidden = false;

      resultCrop.classList.remove(
        "is-offline"
      );

      resultCrop.textContent =
        profile.cropName
          ? profile.cropName.toUpperCase()
          : "CROP NOT IDENTIFIED — try a wider shot showing the whole leaf";
    }

    resultSeverityLabel.textContent =
      `SEVERITY — ${profile.severity}`;

    resultName.textContent =
      profile.name;

    resultDesc.textContent =
      profile.desc;

    confidenceValue.textContent =
      `${profile.confidence}%`;

    confidenceFill.style.width =
      "0%";

    treatmentSteps.innerHTML =
      "";

    profile.steps.forEach(
      (step) => {
        const li =
          document.createElement(
            "li"
          );

        li.textContent = step;

        treatmentSteps.appendChild(
          li
        );
      }
    );

    resultSection.hidden =
      false;

    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

    requestAnimationFrame(
      () => {
        confidenceFill.style.width =
          `${profile.confidence}%`;
      }
    );
  }

  function renderError(message) {
    resultSeverityLabel.textContent =
      "ERROR";

    resultName.textContent =
      "Couldn't complete diagnosis";

    resultDesc.textContent =
      message;

    confidenceValue.textContent =
      "—";

    confidenceFill.style.width =
      "0%";

    treatmentSteps.innerHTML =
      "";

    const li =
      document.createElement(
        "li"
      );

    li.textContent =
      "Check your API key and connection, then try scanning again.";

    treatmentSteps.appendChild(
      li
    );

    resultSection.hidden =
      false;

    resultSection.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  scanBtn.addEventListener(
    "click",
    runScan
  );

  rescanBtn.addEventListener(
    "click",
    () => {
      resultSection.hidden = true;
      previewImg.hidden = true;
      viewfinderEmpty.hidden = false;
      scanBtn.disabled = true;
      loadedImage = null;

      cameraInput.value = "";
      uploadInput.value = "";

      document
        .getElementById("scanner")
        .scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  );
})();