const fs = require('fs');
const htmlContent = fs.readFileSync('gas_response.html', 'utf-8');

function extractGasPayload(htmlContent) {
  if (htmlContent.includes("userHtml")) {
    const idx = htmlContent.indexOf("userHtml");
    if (idx !== -1) {
      const snippet = htmlContent.substring(idx, idx + 500000);
      const endMatch = snippet.match(/(\\x22|")\s*,\s*(\\x22|")(?:ncc|sandboxHost|clientSideProperties)/);
      if (endMatch) {
        let rawPayload = snippet.substring(0, endMatch.index);
        const startDoc = rawPayload.match(/\\x3c!|\\x3chtml|<!|<html/i);
        if (startDoc) {
          rawPayload = rawPayload.substring(startDoc.index);
        }

        let unescaped = rawPayload
          .replace(/\\x22/g, '"')
          .replace(/\\x3c/g, "<")
          .replace(/\\x3e/g, ">")
          .replace(/\\x3d/g, "=")
          .replace(/\\x27/g, "'")
          .replace(/\\x26/g, "&")
          .replace(/\\x5b/g, "[")
          .replace(/\\x5d/g, "]")
          .replace(/\\x7b/g, "{")
          .replace(/\\x7d/g, "}")
          .replace(/\\x2f/g, "/")
          .replace(/\\\//g, "/")
          .replace(/\\"/g, '"')
          .replace(/\\r\\n/g, "\n")
          .replace(/\\n/g, "\n");

        return unescaped.trim();
      }
    }
  }
  return htmlContent;
}

const clean = extractGasPayload(htmlContent);
console.log("Extracted JS Length:", clean.length);
console.log("\nFirst 400 Chars of JS clean payload:\n", clean.substring(0, 400));
