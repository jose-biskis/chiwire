function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const styles = `
:root {
  --bg0: #0f2a24;
  --bg1: #1a4a3c;
  --ink: #f4f7f5;
  --muted: #b7cfc6;
  --accent: #f0a05a;
  --accent-ink: #1a1208;
  --panel: rgba(255, 255, 255, 0.08);
  --line: rgba(255, 255, 255, 0.16);
  --danger: #ff7b72;
  --ok: #7dffb3;
  --shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
  --font-display: "Fraunces", "Iowan Old Style", Georgia, serif;
  --font-body: "Manrope", "Avenir Next", "Segoe UI", sans-serif;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--font-body);
  color: var(--ink);
  background:
    radial-gradient(1200px 600px at 10% -10%, #2f6b57 0%, transparent 55%),
    radial-gradient(900px 500px at 100% 0%, #c9783a 0%, transparent 45%),
    linear-gradient(160deg, var(--bg0), var(--bg1) 55%, #0b1c18);
  background-attachment: fixed;
}

a { color: var(--accent); }

.shell {
  width: min(920px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2.5rem 0 4rem;
}

.brand {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(2.4rem, 6vw, 4rem);
  letter-spacing: -0.03em;
  line-height: 1;
  margin: 0 0 0.75rem;
  animation: rise 700ms ease both;
}

.lede {
  max-width: 36rem;
  color: var(--muted);
  font-size: 1.05rem;
  line-height: 1.55;
  margin: 0 0 2rem;
  animation: rise 700ms ease 80ms both;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  backdrop-filter: blur(10px);
  box-shadow: var(--shadow);
  padding: 1.25rem;
  animation: rise 700ms ease 140ms both;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.tab {
  appearance: none;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink);
  font: inherit;
  padding: 0.55rem 0.9rem;
  cursor: pointer;
}

.tab[aria-selected="true"] {
  background: var(--accent);
  color: var(--accent-ink);
  border-color: transparent;
}

label {
  display: block;
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 0.4rem;
}

textarea, input[type="text"], input[type="file"] {
  width: 100%;
  font: inherit;
  color: var(--ink);
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid var(--line);
  padding: 0.85rem 0.9rem;
}

textarea {
  min-height: 220px;
  resize: vertical;
  line-height: 1.5;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
  margin-top: 0.9rem;
}

button, .button {
  appearance: none;
  border: 0;
  background: var(--accent);
  color: var(--accent-ink);
  font: inherit;
  font-weight: 650;
  padding: 0.7rem 1rem;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

button.secondary, .button.secondary {
  background: transparent;
  color: var(--ink);
  border: 1px solid var(--line);
}

button.danger {
  background: transparent;
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 55%, transparent);
}

.meta {
  color: var(--muted);
  font-size: 0.9rem;
  margin: 0.75rem 0 0;
}

.status {
  min-height: 1.4rem;
  margin-top: 0.85rem;
  color: var(--muted);
  font-size: 0.92rem;
}

.status.ok { color: var(--ok); }
.status.err { color: var(--danger); }

.hidden { display: none !important; }

.share-url {
  word-break: break-all;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.92rem;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 640px) {
  .shell { width: min(100% - 1.25rem, 920px); padding-top: 1.5rem; }
  .row { flex-direction: column; }
  button, .button { width: 100%; justify-content: center; }
}
`;

export function homePage(): string {
  return layout({
    title: "Contimiti",
    body: `
      <h1 class="brand">Contimiti</h1>
      <p class="lede">
        Share a note or a file for a day. Texts stay editable in the browser;
        files are upload, download, and delete only.
      </p>
      <section class="panel" aria-label="Create a share">
        <div class="tabs" role="tablist">
          <button class="tab" type="button" role="tab" id="tab-text" aria-selected="true" aria-controls="pane-text">Text</button>
          <button class="tab" type="button" role="tab" id="tab-file" aria-selected="false" aria-controls="pane-file">File</button>
        </div>

        <div id="pane-text" role="tabpanel" aria-labelledby="tab-text">
          <label for="text-content">Note</label>
          <textarea id="text-content" placeholder="Paste something worth sharing…"></textarea>
          <div class="row">
            <button type="button" id="create-text">Create text share</button>
          </div>
        </div>

        <div id="pane-file" class="hidden" role="tabpanel" aria-labelledby="tab-file">
          <label for="file-input">File</label>
          <input id="file-input" type="file" />
          <div class="row">
            <button type="button" id="create-file">Upload file share</button>
          </div>
        </div>

        <p id="status" class="status" role="status"></p>
        <p id="share-link" class="meta share-url hidden"></p>
      </section>
      <script>
        const tabText = document.getElementById("tab-text");
        const tabFile = document.getElementById("tab-file");
        const paneText = document.getElementById("pane-text");
        const paneFile = document.getElementById("pane-file");
        const status = document.getElementById("status");
        const shareLink = document.getElementById("share-link");

        function selectTab(which) {
          const text = which === "text";
          tabText.setAttribute("aria-selected", String(text));
          tabFile.setAttribute("aria-selected", String(!text));
          paneText.classList.toggle("hidden", !text);
          paneFile.classList.toggle("hidden", text);
        }

        tabText.addEventListener("click", () => selectTab("text"));
        tabFile.addEventListener("click", () => selectTab("file"));

        function setStatus(message, kind) {
          status.textContent = message;
          status.className = "status" + (kind ? " " + kind : "");
        }

        function showShare(url) {
          shareLink.classList.remove("hidden");
          shareLink.innerHTML = '<a href="' + url + '">' + url + "</a>";
        }

        document.getElementById("create-text").addEventListener("click", async () => {
          const content = document.getElementById("text-content").value;
          if (!content.trim()) {
            setStatus("Write something first.", "err");
            return;
          }
          setStatus("Creating…");
          try {
            const response = await fetch("/api/texts", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed");
            setStatus("Text share ready. Expires in 24 hours.", "ok");
            showShare(data.url);
          } catch (error) {
            setStatus(error.message || "Could not create text share.", "err");
          }
        });

        document.getElementById("create-file").addEventListener("click", async () => {
          const input = document.getElementById("file-input");
          const file = input.files && input.files[0];
          if (!file) {
            setStatus("Choose a file first.", "err");
            return;
          }
          setStatus("Uploading…");
          try {
            const response = await fetch("/api/files", {
              method: "POST",
              headers: {
                "content-type": file.type || "application/octet-stream",
                "x-filename": file.name
              },
              body: file
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed");
            setStatus("File share ready. Expires in 24 hours.", "ok");
            showShare(data.url);
          } catch (error) {
            setStatus(error.message || "Could not upload file.", "err");
          }
        });
      </script>
    `
  });
}

export function textPage(share: {
  id: string;
  content: string;
  expiresAt: string;
  updatedAt: string;
}): string {
  const expires = escapeHtml(new Date(share.expiresAt).toLocaleString());
  const updated = escapeHtml(new Date(share.updatedAt).toLocaleString());
  const content = escapeHtml(share.content);

  return layout({
    title: `Text · Contimiti`,
    body: `
      <p class="meta"><a href="/">← Contimiti</a></p>
      <h1 class="brand">Shared note</h1>
      <p class="lede">Open, copy, and update. This note expires ${expires}.</p>
      <section class="panel">
        <label for="text-content">Content</label>
        <textarea id="text-content">${content}</textarea>
        <div class="row">
          <button type="button" id="copy-text">Copy</button>
          <button type="button" id="save-text">Save update</button>
        </div>
        <p class="meta">Last updated ${updated}</p>
        <p id="status" class="status" role="status"></p>
      </section>
      <script>
        const id = ${JSON.stringify(share.id)};
        const status = document.getElementById("status");
        const textarea = document.getElementById("text-content");

        function setStatus(message, kind) {
          status.textContent = message;
          status.className = "status" + (kind ? " " + kind : "");
        }

        document.getElementById("copy-text").addEventListener("click", async () => {
          try {
            await navigator.clipboard.writeText(textarea.value);
            setStatus("Copied to clipboard.", "ok");
          } catch {
            textarea.select();
            setStatus("Select and copy manually.", "err");
          }
        });

        document.getElementById("save-text").addEventListener("click", async () => {
          setStatus("Saving…");
          try {
            const response = await fetch("/api/texts/" + encodeURIComponent(id), {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ content: textarea.value })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed");
            setStatus("Saved. Still expires " + new Date(data.expiresAt).toLocaleString() + ".", "ok");
          } catch (error) {
            setStatus(error.message || "Could not save.", "err");
          }
        });
      </script>
    `
  });
}

export function filePage(share: {
  id: string;
  filename: string;
  size: number;
  contentType: string;
  expiresAt: string;
}): string {
  const filename = escapeHtml(share.filename);
  const expires = escapeHtml(new Date(share.expiresAt).toLocaleString());
  const size = escapeHtml(formatBytes(share.size));
  const type = escapeHtml(share.contentType);

  return layout({
    title: `${share.filename} · Contimiti`,
    body: `
      <p class="meta"><a href="/">← Contimiti</a></p>
      <h1 class="brand">Shared file</h1>
      <p class="lede">Download or delete. This file expires ${expires}.</p>
      <section class="panel">
        <p class="meta"><strong>${filename}</strong></p>
        <p class="meta">${size} · ${type}</p>
        <div class="row">
          <a class="button" href="/api/files/${encodeURIComponent(share.id)}">Download</a>
          <button type="button" class="danger" id="delete-file">Delete</button>
        </div>
        <p id="status" class="status" role="status"></p>
      </section>
      <script>
        const id = ${JSON.stringify(share.id)};
        const status = document.getElementById("status");

        document.getElementById("delete-file").addEventListener("click", async () => {
          if (!confirm("Delete this file share?")) return;
          status.textContent = "Deleting…";
          status.className = "status";
          try {
            const response = await fetch("/api/files/" + encodeURIComponent(id), { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed");
            status.textContent = "Deleted.";
            status.className = "status ok";
            setTimeout(() => { location.href = "/"; }, 700);
          } catch (error) {
            status.textContent = error.message || "Could not delete.";
            status.className = "status err";
          }
        });
      </script>
    `
  });
}

export function notFoundPage(message = "This share is gone or expired."): string {
  return layout({
    title: "Not found · Contimiti",
    body: `
      <h1 class="brand">Gone</h1>
      <p class="lede">${escapeHtml(message)}</p>
      <p class="meta"><a href="/">Create a new share</a></p>
    `
  });
}

function layout(options: { title: string; body: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Manrope:wght@400;650&display=swap" rel="stylesheet" />
  <style>${styles}</style>
</head>
<body>
  <main class="shell">
    ${options.body}
  </main>
</body>
</html>`;
}

function formatBytes(size: number): string {
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
