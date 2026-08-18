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

export type FieldKind = "string" | "number" | "boolean" | "null";

export type FacetValue = {
  value: string;
  count: number;
};

export type FieldMeta = {
  path: string;
  kind: FieldKind;
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
