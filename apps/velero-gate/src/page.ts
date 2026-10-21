type Saved = {
  apiBase: string;
  token: string;
  apiKey: string;
  apiSecret: string;
};

export function page(
  saved: Saved,
  status: { connected: boolean; lastError: string | null; jobs: number }
): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Velero harbor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Red+Hat+Mono:wght@400;500&display=swap" rel="stylesheet" />
    <style>
      :root {
        --hull: #071014;
        --brass: #c4a574;
        --ivory: #e8dcc8;
        --phosphor: #7dffb3;
        --port: #c45c4a;
        --dim: #6d7a74;
        --line: rgba(196, 165, 116, 0.28);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        color: var(--ivory);
        font-family: "Red Hat Mono", monospace;
        background:
          radial-gradient(900px 420px at 8% -10%, rgba(196,165,116,.1), transparent 50%),
          linear-gradient(180deg, #0a161c, var(--hull) 55%, #05090b);
      }
      main { max-width: 36rem; margin: 0 auto; padding: 2.4rem 1.4rem 3rem; }
      h1 {
        font-family: Fraunces, serif;
        font-size: 3rem;
        letter-spacing: -.04em;
        margin: 0 0 .3rem;
      }
      h1 span { color: var(--brass); }
      .tag { color: var(--brass); letter-spacing: .18em; text-transform: uppercase; font-size: .72rem; }
      p.lead { color: var(--dim); line-height: 1.55; }
      form { display: grid; gap: .7rem; margin-top: 1.4rem; }
      label { font-size: .72rem; letter-spacing: .12em; text-transform: uppercase; color: var(--brass); }
      input {
        width: 100%;
        background: rgba(8,22,26,.72);
        border: 1px solid var(--line);
        color: var(--ivory);
        font: inherit;
        padding: .75rem .8rem;
      }
      button {
        margin-top: .6rem;
        border: 1px solid var(--brass);
        background: #0b1412;
        color: var(--phosphor);
        font: inherit;
        letter-spacing: .16em;
        text-transform: uppercase;
        padding: .9rem 1rem;
        cursor: pointer;
      }
      .lamp {
        display: inline-block;
        width: .7rem; height: .7rem; border-radius: 50%;
        background: var(--dim);
        margin-right: .45rem;
      }
      .lamp.on {
        background: var(--phosphor);
        box-shadow: 0 0 12px var(--phosphor);
      }
      .error { color: var(--port); min-height: 1.2em; }
      .hint { font-size: .78rem; color: var(--dim); line-height: 1.5; }
    </style>
  </head>
  <body>
    <main>
      <p class="tag"><span id="lamp" class="lamp${status.connected ? " on" : ""}"></span><span id="state">${status.connected ? "tied up" : "adrift"} · ${status.jobs} hops</span></p>
      <h1>Velero <span>harbor</span></h1>
      <p class="lead">Keys stay on this laptop. The VPS only steers. Binance sees your home IP. Leave the Harbor window open.</p>
      <p class="error" id="error">${status.lastError ? escapeHtml(status.lastError) : ""}</p>
      <form id="form">
        <label>Desk API</label>
        <input name="apiBase" value="${escapeHtml(saved.apiBase)}" />
        <label>Harbor token</label>
        <input name="token" value="${escapeHtml(saved.token)}" autocomplete="off" />
        <label>Binance API key</label>
        <input name="apiKey" value="${escapeHtml(saved.apiKey)}" autocomplete="off" />
        <label>Binance secret</label>
        <input name="apiSecret" type="password" value="${escapeHtml(saved.apiSecret)}" autocomplete="off" />
        <button type="submit">Make fast</button>
      </form>
      <p class="hint">Token is <code>VELERO_GATE_TOKEN</code> in <code>.env.deploy.local</code>. Desk: <a href="https://velero.avilalabs.dev" style="color:var(--brass)">velero.avilalabs.dev</a>. Credentials: ~/.config/velero-gate/credentials.json</p>
    </main>
    <script>
      const form = document.getElementById("form");
      const lamp = document.getElementById("lamp");
      const state = document.getElementById("state");
      const errorBox = document.getElementById("error");

      async function refreshStatus() {
        const response = await fetch("/health", { cache: "no-store" });
        const payload = await response.json();
        lamp.classList.toggle("on", Boolean(payload.connected));
        state.textContent = (payload.connected ? "tied up" : "adrift") + " · " + (payload.jobs ?? 0) + " hops";
        errorBox.textContent = payload.error || "";
      }

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(form).entries());
        await fetch("/save", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(data)
        });
        await refreshStatus();
      });
      setInterval(() => { refreshStatus().catch(() => undefined); }, 2000);
    </script>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
