import React, { useState } from "react";
import QRCodeLib from "qrcode";

function App() {
  // ===== STATE =====
  const [inputType, setInputType] = useState("URL");
  const [inputs, setInputs] = useState({});
  const [loading, setLoading] = useState(false);
  const [pngDataUrl, setPngDataUrl] = useState(null);
  const [svgString, setSvgString] = useState(null);
  const [error, setError] = useState(null);

  // ===== HANDLE FORM CHANGES =====
  const handleChange = (field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  // ===== BUILD CONTENT STRING BASED ON TYPE =====
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

  // ===== GENERATE QR =====
  const handleGenerate = async () => {
    setError(null);
    const content = buildContent();

    if (!content.trim()) {
      setError("Please fill in the required fields before generating.");
      return;
    }

    setLoading(true);
    setPngDataUrl(null);
    setSvgString(null);

    try {
      const dataUrl = await QRCodeLib.toDataURL(content, {
        errorCorrectionLevel: "M",
        margin: 1,
        scale: 8,
      });

      const svg = await QRCodeLib.toString(content, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
      });

      setPngDataUrl(dataUrl);
      setSvgString(svg);
    } catch (err) {
      console.error("QR generation failed:", err);
      setError("Failed to generate QR. Try simpler input.");
    } finally {
      setLoading(false);
    }
  };

  // ===== DOWNLOAD FUNCTIONS =====
  const downloadPng = () => {
    if (!pngDataUrl) return;
    const a = document.createElement("a");
    a.href = pngDataUrl;
    a.download = "qr-code.png";
    a.click();
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ===== RENDER INPUT FORMS =====
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
              value={inputs.ssid || ""}
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

  return (
    <div className="app">
      {/* ===== HEADER ===== */}
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

      {/* ===== MAIN CONTENT ===== */}
      <main className="app-main">
        <div className="main-container">
          {/* INPUT SECTION */}
          <section className="section input-section">
            <h2 className="section-title">1️⃣ Enter Your Content</h2>
            <p className="section-subtitle">
              Select the type of content and fill in the details below.
            </p>

            <div className="input-card">
              <label htmlFor="type" className="input-label">
                Select Type
              </label>
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

              {error && <div style={{ color: "crimson", fontSize: 14 }}>{error}</div>}

              <button
                className="primary-btn"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? "Generating…" : "Generate QR"}
              </button>
            </div>
          </section>

          {/* CUSTOMIZATION SECTION */}
          <section className="section customization-section">
            <h2 className="section-title">2️⃣ Customize Your QR</h2>
            <p className="section-subtitle">
              Choose colors, shapes, and add a logo to match your brand.
            </p>

            <div className="customization-card">
              <div className="customization-row">
                <label>Foreground Color:</label>
                <input type="color" defaultValue="#000000" />
              </div>

              <div className="customization-row">
                <label>Background Color:</label>
                <input type="color" defaultValue="#ffffff" />
              </div>

              <div className="customization-row">
                <label>Upload Logo:</label>
                <input type="file" accept="image/*" />
              </div>

              <div className="customization-row">
                <label>Size:</label>
                <input type="range" min="100" max="600" defaultValue="250" />
              </div>
            </div>
          </section>

          {/* PREVIEW SECTION */}
          <section className="section preview-section">
            <h2 className="section-title">3️⃣ Preview & Download</h2>
            <p className="section-subtitle">
              See your QR code below and download it as PNG or SVG.
            </p>

            <div className="preview-card">
              <div className="qr-preview-placeholder">
                {loading && <p>Generating preview…</p>}
                {!loading && !pngDataUrl && <p>QR Preview Will Appear Here</p>}
                {!loading && pngDataUrl && (
                  <img
                    src={pngDataUrl}
                    alt="Generated QR"
                    style={{
                      width: 220,
                      height: 220,
                      objectFit: "contain",
                      borderRadius: 8,
                    }}
                  />
                )}
              </div>

              <div className="download-buttons">
                <button
                  className="secondary-btn"
                  onClick={downloadPng}
                  disabled={!pngDataUrl}
                >
                  Download PNG
                </button>
                <button
                  className="secondary-btn"
                  onClick={downloadSvg}
                  disabled={!svgString}
                >
                  Download SVG
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ===== FOOTER ===== */}
      <footer className="app-footer">
        <p>© 2025 QRVerse • Built for creators and businesses</p>
      </footer>
    </div>
  );
}

export default App;
