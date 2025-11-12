// ==============================
// QRVerse - Input Safety Validator
// ==============================
// This function validates input content before generating or previewing QR codes.
// It classifies input as SAFE, WARN, or BLOCK, and provides a message for UI display.
// It should be imported and called before any backend requests for QR generation.

export function validateInputSafety(inputType, content, isVerifiedUser = false) {
  // ---- 1️⃣ Normalize ----
  if (!content || typeof content !== "string" || !content.trim()) {
    return {
      status: "block",
      reasonCode: "EMPTY",
      message: "Please enter content to generate a QR code.",
    };
  }

  const value = content.trim().toLowerCase();
  const decoded = decodeURIComponent(value);
  const noQuery = decoded.split(/[?#]/)[0]; // strip query string
  const isUrlLike = /^https?:\/\//i.test(value) || /^ftp:\/\//i.test(value);

  // ---- 2️⃣ Skip validation for non-URL input types ----
  const nonUrlTypes = ["Text", "Wi-Fi", "Email", "vCard", "Phone", "SMS", "Event", "Geo", "UPI", "MECARD"];
  if (nonUrlTypes.includes(inputType)) {
    return { status: "ok", reasonCode: "SAFE", message: "Content type is non-URL and safe." };
  }

  // ---- 3️⃣ Protocol Safety Check ----
  const unsafeProtocolPattern = /^(javascript:|data:|file:|vbscript:|about:|filesystem:)/i;
  const riskyProtocolPattern = /^(ftp:|telnet:|ssh:|mms:|rtsp:|magnet:)/i;

  if (unsafeProtocolPattern.test(value)) {
    return {
      status: "block",
      reasonCode: "UNSAFE_PROTOCOL",
      message: "Blocked — unsafe URL scheme (javascript:, data:, file:, etc.) detected.",
    };
  }
  if (riskyProtocolPattern.test(value)) {
    return {
      status: "warn",
      reasonCode: "RISKY_PROTOCOL",
      message: "Warning — non-secure protocol detected (ftp, telnet, etc.).",
    };
  }

  // ---- 4️⃣ Define lists ----
  const blockedExtensions = [
    "exe", "msi", "bat", "cmd", "vbs", "scr", "dll", "com", "jar", "ps1", "sh",
    "apk", "aab", "app", "dmg", "pkg", "deb", "rpm", "img", "bin", "crx", "xpi"
  ];

  const archiveExtensions = [
    "zip", "rar", "7z", "tar", "tgz", "tar.gz", "gz", "bz2", "xz", "iso"
  ];

  const macroEnabledDocs = ["docm", "xlsm", "pptm"];

  const shortenerDomains = [
    "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "dlvr.it", "rebrand.ly", "cutt.ly"
  ];

  // ---- 5️⃣ Extract file extension ----
  const extensionMatch = noQuery.match(/\.([a-z0-9]+)$/i);
  const extension = extensionMatch ? extensionMatch[1].toLowerCase() : "";

  // ---- 6️⃣ Executable / Dangerous File Extensions ----
  if (blockedExtensions.includes(extension)) {
    return {
      status: "block",
      reasonCode: "EXECUTABLE",
      message: `Blocked — executable or installable file type (.${extension}) is not allowed for safety reasons.`,
    };
  }

  // ---- 7️⃣ Archive / Compressed Files ----
  if (archiveExtensions.includes(extension)) {
    if (!isVerifiedUser) {
      return {
        status: "block",
        reasonCode: "ARCHIVE",
        message: `Archive file (.${extension}) links are restricted to verified users for safety.`,
      };
    } else {
      return {
        status: "warn",
        reasonCode: "ARCHIVE",
        message: `Archive link detected (.${extension}). Proceed with caution and share only with trusted users.`,
      };
    }
  }

  // ---- 8️⃣ Macro-Enabled Office Documents ----
  if (macroEnabledDocs.includes(extension)) {
    return {
      status: "warn",
      reasonCode: "MACRO_DOC",
      message: `Macro-enabled document (.${extension}) detected. These may contain embedded scripts. Verify file before sharing.`,
    };
  }

  // ---- 9️⃣ Shortened URLs ----
  try {
    const urlObj = new URL(value);
    const domain = urlObj.hostname.replace(/^www\./, "");
    if (shortenerDomains.includes(domain)) {
      return {
        status: "warn",
        reasonCode: "SHORTENER",
        message: `Shortened URL detected (${domain}). Expand the link before generating a QR code.`,
      };
    }
  } catch {
    // not a valid URL; fall through
  }

  // ---- 🔟 HTTP vs HTTPS ----
  if (value.startsWith("http://")) {
    return {
      status: "warn",
      reasonCode: "HTTP",
      message: "Warning — non-secure HTTP link detected. Use HTTPS whenever possible.",
    };
  }

  // ---- 11️⃣ Default Safe Case ----
  if (isUrlLike || value.startsWith("https://")) {
    return {
      status: "ok",
      reasonCode: "SAFE",
      message: "Looks good — this link appears safe for QR generation.",
    };
  }

  // ---- 12️⃣ Invalid or malformed input ----
  return {
    status: "block",
    reasonCode: "INVALID",
    message: "Invalid or unrecognized input. Please enter a valid URL or text.",
  };
}

