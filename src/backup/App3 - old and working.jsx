import React, { useState, useEffect } from "react";
import QRCodeLib from "qrcode";

/* ===== Custom Hook: Persistent State ===== */
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
      console.warn("Unable to save state:", key);
    }
  }, [key, value]);

  return [value, setValue];
}

/* ===== Main App Component ===== */
function App() {
  // Input and customization states (persistent)
  const [inputType, setInputType] = usePersistentState("qrverse-inputType", "URL");
  const [inputs, setInputs] = usePersistentState("qrverse-inputs", {});
  const [fgColor, setFgColor] = usePersistentState("qrverse-fgColor", "#000000");
  const [bgColor, setBgColor] = usePersistentState("qrverse-bgColor", "#ffffff");
  const [qrSize, setQrSize] = usePersistentState("qrverse-qrSize", 900);
  const [logoFile, setLogoFile] = useState(null); // placeholder (future feature)

  // QR state
  const [loading, setLoading] = useState(false);
  const [pngDataUrl, setPngDataUrl] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [error, setError] = useState(null);

  /* ===== Handle Input Changes ===== */
  const handleChange = (field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  /* ===== Build QR Content Based on Input Type ===== */
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
        return `mailto:${emailTo || ""}?subject=${encodeURIComponent(
          subject || ""
        )}&body=${encodeURIComponent(body || "")}`;
      case "vCard":
        const { name, phone, email, company } = inputs;
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || ""}\nORG:${
          company || ""
        }\nTEL:${phone || ""}\nEMAIL:${email || ""}\nEND:VCARD`;
      default:
        return "";
    }
  };

  /* ===== Generate QR on Button Click ===== */
  const handleGenerate = async () => {
    const content = buildContent();
    if (!content.trim()) {
      setError("Please fill in the required fields before generating.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const dataUrl = await QRCodeLib.toDataURL(content, {
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: fgColor, light: bgColor },
        width: qrSize,
      });

      const svg = await QRCodeLib.toString(content, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        color: { dark: fgColor, light: bgColor },
      });

      setPngDataUrl(dataUrl);
      setSvgString(svg);
    } catch (err) {
      console.error("QR generation failed:", err);
      setError("Failed to generate QR. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ===== Auto-generate live preview when inputs or colors change ===== */
  useEffect(() => {
    const autoPreview = async () => {
      const content = buildContent();
      if (!content.trim()) return;
      try {
        const dataUrl = await QRCodeLib.toDataURL(content, {
          errorCorrectionLevel: "M",
          margin: 1,
          color: { dark: fgColor, light: bgColor },
          width: qrSize,
        });
        setPngDataUrl(dataUrl);
      } catch (err) {
        console.error("Live preview generation failed:", err);
      }
    };
    autoPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fgColor, bgColor, qrSize, inputType, inputs]);

  /* ===== Download Functions ===== */
  const downloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = `qr-${qrSize}x${qrSize}.png`;
    a.click();
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${qrSize}x${qrSize}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ===== Dynamic Input Fields ===== */
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
            placeholder="Enter your text here..."
            rows="3"
            value={inputs.text || ""}
            onChange={(e) => handleChange("text", e.target.value)}
            className="qr-input"
          />
        );

      case "Wi-Fi":
        return (
          <>
            <input
              type="text"
              placeholder="Network SSID"
              value={inputs.s || ""}
              onChange={(e) => handleChange("ssid", e.target.value)}
              className="qr-input"
            />
            <input
              type="password"
              placeholder="Password"
              value={inputs.password || ""}
              onChange={(e) => handleChange("password", e.target.value)}
              className="qr-input"
            />
            <select
              value={inputs.encryption || "WPA"}
              onChange={(e) => handleChange("encryption", e.target.value)}
              className="qr-input"
            >
              <option value="WPA">WPA/WPA2</option>
              <option value="WEP">WEP</option>
              <option value="nopass">None</option>
            </select>
          </>
        );

      case "Email":
        return (
          <>
            <input
              type="email"
              placeholder="Recipient email"
              value={inputs.emailTo || ""}
              onChange={(e) => handleChange("emailTo", e.target.value)}
              className="qr-input"
            />
            <input
              type="text"
              placeholder="Subject"
              value={inputs.subject || ""}
              onChange={(e) => handleChange("subject", e.target.value)}
              className="qr-input"
            />
            <textarea
              placeholder="Message body"
              rows="3"
              value={inputs.body || ""}
              onChange={(e) => handleChange("body", e.target.value)}
              className="qr-input"
            />
          </>
        );

      case "vCard":
        return (
          <>
            <input
              type="text"
              placeholder="Full Name"
              value={inputs.name || ""}
              onChange={(e) => handleChange("name", e.target.value)}
              className="qr-input"
            />
            <input
              type="text"
              placeholder="Phone Number"
              value={inputs.phone || ""}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="qr-input"
            />
            <input
              type="email"
              placeholder="Email Address"
              value={inputs.email || ""}
              onChange={(e) => handleChange("email", e.target.value)}
              className="qr-input"
            />
            <input
              type="text"
              placeholder="Company (optional)"
              value={inputs.company || ""}
              onChange={(e) => handleChange("company", e.target.value)}
              className="qr-input"
            />
          </>
        );

      default:
        return null;
    }
  };

  /* ===== UI ===== */
  return (
    <div className="app">
      {/* HEADER */}
      <header className="app-header">
        <div className="header-container">
          <div className="logo">
            <img src="/qrverse-logo.png" alt="QRVerse Logo" className="logo-img" />
            <h1 className="site-title">QRVerse</h1>
          </div>
          <nav className="nav-links">
            <a href="#" className="nav-item">Home</a>
            <a href="#" className="nav-item">History</a>
            <a href="#" className="nav-item">About</a>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="app-main">
        <div className="main-container">
          {/* INPUT SECTION */}
          <section className="section input-section">
            <h2 className="section-title">1️⃣ Enter Your Content</h2>
            <p className="section-subtitle">Select the type and fill in the details below.</p>

            <div className="input-card">
              <label htmlFor="type" className="input-label">Select Type</label>
              <select
                id="type"
                value={inputType}
                onChange={(e) => setInputType(e.target.value)}
                className="qr-input"
              >
                <option value="URL">URL</option>
                <option value="Text">Text</option>
                <option value="Wi-Fi">Wi-Fi</option>
                <option value="Email">Email</option>
                <option value="vCard">vCard</option>
              </select>
              {renderInputFields()}
            </div>
          </section>

          {/* CUSTOMIZATION SECTION */}
          <section className="section customization-section">
            <h2 className="section-title">2️⃣ Customize & Generate</h2>
            <p className="section-subtitle">Adjust colors, size, or upload a logo (coming soon).</p>

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
                <label>Size Preset:</label>
                <select
                  value={qrSize}
                  onChange={(e) => setQrSize(Number(e.target.value))}
                  className="qr-input"
                >
                  <option value="600">600 × 600 (Small)</option>
                  <option value="900">900 × 900 (Medium)</option>
                  <option value="1200">1200 × 1200 (Large)</option>
                  <option value="1500">1500 × 1500 (Extra Large)</option>
                  <option value="2000">2000 × 2000 (Ultra HD)</option>
                </select>
              </div>

              <div className="customization-row">
                <label>Upload Logo (coming soon):</label>
                <input type="file" accept="image/*" disabled onChange={(e) => setLogoFile(e.target.files[0])} />
              </div>

              {error && <div style={{ color: "crimson", fontSize: 14 }}>{error}</div>}
              <button className="primary-btn" onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating…" : "Generate QR Code"}
              </button>
            </div>
          </section>

          {/* PREVIEW SECTION */}
          <section className="section preview-section">
            <h2 className="section-title">3️⃣ Preview & Download</h2>
            <p className="section-subtitle">See your QR and download it as PNG or SVG.</p>

            <div className="preview-card">
              <div className="qr-preview-placeholder">
                {loading && <p>Generating preview…</p>}
                {!loading && !pngDataUrl && <p>QR Preview Will Appear Here</p>}
                {!loading && pngDataUrl && (
                  <img
                    src={pngDataUrl}
                    alt="Generated QR"
                    style={{ width: 220, height: 220, objectFit: "contain", borderRadius: 8 }}
                  />
                )}
              </div>

              <div className="download-buttons">
                <button className="secondary-btn" onClick={downloadPng} disabled={!pngDataUrl}>
                  Download PNG
                </button>
                <button className="secondary-btn" onClick={downloadSvg} disabled={!svgString}>
                  Download SVG
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="app-footer">
        <p>© 2025 QRVerse • Built for creators and businesses</p>
      </footer>
    </div>
  );
}

export default App;
