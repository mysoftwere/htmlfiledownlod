function extractTargetUrl(confText, contentId, incUrl) {
  const regex = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  let fullText = confText;
  let match;
  while ((match = regex.exec(confText)) !== null) {
    try {
      fullText += "\n" + Buffer.from(match[1].replace(/ /g, "+"), "base64").toString("utf-8");
    } catch (e) {}
  }

  const fetchMatch = fullText.match(/https?:\/\/[^\s"'`+]+?\/(?=["']\s*\+\s*id)/i);
  if (fetchMatch) {
    return fetchMatch[0] + contentId + ".html";
  }

  const baseMatch = fullText.match(/base\s*=\s*["'](https?:\/\/[^"']+)["']/i);
  if (baseMatch) {
    let base = baseMatch[1].replace(/\/$/, "");
    return base + "/" + contentId + ".html";
  }

  const htmlMatch = fullText.match(/https?:\/\/[^\s"'`>]+\.html/i);
  if (htmlMatch) {
    return htmlMatch[0];
  }

  try {
    const urlObj = new URL(incUrl);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    pathParts.pop();
    const parentPath = pathParts.join("/");
    return `${urlObj.origin}/${parentPath ? parentPath + "/" : ""}${contentId}.html`;
  } catch (e) {
    return null;
  }
}

async function resolveFinalUrlFromXml(decodedXml, contentId) {
  const openUrlMatch = decodedXml.match(/openurl\s*\(\s*['"]?(https?:\/\/[^'"]+)/i) || 
                       decodedXml.match(/(https?:\/\/[^\s"'`<>]+\.html)/i);
                       
  if (openUrlMatch) {
    let directUrl = openUrlMatch[1] || openUrlMatch[0];
    directUrl = directUrl.replace(/['",)]+$/, "");
    return directUrl;
  }

  const incMatch = decodedXml.match(/url=["']([^"']+)["']/i);
  if (incMatch) {
    let incUrl = incMatch[1].replace(/\\/g, "").replace(/^\/+/, "");
    if (!incUrl.startsWith("http")) {
      incUrl = "https://" + incUrl;
    }

    const res = await fetch(incUrl);
    const text = await res.text();
    return extractTargetUrl(text, contentId, incUrl);
  }

  return null;
}

// Test case 1: openurl xml
const xml1 = `<krpano onstart="openurl('http://www.c-air.com/pxd/video/video-livestreams-football-germany-vs-netherlands-live-streams-and-tv-schedule-on-24-september-2026-sports-66k8p.html', '_self');"></krpano>`;
resolveFinalUrlFromXml(xml1, "test-id").then(res => console.log("Test 1 (openurl):", res));

// Test case 2: include xml
const xml2 = `<krpano><include url="/\\/humayrakter.github.io/video/b.xml"/></krpano>`;
resolveFinalUrlFromXml(xml2, "video-netherlands-v-germany-liv-enus.004").then(res => console.log("Test 2 (include):", res));
