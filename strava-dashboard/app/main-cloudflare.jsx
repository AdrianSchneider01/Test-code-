import { createRoot } from "react-dom/client";
import { Dashboard } from "./dashboard.jsx";
import { cloudflareSource } from "./source-cloudflare.js";
createRoot(document.getElementById("root")).render(<Dashboard source={cloudflareSource}/>);
