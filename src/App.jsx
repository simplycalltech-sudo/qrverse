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
  const [validationStatus, setValidationStatus] = useState("ok"); // ok | warn | block
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
        {
          const { ssid, password, encryption } = inputs;
          return `WIFI:S:${ssid || ""};T:${encryption || "WPA"};P:${password || ""};;`;
        }
      case "Email":
        {
          const { emailTo, subject, body } = inputs;
          return `mailto:${emailTo || ""}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
        }
      case "vCard":
        {
          const { name, phone, email, company } = inputs;
          return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || ""}\nORG:${company || ""}\nTEL:${phone || ""}\nEMAIL:${email || ""}\nEND:VCARD`;
        }
      case "Phone":
        return `tel:${inputs.phoneNumber || ""}`;
      case "SMS":
        return `SMSTO:${inputs.smsNumber || ""}:${inputs.smsMessage || ""}`;
      case "Event":
        {
          const { eventName, eventLocation, eventStart, eventEnd, eventDescription } = inputs;
          return `BEGIN:VEVENT\nSUMMARY:${eventName || ""}\nLOCATION:${eventLocation || ""}\nDTSTART:${eventStart || ""}\nDTEND:${eventEnd || ""}\nDESCRIPTION:${eventDescription || ""}\nEND:VEVENT`;
        }
      case "Geo":
        return `geo:${inputs.latitude || ""},${inputs.longitude || ""}${inputs.label ? `?q=${inputs.label}` : ""}`;
      case "UPI":
        {
          const { pa, pn, am, cu, tn, tr } = inputs;
          return `upi://pay?pa=${pa || ""}&pn=${pn || ""}${am ? `&am=${am}` : ""}${cu ? `&cu=${cu}` : ""}${tn ? `&tn=${tn}` : ""}${tr ? `&tr=${tr}` : ""}`;
        }
      case "MECARD":
        {
          const { fullName, mePhone, meEmail } = inputs;
          return `MECARD:N:${fullName || ""};TEL:${mePhone || ""};EMAIL:${meEmail || ""};;`;
        }
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
      try {
        const result = validateInputSafety(inputType, content, isVerifiedUser);
        setValidationStatus(result.status);
        setValidationMessage(result.message);

        if (result.status === "block") {
          setPngDataUrl(null);
          return; // Stop unsafe QR generation
        }
      } catch (err) {
        // If validation throws, fail-safe: block
        console.error("Validation error:", err);
        setValidationStatus("block");
        setValidationMessage("Validation error");
        setPngDataUrl(null);
        return;
      }

      try {
        const params = new URLSearchParams({
          data: content,
          inputType: inputType,
          fg: fgColor,
          bg: bgColor,
          box_size: "10",
          border: "4",
          error: "H",
        });

        // Fetch PNG
        const response = await fetch(`${API_BASE}/generate?${params.toString()}`);
        if (!response.ok) throw new Error("Backend Error");
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        setPngDataUrl(imageUrl);

        // Fetch SVG (for EPS or vector downloads)
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
  }, [fgColor, bgColor, qrSize, inputType, inputs, isVerifiedUser]);

  /* ===== Handle Input Change ===== */
  const handleChange = (field, value) => {
    // preserve existing behavior but also validate inline
    setInputs((prev) => ({ ...prev, [field]: value }));

    // Run validation on the latest content quickly
    try {
      const content = (() => {
        // buildContent uses inputs state; use a local approximation with updated field
        const merged = { ...inputs, [field]: value };
        switch (inputType) {
          case "URL":
            return merged.url || "";
          case "Text":
            return merged.text || "";
          case "Wi-Fi": {
            const { ssid, password, encryption } = merged;
            return `WIFI:S:${ssid || ""};T:${encryption || "WPA"};P:${password || ""};;`;
          }
          case "Email": {
            const { emailTo, subject, body } = merged;
            return `mailto:${emailTo || ""}?subject=${encodeURIComponent(subject || "")}&body=${encodeURIComponent(body || "")}`;
          }
          case "vCard": {
            const { name, phone, email, company } = merged;
            return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || ""}\nORG:${company || ""}\nTEL:${phone || ""}\nEMAIL:${email || ""}\nEND:VCARD`;
          }
          case "Phone":
            return `tel:${merged.phoneNumber || ""}`;
          case "SMS":
            return `SMSTO:${merged.smsNumber || ""}:${merged.smsMessage || ""}`;
          case "Event": {
            const { eventName, eventLocation, eventStart, eventEnd, eventDescription } = merged;
            return `BEGIN:VEVENT\nSUMMARY:${eventName || ""}\nLOCATION:${eventLocation || ""}\nDTSTART:${eventStart || ""}\nDTEND:${eventEnd || ""}\nDESCRIPTION:${eventDescription || ""}\nEND:VEVENT`;
          }
          case "Geo":
            return `geo:${merged.latitude || ""},${merged.longitude || ""}${merged.label ? `?q=${merged.label}` : ""}`;
          case "UPI": {
            const { pa, pn, am, cu, tn, tr } = merged;
            return `upi://pay?pa=${pa || ""}&pn=${pn || ""}${am ? `&am=${am}` : ""}${cu ? `&cu=${cu}` : ""}${tn ? `&tn=${tn}` : ""}${tr ? `&tr=${tr}` : ""}`;
          }
          case "MECARD": {
            const { fullName, mePhone, meEmail } = merged;
            return `MECARD:N:${fullName || ""};TEL:${mePhone || ""};EMAIL:${meEmail || ""};;`;
          }
          default:
            return "";
        }
      })();

      const result = validateInputSafety(inputType, content, isVerifiedUser);
      setValidationStatus(result.status);
      setValidationMessage(result.message);
    } catch (err) {
      console.error("Inline validation error:", err);
      // keep previous validation state if inline validation fails unexpectedly
    }
  };

  /* ===== Handle Download ===== */
  const handleDownload = async () => {
    if (!pngDataUrl) return;
    const fileName = `qr-${qrSize}x${qrSize}.${downloadFormat}`;

    switch (downloadFormat) {
      case "png": {
        const a = document.createElement("a");
        a.href = pngDataUrl;
        a.download = fileName;
        a.click();
        break;
      }
      case "jpg":
      case "jpeg": {
        const img = new Image();
        img.src = pngDataUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          const jpgUrl = canvas.toDataURL("image/jpeg", 1.0);
          const a = document.createElement("a");
          a.href = jpgUrl;
          a.download = fileName;
          a.click();
        };
        break;
      }
      case "webp": {
        const img = new Image();
        img.src = pngDataUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const webpUrl = canvas.toDataURL("image/webp", 1.0);
          const a = document.createElement("a");
          a.href = webpUrl;
          a.download = fileName;
          a.click();
        };
        break;
      }
      case "svg": {
        if (!svgString) return;
        const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
      case "pdf": {
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: [qrSize + 100, qrSize + 100],
        });
        const margin = 50;
        pdf.addImage(pngDataUrl, "PNG", margin, margin, qrSize, qrSize);
        pdf.save(fileName);
        break;
      }
      case "tiff": {
        const img = new Image();
        img.src = pngDataUrl;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const tiff = UTIF.encodeImage(imageData.data, img.width, img.height);
          const blob = new Blob([tiff], { type: "image/tiff" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
        };
        break;
      }
      case "eps": {
        if (!svgString) return;
        const epsData = svgToEPS(svgString);
        const blob = new Blob([epsData], { type: "application/postscript" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
        break;
      }
      default:
        break;
    }
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
      case "Text":
        return (
          <textarea
            placeholder="Enter text..."
            rows="3"
            value={inputs.text || ""}
            onChange={(e) => handleChange("text", e.target.value)}
            className="qr-input"
          />
        );
      case "Wi-Fi":
        return (
          <>
            <input type="text" placeholder="SSID" value={inputs.ssid || ""} onChange={(e) => handleChange("ssid", e.target.value)} className="qr-input" />
            <input type="password" placeholder="Password" value={inputs.password || ""} onChange={(e) => handleChange("password", e.target.value)} className="qr-input" />
            <select value={inputs.encryption || "WPA"} onChange={(e) => handleChange("encryption", e.target.value)} className="qr-input">
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None</option>
            </select>
          </>
        );
      case "Email":
        return (
          <>
            <input type="email" placeholder="Recipient email" value={inputs.emailTo || ""} onChange={(e) => handleChange("emailTo", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Subject" value={inputs.subject || ""} onChange={(e) => handleChange("subject", e.target.value)} className="qr-input" />
            <textarea placeholder="Message body" rows="3" value={inputs.body || ""} onChange={(e) => handleChange("body", e.target.value)} className="qr-input" />
          </>
        );
      case "vCard":
        return (
          <>
            <input type="text" placeholder="Full Name" value={inputs.name || ""} onChange={(e) => handleChange("name", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Phone Number" value={inputs.phone || ""} onChange={(e) => handleChange("phone", e.target.value)} className="qr-input" />
            <input type="email" placeholder="Email Address" value={inputs.email || ""} onChange={(e) => handleChange("email", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Company (optional)" value={inputs.company || ""} onChange={(e) => handleChange("company", e.target.value)} className="qr-input" />
          </>
        );
      case "Phone":
        return <input type="text" placeholder="+91XXXXXXXXXX" value={inputs.phoneNumber || ""} onChange={(e) => handleChange("phoneNumber", e.target.value)} className="qr-input" />;
      case "SMS":
        return (
          <>
            <input type="text" placeholder="Recipient Number" value={inputs.smsNumber || ""} onChange={(e) => handleChange("smsNumber", e.target.value)} className="qr-input" />
            <textarea placeholder="Message" rows="3" value={inputs.smsMessage || ""} onChange={(e) => handleChange("smsMessage", e.target.value)} className="qr-input" />
          </>
        );
      case "Event":
        return (
          <>
            <input type="text" placeholder="Event Name" value={inputs.eventName || ""} onChange={(e) => handleChange("eventName", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Location" value={inputs.eventLocation || ""} onChange={(e) => handleChange("eventLocation", e.target.value)} className="qr-input" />
            <input type="datetime-local" placeholder="Start Time" value={inputs.eventStart || ""} onChange={(e) => handleChange("eventStart", e.target.value)} className="qr-input" />
            <input type="datetime-local" placeholder="End Time" value={inputs.eventEnd || ""} onChange={(e) => handleChange("eventEnd", e.target.value)} className="qr-input" />
            <textarea placeholder="Description" rows="3" value={inputs.eventDescription || ""} onChange={(e) => handleChange("eventDescription", e.target.value)} className="qr-input" />
          </>
        );
      case "Geo":
        return (
          <>
            <input type="number" placeholder="Latitude" value={inputs.latitude || ""} onChange={(e) => handleChange("latitude", e.target.value)} className="qr-input" />
            <input type="number" placeholder="Longitude" value={inputs.longitude || ""} onChange={(e) => handleChange("longitude", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Label (optional)" value={inputs.label || ""} onChange={(e) => handleChange("label", e.target.value)} className="qr-input" />
          </>
        );
      case "UPI":
        return (
          <>
            <input type="text" placeholder="Payee UPI ID (pa)" value={inputs.pa || ""} onChange={(e) => handleChange("pa", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Payee Name (pn)" value={inputs.pn || ""} onChange={(e) => handleChange("pn", e.target.value)} className="qr-input" />
            <input type="number" placeholder="Amount (am)" value={inputs.am || ""} onChange={(e) => handleChange("am", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Currency (cu)" value={inputs.cu || "INR"} onChange={(e) => handleChange("cu", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Transaction Note (tn)" value={inputs.tn || ""} onChange={(e) => handleChange("tn", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Transaction Ref (tr)" value={inputs.tr || ""} onChange={(e) => handleChange("tr", e.target.value)} className="qr-input" />
          </>
        );
      case "MECARD":
        return (
          <>
            <input type="text" placeholder="Full Name" value={inputs.fullName || ""} onChange={(e) => handleChange("fullName", e.target.value)} className="qr-input" />
            <input type="text" placeholder="Phone" value={inputs.mePhone || ""} onChange={(e) => handleChange("mePhone", e.target.value)} className="qr-input" />
            <input type="email" placeholder="Email" value={inputs.meEmail || ""} onChange={(e) => handleChange("meEmail", e.target.value)} className="qr-input" />
          </>
        );
      default:
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
            <select value={inputType} onChange={(e) => setInputType(e.target.value)} className="qr-input">
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
            <h2 className="section-title">2️⃣ Customize & Download</h2>
            <div className="customization-card">
              <div className="customization-row">
                <label>Foreground Color:</label>
                <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} />
              </div>
              <div className="customization-row">
                <label>Background Color:</label>
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
              </div>
              <div className="customization-row">
                <label>Download size:</label>
                <select value={qrSize} onChange={(e) => setQrSize(Number(e.target.value))} className="qr-input">
                  <option value="600">Small (600 × 600)</option>
                  <option value="900">Medium (900 × 900)</option>
                  <option value="1200">Large (1200 × 1200)</option>
                  <option value="1500">Extra Large (1500 × 1500)</option>
                  <option value="2000">Ultra HD (2000 × 2000)</option>
                </select>
              </div>
              <div className="customization-row">
                <label>Download Format:</label>
                <select value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)} className="qr-input">
                  <option value="png">PNG</option>
                  <option value="jpg">JPG</option>
                  <option value="webp">WebP</option>
                  <option value="svg">SVG</option>
                  <option value="pdf">PDF</option>
                  <option value="tiff">TIFF</option>
                  <option value="eps">EPS</option>
                </select>
              </div>
              <button className="secondary-btn" onClick={handleDownload} disabled={!pngDataUrl}>
                Download {downloadFormat.toUpperCase()}
              </button>
            </div>
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
