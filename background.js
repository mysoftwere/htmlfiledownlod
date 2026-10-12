chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "download_krpano_html",
    title: "Download Krpano Target HTML",
    contexts: ["link", "page"]
  });
});

function notify(title, message) {
  try {
    chrome.notifications.create({
      type: "basic",
      iconUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      title: title,
      message: message
    });
  } catch (e) {
    console.log(title, message);
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "download_krpano_html") {
    const targetUrl = info.linkUrl || (tab ? tab.url : "");
    if (targetUrl) {
      processAndDownload(targetUrl);
    } else {
      notify("Krpano Downloader", "❌ কোনো বৈধ লিংক খুঁজে পাওয়া যায়নি!");
    }
  }
});

function decodeXmlParam(xmlParam) {
  if (!xmlParam) return null;

  if (xmlParam.includes("base64,")) {
    let b64 = xmlParam.split("base64,")[1];
    return safeB64Decode(b64);
  }

  let decoded = xmlParam;
  try {
    decoded = decodeURIComponent(xmlParam);
  } catch (e) {}

  if (decoded.includes("<krpano") || decoded.includes("include") || decoded.includes("openurl")) {
    return decoded;
  }

  const rawB64Decoded = safeB64Decode(xmlParam);
  if (rawB64Decoded.includes("<krpano") || rawB64Decoded.includes("openurl")) {
    return rawB64Decoded;
  }

  return decoded;
}

function safeB64Decode(str) {
  try {
    const raw = atob(str.replace(/ /g, "+"));
    return new TextDecoder().decode(Uint8Array.from(raw, c => c.charCodeAt(0)));
  } catch (e) {
    try {
      return atob(str.replace(/ /g, "+"));
    } catch (err) {
      return str;
    }
  }
}

function decodeNestedAtob(text) {
  let resultText = text;
  const regex = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const decoded = safeB64Decode(match[1]);
      resultText += "\n" + decoded;
    } catch (e) {}
  }
  return resultText;
}

function extractTargetUrl(confText, contentId, incUrl) {
  const fullText = decodeNestedAtob(confText);

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

    try {
      const res = await fetch(incUrl);
      if (res.ok) {
        const text = await res.text();
        return extractTargetUrl(text, contentId, incUrl);
      }
    } catch (e) {}
  }

  return null;
}

async function resolveGoogleGotoUrl(rawUrl) {
  if (rawUrl.includes("google.com/goto") || (!rawUrl.includes("xml=") && rawUrl.includes("google.com"))) {
    try {
      const res = await fetch(rawUrl, { method: "GET" });
      if (res.url && res.url.includes("xml=")) {
        return res.url;
      }
    } catch (e) {}
  }
  return rawUrl;
}

function extractGasPayload(htmlContent) {
  if (htmlContent && htmlContent.includes("userHtml")) {
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
          .replace(/\\x3c/g, '<')
          .replace(/\\x3e/g, '>')
          .replace(/\\x3d/g, '=')
          .replace(/\\x27/g, "'")
          .replace(/\\x26/g, '&')
          .replace(/\\x5b/g, '[')
          .replace(/\\x5d/g, ']')
          .replace(/\\x7b/g, '{')
          .replace(/\\x7d/g, '}')
          .replace(/\\x2f/g, '/')
          .replace(/\\\\r\\\\n/g, '\n')
          .replace(/\\r\\n/g, '\n')
          .replace(/\\\\r/g, '')
          .replace(/\\r/g, '')
          .replace(/\\\\n/g, '\n')
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, '/')
          .replace(/\\\//g, '/');
        return unescaped.trim();
      }
    }
  }
  return htmlContent;
}

async function resolvePannellumUrl(targetUrl) {
  try {
    let parsedUrl = new URL(targetUrl);
    let configParam = parsedUrl.searchParams.get("config");

    if (!configParam) {
      const configMatch = targetUrl.match(/[?&]config=([^&]+)/i);
      if (configMatch) configParam = configMatch[1];
    }

    if (!configParam) return { finalUrl: null, contentId: null };

    let cleanedCfg = decodeURIComponent(configParam).replace(/\\\//g, "/").replace(/\\/g, "").trim();
    if (!cleanedCfg.startsWith("http")) {
      cleanedCfg = "https://" + cleanedCfg.replace(/^\/+/, "");
    }

    let contentId = parsedUrl.searchParams.get("id");
    let slug = "";
    if (cleanedCfg.includes("?")) {
      slug = cleanedCfg.split("?").pop();
    } else {
      let filename = cleanedCfg.split("/").pop();
      slug = filename.replace(/\.json$/i, "");
    }

    if (!contentId) {
      contentId = slug;
    }

    const res = await fetch(cleanedCfg);
    if (!res.ok) return { finalUrl: null, contentId };

    const confText = await res.text();

    // Pattern 1: fetch('url' + slug + '.html')
    const fetchSlugMatch = confText.match(/fetch\s*\(\s*['"](https?:\/\/[^'"]+)['"]\s*\+\s*slug\s*\+\s*['"](\.[a-zA-Z0-9]+)?['"]/i);
    if (fetchSlugMatch) {
      const basePath = fetchSlugMatch[1];
      const ext = fetchSlugMatch[2] || "";
      return { finalUrl: `${basePath}${slug}${ext}`, contentId };
    }

    // Pattern 2: fetch('url' + window.location.hostname + '...')
    const fetchHostMatch = confText.match(/fetch\s*\(\s*['"](https?:\/\/[^'"]+)['"]\s*\+\s*window\.location\.hostname\s*\+\s*['"]([^'"]*)['"]/i);
    if (fetchHostMatch) {
      const part1 = fetchHostMatch[1];
      const part2 = fetchHostMatch[2];
      const hostname = parsedUrl.hostname;
      return { finalUrl: `${part1}${hostname}${part2}`, contentId };
    }

    // Pattern 3: direct fetch('https://...')
    const directFetch = confText.match(/fetch\s*\(\s*['"](https?:\/\/[^'"]+)['"]/i);
    if (directFetch) {
      return { finalUrl: directFetch[1], contentId };
    }

    // Pattern 4: generic URL in JSON
    const genericUrl = confText.match(/['"](https?:\/\/[^'"]+\.(?:html|php)[^'"]*)['"]/i);
    if (genericUrl) {
      return { finalUrl: genericUrl[1], contentId };
    }

    return { finalUrl: null, contentId };
  } catch (e) {
    return { finalUrl: null, contentId: null };
  }
}

async function processAndDownload(rawUrl) {
  try {
    let targetUrl = await resolveGoogleGotoUrl(rawUrl);

    let decodedUrl = targetUrl;
    try {
      decodedUrl = decodeURIComponent(targetUrl);
    } catch (e) {}

    const xmlMatch = decodedUrl.match(/[?&]xml=([^&]+)/i);
    const idMatch = decodedUrl.match(/[?&]id=([^&]+)/i);
    const configMatch = decodedUrl.match(/[?&]config=([^&]+)/i);

    const xmlParam = xmlMatch ? xmlMatch[1] : null;
    const contentId = idMatch ? idMatch[1] : ("page_" + Date.now());

    // Pannellum কনফিগ চেক
    if (configMatch || targetUrl.toLowerCase().includes("pannellum")) {
      notify("Krpano Downloader", "⏳ Pannellum কনফিগ পার্স করা হচ্ছে...");
      const pRes = await resolvePannellumUrl(targetUrl);
      if (pRes.finalUrl) {
        const pContentId = pRes.contentId || contentId;
        try {
          const checkRes = await fetch(pRes.finalUrl, { method: "GET" });
          if (checkRes.ok && checkRes.status === 200) {
            const rawText = await checkRes.text();
            const cleanHtml = extractGasPayload(rawText);
            const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(cleanHtml);
            chrome.downloads.download({
              url: dataUrl,
              filename: pContentId + ".html"
            }, (downloadId) => {
              if (downloadId !== undefined) {
                notify("Krpano Downloader", `✅ ডাউনলোড শুরু হয়েছে: ${pContentId}.html`);
              } else {
                notify("Krpano Downloader", "❌ ডাউনলোড শুরু করতে ব্যর্থ হয়েছে।");
              }
            });
            return;
          }
        } catch (err) {}
      }
    }

    // ১. যদি xml প্যারামিটার না থাকে কিন্তু ডাইরেক্ট HTML বা Google Apps Script লিংক হয়
    if (!xmlParam) {
      if (targetUrl.includes("script.google.com") || targetUrl.includes("id=") || targetUrl.includes(".html")) {
        notify("Krpano Downloader", "⏳ গুগল অ্যাপস স্ক্রিপ্ট / ডাইরেক্ট HTML ডাউনলোড করা হচ্ছে...");
        try {
          const checkRes = await fetch(targetUrl, { method: "GET" });
          if (checkRes.ok && checkRes.status === 200) {
            const rawText = await checkRes.text();
            const cleanHtml = extractGasPayload(rawText);
            const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(cleanHtml);
            chrome.downloads.download({
              url: dataUrl,
              filename: contentId + ".html"
            }, (downloadId) => {
              if (downloadId !== undefined) {
                notify("Krpano Downloader", `✅ ডাউনলোড শুরু হয়েছে: ${contentId}.html`);
              } else {
                notify("Krpano Downloader", "❌ ডাউনলোড শুরু করতে ব্যর্থ হয়েছে।");
              }
            });
            return;
          }
        } catch (err) {}
      }
      notify("Krpano Downloader", "❌ এই লিংকে xml/config প্যারামিটার বা কোনো ফাইল পাওয়া যায়নি!");
      return;
    }

    // ২. xml প্যারামিটার থাকলে নিয়মিত krpano প্রসেস করা
    const decodedXml = decodeXmlParam(xmlParam);

    if (!decodedXml) {
      notify("Krpano Downloader", "❌ XML পার্স করতে ব্যর্থ হয়েছে!");
      return;
    }

    notify("Krpano Downloader", "⏳ লিংক প্রসেস করা হচ্ছে...");

    const finalUrl = await resolveFinalUrlFromXml(decodedXml, contentId);

    if (finalUrl) {
      notify("Krpano Downloader", "⏳ ফাইল টেস্ট করা হচ্ছে...");
      try {
        const checkRes = await fetch(finalUrl, { method: "GET" });
        if (checkRes.ok && checkRes.status === 200) {
          const rawText = await checkRes.text();
          const cleanHtml = extractGasPayload(rawText);
          const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(cleanHtml);
          chrome.downloads.download({
            url: dataUrl,
            filename: contentId + ".html"
          }, (downloadId) => {
            if (downloadId !== undefined) {
              notify("Krpano Downloader", `✅ ডাউনলোড শুরু হয়েছে: ${contentId}.html`);
            } else {
              notify("Krpano Downloader", "❌ ডাউনলোড শুরু করতে ব্যর্থ হয়েছে।");
            }
          });
        } else {
          notify("Krpano Downloader", `❌ ফাইলটি সার্ভারে নেই (HTTP ${checkRes.status})!`);
        }
      } catch (err) {
        notify("Krpano Downloader", "❌ টার্গেট ওয়েবসাইটটি বন্ধ/ডাউন (Connection Error)!");
      }
    } else {
      notify("Krpano Downloader", "❌ XML থেকে কোনো টার্গেট URL পাওয়া যায়নি।");
    }
  } catch (e) {
    notify("Krpano Downloader", `❌ সমস্যা: ${e.message}`);
  }
}
