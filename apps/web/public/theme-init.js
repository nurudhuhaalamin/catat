// Set tema sebelum paint untuk mencegah flash. Skrip eksternal agar lolos CSP (script-src 'self').
(function () {
  try {
    var saved = localStorage.getItem("catat:theme"); // "light" | "dark" | "system" | null
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    var dark = saved === "dark" || ((saved === "system" || !saved) && prefersDark);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {
    /* ignore */
  }
})();
