import { Navigate, Route, Routes } from "react-router-dom";
import { CoursePage } from "@/pages/CoursePage";
import { HomePage } from "@/pages/HomePage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses/:slug" element={<CoursePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
