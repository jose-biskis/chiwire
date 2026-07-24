/* global THREE, gsap */
(() => {
  const slug = window.__PRACTICE_SLUG__;
  const renderMode = window.__PRACTICE_MODE__ === "glb" ? "glb" : "procedural";
  const debugMode =
    window.__PRACTICE_DEBUG__ === true ||
    new URLSearchParams(window.location.search).get("debug") === "1";
  const toastEl = document.getElementById("toast");
  const stepListEl = document.getElementById("step-list");
  const recipeNameEl = document.getElementById("recipe-name");
  const scoreTextEl = document.getElementById("score-text");
  const controlHintEl = document.getElementById("control-hint");
  const loadingEl = document.getElementById("loading");
  const debugPanelEl = document.getElementById("debug-panel");
  const gltfLoader = typeof THREE.GLTFLoader === "function" ? new THREE.GLTFLoader() : null;

  let practice = null;
  let currentStepIndex = 0;
  let score = 0;
  let selectedToolSlug = "hand";
  let stationCompromised = false;
  let vesselState = {
    "mixing-glass": { liquids: [], ice: 0, liquidMl: 0, stirred: false, overflow: false },
    "rocks-glass": { liquids: [], ice: 0, liquidMl: 0, strainedIn: false, overflow: false }
  };
  /** Counts for generic `place` steps: `${vessel}:${asset}` → count */
  let placeCounts = {};
  /** Visual pieces left in vessels after a successful `place` (ice cubes, etc.) */
  let depositedPieces = [];
  /** Liquid fill meshes keyed by vessel slug */
  let liquidMeshes = {};
  /** Spill puddles / fallen ice on the bar */
  let spillMeshes = [];

  const BOTTLE_LIQUID = {
    "gin-bottle": 0x7dd3fc,
    "campari-bottle": 0xdc2626,
    "vermouth-bottle": 0x92400e
  };
  const SPIRIT_BOTTLES = new Set(["gin-bottle", "campari-bottle", "vermouth-bottle"]);
  const VESSEL_CAPACITY = {
    "mixing-glass": { ice: 5, liquidMl: 120 },
    "rocks-glass": { ice: 4, liquidMl: 90 }
  };
  const JIGGER_SIDES = {
    short: { ml: 30, label: "30 ml" },
    long: { ml: 45, label: "45 ml" }
  };
  const TOOL_SLUGS = new Set(["barspoon", "jigger", "strainer", "shaker"]);
  const TECHNIQUE_TOOLS = new Set(["barspoon", "strainer", "shaker"]);

  let jiggerState = {
    side: "short",
    filledMl: 0,
    bottleSlug: null
  };

  const failBannerEl = document.getElementById("fail-banner");
  const failReasonEl = document.getElementById("fail-reason");
  const resetBtnEl = document.getElementById("reset-btn");
  const jiggerSideBarEl = document.getElementById("jigger-side-bar");

  const sceneObjects = [];
  let objectBySlug = {};
  let selectedObject = null;
  let originalY = 0;
  let targetRing = null;
  let targetRingPulse = 0;
  const debugHelpers = [];
  let lastDebugDrop = null;

  function showToast(message, ok) {
    toastEl.textContent = message;
    toastEl.className = ok ? "ok" : "bad";
    setTimeout(() => {
      toastEl.className = "";
      toastEl.style.display = "none";
      toastEl.removeAttribute("style");
    }, 2200);
  }

  function currentStep() {
    if (!practice?.steps) return null;
    return practice.steps[currentStepIndex] || null;
  }

  function renderSteps() {
    if (!practice?.steps) return;
    stepListEl.innerHTML = "";
    practice.steps.forEach((step, idx) => {
      const li = document.createElement("li");
      if (idx < currentStepIndex) li.className = "done";
      if (idx === currentStepIndex) li.className = "current";
      li.innerHTML = `<span>${idx < currentStepIndex ? "✓" : idx + 1}.</span><span>${step.title}</span>`;
      stepListEl.appendChild(li);
    });
  }

  function failStep(message) {
    showToast(message || currentStep()?.failure_message || "Wrong move.", false);
    score = Math.max(0, score - 25);
    scoreTextEl.textContent = String(score);
  }

  function markCompromised(reason) {
    stationCompromised = true;
    failStep(reason);
    if (failReasonEl) failReasonEl.textContent = reason;
    if (failBannerEl) failBannerEl.classList.add("visible");
    if (resetBtnEl) resetBtnEl.classList.add("pulse-reset");
    controlHintEl.textContent = "Station compromised — Reset to retry, or keep going for a messy pour.";
  }

  function clearCompromised() {
    stationCompromised = false;
    if (failBannerEl) failBannerEl.classList.remove("visible");
    if (resetBtnEl) resetBtnEl.classList.remove("pulse-reset");
  }

  function succeedStep(message) {
    showToast(message || currentStep()?.success_message || "Good.", true);
    score += 100;
    scoreTextEl.textContent = String(score);
    currentStepIndex += 1;
    renderSteps();
    if (currentStepIndex >= practice.steps.length) {
      controlHintEl.textContent = "Practice complete. Reset to try again.";
      showToast("Negroni nailed. Process complete.", true);
      updateTargetHighlight();
    } else {
      refreshControlHint();
    }
  }

  function assetName(slug) {
    return practice?.assets?.find((a) => a.slug === slug)?.name || slug;
  }

  function refreshControlHint() {
    const step = currentStep();
    if (!step) {
      updateTargetHighlight();
      updateDebugPanel();
      return;
    }
    const action = practice.actions.find((a) => a.slug === step.action_slug);
    const targetName = step.target_vessel_slug ? assetName(step.target_vessel_slug) : null;
    const actionSlug = normalizeActionSlug(step.action_slug);
    let hint = action?.ui_hint || step.title;
    if (actionSlug === "place" && targetName) {
      const what = (step.required_asset_slugs || []).map(assetName).join(" / ");
      const ideal = Number(step.params?.idealCount || step.params?.minCount || 1);
      const max = Number(step.params?.maxCount || ideal + 2);
      hint = `Drag ${what} onto the ${targetName}. Aim for ~${ideal} (glass holds ${max} before overflow).`;
    } else if (actionSlug === "pour" && targetName) {
      hint = `Pick a jigger cup (30 or 45 ml), fill from the bottle, then pour the jigger into the ${targetName}.`;
    } else if (actionSlug === "stir") {
      hint = `Drag the barspoon into the ${targetName || "Mixing glass"} to stir.`;
    } else if (actionSlug === "strain") {
      hint = `Drag the strainer onto the Mixing glass to pour into the Rocks glass.`;
    }
    controlHintEl.textContent = hint;
    updateTargetHighlight();
    updateDebugPanel();
  }

  function updateDebugPanel() {
    if (!debugMode || !debugPanelEl) return;
    const step = currentStep();
    const lines = [
      `debug=1 · colliders + drop zones`,
      `step: ${step ? `${step.step_order || currentStepIndex + 1} ${step.action_slug}` : "(done)"}`,
      step?.target_vessel_slug ? `target: ${step.target_vessel_slug}` : null,
      step?.required_asset_slugs?.length ? `need: ${step.required_asset_slugs.join(",")}` : null,
      lastDebugDrop
        ? `last drop: ${lastDebugDrop.slug} → ${lastDebugDrop.target || "?"} dist=${lastDebugDrop.dist} need<${lastDebugDrop.threshold} ${lastDebugDrop.ok ? "OK" : "MISS"}`
        : "last drop: —"
    ].filter(Boolean);
    debugPanelEl.textContent = lines.join("\n");
  }

  function updateTargetHighlight() {
    if (!targetRing) {
      targetRing = new THREE.Mesh(
        new THREE.RingGeometry(0.22, 0.32, 48),
        new THREE.MeshBasicMaterial({
          color: 0xd01059,
          transparent: true,
          opacity: 0.85,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      targetRing.rotation.x = -Math.PI / 2;
      targetRing.position.y = 0.04;
      targetRing.visible = false;
      scene.add(targetRing);
    }

    const step = currentStep();
    const vesselSlug = step?.target_vessel_slug;
    const vessel = vesselSlug ? objectBySlug[vesselSlug] : null;
    if (!vessel) {
      targetRing.visible = false;
      return;
    }
    targetRing.visible = true;
    targetRing.position.x = vessel.position.x;
    targetRing.position.z = vessel.position.z;
    const radius = Math.max(Number(vessel.userData?.collider?.radius) || 0.2, 0.18);
    targetRing.geometry.dispose();
    targetRing.geometry = new THREE.RingGeometry(radius + 0.04, radius + 0.14, 48);
  }

  function normalizeActionSlug(actionSlug) {
    if (actionSlug === "add-ice" || actionSlug === "garnish") return "place";
    return actionSlug;
  }

  function ensureStep(actionSlug, extraCheck) {
    const step = currentStep();
    if (!step) {
      showToast("Already finished. Reset to practice again.", false);
      return false;
    }
    if (normalizeActionSlug(step.action_slug) !== normalizeActionSlug(actionSlug)) {
      failStep(step.failure_message || `Current step needs "${step.action_slug}", not "${actionSlug}".`);
      return false;
    }
    if (typeof extraCheck === "function") {
      const result = extraCheck(step);
      if (result !== true) {
        failStep(typeof result === "string" ? result : step.failure_message);
        return false;
      }
    }
    succeedStep(step.success_message);
    return true;
  }

  // --- Audio ---
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playClack() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  }
  function playStir() {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.4);
  }

  // --- Procedural builders ---
  function toColor(value, fallback) {
    try {
      return new THREE.Color(value ?? fallback);
    } catch {
      return new THREE.Color(fallback);
    }
  }

  function makeBottleBadge(text, bgHex, fgHex) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgHex;
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = fgHex;
    ctx.font = "bold 44px Figtree, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(text || "").toUpperCase(), 128, 64);
    const texture = new THREE.CanvasTexture(canvas);
    const badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.1),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    );
    badge.position.set(0, 0.24, 0.132);
    return badge;
  }

  function bottle(liquidHex, labelBg, labelText, fgHex) {
    const g = new THREE.Group();
    // Clear glass shell so the liquid color reads clearly.
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.135, 0.44, 22, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        transparent: true,
        opacity: 0.22,
        roughness: 0.08,
        metalness: 0.05,
        side: THREE.DoubleSide
      })
    );
    shell.position.y = 0.22;
    shell.castShadow = true;
    g.add(shell);

    const liquid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.118, 0.36, 22),
      new THREE.MeshStandardMaterial({
        color: toColor(liquidHex, "#7dd3fc"),
        roughness: 0.28,
        metalness: 0.05,
        transparent: true,
        opacity: 0.95
      })
    );
    liquid.position.y = 0.2;
    liquid.castShadow = true;
    g.add(liquid);

    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, transparent: true, opacity: 0.45 })
    );
    neck.position.y = 0.5;
    g.add(neck);

    const cork = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    cork.position.y = 0.58;
    g.add(cork);

    g.add(makeBottleBadge(labelText, labelBg, fgHex || "#111827"));
    return g;
  }

  function glass(radius, height, color) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 0.9, height, 28, 1, true),
      new THREE.MeshStandardMaterial({
        color: color || 0xe2e8f0,
        transparent: true,
        opacity: 0.35,
        roughness: 0.1,
        metalness: 0.1,
        side: THREE.DoubleSide
      })
    );
    mesh.position.y = height / 2;
    mesh.castShadow = true;
    g.add(mesh);
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.9, radius * 0.9, 0.02, 28),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.5 })
    );
    base.position.y = 0.01;
    g.add(base);
    g.userData.vesselRadius = radius;
    g.userData.vesselHeight = height;
    return g;
  }

  function builders(key, meta) {
    const m = meta || {};
    switch (key) {
      case "bottle_gin":
        return bottle(m.liquidColor || "#7dd3fc", "#e0f2fe", m.label || "GIN", "#0c4a6e");
      case "bottle_campari":
        return bottle(m.liquidColor || "#dc2626", "#fee2e2", m.label || "CAMPARI", "#7f1d1d");
      case "bottle_vermouth":
        return bottle(m.liquidColor || "#92400e", "#fef3c7", m.label || "VERMOUTH", "#451a03");
      case "ice_cubes": {
        const g = new THREE.Group();
        for (let i = 0; i < 5; i += 1) {
          const cube = new THREE.Mesh(
            new THREE.BoxGeometry(0.1, 0.1, 0.1),
            new THREE.MeshStandardMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.75, roughness: 0.15 })
          );
          cube.position.set((i % 3) * 0.12 - 0.12, 0.06 + Math.floor(i / 3) * 0.1, (i % 2) * 0.1 - 0.05);
          cube.rotation.y = i * 0.3;
          cube.castShadow = true;
          g.add(cube);
        }
        return g;
      }
      case "orange_peel": {
        const g = new THREE.Group();
        const peel = new THREE.Mesh(
          new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI * 1.2),
          new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 })
        );
        peel.rotation.x = Math.PI / 2;
        peel.position.y = 0.03;
        peel.castShadow = true;
        g.add(peel);
        return g;
      }
      case "mixing_glass":
        return glass(0.2, 0.38, 0xb8d4e8);
      case "rocks_glass":
        return glass(0.16, 0.2, 0xe8e0d4);
      case "barspoon": {
        // Vertical spoon (Y-up) so stir orbits read as bartending, not a spinning rod.
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.009, 0.42, 10),
          new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.92, roughness: 0.22 })
        );
        shaft.position.y = 0.27;
        shaft.castShadow = true;
        const tip = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 12, 10),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 })
        );
        tip.position.y = 0.045;
        tip.castShadow = true;
        const handle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.01, 0.06, 10),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 })
        );
        handle.position.y = 0.5;
        g.add(shaft, tip, handle);
        return g;
      }
      case "jigger": {
        // Double-sided jigger: short cup up (30 ml), long cup down (45 ml).
        const g = new THREE.Group();
        const shortCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.035, 0.09, 14, 1, true),
          new THREE.MeshStandardMaterial({
            color: 0xd01059,
            metalness: 0.75,
            roughness: 0.28,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
          })
        );
        shortCup.position.y = 0.14;
        const longCup = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.04, 0.12, 14, 1, true),
          new THREE.MeshStandardMaterial({
            color: 0x9e2c58,
            metalness: 0.75,
            roughness: 0.28,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
          })
        );
        longCup.position.y = 0.04;
        const waist = new THREE.Mesh(
          new THREE.CylinderGeometry(0.02, 0.02, 0.03, 10),
          new THREE.MeshStandardMaterial({ color: 0x6b3349, metalness: 0.85, roughness: 0.25 })
        );
        waist.position.y = 0.095;
        const fill = new THREE.Mesh(
          new THREE.CylinderGeometry(0.032, 0.028, 1, 12),
          new THREE.MeshStandardMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0,
            roughness: 0.25
          })
        );
        fill.position.y = 0.14;
        fill.scale.y = 0.01;
        fill.userData.isJiggerFill = true;
        g.add(longCup, waist, shortCup, fill);
        g.userData.jiggerFill = fill;
        return g;
      }
      case "strainer": {
        const g = new THREE.Group();
        const disc = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, 0.03, 20),
          new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85, roughness: 0.3 })
        );
        disc.position.y = 0.03;
        g.add(disc);
        return g;
      }
      case "shaker": {
        const g = new THREE.Group();
        const tin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.13, 0.36, 20),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.95, roughness: 0.2 })
        );
        tin.position.y = 0.18;
        tin.castShadow = true;
        g.add(tin);
        return g;
      }
      default: {
        const fallback = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.2, 0.2),
          new THREE.MeshStandardMaterial({ color: 0x78716c })
        );
        fallback.position.y = 0.1;
        return fallback;
      }
    }
  }

  // --- Three.js scene ---
  const container = document.getElementById("canvas-container");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x332d2f);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 4.8, 7.5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2 - 0.05;
  controls.minDistance = 3;
  controls.maxDistance = 14;

  scene.add(new THREE.AmbientLight(0xf5e6eb, 0.42));
  const spot = new THREE.SpotLight(0xffd6e4, 1.55);
  spot.position.set(0, 7, 1);
  spot.castShadow = true;
  spot.angle = Math.PI / 3;
  spot.penumbra = 0.75;
  scene.add(spot);
  const fill = new THREE.DirectionalLight(0x9e2c58, 0.28);
  fill.position.set(-4, 3, -2);
  scene.add(fill);

  // Bar body + tabletop follow brand palette (--palette-3/4/5 equivalents).
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.7, 5.5),
    new THREE.MeshStandardMaterial({ color: 0x38262d, roughness: 0.55, metalness: 0.15 })
  );
  bar.position.y = -0.35;
  bar.receiveShadow = true;
  scene.add(bar);

  const wood = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.06, 5),
    new THREE.MeshStandardMaterial({ color: 0x6b3349, roughness: 0.72, metalness: 0.08 })
  );
  wood.position.y = 0.02;
  wood.receiveShadow = true;
  scene.add(wood);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshStandardMaterial({ color: 0x332d2f, roughness: 0.92 })
  );
  wall.position.set(0, 3.5, -2.7);
  scene.add(wall);

  /** Neon script text only — no circular logo plate. */
  function addNeonLogoSign() {
    const draw = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1400;
      canvas.height = 420;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Soft pink glow behind letterforms (tube bloom), not a filled disc.
      ctx.save();
      ctx.font = '220px "Great Vibes", "Segoe Script", cursive';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#D01059";
      ctx.shadowBlur = 48;
      ctx.fillText("Valen's Tonic", canvas.width / 2, canvas.height / 2 + 10);
      ctx.shadowBlur = 18;
      ctx.fillText("Valen's Tonic", canvas.width / 2, canvas.height / 2 + 10);
      ctx.shadowBlur = 0;
      ctx.fillText("Valen's Tonic", canvas.width / 2, canvas.height / 2 + 10);

      // Tiny leaf accents above the T (logo detail, still text-only sign).
      const leafX = canvas.width / 2 + 118;
      const leafY = canvas.height / 2 - 78;
      ctx.translate(leafX, leafY);
      ctx.rotate(-0.35);
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(14, -4, 8, 18, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const texture = new THREE.CanvasTexture(canvas);
      if ("encoding" in texture && THREE.sRGBEncoding !== undefined) {
        texture.encoding = THREE.sRGBEncoding;
      }
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.needsUpdate = true;

      const signW = 3.4;
      const signH = signW * (canvas.height / canvas.width);
      const signY = 2.55;
      const signZ = -2.655;

      const material = new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        alphaTest: 0.05,
        roughness: 0.35,
        metalness: 0.05,
        emissive: new THREE.Color(0xd01059),
        emissiveMap: texture,
        emissiveIntensity: 1.05,
        side: THREE.FrontSide,
        depthWrite: false
      });
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(signW, signH), material);
      sign.position.set(0, signY, signZ);
      scene.add(sign);

      // Diffuse neon cast — no circular backing plate.
      const neonLight = new THREE.PointLight(0xd01059, 1.35, 8, 2);
      neonLight.position.set(0, signY, -2.2);
      scene.add(neonLight);

      if (typeof gsap !== "undefined") {
        gsap.to(material, {
          emissiveIntensity: 1.35,
          duration: 2.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut"
        });
        gsap.to(neonLight, {
          intensity: 1.85,
          duration: 2.4,
          yoyo: true,
          repeat: -1,
          ease: "sine.inOut"
        });
      }
    };

    if (document.fonts?.load) {
      document.fonts
        .load('220px "Great Vibes"')
        .then(() => draw())
        .catch(() => draw());
    } else {
      setTimeout(draw, 120);
    }
  }
  addNeonLogoSign();

  const guidePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  guidePlane.rotation.x = -Math.PI / 2;
  guidePlane.position.y = 0.55;
  scene.add(guidePlane);

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function colliderGeometry(collider) {
    if (collider.type === "cylinder") {
      const r = Math.max(Number(collider.radius) || 0.12, 0.05);
      const h = Math.max(Number(collider.height) || 0.2, 0.05);
      return new THREE.CylinderGeometry(r, r, h, 16);
    }
    if (collider.type === "sphere") {
      return new THREE.SphereGeometry(Math.max(Number(collider.radius) || 0.2, 0.05), 12, 12);
    }
    const w = Math.max(Number(collider.width) || 0.25, 0.05);
    const h = Math.max(Number(collider.height) || 0.2, 0.05);
    const d = Math.max(Number(collider.depth) || 0.25, 0.05);
    return new THREE.BoxGeometry(w, h, d);
  }

  function clearDebugHelpers() {
    while (debugHelpers.length) {
      const helper = debugHelpers.pop();
      if (helper.parent) helper.parent.remove(helper);
      if (helper.geometry) helper.geometry.dispose();
      if (helper.material) helper.material.dispose();
    }
  }

  function addDebugHelper(mesh) {
    debugHelpers.push(mesh);
    return mesh;
  }

  function attachAssetUserData(mesh, asset) {
    const vesselRadius = mesh.userData.vesselRadius || Number(asset.collider?.radius) || null;
    const vesselHeight = mesh.userData.vesselHeight || Number(asset.collider?.height) || null;
    const jiggerFill = mesh.userData.jiggerFill || null;
    mesh.position.set(asset.spawn.x || 0, asset.spawn.y || 0.05, asset.spawn.z || 0);
    if (asset.spawn.rotY) mesh.rotation.y = asset.spawn.rotY;
    mesh.userData = {
      slug: asset.slug,
      kind: asset.kind,
      spawnX: asset.spawn.x || 0,
      spawnY: asset.spawn.y || 0.05,
      spawnZ: asset.spawn.z || 0,
      collider: asset.collider || {},
      draggable: asset.kind !== "vessel",
      renderMode,
      vesselRadius,
      vesselHeight,
      jiggerFill
    };
    mesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // Help raycasts find the root even on nested GLB meshes.
        child.userData.dragRootSlug = asset.slug;
      }
    });

    const collider = asset.collider || {};

    // Invisible larger hit volume so small items (ice, peel, spoon) are easy to grab.
    if (mesh.userData.draggable) {
      let hitGeo;
      if (collider.type === "cylinder") {
        const r = Math.max(Number(collider.radius) || 0.12, 0.18);
        const h = Math.max(Number(collider.height) || 0.2, 0.25);
        hitGeo = new THREE.CylinderGeometry(r, r, h, 16);
      } else if (collider.type === "sphere") {
        hitGeo = new THREE.SphereGeometry(Math.max(Number(collider.radius) || 0.2, 0.22), 12, 12);
      } else {
        const w = Math.max(Number(collider.width) || 0.25, 0.35);
        const h = Math.max(Number(collider.height) || 0.2, 0.25);
        const d = Math.max(Number(collider.depth) || 0.25, 0.35);
        hitGeo = new THREE.BoxGeometry(w, h, d);
      }
      const hit = new THREE.Mesh(
        hitGeo,
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          wireframe: true,
          transparent: true,
          opacity: debugMode ? 0.7 : 0,
          visible: debugMode,
          depthTest: true
        })
      );
      hit.position.y = (Number(collider.height) || 0.2) / 2;
      hit.userData.dragRootSlug = asset.slug;
      hit.userData.isHitProxy = true;
      mesh.add(hit);
      if (debugMode) addDebugHelper(hit);
    }

    // Authored collider (seed) — magenta wireframe in debug.
    if (debugMode && collider.type) {
      const authored = new THREE.Mesh(
        colliderGeometry(collider),
        new THREE.MeshBasicMaterial({
          color: asset.kind === "vessel" ? 0xf472b6 : 0xa78bfa,
          wireframe: true,
          transparent: true,
          opacity: 0.85
        })
      );
      authored.position.y = (Number(collider.height) || 0.2) / 2;
      authored.userData.isDebugCollider = true;
      mesh.add(authored);
      addDebugHelper(authored);
    }

    // Drop acceptance disc for vessels (XZ radius used by nearVessel).
    if (debugMode && asset.kind === "vessel") {
      const dropR = vesselDropRadiusForCollider(collider);
      const disc = new THREE.Mesh(
        new THREE.RingGeometry(dropR - 0.03, dropR, 48),
        new THREE.MeshBasicMaterial({
          color: 0x4ade80,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      );
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = 0.03;
      disc.userData.isDebugDropZone = true;
      mesh.add(disc);
      addDebugHelper(disc);
    }

    scene.add(mesh);
    sceneObjects.push(mesh);
    objectBySlug[asset.slug] = mesh;
  }

  function findDraggableRoot(object) {
    let node = object;
    while (node) {
      if (node.userData?.slug && node.userData.draggable) {
        return node;
      }
      if (node.userData?.dragRootSlug) {
        return objectBySlug[node.userData.dragRootSlug] || null;
      }
      if (!node.parent || node.parent === scene) {
        break;
      }
      node = node.parent;
    }
    return null;
  }

  function loadGlb(url) {
    return new Promise((resolve, reject) => {
      if (!gltfLoader) {
        reject(new Error("GLTFLoader unavailable"));
        return;
      }
      gltfLoader.load(
        url,
        (gltf) => resolve(gltf.scene),
        undefined,
        (err) => reject(err)
      );
    });
  }

  async function spawnAssets() {
    objectBySlug = {};
    clearDebugHelpers();
    while (sceneObjects.length) {
      const existing = sceneObjects.pop();
      scene.remove(existing);
    }

    for (const asset of practice.assets) {
      let mesh = null;
      if (renderMode === "glb" && asset.glb_url) {
        try {
          mesh = await loadGlb(asset.glb_url);
        } catch (err) {
          console.warn(`GLB load failed for ${asset.slug}, falling back to procedural`, err);
        }
      }
      if (!mesh) {
        mesh = builders(asset.procedural_key || "fallback", asset.meta || {});
      }
      attachAssetUserData(mesh, asset);
    }
    refreshControlHint();
  }

  function vesselDropRadiusForCollider(collider) {
    const base = Number(collider?.radius) || 0.22;
    // Forgiving XZ drop radius so ice does not need pixel-perfect centering.
    return Math.max(base + 0.65, 1.05);
  }

  function vesselDropRadius(vesselSlug) {
    const vessel = objectBySlug[vesselSlug];
    return vesselDropRadiusForCollider(vessel?.userData?.collider || {});
  }

  function distanceToVessel(obj, vesselSlug) {
    const vessel = objectBySlug[vesselSlug];
    if (!vessel) return Infinity;
    const dx = obj.position.x - vessel.position.x;
    const dz = obj.position.z - vessel.position.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function nearVessel(obj, vesselSlug) {
    return distanceToVessel(obj, vesselSlug) < vesselDropRadius(vesselSlug);
  }

  function clearDeposits() {
    while (depositedPieces.length) {
      const piece = depositedPieces.pop();
      gsap.killTweensOf(piece.position);
      gsap.killTweensOf(piece.rotation);
      if (piece.parent) piece.parent.remove(piece);
    }
  }

  function clearLiquidMeshes() {
    for (const slug of Object.keys(liquidMeshes)) {
      const mesh = liquidMeshes[slug];
      gsap.killTweensOf(mesh.rotation);
      gsap.killTweensOf(mesh.scale);
      gsap.killTweensOf(mesh.position);
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
    liquidMeshes = {};
  }

  function clearSpills() {
    while (spillMeshes.length) {
      const mesh = spillMeshes.pop();
      gsap.killTweensOf(mesh.position);
      gsap.killTweensOf(mesh.scale);
      if (mesh.parent) mesh.parent.remove(mesh);
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    }
  }

  function blendLiquidColor(slugs) {
    if (!slugs.length) return new THREE.Color(0xb91c1c);
    const out = new THREE.Color(0, 0, 0);
    for (const slug of slugs) {
      out.add(new THREE.Color(BOTTLE_LIQUID[slug] ?? 0x888888));
    }
    out.multiplyScalar(1 / slugs.length);
    return out;
  }

  function vesselFillHeight(vesselSlug) {
    const vessel = objectBySlug[vesselSlug];
    const state = vesselState[vesselSlug];
    const cap = VESSEL_CAPACITY[vesselSlug] || { liquidMl: 100 };
    const glassH = vessel?.userData.vesselHeight || Number(vessel?.userData.collider?.height) || 0.3;
    const ratio = (state?.liquidMl || 0) / cap.liquidMl;
    // Allow visual over-rim when overflowing.
    return Math.min(Math.max(ratio, 0) * glassH * 0.82, glassH * 1.05);
  }

  function spawnLiquidPuddle(vesselSlug, color) {
    const vessel = objectBySlug[vesselSlug];
    if (!vessel) return;
    const puddle = new THREE.Mesh(
      new THREE.CircleGeometry(0.12 + Math.random() * 0.08, 20),
      new THREE.MeshStandardMaterial({
        color: color || 0xb91c1c,
        transparent: true,
        opacity: 0.75,
        roughness: 0.35,
        metalness: 0.05
      })
    );
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(
      vessel.position.x + (Math.random() - 0.5) * 0.35,
      0.035,
      vessel.position.z + 0.22 + Math.random() * 0.15
    );
    puddle.scale.set(0.2, 0.2, 0.2);
    scene.add(puddle);
    spillMeshes.push(puddle);
    gsap.to(puddle.scale, { x: 1, y: 1, z: 1, duration: 0.45, ease: "power2.out" });
  }

  /** Cascading overflow: rim surge, side drips, then puddle. */
  function animateLiquidOverflow(vesselSlug, colorHex) {
    const vessel = objectBySlug[vesselSlug];
    const liquid = liquidMeshes[vesselSlug];
    if (!vessel) return;
    const color = new THREE.Color(colorHex || 0xb91c1c);

    if (liquid) {
      const baseY = liquid.position.y;
      gsap
        .timeline()
        .to(liquid.scale, { y: `+=0.08`, duration: 0.2, ease: "power1.out" })
        .to(liquid.position, { y: baseY + 0.04, duration: 0.2, ease: "power1.out" }, "<")
        .to(liquid.scale, { y: `-=0.03`, duration: 0.35, ease: "bounce.out" })
        .to(liquid.position, { y: baseY + 0.02, duration: 0.35, ease: "bounce.out" }, "<");
    }

    const glassH = vessel.userData.vesselHeight || 0.3;
    for (let i = 0; i < 7; i += 1) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.018 + Math.random() * 0.012, 8, 8),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.9,
          roughness: 0.2
        })
      );
      const side = i % 2 === 0 ? 1 : -1;
      drop.position.set(
        vessel.position.x + side * (0.12 + Math.random() * 0.08),
        vessel.position.y + glassH * 0.9,
        vessel.position.z + (Math.random() - 0.5) * 0.1
      );
      scene.add(drop);
      spillMeshes.push(drop);
      gsap.to(drop.position, {
        y: 0.05,
        x: drop.position.x + side * (0.08 + Math.random() * 0.2),
        z: drop.position.z + 0.15 + Math.random() * 0.2,
        duration: 0.45 + Math.random() * 0.35,
        delay: i * 0.05,
        ease: "power2.in",
        onComplete() {
          gsap.to(drop.scale, { x: 1.8, y: 0.15, z: 1.8, duration: 0.2 });
          gsap.to(drop.material, { opacity: 0.55, duration: 0.2 });
        }
      });
    }

    const sheet = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.28, 0.02),
      new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.7, roughness: 0.15 })
    );
    sheet.position.set(vessel.position.x + 0.16, vessel.position.y + glassH * 0.55, vessel.position.z);
    scene.add(sheet);
    spillMeshes.push(sheet);
    gsap.fromTo(
      sheet.scale,
      { y: 0.2 },
      {
        y: 1,
        duration: 0.35,
        ease: "power1.out",
        onComplete() {
          gsap.to(sheet.material, {
            opacity: 0,
            duration: 0.5,
            delay: 0.15,
            onComplete() {
              if (sheet.parent) sheet.parent.remove(sheet);
            }
          });
        }
      }
    );

    spawnLiquidPuddle(vesselSlug, colorHex);
    gsap.delayedCall(0.25, () => spawnLiquidPuddle(vesselSlug, colorHex));
  }

  function spillIceOnBar(vesselSlug) {
    const vessel = objectBySlug[vesselSlug];
    if (!vessel) return;
    const cube = makeIceCubeMesh();
    cube.position.set(
      vessel.position.x + (Math.random() - 0.5) * 0.35,
      0.55,
      vessel.position.z + 0.28 + Math.random() * 0.12
    );
    cube.rotation.set(Math.random(), Math.random(), Math.random());
    scene.add(cube);
    spillMeshes.push(cube);
    depositedPieces.push(cube);
    gsap.to(cube.position, {
      y: 0.06,
      duration: 0.5,
      ease: "bounce.out"
    });
  }

  function syncVesselLiquid(vesselSlug, animateIn) {
    const vessel = objectBySlug[vesselSlug];
    const state = vesselState[vesselSlug];
    if (!vessel || !state) return;

    const liquids = state.liquids || [];
    const show = state.liquidMl > 0 || liquids.length > 0 || state.strainedIn;
    let mesh = liquidMeshes[vesselSlug];

    if (!show) {
      if (mesh) {
        if (mesh.parent) mesh.parent.remove(mesh);
        delete liquidMeshes[vesselSlug];
      }
      return;
    }

    const radius = Math.max((vessel.userData.vesselRadius || Number(vessel.userData.collider?.radius) || 0.18) * 0.78, 0.1);
    const fillHeight = Math.max(vesselFillHeight(vesselSlug), 0.04);
    const color = blendLiquidColor(liquids.length ? liquids : ["campari-bottle", "gin-bottle", "vermouth-bottle"]);

    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius * 0.96, 1, 28),
        new THREE.MeshStandardMaterial({
          color,
          transparent: true,
          opacity: 0.88,
          roughness: 0.22,
          metalness: 0.05
        })
      );
      mesh.userData.isLiquidFill = true;
      vessel.add(mesh);
      liquidMeshes[vesselSlug] = mesh;
      if (animateIn) {
        mesh.scale.set(1, 0.05, 1);
        mesh.position.y = 0.03;
        gsap.to(mesh.scale, { y: fillHeight, duration: 0.45, ease: "power2.out" });
        gsap.to(mesh.position, { y: fillHeight / 2 + 0.025, duration: 0.45, ease: "power2.out" });
      } else {
        mesh.scale.set(1, fillHeight, 1);
        mesh.position.y = fillHeight / 2 + 0.025;
      }
    } else {
      mesh.material.color.copy(color);
      gsap.to(mesh.scale, { y: fillHeight, duration: 0.35, ease: "power2.out" });
      gsap.to(mesh.position, { y: fillHeight / 2 + 0.025, duration: 0.35, ease: "power2.out" });
    }
  }

  function addLiquidToVessel(vesselSlug, bottleSlug, amountMl) {
    const state = vesselState[vesselSlug];
    const cap = VESSEL_CAPACITY[vesselSlug];
    if (!state || !cap) return;
    state.liquids.push(bottleSlug);
    state.liquidMl += amountMl;
    syncVesselLiquid(vesselSlug, true);
    if (state.liquidMl > cap.liquidMl) {
      state.overflow = true;
      animateLiquidOverflow(vesselSlug, BOTTLE_LIQUID[bottleSlug]);
      markCompromised(`Overflow! Too much liquid in the ${assetName(vesselSlug)}.`);
    }
  }

  function placeIceInVessel(vesselSlug) {
    const state = vesselState[vesselSlug];
    const cap = VESSEL_CAPACITY[vesselSlug];
    if (!state || !cap) return state?.ice || 0;
    state.ice += 1;
    if (state.ice > cap.ice) {
      state.overflow = true;
      spillIceOnBar(vesselSlug);
      markCompromised(`Overflow! Too much ice in the ${assetName(vesselSlug)}.`);
    } else {
      depositInVessel("ice-bucket", vesselSlug, state.ice - 1);
    }
    return state.ice;
  }

  function selectTool(slug) {
    selectedToolSlug = slug || "hand";
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.style.outline = b.getAttribute("data-tool") === selectedToolSlug ? "2px solid #D01059" : "none";
    });
    if (jiggerSideBarEl) {
      jiggerSideBarEl.classList.toggle("visible", selectedToolSlug === "jigger");
    }
    syncJiggerSideButtons();
    if (selectedToolSlug === "hand") {
      controlHintEl.textContent = "Hand ready — drag ice, bottles, peel, or bar tools.";
    } else if (selectedToolSlug === "jigger") {
      controlHintEl.textContent = `Jigger · ${JIGGER_SIDES[jiggerState.side].label} cup — drag a bottle onto the jigger, then the jigger onto a glass.`;
    } else {
      controlHintEl.textContent = `${selectedToolSlug} ready — drag it onto a glass (animations always play).`;
    }
  }

  function syncJiggerSideButtons() {
    document.querySelectorAll("[data-jigger-side]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-jigger-side") === jiggerState.side);
    });
  }

  function setJiggerSide(side) {
    if (!JIGGER_SIDES[side]) return;
    jiggerState.side = side;
    syncJiggerSideButtons();
    // Flip jigger so the active cup faces up.
    const jigger = objectBySlug.jigger;
    if (jigger) {
      gsap.to(jigger.rotation, {
        z: side === "long" ? Math.PI : 0,
        duration: 0.45,
        ease: "power2.inOut"
      });
    }
    controlHintEl.textContent = `Using the ${JIGGER_SIDES[side].label} side — no rush.`;
    showToast(`${JIGGER_SIDES[side].label} cup selected`, true);
  }

  function syncJiggerFillVisual() {
    const jigger = objectBySlug.jigger;
    const fill = jigger?.userData?.jiggerFill;
    if (!fill) return;
    const side = jiggerState.side;
    const capacity = JIGGER_SIDES[side].ml;
    const ratio = Math.min(jiggerState.filledMl / capacity, 1.15);
    const cupH = side === "short" ? 0.07 : 0.1;
    const fillH = Math.max(ratio * cupH, 0.01);
    const cupY = side === "short" ? 0.14 : 0.04;
    fill.material.color.set(BOTTLE_LIQUID[jiggerState.bottleSlug] || 0x7dd3fc);
    fill.material.opacity = jiggerState.filledMl > 0 ? 0.9 : 0;
    // Keep fill in the upright cup relative to jigger flip.
    fill.position.y = side === "long" ? -0.02 : cupY;
    gsap.to(fill.scale, { y: fillH, duration: 0.35, ease: "power2.out" });
  }

  function clearJigger() {
    jiggerState.filledMl = 0;
    jiggerState.bottleSlug = null;
    syncJiggerFillVisual();
  }

  function nearObject(obj, other, radius = 0.85) {
    if (!obj || !other) return false;
    const dx = obj.position.x - other.position.x;
    const dz = obj.position.z - other.position.z;
    return Math.sqrt(dx * dx + dz * dz) < radius;
  }

  function animatePourToTarget(source, target, opts, onStream, onDone) {
    if (!source || !target) {
      onDone?.();
      return;
    }
    const lift = opts?.lift ?? 0.42;
    const tilt = opts?.tilt ?? 1.05;
    const streamColor = new THREE.Color(opts?.color ?? 0xb91c1c);

    gsap.killTweensOf(source.position);
    gsap.killTweensOf(source.rotation);

    const home = {
      x: source.userData.spawnX ?? source.position.x,
      y: source.userData.spawnY ?? source.position.y,
      z: source.userData.spawnZ ?? source.position.z,
      rotZ: source.userData.slug === "jigger" ? (jiggerState.side === "long" ? Math.PI : 0) : 0,
      rotY: source.rotation.y
    };
    // After pour, jigger returns to its station pose; bottles use spawn.
    if (source.userData.slug !== "jigger") {
      home.rotZ = 0;
    }

    const toward = source.position.x >= target.position.x ? 1 : -1;
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, 1, 8),
      new THREE.MeshStandardMaterial({
        color: streamColor,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2
      })
    );
    stream.visible = false;
    scene.add(stream);

    const placeStream = () => {
      const from = new THREE.Vector3(
        target.position.x + toward * 0.16,
        lift + 0.06,
        target.position.z
      );
      const to = new THREE.Vector3(target.position.x, target.position.y + 0.2, target.position.z);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const dir = to.clone().sub(from);
      const len = Math.max(dir.length(), 0.12);
      stream.position.copy(mid);
      stream.scale.set(1, len, 1);
      stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      stream.visible = true;
    };

    const tl = gsap.timeline({
      onComplete() {
        scene.remove(stream);
        stream.geometry.dispose();
        stream.material.dispose();
        onDone?.();
      }
    });

    tl.to(source.position, {
      x: target.position.x + toward * 0.26,
      y: lift,
      z: target.position.z,
      duration: 0.35,
      ease: "power2.out"
    });
    tl.to(source.rotation, { z: home.rotZ + toward * -tilt, duration: 0.3, ease: "power2.inOut" }, "<0.05");
    tl.add(() => {
      playClack();
      placeStream();
      onStream?.();
    });
    tl.to(stream.material, { opacity: 0.3, duration: 0.55, ease: "power1.in" });
    tl.add(() => {
      stream.visible = false;
    });
    tl.to(source.rotation, { z: home.rotZ, duration: 0.3, ease: "power2.out" });
    tl.to(
      source.position,
      {
        x: home.x,
        y: home.y,
        z: home.z,
        duration: 0.4,
        ease: "power2.inOut"
      },
      "<"
    );
  }

  function animateStir() {
    const spoon = objectBySlug.barspoon;
    const vessel = objectBySlug["mixing-glass"];
    const liquid = liquidMeshes["mixing-glass"];
    playStir();
    if (!spoon || !vessel) return;

    gsap.killTweensOf(spoon.position);
    gsap.killTweensOf(spoon.rotation);
    if (liquid) {
      gsap.killTweensOf(liquid.rotation);
      gsap.killTweensOf(liquid.material);
    }

    const home = {
      x: spoon.userData.spawnX,
      y: spoon.userData.spawnY,
      z: spoon.userData.spawnZ,
      rotX: spoon.rotation.x,
      rotY: spoon.rotation.y,
      rotZ: spoon.rotation.z
    };
    const cx = vessel.position.x;
    const cz = vessel.position.z;
    const stirY = 0.14;
    const orbitR = 0.07;
    const progress = { angle: 0 };

    const tl = gsap.timeline();
    tl.to(spoon.position, {
      x: cx + orbitR,
      y: stirY,
      z: cz,
      duration: 0.4,
      ease: "power2.out"
    });
    tl.to(
      spoon.rotation,
      {
        x: 0.35,
        y: 0,
        z: 0.2,
        duration: 0.35,
        ease: "power2.out"
      },
      "<"
    );
    tl.to(progress, {
      angle: Math.PI * 5,
      duration: 1.7,
      ease: "sine.inOut",
      onUpdate() {
        const a = progress.angle;
        spoon.position.x = cx + Math.cos(a) * orbitR;
        spoon.position.z = cz + Math.sin(a) * orbitR;
        spoon.position.y = stirY + Math.sin(a * 2) * 0.012;
        spoon.rotation.y = a;
      }
    });
    tl.to(spoon.position, {
      x: home.x,
      y: home.y,
      z: home.z,
      duration: 0.4,
      ease: "power2.inOut"
    });
    tl.to(
      spoon.rotation,
      {
        x: home.rotX,
        y: home.rotY,
        z: home.rotZ,
        duration: 0.35,
        ease: "power2.inOut"
      },
      "<"
    );

    if (liquid) {
      gsap.to(liquid.rotation, {
        y: liquid.rotation.y + Math.PI * 3.5,
        duration: 1.7,
        delay: 0.35,
        ease: "sine.inOut"
      });
    }
  }

  function animateStrain(onDone) {
    const strainer = objectBySlug.strainer;
    const mixing = objectBySlug["mixing-glass"];
    const rocks = objectBySlug["rocks-glass"];
    if (!strainer || !mixing || !rocks) {
      onDone?.();
      return;
    }

    gsap.killTweensOf(strainer.position);
    gsap.killTweensOf(strainer.rotation);
    gsap.killTweensOf(mixing.rotation);
    gsap.killTweensOf(mixing.position);

    const strainerHome = {
      x: strainer.userData.spawnX,
      y: strainer.userData.spawnY,
      z: strainer.userData.spawnZ
    };
    const mixingHome = {
      x: mixing.position.x,
      y: mixing.position.y,
      z: mixing.position.z,
      rotZ: mixing.rotation.z
    };

    const pourColor = blendLiquidColor(
      vesselState["mixing-glass"].liquids.length
        ? vesselState["mixing-glass"].liquids
        : ["campari-bottle", "gin-bottle", "vermouth-bottle"]
    );
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.028, 1, 10),
      new THREE.MeshStandardMaterial({
        color: pourColor,
        transparent: true,
        opacity: 0.85,
        roughness: 0.25
      })
    );
    stream.visible = false;
    scene.add(stream);

    const mx = mixing.position.x;
    const mz = mixing.position.z;
    const rx = rocks.position.x;
    const rz = rocks.position.z;
    const towardRocks = rx >= mx ? 1 : -1;

    const placeStream = () => {
      const from = new THREE.Vector3(mx + towardRocks * 0.12, 0.34, mz);
      const to = new THREE.Vector3(rx, 0.22, rz);
      const mid = from.clone().add(to).multiplyScalar(0.5);
      const dir = to.clone().sub(from);
      const len = Math.max(dir.length(), 0.2);
      stream.position.copy(mid);
      stream.scale.set(1, len, 1);
      stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      stream.visible = true;
    };

    const tl = gsap.timeline({
      onComplete() {
        scene.remove(stream);
        stream.geometry.dispose();
        stream.material.dispose();
        onDone?.();
      }
    });

    // Seat strainer on the mixing-glass rim.
    tl.to(strainer.position, {
      x: mx,
      y: 0.4,
      z: mz,
      duration: 0.35,
      ease: "power2.out"
    });
    tl.to(strainer.rotation, { x: 0.15, y: 0, z: 0, duration: 0.25 }, "<0.05");

    // Tip mixing glass toward rocks; strainer rides with the tilt.
    tl.to(mixing.rotation, { z: towardRocks * -0.65, duration: 0.5, ease: "power2.inOut" });
    tl.to(strainer.position, { x: mx + towardRocks * 0.08, y: 0.36, duration: 0.5, ease: "power2.inOut" }, "<");
    tl.to(strainer.rotation, { z: towardRocks * -0.35, duration: 0.5 }, "<");

    tl.add(() => {
      playClack();
      placeStream();
      const mixed = [...vesselState["mixing-glass"].liquids];
      vesselState["rocks-glass"].liquids = mixed;
      vesselState["rocks-glass"].liquidMl += vesselState["mixing-glass"].liquidMl;
      vesselState["mixing-glass"].liquids = [];
      vesselState["mixing-glass"].liquidMl = 0;
      vesselState["rocks-glass"].strainedIn = true;
      syncVesselLiquid("mixing-glass", false);
      syncVesselLiquid("rocks-glass", true);
    });

    tl.to(stream.material, { opacity: 0.35, duration: 0.55, ease: "power1.in" });
    tl.add(() => {
      stream.visible = false;
    });

    // Set glasses upright and put strainer away.
    tl.to(mixing.rotation, { z: mixingHome.rotZ, duration: 0.4, ease: "power2.out" });
    tl.to(
      strainer.position,
      {
        x: strainerHome.x,
        y: strainerHome.y,
        z: strainerHome.z,
        duration: 0.4,
        ease: "power2.inOut"
      },
      "<"
    );
    tl.to(strainer.rotation, { x: 0, y: 0, z: 0, duration: 0.3 }, "<");
  }

  function animatePour(bottle, vesselSlug, onStream, onDone) {
    const vessel = objectBySlug[vesselSlug];
    if (!bottle || !vessel) {
      onDone?.();
      return;
    }

    gsap.killTweensOf(bottle.position);
    gsap.killTweensOf(bottle.rotation);

    const home = {
      x: bottle.userData.spawnX,
      y: bottle.userData.spawnY,
      z: bottle.userData.spawnZ,
      rotZ: bottle.rotation.z,
      rotY: bottle.rotation.y
    };
    const toward = bottle.position.x >= vessel.position.x ? 1 : -1;
    const pourColor = new THREE.Color(BOTTLE_LIQUID[bottle.userData.slug] || 0xb91c1c);
    const stream = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.02, 1, 8),
      new THREE.MeshStandardMaterial({
        color: pourColor,
        transparent: true,
        opacity: 0.9,
        roughness: 0.2
      })
    );
    stream.visible = false;
    scene.add(stream);

    const placeStream = () => {
      const neck = new THREE.Vector3(
        vessel.position.x + toward * 0.18,
        0.48,
        vessel.position.z
      );
      const mouth = new THREE.Vector3(vessel.position.x, 0.28, vessel.position.z);
      const mid = neck.clone().add(mouth).multiplyScalar(0.5);
      const dir = mouth.clone().sub(neck);
      const len = Math.max(dir.length(), 0.15);
      stream.position.copy(mid);
      stream.scale.set(1, len, 1);
      stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      stream.visible = true;
    };

    const tl = gsap.timeline({
      onComplete() {
        scene.remove(stream);
        stream.geometry.dispose();
        stream.material.dispose();
        onDone?.();
      }
    });

    tl.to(bottle.position, {
      x: vessel.position.x + toward * 0.28,
      y: 0.42,
      z: vessel.position.z,
      duration: 0.35,
      ease: "power2.out"
    });
    tl.to(bottle.rotation, { z: toward * -1.05, duration: 0.3, ease: "power2.inOut" }, "<0.05");
    tl.add(() => {
      playClack();
      placeStream();
      onStream?.();
    });
    tl.to(stream.material, { opacity: 0.35, duration: 0.55, ease: "power1.in" });
    tl.add(() => {
      stream.visible = false;
    });
    tl.to(bottle.rotation, { z: home.rotZ, duration: 0.3, ease: "power2.out" });
    tl.to(
      bottle.position,
      {
        x: home.x,
        y: home.y,
        z: home.z,
        duration: 0.4,
        ease: "power2.inOut"
      },
      "<"
    );
    tl.to(bottle.rotation, { y: home.rotY, duration: 0.2 }, "<");
  }

  function idealIceForVessel(vesselSlug) {
    const step = (practice?.steps || []).find(
      (s) => normalizeActionSlug(s.action_slug) === "place" && s.target_vessel_slug === vesselSlug
    );
    return Number(step?.params?.idealCount || step?.params?.minCount || 0);
  }

  function makeIceCubeMesh() {
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshStandardMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.82,
        roughness: 0.12,
        metalness: 0.05
      })
    );
    cube.castShadow = true;
    cube.receiveShadow = true;
    return cube;
  }

  /** Leave a visible piece inside the vessel when a reusable source (ice pile) is placed. */
  function depositInVessel(assetSlug, vesselSlug, index) {
    const vessel = objectBySlug[vesselSlug];
    if (!vessel) return;

    let piece;
    if (assetSlug === "ice-bucket" || assetSlug.includes("ice")) {
      piece = makeIceCubeMesh();
    } else {
      const asset = practice?.assets?.find((a) => a.slug === assetSlug);
      piece = builders(asset?.procedural_key || "fallback", asset?.meta || {});
      piece.scale.setScalar(0.85);
    }

    piece.userData.deposited = true;
    vessel.add(piece);

    const angle = index * 2.1;
    const radius = 0.05 + (index % 3) * 0.025;
    const restY = 0.07 + Math.floor(index / 3) * 0.085;
    const localX = Math.cos(angle) * radius;
    const localZ = Math.sin(angle) * radius;

    piece.position.set(localX, restY + 0.55, localZ);
    piece.rotation.set(0.4, index * 0.6, 0.2);
    depositedPieces.push(piece);

    gsap.to(piece.position, {
      y: restY,
      duration: 0.45,
      ease: "bounce.out"
    });
    gsap.to(piece.rotation, {
      x: (index % 3) * 0.35 - 0.2,
      y: index * 0.55,
      z: (index % 2) * 0.25,
      duration: 0.45,
      ease: "power2.out"
    });
  }

  function handleDrop(obj) {
    playClack();
    const step = currentStep();
    const slugDropped = obj.userData.slug;
    const actionSlug = step ? normalizeActionSlug(step.action_slug) : null;

    if (step && actionSlug === "place" && (step.required_asset_slugs || []).includes(slugDropped)) {
      const target = step.target_vessel_slug;
      const dist = distanceToVessel(obj, target);
      const threshold = vesselDropRadius(target);
      const ok = dist < threshold;
      lastDebugDrop = {
        slug: slugDropped,
        target,
        dist: dist.toFixed(2),
        threshold: threshold.toFixed(2),
        ok
      };
      updateDebugPanel();

      if (!ok) {
        returnToSpawn(obj);
        failStep(step.failure_message || "Place that on the correct vessel.");
        return;
      }

      const key = `${target}:${slugDropped}`;
      const ideal = Number(step.params.idealCount || step.params.minCount || 1);
      const maxCount = Number(step.params.maxCount || VESSEL_CAPACITY[target]?.ice || ideal + 2);
      const stayOnTarget = Boolean(step.params.stayOnTarget);

      if (stayOnTarget) {
        placeCounts[key] = (placeCounts[key] || 0) + 1;
        gsap.to(obj.position, {
          x: objectBySlug[target].position.x,
          y: 0.28,
          z: objectBySlug[target].position.z,
          duration: 0.35
        });
        obj.userData.draggable = false;
        if (placeCounts[key] >= ideal) {
          ensureStep("place", () => true);
        }
        return;
      }

      // Ice (and similar): allow under/over; overflow when past capacity.
      const iceCount = placeIceInVessel(target);
      placeCounts[key] = iceCount;
      returnToSpawn(obj);

      if (iceCount < ideal) {
        controlHintEl.textContent = `${assetName(target)}: ${iceCount}/${ideal} ice (you can add more — or move on and risk under-icing).`;
      } else if (iceCount === ideal) {
        controlHintEl.textContent = `Nice — ${ideal} ice in the ${assetName(target)}.`;
        if (normalizeActionSlug(step.action_slug) === "place") {
          ensureStep("place", () => true);
        }
      } else if (iceCount <= maxCount) {
        controlHintEl.textContent = `Heavy ice (${iceCount}/${maxCount}). Still in the glass — careful.`;
        if (currentStep() && normalizeActionSlug(currentStep().action_slug) === "place") {
          ensureStep("place", () => true);
        }
      }
      return;
    }

    // Extra ice anytime — under/over is allowed; overflow is punished.
    if (slugDropped === "ice-bucket") {
      const candidates = ["mixing-glass", "rocks-glass"];
      const target = candidates.find((v) => nearVessel(obj, v));
      if (target) {
        const iceCount = placeIceInVessel(target);
        returnToSpawn(obj);
        controlHintEl.textContent = `${assetName(target)} now has ${iceCount} ice.`;
        const placeStep =
          currentStep() &&
          normalizeActionSlug(currentStep().action_slug) === "place" &&
          currentStep().target_vessel_slug === target;
        if (placeStep) {
          const ideal = Number(currentStep().params.idealCount || currentStep().params.minCount || 1);
          if (iceCount >= ideal) ensureStep("place", () => true);
        }
        return;
      }
    }

    if (SPIRIT_BOTTLES.has(slugDropped)) {
      const jigger = objectBySlug.jigger;
      const glassTarget = ["mixing-glass", "rocks-glass"].find((v) => nearVessel(obj, v));

      // Preferred: bottle → jigger.
      if (jigger && nearObject(obj, jigger, 0.9)) {
        selectTool("jigger");
        const side = jiggerState.side;
        const amountMl = JIGGER_SIDES[side].ml;
        animatePourToTarget(
          obj,
          jigger,
          { lift: 0.38, tilt: 0.95, color: BOTTLE_LIQUID[slugDropped] },
          () => {
            jiggerState.filledMl = amountMl;
            jiggerState.bottleSlug = slugDropped;
            syncJiggerFillVisual();
            if (side === "long") {
              markCompromised("Heavy pour — filled the 45 ml side (Negroni wants 30 ml).");
            }
          }
        );
        controlHintEl.textContent = `Jigger filled (${amountMl} ml). Drag the jigger onto a glass to empty it.`;
        return;
      }

      // Direct bottle → glass still works (animation testing / shortcuts).
      if (glassTarget) {
        const amountMl = JIGGER_SIDES[jiggerState.side]?.ml || 30;
        const expected = actionSlug === "pour" ? step?.required_asset_slugs?.[0] : null;
        animatePourToTarget(
          obj,
          objectBySlug[glassTarget],
          { lift: 0.42, tilt: 1.05, color: BOTTLE_LIQUID[slugDropped] },
          () => addLiquidToVessel(glassTarget, slugDropped, amountMl)
        );
        showToast("Tip: pour into the jigger first for the proper build.", false);
        if (actionSlug === "pour" && expected === slugDropped && glassTarget === step?.target_vessel_slug) {
          ensureStep("pour", () => true);
        } else if (step) {
          markCompromised("Poured straight into the glass (or wrong spirit) — animations still run.");
        }
        return;
      }

      returnToSpawn(obj);
      failStep("Drop the bottle on the jigger (or a glass).");
      return;
    }

    // Empty filled jigger into a glass.
    if (slugDropped === "jigger") {
      const glassTarget = ["mixing-glass", "rocks-glass"].find((v) => nearVessel(obj, v));
      if (!glassTarget) {
        returnToSpawn(obj);
        return;
      }
      if (jiggerState.filledMl <= 0) {
        returnToSpawn(obj);
        showToast("Jigger is empty — fill it from a bottle first.", false);
        return;
      }

      const amountMl = jiggerState.filledMl;
      const bottleSlug = jiggerState.bottleSlug || "gin-bottle";
      const expected = actionSlug === "pour" ? step?.required_asset_slugs?.[0] : null;

      animatePourToTarget(
        obj,
        objectBySlug[glassTarget],
        { lift: 0.36, tilt: 0.85, color: BOTTLE_LIQUID[bottleSlug] },
        () => {
          addLiquidToVessel(glassTarget, bottleSlug, amountMl);
          clearJigger();
        }
      );

      const needIce = idealIceForVessel(glassTarget);
      if (needIce && vesselState[glassTarget].ice < needIce && !vesselState[glassTarget].overflow) {
        markCompromised(
          `Under-iced: ${assetName(glassTarget)} has ${vesselState[glassTarget].ice}/${needIce} cubes.`
        );
      }

      if (actionSlug === "pour" && expected === bottleSlug && glassTarget === step?.target_vessel_slug) {
        const wantMl = Number(step.params?.amountMl || 30);
        if (amountMl !== wantMl) {
          markCompromised(`Used ${amountMl} ml; recipe asks for ${wantMl} ml.`);
        }
        ensureStep("pour", () => true);
      } else if (step && actionSlug === "pour") {
        markCompromised(`Wrong spirit or glass — expected ${assetName(expected || "next bottle")}.`);
      }
      return;
    }

    // Technique tools — always animate when near a glass (even if incorrect).
    if (TECHNIQUE_TOOLS.has(slugDropped)) {
      if (slugDropped === "barspoon") {
        const nearMix = nearVessel(obj, "mixing-glass");
        if (!nearMix) {
          returnToSpawn(obj);
          failStep("Drop the barspoon near the Mixing glass to stir.");
          return;
        }
        if (!vesselState["mixing-glass"].liquidMl) {
          markCompromised("Stirring an empty glass — animation still plays.");
        }
        const needIce = idealIceForVessel("mixing-glass");
        if (needIce && vesselState["mixing-glass"].ice < needIce) {
          markCompromised(
            `Stirring under-iced (${vesselState["mixing-glass"].ice}/${needIce}).`
          );
        }
        selectTool("barspoon");
        animateStir();
        vesselState["mixing-glass"].stirred = true;
        syncVesselLiquid("mixing-glass", false);
        if (actionSlug === "stir") ensureStep("stir", () => true);
        else if (step) markCompromised("Stirred out of order — animation still played.");
        return;
      }

      if (slugDropped === "strainer") {
        if (!nearVessel(obj, "mixing-glass") && !nearVessel(obj, "rocks-glass")) {
          returnToSpawn(obj);
          failStep("Drop the strainer on the Mixing glass to strain.");
          return;
        }
        if (!vesselState["mixing-glass"].stirred) {
          markCompromised("Straining before stir — animation still plays.");
        }
        selectTool("strainer");
        animateStrain(() => {
          if (actionSlug === "strain") ensureStep("strain", () => true);
          else if (step) markCompromised("Strained out of order — animation still played.");
          if (vesselState["rocks-glass"].liquidMl > VESSEL_CAPACITY["rocks-glass"].liquidMl) {
            vesselState["rocks-glass"].overflow = true;
            animateLiquidOverflow("rocks-glass", BOTTLE_LIQUID[vesselState["rocks-glass"].liquids[0]]);
            markCompromised("Rocks glass overflowed on the strain.");
          }
        });
        return;
      }

      if (slugDropped === "shaker") {
        const nearMix = nearVessel(obj, "mixing-glass");
        if (nearMix) {
          // Shake animation: bounce the shaker, always allowed for testing.
          gsap
            .timeline()
            .to(obj.position, { y: 0.45, duration: 0.15 })
            .to(obj.rotation, { z: 0.4, duration: 0.12, yoyo: true, repeat: 5 })
            .to(obj.position, {
              x: obj.userData.spawnX,
              y: obj.userData.spawnY,
              z: obj.userData.spawnZ,
              duration: 0.35
            })
            .to(obj.rotation, { z: 0, duration: 0.2 }, "<");
          markCompromised("Shaking a Negroni fails the practice — but the animation ran.");
          return;
        }
        returnToSpawn(obj);
        return;
      }

      returnToSpawn(obj);
      return;
    }

    lastDebugDrop = {
      slug: slugDropped,
      target: step?.target_vessel_slug || "",
      dist: step?.target_vessel_slug ? distanceToVessel(obj, step.target_vessel_slug).toFixed(2) : "—",
      threshold: step?.target_vessel_slug ? vesselDropRadius(step.target_vessel_slug).toFixed(2) : "—",
      ok: false
    };
    updateDebugPanel();
    returnToSpawn(obj);
  }

  function returnToSpawn(obj) {
    gsap.to(obj.position, {
      x: obj.userData.spawnX,
      y: obj.userData.spawnY,
      z: obj.userData.spawnZ,
      duration: 0.45,
      ease: "back.out(1.4)"
    });
  }

  function pointerToNdc(event, element) {
    const rect = element.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1
    };
  }

  function onPointerDown(event) {
    if (event.target.closest?.("button") || event.target.closest?.(".glass") || event.target.closest?.(".top-link")) {
      return;
    }
    if (!practice) return;

    const ndc = pointerToNdc(event, renderer.domElement);
    mouse.x = ndc.x;
    mouse.y = ndc.y;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(sceneObjects, true);
    if (!hits.length) return;

    const root = findDraggableRoot(hits[0].object);
    if (!root || !root.userData.draggable) return;

    // Picking up a bar tool also equips it in the toolbar.
    if (TOOL_SLUGS.has(root.userData.slug)) {
      selectTool(root.userData.slug);
    }

    event.preventDefault();
    event.stopPropagation();
    controls.enabled = false;
    renderer.domElement.setPointerCapture?.(event.pointerId);
    selectedObject = root;
    originalY = root.position.y;
    gsap.to(root.position, { y: 0.55, duration: 0.18 });
    document.body.style.cursor = "grabbing";
  }

  function onPointerMove(event) {
    if (!selectedObject) return;
    event.preventDefault();
    const ndc = pointerToNdc(event, renderer.domElement);
    mouse.x = ndc.x;
    mouse.y = ndc.y;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(guidePlane);
    if (hit.length) {
      selectedObject.position.x = hit[0].point.x;
      selectedObject.position.z = hit[0].point.z;
    }
  }

  function onPointerUp(event) {
    if (!selectedObject) return;
    event.preventDefault();
    try {
      renderer.domElement.releasePointerCapture?.(event.pointerId);
    } catch {
      /* ignore */
    }
    handleDrop(selectedObject);
    selectedObject = null;
    controls.enabled = true;
    document.body.style.cursor = "default";
  }

  const canvasEl = renderer.domElement;
  canvasEl.addEventListener("pointerdown", onPointerDown);
  canvasEl.addEventListener("pointermove", onPointerMove);
  canvasEl.addEventListener("pointerup", onPointerUp);
  canvasEl.addEventListener("pointercancel", onPointerUp);
  // Avoid browser touch gestures stealing the drag.
  canvasEl.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
  canvasEl.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectTool(btn.getAttribute("data-tool"));
    });
  });

  document.querySelectorAll("[data-jigger-side]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setJiggerSide(btn.getAttribute("data-jigger-side"));
      selectTool("jigger");
    });
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    currentStepIndex = 0;
    score = 0;
    scoreTextEl.textContent = "0";
    vesselState = {
      "mixing-glass": { liquids: [], ice: 0, liquidMl: 0, stirred: false, overflow: false },
      "rocks-glass": { liquids: [], ice: 0, liquidMl: 0, strainedIn: false, overflow: false }
    };
    placeCounts = {};
    clearDeposits();
    clearLiquidMeshes();
    clearSpills();
    clearJigger();
    clearCompromised();
    jiggerState.side = "short";
    const jigger = objectBySlug.jigger;
    if (jigger) jigger.rotation.z = 0;
    syncJiggerSideButtons();
    for (const obj of sceneObjects) {
      gsap.killTweensOf(obj.position);
      gsap.killTweensOf(obj.rotation);
      obj.userData.draggable = obj.userData.kind !== "vessel";
      obj.position.set(obj.userData.spawnX, obj.userData.spawnY, obj.userData.spawnZ);
      obj.rotation.y = 0;
      obj.rotation.x = 0;
      obj.rotation.z = 0;
    }
    selectTool("hand");
    renderSteps();
    refreshControlHint();
    showToast("Station reset.", true);
  });

  document.getElementById("fail-reset-btn")?.addEventListener("click", () => {
    document.getElementById("reset-btn")?.click();
  });

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    if (targetRing?.visible) {
      targetRingPulse += 0.06;
      const s = 1 + Math.sin(targetRingPulse) * 0.1;
      targetRing.scale.set(s, s, 1);
      targetRing.material.opacity = 0.5 + Math.sin(targetRingPulse) * 0.3;
    }
    renderer.render(scene, camera);
  }
  animate();

  async function boot() {
    const res = await fetch(`${window.__API_BASE__ || ""}/api/practices/${encodeURIComponent(slug)}`);
    if (!res.ok) {
      recipeNameEl.textContent = "Practice not found";
      controlHintEl.textContent = "Check the scene slug in backoffice.";
      return;
    }
    practice = await res.json();
    recipeNameEl.textContent = practice.recipe.name;
    renderSteps();
    await spawnAssets();
    selectTool("hand");
  }

  document.getElementById("enter-btn").addEventListener("click", () => {
    audioCtx.resume();
    loadingEl.style.opacity = "0";
    loadingEl.style.pointerEvents = "none";
    setTimeout(() => {
      loadingEl.classList.add("hidden");
      loadingEl.style.display = "none";
    }, 450);
  });

  boot().catch((err) => {
    console.error(err);
    recipeNameEl.textContent = "Failed to load practice";
  });
})();
