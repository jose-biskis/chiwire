import { readFileSync } from "node:fs";

import type {
  CatalogMeta,
  FacetValue,
  FieldFilter,
  FieldKind,
  FieldMeta,
  FilterOp,
  MediaDetail,
  MediaResource,
  MediaSummary,
  QueryResult,
} from "./types.js";
import { FILTER_OPS } from "./types.js";

const HASHTAG_RE = /#[\p{L}\p{N}_]+/gu;
const SKIP_FLATTEN = new Set([
  "video_dash_manifest",
  "video_versions",
  "image_versions",
  "resources",
  "clips_metadata",
  "thumbnail_url",
  "video_url",
  "profile_pic_url",
  "profile_pic_url_hd",
]);
const FACET_VALUE_LIMIT = 40;
const HASHTAG_FACET_LIMIT = 48;

type Scalar = string | number | boolean | null;

type ResourceUrls = {
  thumbUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  mediaType: number;
};

export type IndexedMedia = {
  pk: string;
  summary: MediaSummary;
  scalars: Record<string, Scalar>;
  hashtags: string[];
  searchText: string;
  thumbUrl: string | null;
  videoUrl: string | null;
  imageUrl: string | null;
  resources: ResourceUrls[];
};

export function isFilterOp(value: string): value is FilterOp {
  return (FILTER_OPS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function firstUrl(versions: unknown): string | null {
  if (!Array.isArray(versions) || versions.length === 0) {
    return null;
  }
  const first = asRecord(versions[0]);
  return first ? asString(first.url) : null;
}

function pickThumb(post: Record<string, unknown>, resources: ResourceUrls[]): string | null {
  return (
    asString(post.thumbnail_url) ??
    firstUrl(post.image_versions) ??
    resources[0]?.thumbUrl ??
    resources[0]?.imageUrl ??
    null
  );
}

function pickVideo(post: Record<string, unknown>, resources: ResourceUrls[]): string | null {
  return asString(post.video_url) ?? firstUrl(post.video_versions) ?? resources[0]?.videoUrl ?? null;
}

function pickImage(post: Record<string, unknown>, resources: ResourceUrls[]): string | null {
  return firstUrl(post.image_versions) ?? asString(post.thumbnail_url) ?? resources[0]?.imageUrl ?? null;
}

function parseResources(post: Record<string, unknown>): ResourceUrls[] {
  const raw = post.resources;
  if (!Array.isArray(raw)) {
    return [];
  }
  const items: ResourceUrls[] = [];
  for (const entry of raw) {
    const row = asRecord(entry);
    if (!row) {
      continue;
    }
    items.push({
      thumbUrl: asString(row.thumbnail_url) ?? firstUrl(row.image_versions),
      videoUrl: asString(row.video_url) ?? firstUrl(row.video_versions),
      imageUrl: firstUrl(row.image_versions) ?? asString(row.thumbnail_url),
      mediaType: asNumber(row.media_type),
    });
  }
  return items;
}

function instagramUrl(code: string, productType: string): string {
  if (productType === "clips" || productType === "igtv") {
    return `https://www.instagram.com/reel/${code}/`;
  }
  return `https://www.instagram.com/p/${code}/`;
}

function extractHashtags(caption: string): string[] {
  const found = caption.match(HASHTAG_RE) ?? [];
  const unique = new Set(found.map((tag) => tag.toLowerCase()));
  return [...unique];
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function flatten(value: unknown, prefix: string, out: Record<string, Scalar>, depth: number): void {
  if (depth > 4 || value === undefined) {
    return;
  }
  if (value === null) {
    if (prefix) {
      out[prefix] = null;
    }
    return;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (prefix) {
      out[prefix] = value;
    }
    return;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return;
    }
    if (value.every((item) => typeof item !== "object" || item === null)) {
      out[prefix] = value.map((item) => String(item)).join(", ");
    }
    return;
  }
  const record = asRecord(value);
  if (!record) {
    return;
  }
  for (const [key, child] of Object.entries(record)) {
    if (SKIP_FLATTEN.has(key)) {
      continue;
    }
    const path = prefix ? `${prefix}.${key}` : key;
    flatten(child, path, out, depth + 1);
  }
}

function inferKind(values: Iterable<Scalar>): FieldKind {
  let sawString = false;
  let sawNumber = false;
  let sawBoolean = false;
  let sawNull = false;
  for (const value of values) {
    if (value === null) {
      sawNull = true;
    } else if (typeof value === "number") {
      sawNumber = true;
    } else if (typeof value === "boolean") {
      sawBoolean = true;
    } else {
      sawString = true;
    }
  }
  if (sawString) {
    return "string";
  }
  if (sawNumber && !sawBoolean) {
    return "number";
  }
  if (sawBoolean && !sawNumber) {
    return "boolean";
  }
  if (sawNull && !sawNumber && !sawBoolean && !sawString) {
    return "null";
  }
  return "string";
}

function countValues(values: Iterable<string>): FacetValue[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([value, count]) => ({ value, count }));
}

function fuzzyScore(haystack: string, query: string): number {
  const hay = fold(haystack);
  const needle = fold(query).trim();
  if (!needle) {
    return 1;
  }
  const index = hay.indexOf(needle);
  if (index >= 0) {
    return 1.2 - Math.min(index, 200) / 1000;
  }
  const tokens = needle.split(/\s+/).filter(Boolean);
  if (tokens.length > 1 && tokens.every((token) => hay.includes(token))) {
    return 0.85;
  }
  let cursor = 0;
  let gaps = 0;
  for (const char of needle.replace(/\s+/g, "")) {
    const found = hay.indexOf(char, cursor);
    if (found === -1) {
      return 0;
    }
    gaps += found - cursor;
    cursor = found + 1;
  }
  return Math.max(0.2, 0.55 - gaps / Math.max(hay.length, 1));
}

function compareFilter(actual: Scalar | undefined, filter: FieldFilter): boolean {
  if (filter.op === "exists") {
    return actual !== undefined && actual !== null && actual !== "";
  }
  if (filter.op === "missing") {
    return actual === undefined || actual === null || actual === "";
  }
  if (actual === undefined || actual === null) {
    return false;
  }
  const actualText = String(actual);
  if (filter.op === "eq") {
    return fold(actualText) === fold(filter.value);
  }
  if (filter.op === "neq") {
    return fold(actualText) !== fold(filter.value);
  }
  if (filter.op === "contains") {
    return fold(actualText).includes(fold(filter.value));
  }
  const left = typeof actual === "number" ? actual : Number(actual);
  const right = Number(filter.value);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  if (filter.op === "gte") {
    return left >= right;
  }
  if (filter.op === "lte") {
    return left <= right;
  }
  if (filter.op === "gt") {
    return left > right;
  }
  return left < right;
}

function scalarOf(media: IndexedMedia, field: string): Scalar | undefined {
  if (field === "hashtags") {
    return media.hashtags.join(" ");
  }
  if (field === "has_video") {
    return media.summary.hasVideo;
  }
  if (field === "has_location") {
    return media.summary.locationName != null;
  }
  if (field === "resource_count") {
    return media.summary.resourceCount;
  }
  return media.scalars[field];
}

function toSummaryResources(media: IndexedMedia): MediaResource[] {
  if (media.resources.length === 0) {
    return [
      {
        index: 0,
        mediaType: media.summary.mediaType,
        hasVideo: media.summary.hasVideo,
      },
    ];
  }
  return media.resources.map((resource, index) => ({
    index,
    mediaType: resource.mediaType,
    hasVideo: Boolean(resource.videoUrl),
  }));
}

export class MediaCatalog {
  readonly sourcePath: string;
  readonly dumpRows: number;
  readonly loadedAt: string;
  readonly items: IndexedMedia[];
  readonly byPk: Map<string, IndexedMedia>;
  readonly meta: CatalogMeta;

  constructor(sourcePath: string) {
    this.sourcePath = sourcePath;
    const raw = readFileSync(sourcePath, "utf8");
    const chunks = raw
      .split("--- POST SEPARATOR ---")
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    this.dumpRows = chunks.length;
    this.byPk = new Map();

    for (const chunk of chunks) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(chunk);
      } catch {
        continue;
      }
      const post = asRecord(parsed);
      if (!post) {
        continue;
      }
      const pk = asString(post.pk);
      if (!pk || this.byPk.has(pk)) {
        continue;
      }

      const resources = parseResources(post);
      const user = asRecord(post.user) ?? {};
      const location = asRecord(post.location);
      const caption = asString(post.caption_text) ?? "";
      const hashtags = extractHashtags(caption);
      const code = asString(post.code) ?? pk;
      const productType = asString(post.product_type) ?? "unknown";
      const thumbUrl = pickThumb(post, resources);
      const videoUrl = pickVideo(post, resources);
      const imageUrl = pickImage(post, resources);

      const scalars: Record<string, Scalar> = {};
      flatten(post, "", scalars, 0);
      scalars.hashtags = hashtags.join(" ");
      scalars.has_video = Boolean(videoUrl);
      scalars.has_location = location != null;
      scalars.resource_count = resources.length;

      const summary: MediaSummary = {
        pk,
        code,
        takenAt: asString(post.taken_at) ?? "",
        takenAtTs: asNumber(post.taken_at_ts),
        productType,
        mediaType: asNumber(post.media_type),
        captionText: caption,
        likeCount: asNumber(post.like_count),
        playCount: asNumber(post.play_count),
        commentCount: asNumber(post.comment_count),
        videoDuration: asNumber(post.video_duration),
        locationName: location ? asString(location.name) : null,
        username: asString(user.username) ?? "",
        fullName: asString(user.full_name) ?? "",
        hasVideo: Boolean(videoUrl),
        hashtags,
        instagramUrl: instagramUrl(code, productType),
        resourceCount: resources.length,
      };

      const searchText = [
        caption,
        code,
        pk,
        summary.username,
        summary.fullName,
        summary.locationName ?? "",
        productType,
        hashtags.join(" "),
        Object.entries(scalars)
          .filter(([key]) => !key.endsWith("_url"))
          .map(([, value]) => String(value ?? ""))
          .join(" "),
      ].join("\n");

      this.byPk.set(pk, {
        pk,
        summary,
        scalars,
        hashtags,
        searchText,
        thumbUrl,
        videoUrl,
        imageUrl,
        resources,
      });
    }

    this.items = [...this.byPk.values()].sort((left, right) => right.summary.takenAtTs - left.summary.takenAtTs);
    this.loadedAt = new Date().toISOString();
    this.meta = this.buildMeta();
  }

  private buildMeta(): CatalogMeta {
    const fieldValues = new Map<string, Scalar[]>();
    for (const item of this.items) {
      for (const [path, value] of Object.entries(item.scalars)) {
        const bucket = fieldValues.get(path);
        if (bucket) {
          bucket.push(value);
        } else {
          fieldValues.set(path, [value]);
        }
      }
    }

    const fields: FieldMeta[] = [...fieldValues.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, values]) => {
        const unique = [...new Set(values.map((value) => String(value)))];
        const field: FieldMeta = {
          path,
          kind: inferKind(values),
          uniqueCount: unique.length,
        };
        if (unique.length <= FACET_VALUE_LIMIT) {
          field.values = countValues(values.map((value) => String(value)));
        }
        return field;
      });

    const dates = this.items.map((item) => item.summary.takenAt).filter(Boolean);

    return {
      sourcePath: this.sourcePath,
      dumpRows: this.dumpRows,
      uniquePosts: this.items.length,
      loadedAt: this.loadedAt,
      dateMin: dates.at(-1) ?? dates[0] ?? null,
      dateMax: dates[0] ?? null,
      fields,
      facets: {
        productType: countValues(this.items.map((item) => item.summary.productType)),
        mediaType: countValues(this.items.map((item) => String(item.summary.mediaType))),
        locationName: countValues(
          this.items
            .map((item) => item.summary.locationName)
            .filter((value): value is string => Boolean(value)),
        ).slice(0, FACET_VALUE_LIMIT),
        hashtags: countValues(this.items.flatMap((item) => item.hashtags)).slice(0, HASHTAG_FACET_LIMIT),
      },
    };
  }

  query(options: {
    q: string;
    filters: FieldFilter[];
    sort: string;
    dir: "asc" | "desc";
    page: number;
    limit: number;
  }): QueryResult {
    let matched = this.items.filter((item) =>
      options.filters.every((filter) => compareFilter(scalarOf(item, filter.field), filter)),
    );

    if (options.q.trim()) {
      const scored = matched
        .map((item) => ({ item, score: fuzzyScore(item.searchText, options.q) }))
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);
      matched = scored.map((entry) => entry.item);
    } else {
      const dir = options.dir === "asc" ? 1 : -1;
      matched = [...matched].sort((left, right) => {
        const leftValue = scalarOf(left, options.sort);
        const rightValue = scalarOf(right, options.sort);
        if (typeof leftValue === "number" && typeof rightValue === "number") {
          return (leftValue - rightValue) * dir;
        }
        return String(leftValue ?? "").localeCompare(String(rightValue ?? "")) * dir;
      });
    }

    const page = Math.max(1, options.page);
    const limit = Math.min(96, Math.max(1, options.limit));
    const start = (page - 1) * limit;
    return {
      total: matched.length,
      page,
      limit,
      items: matched.slice(start, start + limit).map((item) => item.summary),
    };
  }

  detail(pk: string): MediaDetail | null {
    const item = this.byPk.get(pk);
    if (!item) {
      return null;
    }
    const fields = Object.entries(item.scalars)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([path, value]) => ({ path, value: value == null ? "" : String(value) }));
    return {
      summary: item.summary,
      fields,
      resources: toSummaryResources(item),
    };
  }

  assetUrl(pk: string, kind: "thumb" | "video" | "image", resourceIndex: number | null): string | null {
    const item = this.byPk.get(pk);
    if (!item) {
      return null;
    }
    if (resourceIndex != null) {
      const resource = item.resources[resourceIndex];
      if (!resource) {
        return null;
      }
      if (kind === "video") {
        return resource.videoUrl;
      }
      if (kind === "image") {
        return resource.imageUrl ?? resource.thumbUrl;
      }
      return resource.thumbUrl ?? resource.imageUrl;
    }
    if (kind === "video") {
      return item.videoUrl;
    }
    if (kind === "image") {
      return item.imageUrl ?? item.thumbUrl;
    }
    return item.thumbUrl ?? item.imageUrl;
  }
}
