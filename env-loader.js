window.__envReady = (async function () {
  try {
    const res = await fetch("conf73.env");
    if (!res.ok) {
      console.warn("[env-loader] Could not load config.env");
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
      const val = line.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      env[key] = val;
    });
    window.ENV = env;
  } catch (e) {
    console.warn("[env-loader] Error:", e);
    window.ENV = {};
  }
})();
