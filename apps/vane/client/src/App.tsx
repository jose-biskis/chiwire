import { useEffect, useMemo, useState } from "react";

import {
  Badge,
  Button,
  Input,
  Label,
  ScrollArea,
  Separator,
  Switch,
} from "@chiwire/ui/internal";

import {
  FILTER_OPS,
  fetchDetail,
  fetchMedias,
  fetchMeta,
  imageSrc,
  thumbSrc,
  videoSrc,
  type CatalogMeta,
  type FieldFilter,
  type FilterOp,
  type MediaDetail,
  type MediaSummary,
} from "./api";

const PAGE_SIZE = 36;
const SORTS = [
  { value: "taken_at_ts", label: "Date" },
  { value: "like_count", label: "Likes" },
  { value: "play_count", label: "Plays" },
  { value: "comment_count", label: "Comments" },
  { value: "video_duration", label: "Duration" },
] as const;

function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

function formatDate(iso: string): string {
  if (!iso) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function formatDuration(seconds: number): string {
  if (!seconds) {
    return "";
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function kindLabel(productType: string, mediaType: number): string {
  if (productType === "carousel_container" || mediaType === 8) {
    return "carousel";
  }
  if (productType === "igtv") {
    return "igtv";
  }
  if (productType === "clips") {
    return "reel";
  }
  return mediaType === 2 ? "video" : "photo";
}

function captionPreview(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function MediaCard({
  item,
  onOpen,
}: {
  item: MediaSummary;
  onOpen: (pk: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const preview = captionPreview(item.captionText);

  return (
    <button
      type="button"
      className="vane-card"
      data-playing={playing ? "true" : "false"}
      onClick={() => onOpen(item.pk)}
      onMouseEnter={() => {
        if (item.hasVideo) {
          setPlaying(true);
        }
      }}
      onMouseLeave={() => setPlaying(false)}
    >
      <div className="vane-frame">
        {broken ? (
          <div className="vane-missing">no still</div>
        ) : (
          <img
            src={thumbSrc(item.pk)}
            alt=""
            loading="lazy"
            onError={() => setBroken(true)}
          />
        )}
        {item.hasVideo ? (
          <video
            muted
            loop
            playsInline
            preload="none"
            poster={thumbSrc(item.pk)}
            src={playing ? videoSrc(item.pk) : undefined}
            onLoadedData={(event) => {
              void event.currentTarget.play().catch(() => undefined);
            }}
          />
        ) : null}
        <div className="vane-card-meta">
          <div className="vane-card-kicker">
            <span>
              {kindLabel(item.productType, item.mediaType)}
              {item.resourceCount > 1 ? ` · ${item.resourceCount}` : ""}
            </span>
            <span>{formatDuration(item.videoDuration) || compact(item.likeCount)}</span>
          </div>
          {preview ? <p className="vane-caption">{preview}</p> : null}
        </div>
      </div>
    </button>
  );
}

function Lightbox({
  detail,
  slide,
  onSlide,
  onClose,
  onHashtag,
}: {
  detail: MediaDetail;
  slide: number;
  onSlide: (index: number) => void;
  onClose: () => void;
  onHashtag: (tag: string) => void;
}) {
  const { summary, resources, fields } = detail;
  const current = resources[slide] ?? resources[0];
  const resourceIndex = current && resources.length > 1 ? current.index : undefined;
  const showVideo = current?.hasVideo ?? summary.hasVideo;

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowRight") {
        onSlide((slide + 1) % Math.max(resources.length, 1));
      }
      if (event.key === "ArrowLeft") {
        onSlide((slide - 1 + Math.max(resources.length, 1)) % Math.max(resources.length, 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onSlide, resources.length, slide]);

  return (
    <div className="vane-lightbox" role="dialog" aria-modal="true">
      <div className="vane-stage">
        {showVideo ? (
          <video
            key={`${summary.pk}-${slide}-video`}
            controls
            autoPlay
            playsInline
            poster={thumbSrc(summary.pk, resourceIndex)}
            src={videoSrc(summary.pk, resourceIndex)}
          />
        ) : (
          <img
            key={`${summary.pk}-${slide}-image`}
            src={imageSrc(summary.pk, resourceIndex)}
            alt={captionPreview(summary.captionText) || summary.code}
          />
        )}
        {resources.length > 1 ? (
          <>
            <button
              type="button"
              className="vane-nav"
              data-side="prev"
              onClick={() => onSlide((slide - 1 + resources.length) % resources.length)}
            >
              ‹
            </button>
            <button
              type="button"
              className="vane-nav"
              data-side="next"
              onClick={() => onSlide((slide + 1) % resources.length)}
            >
              ›
            </button>
          </>
        ) : null}
      </div>
      <aside className="vane-inspect">
        <div className="vane-toolbar" style={{ marginBottom: "0.8rem" }}>
          <Badge>{kindLabel(summary.productType, summary.mediaType)}</Badge>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <h2>{summary.code}</h2>
        <p className="vane-lede" style={{ marginBottom: "0.8rem" }}>
          {formatDate(summary.takenAt)}
          {summary.locationName ? ` · ${summary.locationName}` : ""}
        </p>
        {summary.captionText ? (
          <p style={{ whiteSpace: "pre-wrap", fontSize: "0.92rem", lineHeight: 1.45 }}>
            {summary.captionText}
          </p>
        ) : null}
        <div className="vane-chips" style={{ margin: "0.8rem 0" }}>
          {summary.hashtags.map((tag) => (
            <button key={tag} type="button" className="vane-chip" onClick={() => onHashtag(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <dl className="vane-kv">
          <dt>Likes</dt>
          <dd>{summary.likeCount}</dd>
          <dt>Plays</dt>
          <dd>{summary.playCount}</dd>
          <dt>Comments</dt>
          <dd>{summary.commentCount}</dd>
          <dt>User</dt>
          <dd>
            @{summary.username}
            {summary.fullName ? ` · ${summary.fullName}` : ""}
          </dd>
          <dt>Instagram</dt>
          <dd>
            <a href={summary.instagramUrl} target="_blank" rel="noreferrer">
              Open post
            </a>
          </dd>
        </dl>
        <Separator className="my-4" />
        <p className="vane-label">All fields</p>
        <ScrollArea className="h-[42vh] mt-2">
          <dl className="vane-kv">
            {fields.map((field) => (
              <FragmentRow key={field.path} path={field.path} value={field.value} />
            ))}
          </dl>
        </ScrollArea>
      </aside>
    </div>
  );
}

function FragmentRow({ path, value }: { path: string; value: string }) {
  if (!value) {
    return null;
  }
  return (
    <>
      <dt>{path}</dt>
      <dd>{value}</dd>
    </>
  );
}

export function App() {
  const [meta, setMeta] = useState<CatalogMeta | null>(null);
  const [items, setItems] = useState<MediaSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filters, setFilters] = useState<FieldFilter[]>([]);
  const [sort, setSort] = useState("taken_at_ts");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<MediaDetail | null>(null);
  const [slide, setSlide] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 220);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    void fetchMeta()
      .then(setMeta)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load catalog");
      });
  }, []);

  useEffect(() => {
    setReady(false);
    void fetchMedias({
      q: debouncedQ,
      filters,
      sort,
      dir,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setError(null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => setReady(true));
  }, [debouncedQ, dir, filters, page, sort]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fieldOptions = useMemo(() => meta?.fields.map((field) => field.path) ?? [], [meta]);

  function addFilter() {
    const field = fieldOptions[0] ?? "caption_text";
    setPage(1);
    setFilters((current) => [...current, { field, op: "contains", value: "" }]);
  }

  function updateFilter(index: number, patch: Partial<FieldFilter>) {
    setPage(1);
    setFilters((current) =>
      current.map((filter, filterIndex) => (filterIndex === index ? { ...filter, ...patch } : filter)),
    );
  }

  function removeFilter(index: number) {
    setPage(1);
    setFilters((current) => current.filter((_, filterIndex) => filterIndex !== index));
  }

  function toggleFacet(field: string, value: string) {
    setPage(1);
    setFilters((current) => {
      const match = current.findIndex(
        (filter) => filter.field === field && filter.op === "eq" && filter.value === value,
      );
      if (match >= 0) {
        return current.filter((_, index) => index !== match);
      }
      return [...current, { field, op: "eq", value }];
    });
  }

  async function openDetail(pk: string) {
    try {
      const payload = await fetchDetail(pk);
      setDetail(payload);
      setSlide(0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to open media");
    }
  }

  const productOn = (value: string) =>
    filters.some((filter) => filter.field === "product_type" && filter.op === "eq" && filter.value === value);

  return (
    <div className="vane-app">
      <aside className="vane-rail">
        <p className="vane-brand">Vane</p>
        <p className="vane-lede">
          Internal media well for the Instagram dump. Fuzzy search across every indexed field; add
          exact filters for anything else.
        </p>

        <div className="vane-stack">
          <div className="vane-field">
            <Label htmlFor="vane-q" className="vane-label">
              Fuzzy search
            </Label>
            <Input
              id="vane-q"
              value={q}
              onChange={(event) => {
                setPage(1);
                setQ(event.target.value);
              }}
              placeholder="caption, hashtag, place, code…"
            />
          </div>

          <div>
            <p className="vane-label">Kind</p>
            <div className="vane-chips" style={{ marginTop: "0.4rem" }}>
              {(meta?.facets.productType ?? []).map((facet) => (
                <button
                  key={facet.value}
                  type="button"
                  className="vane-chip"
                  data-on={productOn(facet.value) ? "true" : "false"}
                  onClick={() => toggleFacet("product_type", facet.value)}
                >
                  {facet.value} {facet.count}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="vane-label">Hashtags</p>
            <div className="vane-chips" style={{ marginTop: "0.4rem" }}>
              {(meta?.facets.hashtags ?? []).slice(0, 18).map((facet) => (
                <button
                  key={facet.value}
                  type="button"
                  className="vane-chip"
                  data-on={
                    filters.some(
                      (filter) =>
                        filter.field === "hashtags" &&
                        filter.op === "contains" &&
                        filter.value === facet.value,
                    )
                      ? "true"
                      : "false"
                  }
                  onClick={() => {
                    setPage(1);
                    setFilters((current) => {
                      const match = current.findIndex(
                        (filter) =>
                          filter.field === "hashtags" &&
                          filter.op === "contains" &&
                          filter.value === facet.value,
                      );
                      if (match >= 0) {
                        return current.filter((_, index) => index !== match);
                      }
                      return [...current, { field: "hashtags", op: "contains", value: facet.value }];
                    });
                  }}
                >
                  {facet.value}
                </button>
              ))}
            </div>
          </div>

          <Separator />

          <div className="vane-stack">
            <div className="vane-toolbar" style={{ marginBottom: 0 }}>
              <p className="vane-label" style={{ margin: 0 }}>
                Field filters
              </p>
              <Button type="button" size="sm" variant="outline" onClick={addFilter}>
                Add
              </Button>
            </div>
            {filters
              .filter((filter) => filter.field !== "product_type" && filter.field !== "hashtags")
              .map((filter) => {
                const index = filters.indexOf(filter);
                const fieldMeta = meta?.fields.find((field) => field.path === filter.field);
                return (
                  <div key={`${filter.field}-${index}`} className="vane-filter-row">
                    <select
                      className="vane-select"
                      value={filter.field}
                      onChange={(event) => updateFilter(index, { field: event.target.value })}
                    >
                      {fieldOptions.map((path) => (
                        <option key={path} value={path}>
                          {path}
                        </option>
                      ))}
                    </select>
                    <select
                      className="vane-select"
                      value={filter.op}
                      onChange={(event) => updateFilter(index, { op: event.target.value as FilterOp })}
                    >
                      {FILTER_OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    {fieldMeta?.values ? (
                      <select
                        className="vane-select"
                        value={filter.value}
                        onChange={(event) => updateFilter(index, { value: event.target.value })}
                      >
                        <option value="">any</option>
                        {fieldMeta.values.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.value}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        className="vane-filter-value"
                        value={filter.value}
                        onChange={(event) => updateFilter(index, { value: event.target.value })}
                      />
                    )}
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeFilter(index)}>
                      ×
                    </Button>
                  </div>
                );
              })}
          </div>

          <div className="vane-field">
            <Label htmlFor="vane-sort" className="vane-label">
              Sort
            </Label>
            <select
              id="vane-sort"
              className="vane-select"
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value);
              }}
            >
              {SORTS.map((entry) => (
                <option key={entry.value} value={entry.value}>
                  {entry.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <Switch
                id="vane-dir"
                checked={dir === "desc"}
                onCheckedChange={(checked) => {
                  setPage(1);
                  setDir(checked ? "desc" : "asc");
                }}
              />
              <Label htmlFor="vane-dir">{dir === "desc" ? "Descending" : "Ascending"}</Label>
            </div>
          </div>
        </div>
      </aside>

      <main className="vane-main">
        <div className="vane-toolbar">
          <p className="vane-count">
            {ready ? `${compact(total)} shown` : "Loading…"}
            {meta
              ? ` · ${compact(meta.uniquePosts)} unique / ${compact(meta.dumpRows)} dump rows`
              : ""}
            {meta?.dateMin && meta.dateMax ? ` · ${formatDate(meta.dateMin)} → ${formatDate(meta.dateMax)}` : ""}
          </p>
        </div>
        {error ? <p className="vane-error">{error}</p> : null}
        <div className="vane-grid">
          {items.map((item) => (
            <MediaCard key={item.pk} item={item} onOpen={(pk) => void openDetail(pk)} />
          ))}
        </div>
        <div className="vane-pager">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
            Prev
          </Button>
          <span className="vane-count">
            {page} / {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page >= pages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </main>

      {detail ? (
        <Lightbox
          detail={detail}
          slide={slide}
          onSlide={setSlide}
          onClose={() => setDetail(null)}
          onHashtag={(tag) => {
            setDetail(null);
            setPage(1);
            setFilters((current) => {
              if (
                current.some(
                  (filter) => filter.field === "hashtags" && filter.op === "contains" && filter.value === tag,
                )
              ) {
                return current;
              }
              return [...current, { field: "hashtags", op: "contains", value: tag }];
            });
          }}
        />
      ) : null}
    </div>
  );
}
