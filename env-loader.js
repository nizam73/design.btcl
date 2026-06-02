// env-loader.js
// Fetches the .env file at runtime and populates window.ENV
// so firebase-init.js and app.js can read the keys.
// This file must be loaded BEFORE firebase-init.js in index.html
// using a plain <script> tag (not type="module").

(async function () {
  try {
    const res = await fetch(".env");
    if (!res.ok) {
      console.warn("[env-loader] Could not load .env file. Make sure it exists in the root folder.");
      window.ENV = {};
      return;
    }
    const text = await res.text();
    const env = {};
    text.split("\n").forEach((line) => {
      line = line.trim();
      if (!line || line.startsWith("#")) return;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) return;
      const key = line.slice(0, eqIdx).trim();
      const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, ""); // strip quotes
      env[key] = val;
    });
    window.ENV = env;
  } catch (e) {
    console.warn("[env-loader] Error loading .env:", e);
    window.ENV = {};
  }
})();
