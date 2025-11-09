import React, { useState, useEffect } from "react";
import QRCodeLib from "qrcode";
import jsPDF from "jspdf";
import * as UTIF from "utif"; // for TIFF export

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

/* ===== SVG → EPS Converter ===== */
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

  /* ===== Build Content ===== */
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
        return `BEGIN:VCARD\nVERSION:3.0\nFN:${name || ""}\nORG:${company || ""}\nTEL:${
          phone || ""
        }\nEMAIL:${email || ""}\nEND:VCARD`;
      default:
        return "";
    }
  };

  /* ===== Live Preview ===== */
  useEffect(() => {
    const timeout = setTimeout(async () => {
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

        const svg = await QRCodeLib.toString(content, {
          type: "svg",
          errorCorrectionLevel: "M",
          margin: 1,
          color: { dark: fgColor, light: bgColor },
        });
        setSvgString(svg);
      } catch (err) {
        console.error("QR generation failed:", err);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [fgColor, bgColor, qrSize, inputType, inputs]);

  /* ===== Input Change Handler ===== */
  const handleChange = (field, value) => {
    setInputs((prev) => ({ ...prev, [field]: value }));
  };

  /* ===== Handle Download ===== */
  const handleDownload = async () => {
    if (!pngDataUrl) return;

    // --- PNG ---
    if (downloadFormat === "png") {
      const a = document.createElement("a");
      a.href = pngDataUrl;
      a.download = `qr-${qrSize}x${qrSize}.png`;
      a.click();
    }

    // --- JPG ---
    else if (downloadFormat === "jpg" || downloadFormat === "jpeg") {
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
        a.download = `qr-${qrSize}x${qrSize}.jpg`;
        a.click();
      };
    }

    // --- WebP ---
    else if (downloadFormat === "webp") {
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
        a.download = `qr-${qrSize}x${qrSize}.webp`;
        a.click();
      };
    }

    // --- SVG ---
    else if (downloadFormat === "svg" && svgString) {
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${qrSize}x${qrSize}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    }

    // --- PDF ---
    else if (downloadFormat === "pdf") {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: [qrSize + 100, qrSize + 100],
      });
      const margin = 50;
      pdf.addImage(pngDataUrl, "PNG", margin, margin, qrSize, qrSize);
      pdf.save(`qr-${qrSize}x${qrSize}.pdf`);
    }

    // --- TIFF ---
    else if (downloadFormat === "tiff") {
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
        a.download = `qr-${qrSize}x${qrSize}.tiff`;
        a.click();
        URL.revokeObjectURL(url);
      };
    }

    // --- EPS ---
    else if (downloadFormat === "eps" && svgString) {
      const epsData = svgToEPS(svgString);
      const blob = new Blob([epsData], { type: "application/postscript" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${qrSize}x${qrSize}.eps`;
      a.click();
      URL.revokeObjectURL(url);
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
            placeholder="Enter your text here..."
            rows="3"
            value={inputs.text || ""}
            onChange={(e) => handleChange("text", e.target.value)}
            className="qr-input"
          />
        );
      default:
        return null;
    }
  };

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
        <section className="section input-section">
          <h2 className="section-title">1️⃣ Enter Your Content</h2>
          <div className="input-card">
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
            </select>
            {renderInputFields()}
          </div>
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
              <label>Download Format:</label>
              <select
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value)}
                className="qr-input"
              >
                <option value="png">PNG (Recommended)</option>
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
            {!pngDataUrl && <p>QR Preview Will Appear Here</p>}
            {pngDataUrl && (
              <img
                src={pngDataUrl}
                alt="QR Preview"
                style={{ width: 220, height: 220, objectFit: "contain", borderRadius: 8 }}
              />
            )}
          </div>
        </section>
      </main>

      <footer className="app-footer">
        <p>© 2025 QRVerse • Multi-format QR Generator</p>
      </footer>
    </div>
  );
}

export default App;
