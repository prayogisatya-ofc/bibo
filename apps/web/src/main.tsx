import React, { Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";

// Lazy agar galeri /dev/avatar bisa dimuat tanpa memuat modul App
// (dan sebaliknya). Fase D: App sudah memakai kontrak AvatarRenderer baru.
const DevAvatarLazy = React.lazy(() =>
  import("./ui/DevAvatar.js").then((m) => ({ default: m.DevAvatar })),
);
const AppLazy = React.lazy(() => import("./App.js").then((m) => ({ default: m.App })));

const el = document.getElementById("root");
if (el) {
  const dev = new URLSearchParams(window.location.search).get("dev") === "avatar";
  createRoot(el).render(
    <React.StrictMode>
      <Suspense fallback={null}>{dev ? <DevAvatarLazy /> : <AppLazy />}</Suspense>
    </React.StrictMode>,
  );
}
