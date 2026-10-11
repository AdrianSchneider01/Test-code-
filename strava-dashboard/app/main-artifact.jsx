import { createRoot } from "react-dom/client";
import { Dashboard } from "./dashboard.jsx";
import { artifactSource } from "./source-artifact.js";
createRoot(document.getElementById("root")).render(<Dashboard source={artifactSource}/>);
