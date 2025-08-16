import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import AppRouter from "./router";
import "./styles/index.css";
import { useTelegram } from "./hooks/useTelegram";

function App() {
  useTelegram();
  return <AppRouter />;
}

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>,
);

