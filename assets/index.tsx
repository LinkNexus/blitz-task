import { StrictMode } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { AuthProvider } from "./providers/auth-provider";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
