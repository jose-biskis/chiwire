export const FILTER_OPS = [
  "eq",
  "neq",
  "contains",
  "gte",
  "lte",
  "gt",
  "lt",
  "exists",
  "missing",
] as const;

export type FilterOp = (typeof FILTER_OPS)[number];

export type FacetValue = {
  value: string;
  count: number;
};

export type FieldMeta = {
  path: string;
  kind: "string" | "number" | "boolean" | "null";
  uniqueCount: number;
  values?: FacetValue[];
};

export type FieldFilter = {
  field: string;
  op: FilterOp;
  value: string;
};

export type MediaResource = {
  index: number;
  mediaType: number;
  hasVideo: boolean;
};

export type MediaSummary = {
  pk: string;
  code: string;
  takenAt: string;
  takenAtTs: number;
  productType: string;
  mediaType: number;
  captionText: string;
  likeCount: number;
  playCount: number;
  commentCount: number;
  videoDuration: number;
  locationName: string | null;
  username: string;
  fullName: string;
  hasVideo: boolean;
  hashtags: string[];
  instagramUrl: string;
  resourceCount: number;
};

export type QueryResult = {
  total: number;
  page: number;
  limit: number;
  items: MediaSummary[];
};

export type CatalogMeta = {
  sourcePath: string;
  dumpRows: number;
  uniquePosts: number;
  loadedAt: string;
  dateMin: string | null;
  dateMax: string | null;
  fields: FieldMeta[];
  facets: {
    productType: FacetValue[];
    mediaType: FacetValue[];
    locationName: FacetValue[];
    hashtags: FacetValue[];
  };
};

export type MediaDetail = {
  summary: MediaSummary;
  fields: Array<{ path: string; value: string }>;
  resources: MediaResource[];
};

async function readError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error ?? `HTTP ${response.status}`;
  } catch {
    return `HTTP ${response.status}`;
  }
}

export async function fetchMeta(): Promise<CatalogMeta> {
  const response = await fetch("/api/meta");
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as CatalogMeta;
}

export async function fetchMedias(options: {
  q: string;
  filters: FieldFilter[];
  sort: string;
  dir: "asc" | "desc";
  page: number;
  limit: number;
}): Promise<QueryResult> {
  const params = new URLSearchParams({
    q: options.q,
    sort: options.sort,
    dir: options.dir,
    page: String(options.page),
    limit: String(options.limit),
  });
  for (const filter of options.filters) {
    params.append("f", `${filter.field}:${filter.op}:${filter.value}`);
  }
  const response = await fetch(`/api/medias?${params}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as QueryResult;
}

export async function fetchDetail(pk: string): Promise<MediaDetail> {
  const response = await fetch(`/api/medias/${encodeURIComponent(pk)}`);
  if (!response.ok) {
    throw new Error(await readError(response));
  }
  return (await response.json()) as MediaDetail;
}

export function thumbSrc(pk: string, resourceIndex?: number): string {
  if (resourceIndex == null) {
    return `/api/asset/${encodeURIComponent(pk)}/thumb`;
  }
  return `/api/asset/${encodeURIComponent(pk)}/resource/${resourceIndex}/thumb`;
}

export function videoSrc(pk: string, resourceIndex?: number): string {
  if (resourceIndex == null) {
    return `/api/asset/${encodeURIComponent(pk)}/video`;
  }
  return `/api/asset/${encodeURIComponent(pk)}/resource/${resourceIndex}/video`;
}

export function imageSrc(pk: string, resourceIndex?: number): string {
  if (resourceIndex == null) {
    return `/api/asset/${encodeURIComponent(pk)}/image`;
  }
  return `/api/asset/${encodeURIComponent(pk)}/resource/${resourceIndex}/image`;
}
