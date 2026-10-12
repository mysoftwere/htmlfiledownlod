function processTargetUrl(rawUrl) {
  let decodedUrl = rawUrl;
  try {
    decodedUrl = decodeURIComponent(rawUrl);
  } catch (e) {}

  const xmlMatch = decodedUrl.match(/[?&]xml=([^&]+)/i);
  const idMatch = decodedUrl.match(/[?&]id=([^&]+)/i);

  const xmlParam = xmlMatch ? xmlMatch[1] : null;
  const contentId = idMatch ? idMatch[1] : "downloaded_page";

  if (!xmlParam || !xmlParam.includes("base64,")) {
    console.log("No xml base64 found in URL:", decodedUrl);
    return null;
  }

  const b64 = xmlParam.split("base64,")[1];
  // Node Buffer replacement for atob
  const decodedXml = Buffer.from(b64.replace(/ /g, "+"), "base64").toString("utf-8");
  const incMatch = decodedXml.match(/url=["']([^"']+)["']/i);

  if (incMatch) {
    let incUrl = incMatch[1].replace(/\\/g, "").replace(/^\/+/, "");
    if (!incUrl.startsWith("http")) incUrl = "https://" + incUrl;
    return { incUrl, contentId, decodedXml };
  }
  return null;
}

const sample1 = "https://www.google.com/url?q=https://czechinvest.gov.cz/panorama/CZI-Holesov/index.html?&xml=data:video/mp4;base64,PGtycGFubz48aW5jbHVkZSB1cmw9Ii9cL3BpeGlyZWVsLmNvbS92b3MvZGEueG1sIi8+PC9rcnBhbm8+&id=video-germany-vs-netherlands-live-en3";
console.log("Parsed result:", processTargetUrl(sample1));
