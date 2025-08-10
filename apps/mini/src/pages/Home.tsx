import { Link } from "react-router-dom";
import GlassPanel from "../components/GlassPanel";
import TopBar from "../components/TopBar";

export default function Home() {
  return (
    <div className="dc-screen">
      <TopBar title="Home" />
      <div className="grid gap-4">
        <Link to="/bank">
          <GlassPanel className="text-center">
            <p>Bank Deposit</p>
          </GlassPanel>
        </Link>
        <Link to="/crypto">
          <GlassPanel className="text-center">
            <p>Crypto Deposit</p>
          </GlassPanel>
        </Link>
        <Link to="/me">
          <GlassPanel className="text-center">
            <p>My Receipts</p>
          </GlassPanel>
        </Link>
      </div>
    </div>
  );
}
