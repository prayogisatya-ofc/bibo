import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { DevAvatar } from "./ui/DevAvatar.js";
import "./app.css";

const el = document.getElementById("root");
if (el) {
  const dev = new URLSearchParams(window.location.search).get("dev") === "avatar";
  createRoot(el).render(
    <React.StrictMode>{dev ? <DevAvatar /> : <App />}</React.StrictMode>,
  );
}
