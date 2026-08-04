import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@chiwire/ui/internal";
import { StatusAlert } from "../components/StatusAlert";
import {
  deleteFileShare,
  formatBytes,
  getFileMeta,
  type FileShareMeta,
  type StatusKind
} from "../lib/api";
import { NotFoundPage } from "./NotFoundPage";

export function FilePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<FileShareMeta | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getFileMeta(id);
        if (!cancelled) setMeta(data);
      } catch {
        if (!cancelled) setLoadError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loadError) {
    return <NotFoundPage message="This share is gone or expired." />;
  }

  if (!meta) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const expires = new Date(meta.expiresAt).toLocaleString();

  async function onDelete(): Promise<void> {
    if (!confirm("Delete this file share?")) return;
    setStatus("Deleting…");
    setStatusKind(null);
    try {
      await deleteFileShare(id);
      setStatus("Deleted.");
      setStatusKind("ok");
      setTimeout(() => navigate("/"), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete.");
      setStatusKind("err");
    }
  }

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">
        <Link to="/" className="underline-offset-3 hover:underline">
          ← Contimiti
        </Link>
      </p>
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Shared file</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Download or delete. This file expires {expires}.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{meta.filename}</CardTitle>
          <CardDescription>
            {formatBytes(meta.size)} · {meta.contentType}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={`/api/files/${encodeURIComponent(id)}`}>Download</a>
            </Button>
            <Button type="button" variant="destructive" onClick={() => void onDelete()}>
              Delete
            </Button>
          </div>
          <StatusAlert message={status} kind={statusKind} />
        </CardContent>
      </Card>
    </>
  );
}
