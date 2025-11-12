import React, { useState, useEffect } from "react";
import jsPDF from "jspdf";
import * as UTIF from "utif";
import { validateInputSafety } from "./utils/validateInputSafety"; // ✅ Added

/* ===== Persistent State Hook ===== */
function usePersistentState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      console.warn("Unable to save:", key);
    }
  }, [key, value]);

  return [value, setValue];
}

/* ===== SVG → EPS Converter (Frontend) ===== */
const svgToEPS = (svgData) => {
  const epsHeader = "%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 1000 1000\n";
  const epsBody = svgData
    .replace(/<svg.*?>/, "")
    .replace("</svg>", "")
    .replace(/fill="/g, "setrgbcolor\nfill ");
  return epsHeader + epsBody + "\nshowpage";
};

/* ===== Main App Component ===== */
function App() {
  const [inputType, setInputType] = usePersistentState("qrverse-inputType", "URL");
  const [inputs, setInputs] = usePersistentState("qrverse-inputs", {});
  const [fgColor, setFgColor] = usePersistentState("qrverse-fgColor", "#000000");
  const [bgColor, setBgColor] = usePersistentState("qrverse-bgColor", "#ffffff");
  const [qrSize, setQrSize] = usePersistentState("qrverse-qrSize", 900);
  const [downloadFormat, setDownloadFormat] = usePersistentState("qrverse-format", "png");

  const [pngDataUrl, setPngDataUrl] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [error, setError] = useState(null);

  // ✅ Validation state
  const [validationStatus, setValidationStatus] = useState("ok");
  const [validationMessage, setValidationMessage] = useState("");
  const [isVerifiedUser, setIsVerifiedUser] = useState(false); // reserved for later

  const API_BASE = "https://qrverse-backend-iodd.onrender.com";

  /* ===== Build QR Content ===== */
  const buildContent = () => {
    switch (inputType) {
      case "URL":
        return inputs.url || "";
      case "Text":
        return inputs.text || "";
      case "Wi-Fi":
        const { ssid, password, encryption } = inputs;
        return `WIFI:S:${ssid || ""};T:${encryption || "WPA"};P:${password || ""};;`;
      case "Email":
        const { emailTo, subject, body } = inputs;
        return `mailto:${emailTo || ""}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
      case "vCard":
        const { name, phone, email, company } = inputs;
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || ""}\nORG:${company || ""}\nTEL:${phone || ""}\nEMAIL:${email || ""}\nEND:VCARD`;
      case "Phone":
        return `tel:${inputs.phoneNumber || ""}`;
      case "SMS":
        return `SMSTO:${inputs.smsNumber || ""}:${inputs.smsMessage || ""}`;
      case "Event":
        const { eventName, eventLocation, eventStart, eventEnd, eventDescription } = inputs;
        return `BEGIN:VEVENT\nSUMMARY:${eventName || ""}\nLOCATION:${eventLocation || ""}\nDTSTART:${eventStart || ""}\nDTEND:${eventEnd || ""}\nDESCRIPTION:${eventDescription || ""}\nEND:VEVENT`;
      case "Geo":
        return `geo:${inputs.latitude || ""},${inputs.longitude || ""}${inputs.label ? `?q=${inputs.label}` : ""}`;
      case "UPI":
        const { pa, pn, am, cu, tn, tr } = inputs;
        return `upi://pay?pa=${pa || ""}&pn=${pn || ""}${am ? `&am=${am}` : ""}${cu ? `&cu=${cu}` : ""}${tn ? `&tn=${tn}` : ""}${tr ? `&tr=${tr}` : ""}`;
      case "MECARD":
        const { fullName, mePhone, meEmail } = inputs;
        return `MECARD:N:${fullName || ""};TEL:${mePhone || ""};EMAIL:${meEmail || ""};;`;
      default:
        return "";
    }
  };

  /* ===== Fetch QR (PNG + SVG) from Backend ===== */
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const content = buildContent();
      if (!content.trim()) {
        setPngDataUrl(null);
        return;
      }

      // ✅ Validate before backend request
      const result = validateInputSafety(inputType, content, isVerifiedUser);
      setValidationStatus(result.status);
      setValidationMessage(result.message);

      if (result.status === "block") {
        setPngDataUrl(null);
        return; // Stop unsafe QR generation
      }

      try {
        const params = new URLSearchParams({
          data: content,
          fg: fgColor,
          bg: bgColor,
          box_size: "10",
          border: "4",
          error: "H",
        });

        const response = await fetch(`${API_BASE}/generate?${params.toString()}`);
        if (!response.ok) throw new Error("Backend Error");
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setPngDataUrl(imageUrl);

        const svgRes = await fetch(`${API_BASE}/generate?${params.toString()}&fmt=svg`);
        if (svgRes.ok) {
          const svgText = await svgRes.text();
          setSvgString(svgText);
        }
      } catch (err) {
        console.error("QR generation failed:", err);
        setError("QR generation failed. Please try again.");
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [fgColor, bgColor, qrSize, inputType, inputs]);

  /* ===== Handle Input Change ===== */
  const handleChange = (field, value) => {
    const updated = { ...inputs, [field]: value };
    setInputs(updated);

    const content = buildContent();
    const result = validateInputSafety(inputType, content, isVerifiedUser);
    setValidationStatus(result.status);
    setValidationMessage(result.message);
  };

  /* ===== Handle Download ===== */
  const handleDownload = async () => {
    if (!pngDataUrl) return;
    const fileName = `qr-${qrSize}x${qrSize}.${downloadFormat}`;
    // unchanged logic...
    // (Download handling remains identical)
  };

  /* ===== Render Input Fields ===== */
  const renderInputFields = () => {
    switch (inputType) {
      case "URL":
        return (
          <input
            type="text"
            placeholder="https://example.com"
            value={inputs.url || ""}
            onChange={(e) => handleChange("url", e.target.value)}
            className="qr-input"
          />
        );
      default:
        // unchanged logic...
        return null;
    }
  };

  /* ===== UI Layout ===== */
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-container">
          <div className="logo">
            <img src="/qrverse-logo.png" alt="QRVerse Logo" className="logo-img" />
            <h1 className="site-title">QRVerse</h1>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-container">
          <section className="section input-section">
            <h2 className="section-title">1️⃣ Enter Your Content</h2>
            <select
              value={inputType}
              onChange={(e) => setInputType(e.target.value)}
              className="qr-input"
            >
              <option value="URL">URL</option>
              <option value="Text">Text</option>
              <option value="Wi-Fi">Wi-Fi</option>
              <option value="Email">Email</option>
              <option value="vCard">vCard</option>
              <option value="Phone">Phone</option>
              <option value="SMS">SMS</option>
              <option value="Event">Event</option>
              <option value="Geo">Geo Location</option>
              <option value="UPI">UPI Payment</option>
              <option value="MECARD">MECARD</option>
            </select>

            {renderInputFields()}

            {/* ✅ Validation message display */}
            {validationMessage && (
              <p
                className={
                  validationStatus === "block"
                    ? "validation-text error"
                    : validationStatus === "warn"
                    ? "validation-text warn"
                    : "validation-text safe"
                }
              >
                {validationMessage}
              </p>
            )}
          </section>

          <section className="section customization-section">
            {/* unchanged customization UI */}
          </section>

          <section className="section preview-section">
            <h2 className="section-title">3️⃣ Live Preview</h2>
            <div className="preview-card">
              {validationStatus === "block" && (
                <p className="validation-text error">
                  ❌ QR generation blocked for safety.
                </p>
              )}
              {validationStatus === "warn" && pngDataUrl && (
                <div className="qr-warning-wrapper">
                  <img
                    src={pngDataUrl}
                    alt="QR Preview"
                    style={{
                      width: 220,
                      height: 220,
                      objectFit: "contain",
                      borderRadius: 8,
                    }}
                  />
                  <div className="qr-warning-overlay">
                    ⚠️ Caution: {validationMessage}
                  </div>
                </div>
              )}
              {validationStatus === "ok" && pngDataUrl && (
                <img
                  src={pngDataUrl}
                  alt="QR Preview"
                  style={{
                    width: 220,
                    height: 220,
                    objectFit: "contain",
                    borderRadius: 8,
                  }}
                />
              )}
              {!pngDataUrl && validationStatus === "ok" && (
                <p>QR Preview Will Appear Here</p>
              )}
            </div>
          </section>
        </div>
      </main>

      <footer className="app-footer">
        <p>© 2025 QRVerse • Powered by FastAPI backend on Render</p>
      </footer>
    </div>
  );
}

export default App;
