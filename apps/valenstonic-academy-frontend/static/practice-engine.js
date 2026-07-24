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
  let selectedToolSlug = null;
  let vesselState = {
    "mixing-glass": { liquids: [], stirred: false, contentsReady: false },
    "rocks-glass": { liquids: [], strainedIn: false }
  };
  /** Counts for generic `place` steps: `${vessel}:${asset}` → count */
  let placeCounts = {};
  /** Visual pieces left in vessels after a successful `place` (ice cubes, etc.) */
  let depositedPieces = [];

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
      const count = Number(step.params?.minCount || 1);
      hint =
        count > 1
          ? `Drag ${what} onto the ${targetName} (${count}×).`
          : `Place ${what} on the ${targetName}.`;
    } else if (actionSlug === "pour" && targetName) {
      hint = `Pour into the ${targetName}. Select the jigger first.`;
    } else if ((actionSlug === "stir" || actionSlug === "strain") && targetName) {
      hint = `${action?.ui_hint || step.title} Target: ${targetName}.`;
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
          color: 0xfbbf24,
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
  function bottle(color, labelColor) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.13, 0.42, 20),
      new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.05, transparent: true, opacity: 0.85 })
    );
    body.position.y = 0.21;
    body.castShadow = true;
    g.add(body);
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.05, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    neck.position.y = 0.48;
    g.add(neck);
    const label = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.14, 0.01),
      new THREE.MeshStandardMaterial({ color: labelColor || 0xfef3c7 })
    );
    label.position.set(0, 0.22, 0.12);
    g.add(label);
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
    return g;
  }

  function builders(key, meta) {
    switch (key) {
      case "bottle_gin":
        return bottle(meta.liquidColor || "#93c5fd", 0xdbeafe);
      case "bottle_campari":
        return bottle(meta.liquidColor || "#ef4444", 0xfecaca);
      case "bottle_vermouth":
        return bottle(meta.liquidColor || "#7c2d12", 0xfde68a);
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
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.5, 8),
          new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.9, roughness: 0.25 })
        );
        shaft.rotation.z = Math.PI / 2;
        shaft.position.y = 0.02;
        g.add(shaft);
        return g;
      }
      case "jigger": {
        const g = new THREE.Group();
        const top = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.03, 0.08, 12),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 })
        );
        top.position.y = 0.1;
        const bottom = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.04, 0.1, 12),
          new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 })
        );
        bottom.position.y = 0.04;
        g.add(top, bottom);
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
  scene.background = new THREE.Color(0x1c1917);

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

  scene.add(new THREE.AmbientLight(0xffffff, 0.45));
  const spot = new THREE.SpotLight(0xfff1d6, 2.2);
  spot.position.set(0, 7, 1);
  spot.castShadow = true;
  spot.angle = Math.PI / 3;
  spot.penumbra = 0.7;
  scene.add(spot);
  const fill = new THREE.DirectionalLight(0xa5f3fc, 0.35);
  fill.position.set(-4, 3, -2);
  scene.add(fill);

  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(10, 0.7, 5.5),
    new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.35, metalness: 0.4 })
  );
  bar.position.y = -0.35;
  bar.receiveShadow = true;
  scene.add(bar);

  const wood = new THREE.Mesh(
    new THREE.BoxGeometry(9.5, 0.06, 5),
    new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 })
  );
  wood.position.y = 0.02;
  wood.receiveShadow = true;
  scene.add(wood);

  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 8),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 })
  );
  wall.position.set(0, 3.5, -2.7);
  scene.add(wall);

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
      renderMode
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
    if (!step) {
      returnToSpawn(obj);
      return;
    }

    const slugDropped = obj.userData.slug;
    const actionSlug = normalizeActionSlug(step.action_slug);

    if (actionSlug === "place" && (step.required_asset_slugs || []).includes(slugDropped)) {
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
      placeCounts[key] = (placeCounts[key] || 0) + 1;
      const minCount = Number(step.params.minCount || 1);
      const stayOnTarget = Boolean(step.params.stayOnTarget);

      if (stayOnTarget) {
        gsap.to(obj.position, {
          x: objectBySlug[target].position.x,
          y: 0.28,
          z: objectBySlug[target].position.z,
          duration: 0.35
        });
        obj.userData.draggable = false;
      } else {
        // Source stays reusable (ice pile); drop a cube into the glass so placement is visible.
        depositInVessel(slugDropped, target, placeCounts[key] - 1);
        returnToSpawn(obj);
      }

      if (placeCounts[key] >= minCount) {
        ensureStep("place", () => true);
      } else {
        controlHintEl.textContent = `Placed ${slugDropped} on ${target}: ${placeCounts[key]}/${minCount}`;
      }
      return;
    }

    if (actionSlug === "pour" && (step.required_asset_slugs || []).includes(slugDropped)) {
      const target = step.target_vessel_slug;
      const dist = distanceToVessel(obj, target);
      const threshold = vesselDropRadius(target);
      lastDebugDrop = {
        slug: slugDropped,
        target,
        dist: dist.toFixed(2),
        threshold: threshold.toFixed(2),
        ok: dist < threshold
      };
      updateDebugPanel();
      if (dist >= threshold) {
        returnToSpawn(obj);
        failStep("Pour into the correct vessel.");
        return;
      }
      if (selectedToolSlug && selectedToolSlug !== step.required_tool_slug) {
        returnToSpawn(obj);
        failStep(`Use the ${step.required_tool_slug} for measured pours.`);
        return;
      }
      if (step.required_tool_slug && selectedToolSlug !== step.required_tool_slug) {
        returnToSpawn(obj);
        failStep(`Select the ${step.required_tool_slug} before pouring.`);
        return;
      }
      vesselState[target].liquids.push(slugDropped);
      returnToSpawn(obj);
      ensureStep("pour", (s) => s.required_asset_slugs[0] === slugDropped);
      return;
    }

    lastDebugDrop = {
      slug: slugDropped,
      target: step.target_vessel_slug || "",
      dist: step.target_vessel_slug ? distanceToVessel(obj, step.target_vessel_slug).toFixed(2) : "—",
      threshold: step.target_vessel_slug ? vesselDropRadius(step.target_vessel_slug).toFixed(2) : "—",
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
      selectedToolSlug = btn.getAttribute("data-tool");
      document.querySelectorAll("[data-tool]").forEach((b) => {
        b.style.outline = b === btn ? "2px solid #d97706" : "none";
      });
      controlHintEl.textContent = `Selected tool: ${selectedToolSlug}`;
    });
  });

  document.getElementById("perform-btn").addEventListener("click", () => {
    const step = currentStep();
    if (!step) return;

    if (step.action_slug === "stir") {
      if (selectedToolSlug !== "barspoon") {
        failStep("Select the barspoon to stir.");
        return;
      }
      if (selectedToolSlug === "shaker") {
        failStep("Never shake a classic Negroni.");
        return;
      }
      playStir();
      const spoon = objectBySlug.barspoon;
      if (spoon) {
        gsap.to(spoon.rotation, { y: spoon.rotation.y + Math.PI * 4, duration: 1.2, ease: "power1.inOut" });
      }
      vesselState["mixing-glass"].stirred = true;
      ensureStep("stir", (s) => s.required_tool_slug === "barspoon");
      return;
    }

    if (step.action_slug === "shake") {
      failStep("Shaking is incorrect for this recipe.");
      return;
    }

    if (step.action_slug === "strain") {
      if (selectedToolSlug !== "strainer") {
        failStep("Select the strainer first.");
        return;
      }
      if (!vesselState["mixing-glass"].stirred) {
        failStep("Stir before straining.");
        return;
      }
      playClack();
      vesselState["rocks-glass"].strainedIn = true;
      ensureStep("strain", () => true);
      return;
    }

    if (selectedToolSlug === "shaker" && step.action_slug === "stir") {
      failStep("Shaking a Negroni fails the practice.");
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    currentStepIndex = 0;
    score = 0;
    scoreTextEl.textContent = "0";
    vesselState = {
      "mixing-glass": { liquids: [], stirred: false, contentsReady: false },
      "rocks-glass": { liquids: [], strainedIn: false }
    };
    placeCounts = {};
    clearDeposits();
    selectedToolSlug = null;
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.style.outline = "none";
    });
    for (const obj of sceneObjects) {
      obj.userData.draggable = obj.userData.kind !== "vessel";
      obj.position.set(obj.userData.spawnX, obj.userData.spawnY, obj.userData.spawnZ);
    }
    renderSteps();
    refreshControlHint();
    showToast("Station reset.", true);
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
