import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  Label,
  Textarea
} from "@chiwire/ui/internal";
import { StatusAlert } from "../components/StatusAlert";
import { getTextShare, updateTextShare, type StatusKind, type TextShare } from "../lib/api";
import { NotFoundPage } from "./NotFoundPage";

export function TextPage() {
  const { id = "" } = useParams();
  const [share, setShare] = useState<TextShare | null>(null);
  const [content, setContent] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await getTextShare(id);
        if (cancelled) return;
        setShare(data);
        setContent(data.content);
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

  if (!share) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const expires = new Date(share.expiresAt).toLocaleString();
  const updated = new Date(share.updatedAt).toLocaleString();

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      setStatus("Copied to clipboard.");
      setStatusKind("ok");
    } catch {
      setStatus("Select and copy manually.");
      setStatusKind("err");
    }
  }

  async function onSave(): Promise<void> {
    setStatus("Saving…");
    setStatusKind(null);
    try {
      const next = await updateTextShare(id, content);
      setShare(next);
      setStatus(`Saved. Still expires ${new Date(next.expiresAt).toLocaleString()}.`);
      setStatusKind("ok");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save.");
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
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Shared note</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Open, copy, and update. This note expires {expires}.
      </p>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="grid gap-2">
            <Label htmlFor="text-content">Content</Label>
            <Textarea
              id="text-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void onCopy()}>
              Copy
            </Button>
            <Button type="button" onClick={() => void onSave()}>
              Save update
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Last updated {updated}</p>
          <StatusAlert message={status} kind={statusKind} />
        </CardContent>
      </Card>
    </>
  );
}
