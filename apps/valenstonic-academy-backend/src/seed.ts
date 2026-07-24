import type { AcademyStore } from "./store.js";

function negroniAssets() {
  return [
    {
      slug: "gin-bottle",
      name: "Gin bottle",
      kind: "ingredient",
      model_type: "procedural",
      procedural_key: "bottle_gin",
      glb_url: "/static/models/negroni/gin-bottle.glb",
      collider: { type: "cylinder", radius: 0.12, height: 0.55 },
      spawn: { x: -3.2, y: 0.05, z: 1.2, rotY: 0.2 },
      meta: { liquidColor: "#dbeafe", label: "GIN" }
    },
    {
      slug: "campari-bottle",
      name: "Campari bottle",
      kind: "ingredient",
      model_type: "procedural",
      procedural_key: "bottle_campari",
      glb_url: "/static/models/negroni/campari-bottle.glb",
      collider: { type: "cylinder", radius: 0.12, height: 0.55 },
      spawn: { x: -2.6, y: 0.05, z: 1.2, rotY: -0.1 },
      meta: { liquidColor: "#ef4444", label: "CAMPARI" }
    },
    {
      slug: "vermouth-bottle",
      name: "Sweet vermouth bottle",
      kind: "ingredient",
      model_type: "procedural",
      procedural_key: "bottle_vermouth",
      glb_url: "/static/models/negroni/vermouth-bottle.glb",
      collider: { type: "cylinder", radius: 0.12, height: 0.55 },
      spawn: { x: -2.0, y: 0.05, z: 1.2, rotY: 0.15 },
      meta: { liquidColor: "#7c2d12", label: "VERMOUTH" }
    },
    {
      slug: "ice-bucket",
      name: "Ice cubes",
      kind: "ingredient",
      model_type: "procedural",
      procedural_key: "ice_cubes",
      glb_url: "/static/models/negroni/ice-bucket.glb",
      collider: { type: "box", width: 0.35, height: 0.2, depth: 0.35 },
      spawn: { x: -3.2, y: 0.05, z: 0.4 },
      meta: {}
    },
    {
      slug: "orange-peel",
      name: "Orange peel",
      kind: "garnish",
      model_type: "procedural",
      procedural_key: "orange_peel",
      glb_url: "/static/models/negroni/orange-peel.glb",
      collider: { type: "box", width: 0.2, height: 0.05, depth: 0.08 },
      spawn: { x: -2.4, y: 0.05, z: 0.4 },
      meta: {}
    },
    {
      slug: "mixing-glass",
      name: "Mixing glass",
      kind: "vessel",
      model_type: "procedural",
      procedural_key: "mixing_glass",
      glb_url: "/static/models/negroni/mixing-glass.glb",
      collider: { type: "cylinder", radius: 0.22, height: 0.35 },
      spawn: { x: -0.6, y: 0.05, z: 0.2 },
      meta: { role: "mixing" }
    },
    {
      slug: "rocks-glass",
      name: "Rocks glass",
      kind: "vessel",
      model_type: "procedural",
      procedural_key: "rocks_glass",
      glb_url: "/static/models/negroni/rocks-glass.glb",
      collider: { type: "cylinder", radius: 0.18, height: 0.22 },
      spawn: { x: 0.6, y: 0.05, z: 0.2 },
      meta: { role: "serve" }
    },
    {
      slug: "barspoon",
      name: "Barspoon",
      kind: "tool",
      model_type: "procedural",
      procedural_key: "barspoon",
      glb_url: "/static/models/negroni/barspoon.glb",
      collider: { type: "box", width: 0.04, height: 0.02, depth: 0.55 },
      spawn: { x: 2.2, y: 0.05, z: 1.0 },
      meta: {}
    },
    {
      slug: "jigger",
      name: "Jigger",
      kind: "tool",
      model_type: "procedural",
      procedural_key: "jigger",
      glb_url: "/static/models/negroni/jigger.glb",
      collider: { type: "cylinder", radius: 0.08, height: 0.16 },
      spawn: { x: 2.6, y: 0.05, z: 1.0 },
      meta: {}
    },
    {
      slug: "strainer",
      name: "Hawthorne strainer",
      kind: "tool",
      model_type: "procedural",
      procedural_key: "strainer",
      glb_url: "/static/models/negroni/strainer.glb",
      collider: { type: "cylinder", radius: 0.16, height: 0.06 },
      spawn: { x: 3.0, y: 0.05, z: 1.0 },
      meta: {}
    },
    {
      slug: "shaker",
      name: "Cocktail shaker",
      kind: "tool",
      model_type: "procedural",
      procedural_key: "shaker",
      glb_url: "/static/models/negroni/shaker.glb",
      collider: { type: "cylinder", radius: 0.14, height: 0.4 },
      spawn: { x: 2.6, y: 0.05, z: 0.4 },
      meta: { note: "Wrong tool for a Negroni — stirring only." }
    }
  ] as const;
}

const GENERIC_ACTIONS = [
  {
    slug: "place",
    name: "Place",
    kind: "place",
    params_schema: { minCount: 1, stayOnTarget: false },
    ui_hint: "Drag onto the Mixing glass (taller, left) or Rocks glass (shorter, right)."
  },
  {
    slug: "pour",
    name: "Pour",
    kind: "pour",
    params_schema: { amountMl: 30 },
    ui_hint: "Drag the bottle onto the Mixing glass. Order matters."
  },
  {
    slug: "stir",
    name: "Stir",
    kind: "stir",
    params_schema: { durationMs: 4000, technique: "stir" },
    ui_hint: "Select the barspoon, then Perform action on the Mixing glass."
  },
  {
    slug: "shake",
    name: "Shake",
    kind: "shake",
    params_schema: { durationMs: 4000, technique: "shake" },
    ui_hint: "Shake is wrong for a classic Negroni."
  },
  {
    slug: "strain",
    name: "Strain",
    kind: "strain",
    params_schema: {},
    ui_hint: "Select the strainer, then Perform — into the Rocks glass."
  },
  {
    slug: "measure",
    name: "Measure",
    kind: "measure",
    params_schema: { amountMl: 30 },
    ui_hint: "Use the jigger to measure before pouring."
  }
] as const;

/** Seeds / refreshes Negroni catalog: assets, generic actions, tools, recipe, scene, course. */
export async function seedIfEmpty(store: AcademyStore): Promise<void> {
  const assets = negroniAssets();

  for (const asset of assets) {
    await store.upsertAsset({ ...asset });
  }

  for (const action of GENERIC_ACTIONS) {
    await store.upsertAction(action);
  }
  // Drop leftovers from older seeds (e.g. add-ice, garnish) so admin only shows verbs.
  await store.deleteActionsNotIn(GENERIC_ACTIONS.map((action) => action.slug));

  const allAssets = await store.listAssets();
  const bySlug = Object.fromEntries(allAssets.map((asset) => [asset.slug, asset]));

  await store.upsertTool({
    slug: "barspoon",
    name: "Barspoon",
    asset_id: bySlug["barspoon"]?.id ?? null,
    enabled_actions: ["stir"]
  });
  await store.upsertTool({
    slug: "jigger",
    name: "Jigger",
    asset_id: bySlug["jigger"]?.id ?? null,
    enabled_actions: ["pour", "measure"]
  });
  await store.upsertTool({
    slug: "strainer",
    name: "Strainer",
    asset_id: bySlug["strainer"]?.id ?? null,
    enabled_actions: ["strain"]
  });
  await store.upsertTool({
    slug: "shaker",
    name: "Shaker",
    asset_id: bySlug["shaker"]?.id ?? null,
    enabled_actions: ["shake"]
  });

  const recipeId = await store.upsertRecipe({
    slug: "negroni",
    name: "Negroni",
    description:
      "Equal parts gin, Campari, and sweet vermouth. Stirred over ice, strained over fresh ice, orange peel garnish. Order and technique matter.",
    category: "cocktail"
  });

  // Always refresh Negroni steps so generic actions stay in sync.
  await store.replaceRecipeSteps(recipeId, [
    {
      step_order: 1,
      title: "Place ice in the mixing glass",
      action_slug: "place",
      required_asset_slugs: ["ice-bucket"],
      target_vessel_slug: "mixing-glass",
      params: { minCount: 3 },
      success_message: "Mixing glass is properly chilled.",
      failure_message: "Place ice in the mixing glass first."
    },
    {
      step_order: 2,
      title: "Pour gin (30 ml)",
      action_slug: "pour",
      required_tool_slug: "jigger",
      required_asset_slugs: ["gin-bottle"],
      target_vessel_slug: "mixing-glass",
      params: { amountMl: 30 },
      success_message: "Gin in.",
      failure_message: "Pour gin into the mixing glass — and in the right order."
    },
    {
      step_order: 3,
      title: "Pour Campari (30 ml)",
      action_slug: "pour",
      required_tool_slug: "jigger",
      required_asset_slugs: ["campari-bottle"],
      target_vessel_slug: "mixing-glass",
      params: { amountMl: 30 },
      success_message: "Campari in.",
      failure_message: "Campari next, into the mixing glass."
    },
    {
      step_order: 4,
      title: "Pour sweet vermouth (30 ml)",
      action_slug: "pour",
      required_tool_slug: "jigger",
      required_asset_slugs: ["vermouth-bottle"],
      target_vessel_slug: "mixing-glass",
      params: { amountMl: 30 },
      success_message: "Vermouth in. Ready to stir.",
      failure_message: "Vermouth goes into the mixing glass after Campari."
    },
    {
      step_order: 5,
      title: "Stir 8–12 seconds (do not shake)",
      action_slug: "stir",
      required_tool_slug: "barspoon",
      target_vessel_slug: "mixing-glass",
      params: { durationMs: 4000, technique: "stir" },
      success_message: "Silky and diluted — classic stir.",
      failure_message: "Use the barspoon and stir. Shaking a Negroni is a hard fail."
    },
    {
      step_order: 6,
      title: "Place fresh ice in the rocks glass",
      action_slug: "place",
      required_asset_slugs: ["ice-bucket"],
      target_vessel_slug: "rocks-glass",
      params: { minCount: 2 },
      success_message: "Service glass ready.",
      failure_message: "Place fresh ice in the rocks glass before straining."
    },
    {
      step_order: 7,
      title: "Strain into the rocks glass",
      action_slug: "strain",
      required_tool_slug: "strainer",
      required_asset_slugs: ["mixing-glass"],
      target_vessel_slug: "rocks-glass",
      params: {},
      success_message: "Clean strain — no ice shards.",
      failure_message: "Strain from mixing glass into rocks glass with the strainer."
    },
    {
      step_order: 8,
      title: "Place orange peel on the rocks glass",
      action_slug: "place",
      required_asset_slugs: ["orange-peel"],
      target_vessel_slug: "rocks-glass",
      params: { minCount: 1, stayOnTarget: true },
      success_message: "Negroni complete. Salute.",
      failure_message: "Place the orange peel on the rocks glass."
    }
  ]);

  const sceneId = await store.upsertScene({
    slug: "negroni",
    name: "Negroni bar practice",
    recipe_id: recipeId,
    environment_key: "bar_counter",
    available_asset_slugs: assets.map((asset) => asset.slug),
    available_tool_slugs: ["barspoon", "jigger", "strainer", "shaker"]
  });

  const courses = await store.listCourses();
  if (courses.length > 0) {
    return;
  }

  const courseId = await store.upsertCourse({
    slug: "classic-cocktails-lab",
    name: "Classic Cocktails Lab",
    description: "Thin course wrapper around interactive bar practices. Starts with the Negroni.",
    category: "cocktails"
  });

  await store.replaceCourseLessons(courseId, [
    {
      lesson_order: 1,
      title: "Why order and technique matter",
      kind: "text",
      body: "A Negroni is equal parts, stirred not shaken. Build in a mixing glass over ice, then strain over fresh ice. Wrong tool or wrong order fails the practice."
    },
    {
      lesson_order: 2,
      title: "Interactive: Build a Negroni",
      kind: "interactive",
      interactive_scene_id: sceneId
    }
  ]);
}
