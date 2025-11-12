// ==============================
// QRVerse - Input Safety Validator (Enhanced with Encoding, Hidden Executable, and Punycode Checks)
// ==============================
// Minimal targeted fixes applied:
// 1️⃣ Multi-level URL decoding (handles %2E, %252E, %00)
// 2️⃣ Hidden executable detection in obfuscated URLs
// 3️⃣ Punycode (IDN) domain warning
// ==============================

export function validateInputSafety(inputType, content, isVerifiedUser = false) {
  // ---- 1️⃣ Normalize ----
  if (!content || typeof content !== "string" || !content.trim()) {
    return {
      status: "block",
      reasonCode: "EMPTY",
      message: "Please enter content to generate a QR code.",
    };
  }

  // Multi-level decoding (handles %2E, %252E, etc.)
  let decoded = content.trim().toLowerCase();
  for (let i = 0; i < 3; i++) {
    try {
      const once = decodeURIComponent(decoded);
      if (once === decoded) break;
      decoded = once;
    } catch {
      break;
    }
  }

  // Remove null bytes and control chars (for %00, etc.)
  decoded = decoded.replace(/\x00/g, "");

  const isUrlLike = /^https?:\/\//i.test(decoded) || /^ftp:\/\//i.test(decoded);

  // ---- 2️⃣ Skip validation for non-URL input types ----
  const nonUrlTypes = ["Text", "Wi-Fi", "Email", "vCard", "Phone", "SMS", "Event", "Geo", "UPI", "MECARD"];
  if (nonUrlTypes.includes(inputType)) {
    return { status: "ok", reasonCode: "SAFE", message: "Content type is non-URL and safe." };
  }

  // ---- 3️⃣ Protocol Safety Check ----
  const unsafeProtocolPattern = /^(javascript:|data:|file:|vbscript:|about:|filesystem:)/i;
  const riskyProtocolPattern = /^(ftp:|telnet:|ssh:|mms:|rtsp:|magnet:)/i;

  if (unsafeProtocolPattern.test(decoded)) {
    return {
      status: "block",
      reasonCode: "UNSAFE_PROTOCOL",
      message: "Blocked — unsafe URL scheme (javascript:, data:, file:, etc.) detected.",
    };
  }
  if (riskyProtocolPattern.test(decoded)) {
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

  // ---- 5️⃣ Extract file extension safely ----
  let extension = "";
  try {
    const urlObj = new URL(decoded);
    const pathname = urlObj.pathname || "";
    const pathPart = pathname.toLowerCase().split(/[?#]/)[0];
    const extMatch = pathPart.match(/\.([a-z0-9]+)$/i);
    extension = extMatch ? extMatch[1].toLowerCase() : "";
  } catch {
    const noQuery = decoded.split(/[?#]/)[0];
    const extMatch = noQuery.match(/\.([a-z0-9]+)$/i);
    extension = extMatch ? extMatch[1].toLowerCase() : "";
  }

  // ---- 6️⃣ Hidden executable detection in encoded or obfuscated paths ----
  if (/\.(exe|msi|bat|cmd|vbs|scr|dll|jar|apk|ps1|sh|aab)(?=[^a-z]|$)/i.test(decoded)) {
    return {
      status: "block",
      reasonCode: "EXECUTABLE_HIDDEN",
      message: "Blocked — hidden executable signature detected in encoded or obfuscated URL.",
    };
  }

  // ---- 7️⃣ Executable / Dangerous File Extensions ----
  if (blockedExtensions.includes(extension)) {
    return {
      status: "block",
      reasonCode: "EXECUTABLE",
      message: `Blocked — executable or installable file type (.${extension}) is not allowed for safety reasons.`,
    };
  }

  // ---- 8️⃣ Archive / Compressed Files ----
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

  // ---- 9️⃣ Macro-Enabled Office Documents ----
  if (macroEnabledDocs.includes(extension)) {
    return {
      status: "warn",
      reasonCode: "MACRO_DOC",
      message: `Macro-enabled document (.${extension}) detected. These may contain embedded scripts. Verify file before sharing.`,
    };
  }

// ---- 🔟 Punycode (IDN) detection — Warn only ----
try {
  const urlObj = new URL(decoded);
  const domain = urlObj.hostname.toLowerCase();

  if (domain.startsWith("xn--")) {
    return {
      status: "warn",
      reasonCode: "PUNYCODE_DOMAIN",
      message:
        "Caution — this domain uses internationalized (Punycode) characters. Verify that it belongs to a trusted source before sharing or scanning.",
    };
  }

  if (shortenerDomains.includes(domain)) {
    return {
      status: "warn",
      reasonCode: "SHORTENER",
      message: `Shortened URL detected (${domain}). Expand the link before generating a QR code.`,
    };
  }
} catch {
  // ignore invalid URL
}


  // ---- 11️⃣ HTTP vs HTTPS ----
  if (decoded.startsWith("http://")) {
    return {
      status: "warn",
      reasonCode: "HTTP",
      message: "Warning — non-secure HTTP link detected. Use HTTPS whenever possible.",
    };
  }

  // ---- 12️⃣ Default Safe Case ----
  if (isUrlLike || decoded.startsWith("https://")) {
    return {
      status: "ok",
      reasonCode: "SAFE",
      message: "Looks good — this link appears safe for QR generation.",
    };
  }

  // ---- 13️⃣ Invalid or malformed input ----
  return {
    status: "block",
    reasonCode: "INVALID",
    message: "Invalid or unrecognized input. Please enter a valid URL or text.",
  };
}
