import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { InitialDataProvider } from "@/lib/InitialDataContext";
import { readClientSsrData } from "@/lib/ssr-data";
import "./styles/globals.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

const initialData = readClientSsrData();
const tree = (
  <StrictMode>
    <InitialDataProvider value={initialData}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </InitialDataProvider>
  </StrictMode>
);

if (root.hasChildNodes()) {
  hydrateRoot(root, tree);
} else {
  createRoot(root).render(tree);
}
