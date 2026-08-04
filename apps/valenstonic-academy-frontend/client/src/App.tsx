import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CoursePage } from "@/pages/CoursePage";
import { HomePage } from "@/pages/HomePage";

function CatchAll() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/", search: location.search }} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/courses/:slug" element={<CoursePage />} />
      <Route path="*" element={<CatchAll />} />
    </Routes>
  );
}
