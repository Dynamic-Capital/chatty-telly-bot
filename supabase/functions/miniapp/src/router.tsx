import { Route, Routes } from "react-router-dom";
import Home from "./pages/Home";
import Bank from "./pages/Bank";
import Crypto from "./pages/Crypto";
import Me from "./pages/Me";
import Admin from "./pages/Admin";
import Plan from "./pages/Plan";
import Status from "./pages/Status";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/bank" element={<Bank />} />
      <Route path="/crypto" element={<Crypto />} />
      <Route path="/plan" element={<Plan />} />
      <Route path="/status" element={<Status />} />
      <Route path="/me" element={<Me />} />
      <Route path="/admin" element={<Admin />} />
    </Routes>
  );
}
