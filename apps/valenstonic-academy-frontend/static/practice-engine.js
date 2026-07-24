/* global THREE, gsap */
(() => {
  const slug = window.__PRACTICE_SLUG__;
  const renderMode = window.__PRACTICE_MODE__ === "glb" ? "glb" : "procedural";
  const toastEl = document.getElementById("toast");
  const stepListEl = document.getElementById("step-list");
  const recipeNameEl = document.getElementById("recipe-name");
  const scoreTextEl = document.getElementById("score-text");
  const controlHintEl = document.getElementById("control-hint");
  const loadingEl = document.getElementById("loading");
  const gltfLoader = typeof THREE.GLTFLoader === "function" ? new THREE.GLTFLoader() : null;

  let practice = null;
  let currentStepIndex = 0;
  let score = 0;
  let selectedToolSlug = null;
  let vesselState = {
    "mixing-glass": { ice: 0, liquids: [], stirred: false, contentsReady: false },
    "rocks-glass": { ice: 0, liquids: [], garnished: false, strainedIn: false }
  };

  const sceneObjects = [];
  let objectBySlug = {};
  let selectedObject = null;
  let originalY = 0;

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
    } else {
      const next = currentStep();
      const action = practice.actions.find((a) => a.slug === next.action_slug);
      controlHintEl.textContent = action?.ui_hint || next.title;
    }
  }

  function ensureStep(actionSlug, extraCheck) {
    const step = currentStep();
    if (!step) {
      showToast("Already finished. Reset to practice again.", false);
      return false;
    }
    if (step.action_slug !== actionSlug) {
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
        return glass(0.2, 0.32, 0xf8fafc);
      case "rocks_glass":
        return glass(0.16, 0.2, 0xe2e8f0);
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
      }
    });
    scene.add(mesh);
    sceneObjects.push(mesh);
    objectBySlug[asset.slug] = mesh;
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
  }

  function nearVessel(obj, vesselSlug) {
    const vessel = objectBySlug[vesselSlug];
    if (!vessel) return false;
    const dx = obj.position.x - vessel.position.x;
    const dz = obj.position.z - vessel.position.z;
    return Math.sqrt(dx * dx + dz * dz) < 0.55;
  }

  function handleDrop(obj) {
    playClack();
    const step = currentStep();
    if (!step) {
      returnToSpawn(obj);
      return;
    }

    const slugDropped = obj.userData.slug;

    if (step.action_slug === "add-ice" && slugDropped === "ice-bucket") {
      const target = step.target_vessel_slug;
      if (nearVessel(obj, target)) {
        vesselState[target].ice += 1;
        returnToSpawn(obj);
        if (vesselState[target].ice >= Number(step.params.minCubes || 1)) {
          ensureStep("add-ice", () => true);
        } else {
          controlHintEl.textContent = `Ice in ${target}: ${vesselState[target].ice}/${step.params.minCubes || 1}`;
        }
        return;
      }
    }

    if (step.action_slug === "pour" && step.required_asset_slugs.includes(slugDropped)) {
      const target = step.target_vessel_slug;
      if (!nearVessel(obj, target)) {
        returnToSpawn(obj);
        failStep("Pour into the correct vessel.");
        return;
      }
      if (selectedToolSlug && selectedToolSlug !== step.required_tool_slug) {
        returnToSpawn(obj);
        failStep(`Use the ${step.required_tool_slug} for measured pours.`);
        return;
      }
      // Prefer jigger selected, but allow pour if jigger is the required tool and selected OR if no wrong tool selected
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

    if (step.action_slug === "garnish" && step.required_asset_slugs.includes(slugDropped)) {
      const target = step.target_vessel_slug;
      if (nearVessel(obj, target)) {
        gsap.to(obj.position, {
          x: objectBySlug[target].position.x,
          y: 0.28,
          z: objectBySlug[target].position.z,
          duration: 0.35
        });
        obj.userData.draggable = false;
        vesselState[target].garnished = true;
        ensureStep("garnish", () => true);
        return;
      }
    }

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

  function onPointerDown(event) {
    if (event.target.closest("button") || event.target.closest(".glass") || event.target.closest(".top-link")) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(sceneObjects, true);
    if (!hits.length) return;
    let root = hits[0].object;
    while (root.parent && root.parent !== scene) root = root.parent;
    if (!root.userData?.draggable) return;
    controls.enabled = false;
    selectedObject = root;
    originalY = root.position.y;
    gsap.to(root.position, { y: 0.55, duration: 0.18 });
  }

  function onPointerMove(event) {
    if (!selectedObject) return;
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hit = raycaster.intersectObject(guidePlane);
    if (hit.length) {
      selectedObject.position.x = hit[0].point.x;
      selectedObject.position.z = hit[0].point.z;
    }
  }

  function onPointerUp() {
    if (!selectedObject) return;
    handleDrop(selectedObject);
    selectedObject = null;
    controls.enabled = true;
  }

  window.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  window.addEventListener("touchstart", (e) => onPointerDown(e.touches[0]), { passive: false });
  window.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      onPointerMove(e.touches[0]);
    },
    { passive: false }
  );
  window.addEventListener("touchend", onPointerUp);

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

    // Wrong tool trap: if user selected shaker during stir step
    if (selectedToolSlug === "shaker" && step.action_slug === "stir") {
      failStep("Shaking a Negroni fails the practice.");
    }
  });

  document.getElementById("reset-btn").addEventListener("click", () => {
    currentStepIndex = 0;
    score = 0;
    scoreTextEl.textContent = "0";
    vesselState = {
      "mixing-glass": { ice: 0, liquids: [], stirred: false, contentsReady: false },
      "rocks-glass": { ice: 0, liquids: [], garnished: false, strainedIn: false }
    };
    selectedToolSlug = null;
    document.querySelectorAll("[data-tool]").forEach((b) => {
      b.style.outline = "none";
    });
    for (const obj of sceneObjects) {
      obj.userData.draggable = obj.userData.kind !== "vessel";
      obj.position.set(obj.userData.spawnX, obj.userData.spawnY, obj.userData.spawnZ);
    }
    renderSteps();
    controlHintEl.textContent = practice.actions.find((a) => a.slug === practice.steps[0].action_slug)?.ui_hint || "";
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
    controlHintEl.textContent =
      practice.actions.find((a) => a.slug === practice.steps[0]?.action_slug)?.ui_hint ||
      "Follow the process steps.";
    await spawnAssets();
  }

  document.getElementById("enter-btn").addEventListener("click", () => {
    audioCtx.resume();
    loadingEl.style.opacity = "0";
    setTimeout(() => loadingEl.classList.add("hidden"), 450);
    loadingEl.style.pointerEvents = "none";
  });

  boot().catch((err) => {
    console.error(err);
    recipeNameEl.textContent = "Failed to load practice";
  });
})();
