import { Navigate, Route, Routes } from "react-router-dom";
import { AppearanceMenu } from "./components/AppearanceMenu";
import { FilePage } from "./pages/FilePage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { TextPage } from "./pages/TextPage";

export function App() {
  return (
    <main className="mx-auto w-[min(36rem,calc(100%-2rem))] py-10 pb-16">
      <div className="mb-6 flex justify-end">
        <AppearanceMenu />
      </div>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/t/:id" element={<TextPage />} />
        <Route path="/f/:id" element={<FilePage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
    </main>
  );
}
