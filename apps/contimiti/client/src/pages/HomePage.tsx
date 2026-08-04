import { useState } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea
} from "@chiwire/ui/internal";
import { StatusAlert } from "../components/StatusAlert";
import { createFileShare, createTextShare, type StatusKind } from "../lib/api";

export function HomePage() {
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState<StatusKind>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  function announce(message: string, kind: StatusKind = null): void {
    setStatus(message);
    setStatusKind(kind);
  }

  async function onCreateText(): Promise<void> {
    if (!note.trim()) {
      announce("Write something first.", "err");
      return;
    }
    announce("Creating…");
    setShareUrl(null);
    try {
      const { url } = await createTextShare(note);
      announce("Text share ready. Expires in 24 hours.", "ok");
      setShareUrl(url);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not create text share.", "err");
    }
  }

  async function onCreateFile(): Promise<void> {
    if (!file) {
      announce("Choose a file first.", "err");
      return;
    }
    announce("Uploading…");
    setShareUrl(null);
    try {
      const { url } = await createFileShare(file);
      announce("File share ready. Expires in 24 hours.", "ok");
      setShareUrl(url);
    } catch (error) {
      announce(error instanceof Error ? error.message : "Could not upload file.", "err");
    }
  }

  return (
    <>
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Contimiti</h1>
      <p className="mb-6 max-w-xl text-sm text-muted-foreground">
        Share a note or a file for a day. Texts stay editable in the browser; files are upload,
        download, and delete only.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create a share</CardTitle>
          <CardDescription>Text stays editable; files are upload/download only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="text-content">Note</Label>
                <Textarea
                  id="text-content"
                  placeholder="Paste something worth sharing…"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
              <Button type="button" onClick={() => void onCreateText()}>
                Create text share
              </Button>
            </TabsContent>
            <TabsContent value="file" className="space-y-3">
              <div className="grid gap-2">
                <Label htmlFor="file-input">File</Label>
                <Input
                  id="file-input"
                  type="file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
              </div>
              <Button type="button" onClick={() => void onCreateFile()}>
                Upload file share
              </Button>
            </TabsContent>
          </Tabs>

          <StatusAlert message={status} kind={statusKind} />
          {shareUrl ? (
            <p className="font-mono text-xs break-all text-muted-foreground">
              <a href={shareUrl} className="underline underline-offset-3">
                {shareUrl}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
