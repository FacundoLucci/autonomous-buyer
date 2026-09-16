import { createRoot } from "react-dom/client";
import { PurchasingInbox } from "../../../src/components/desk/mail";
import "../../../src/styles/desk.css";
import "./qa.css";
createRoot(document.getElementById("root")!).render(<main style={{maxWidth: 920, margin: "24px auto", padding: 20}}><p style={{background: "#e0ff90", padding: 12}}>LOCAL QA · Sample emails and documents · No messages are sent</p><PurchasingInbox email="buyer@sample.example" /></main>);
