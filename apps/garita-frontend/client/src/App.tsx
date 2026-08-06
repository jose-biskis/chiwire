import { useEffect, useState } from "react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
  Switch,
} from "@chiwire/ui/internal";

const AUTH_STORAGE_KEY = "garita-admin-secret";

type PublicSettings = {
  authSecretConfigured: boolean;
  allowedOrigin: string | null;
};

type MaskedWorkspace = {
  id: string;
  displayName: string | null;
  apiKeyPreview: string;
  tokenPreview: string;
  enabled: boolean;
};

async function api<T>(
  path: string,
  init: RequestInit = {},
  secret: string | null,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("accept", "application/json");
  if (init.body) {
    headers.set("content-type", "application/json");
  }
  if (secret) {
    headers.set("authorization", `Bearer ${secret}`);
  }

  const response = await fetch(path, { ...init, headers });
  const payload = (await response.json()) as T & {
    error?: string;
    message?: string;
    detail?: string;
    target?: string;
  };
  if (!response.ok) {
    const parts = [
      payload.message || payload.error || `HTTP ${response.status}`,
      payload.detail,
      payload.target ? `(${payload.target})` : undefined,
    ].filter(Boolean);
    throw new Error(parts.join(" — "));
  }
  return payload;
}

export function App() {
  const [secret, setSecret] = useState<string | null>(() =>
    sessionStorage.getItem(AUTH_STORAGE_KEY),
  );
  const [secretDraft, setSecretDraft] = useState("");
  const [ready, setReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [workspaces, setWorkspaces] = useState<MaskedWorkspace[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [allowedOrigin, setAllowedOrigin] = useState("");
  const [authSecretDraft, setAuthSecretDraft] = useState("");
  const [form, setForm] = useState({
    id: "",
    displayName: "",
    apiKey: "",
    token: "",
    enabled: true,
  });

  async function refresh(nextSecret: string | null = secret) {
    setError(null);
    const session = await api<{ authRequired: boolean }>("/api/session", {}, null);
    setAuthRequired(session.authRequired);

    if (session.authRequired && !nextSecret) {
      return;
    }

    const settingsResponse = await api<{ settings: PublicSettings }>(
      "/api/mcps/settings",
      {},
      nextSecret,
    );
    setSettings(settingsResponse.settings);
    setAllowedOrigin(settingsResponse.settings.allowedOrigin ?? "");
    const workspacesResponse = await api<{ workspaces: MaskedWorkspace[] }>(
      "/api/mcps/workspaces",
      {},
      nextSecret,
    );
    setWorkspaces(workspacesResponse.workspaces);
  }

  useEffect(() => {
    void refresh()
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : "Failed to load Garita";
        if (message.includes("Unauthorized") || message.includes("GARITA_ADMIN_SECRET")) {
          setAuthRequired(true);
          setSecret(null);
          sessionStorage.removeItem(AUTH_STORAGE_KEY);
          return;
        }
        setError(message);
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  async function unlock() {
    try {
      sessionStorage.setItem(AUTH_STORAGE_KEY, secretDraft);
      setSecret(secretDraft);
      await refresh(secretDraft);
      setNotice("Unlocked");
    } catch (err) {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      setSecret(null);
      setError(err instanceof Error ? err.message : "Invalid admin secret");
    }
  }

  async function saveSettings() {
    try {
      setNotice(null);
      const response = await api<{ settings: PublicSettings; authSecret?: string }>(
        "/api/mcps/settings",
        {
          method: "PUT",
          body: JSON.stringify({
            allowedOrigin,
            authSecret: authSecretDraft || undefined,
          }),
        },
        secret,
      );
      setSettings(response.settings);
      setAuthSecretDraft("");
      if (response.authSecret) {
        setNotice(`MCP auth secret saved: ${response.authSecret}`);
      } else {
        setNotice("MCP settings saved");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  }

  async function rotateMcpSecret() {
    try {
      const response = await api<{ settings: PublicSettings; authSecret?: string }>(
        "/api/mcps/settings",
        {
          method: "PUT",
          body: JSON.stringify({ rotateAuthSecret: true }),
        },
        secret,
      );
      setSettings(response.settings);
      setNotice(
        response.authSecret
          ? `Rotated MCP_AUTH_SECRET — copy now: ${response.authSecret}`
          : "Rotated MCP auth secret",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rotate secret");
    }
  }

  async function saveWorkspace() {
    try {
      setNotice(null);
      await api(
        "/api/mcps/workspaces",
        {
          method: "POST",
          body: JSON.stringify({
            id: form.id,
            displayName: form.displayName || null,
            apiKey: form.apiKey,
            token: form.token,
            enabled: form.enabled,
          }),
        },
        secret,
      );
      setForm({
        id: "",
        displayName: "",
        apiKey: "",
        token: "",
        enabled: true,
      });
      await refresh();
      setNotice("Workspace saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workspace");
    }
  }

  async function removeWorkspace(id: string) {
    try {
      await api(`/api/mcps/workspaces/${encodeURIComponent(id)}`, { method: "DELETE" }, secret);
      await refresh();
      setNotice(`Removed ${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace");
    }
  }

  if (!ready) {
    return (
      <main className="garita-shell">
        <h1 className="garita-brand">Garita</h1>
        <p className="garita-lede">Loading…</p>
      </main>
    );
  }

  if (authRequired && !secret) {
    return (
      <main className="garita-shell">
        <h1 className="garita-brand">Garita</h1>
        <p className="garita-lede">Internal checkpoint. Unlock with the admin secret.</p>
        <Card>
          <CardHeader>
            <CardTitle>Admin unlock</CardTitle>
            <CardDescription>Uses GARITA_ADMIN_SECRET from the server environment.</CardDescription>
          </CardHeader>
          <CardContent className="garita-stack">
            <div className="garita-field">
              <Label htmlFor="admin-secret">Admin secret</Label>
              <Input
                id="admin-secret"
                type="password"
                value={secretDraft}
                onChange={(event) => setSecretDraft(event.target.value)}
              />
            </div>
            {error ? <p className="garita-error">{error}</p> : null}
            <Button type="button" onClick={() => void unlock()}>
              Unlock
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="garita-shell">
      <h1 className="garita-brand">Garita</h1>
      <p className="garita-lede">
        Configure Chiwire MCPs: global auth and per-workspace Trello credentials. Stored in Postgres,
        cached in Redis for the MCP hot path.
      </p>

      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert className="mb-4">
          <AlertTitle>OK</AlertTitle>
          <AlertDescription className="garita-mono">{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="garita-stack">
        <Card>
          <CardHeader>
            <CardTitle>MCP global settings</CardTitle>
            <CardDescription>
              Auth secret for callers of mcps.avilalabs.dev. Leave blank to keep the current value.
            </CardDescription>
          </CardHeader>
          <CardContent className="garita-stack">
            <div className="garita-row">
              <Badge variant={settings?.authSecretConfigured ? "default" : "secondary"}>
                {settings?.authSecretConfigured ? "auth configured" : "auth open"}
              </Badge>
            </div>
            <div className="garita-field">
              <Label htmlFor="mcp-auth">Set MCP auth secret</Label>
              <Input
                id="mcp-auth"
                type="password"
                value={authSecretDraft}
                onChange={(event) => setAuthSecretDraft(event.target.value)}
                placeholder="paste or leave blank"
              />
            </div>
            <div className="garita-field">
              <Label htmlFor="allowed-origin">Allowed origin</Label>
              <Input
                id="allowed-origin"
                value={allowedOrigin}
                onChange={(event) => setAllowedOrigin(event.target.value)}
                placeholder="*"
              />
            </div>
            <div className="garita-row">
              <Button type="button" onClick={() => void saveSettings()}>
                Save settings
              </Button>
              <Button type="button" variant="outline" onClick={() => void rotateMcpSecret()}>
                Rotate MCP secret
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Trello workspaces</CardTitle>
            <CardDescription>
              Each workspace has its own Trello API key and member token.
            </CardDescription>
          </CardHeader>
          <CardContent className="garita-stack">
            {workspaces.length === 0 ? (
              <p className="garita-muted">No workspaces yet.</p>
            ) : (
              workspaces.map((workspace) => (
                <div key={workspace.id}>
                  <div className="garita-row" style={{ justifyContent: "space-between" }}>
                    <div>
                      <strong>{workspace.id}</strong>
                      {workspace.displayName ? (
                        <span className="garita-muted"> — {workspace.displayName}</span>
                      ) : null}
                      <div className="garita-mono garita-muted">
                        key {workspace.apiKeyPreview} · token {workspace.tokenPreview}
                        {workspace.enabled ? "" : " · disabled"}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void removeWorkspace(workspace.id)}
                    >
                      Remove
                    </Button>
                  </div>
                  <Separator className="my-3" />
                </div>
              ))
            )}

            <h3 style={{ margin: "0.5rem 0 0" }}>Add / replace workspace</h3>
            <div className="garita-row">
              <div className="garita-field">
                <Label htmlFor="ws-id">Workspace id</Label>
                <Input
                  id="ws-id"
                  value={form.id}
                  onChange={(event) => setForm((current) => ({ ...current, id: event.target.value }))}
                  placeholder="avilalabs"
                />
              </div>
              <div className="garita-field">
                <Label htmlFor="ws-name">Display name</Label>
                <Input
                  id="ws-name"
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, displayName: event.target.value }))
                  }
                />
              </div>
            </div>
            <div className="garita-field">
              <Label htmlFor="ws-key">API key</Label>
              <Input
                id="ws-key"
                value={form.apiKey}
                onChange={(event) =>
                  setForm((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
            </div>
            <div className="garita-field">
              <Label htmlFor="ws-token">Token</Label>
              <Input
                id="ws-token"
                type="password"
                value={form.token}
                onChange={(event) =>
                  setForm((current) => ({ ...current, token: event.target.value }))
                }
              />
            </div>
            <div className="garita-row">
              <div className="garita-field" style={{ flex: "0 0 auto" }}>
                <Label htmlFor="ws-enabled">Enabled</Label>
                <Switch
                  id="ws-enabled"
                  checked={form.enabled}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({ ...current, enabled: checked }))
                  }
                />
              </div>
              <Button type="button" onClick={() => void saveWorkspace()}>
                Save workspace
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
