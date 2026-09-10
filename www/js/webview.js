// The WebView floor. Not a module and ES5 only: it has to parse on the engines
// it is here to turn away.
//
// Android updates the WebView separately from the OS, so minSdk says nothing
// about what a device can render. color-mix and dvh are the highest bars the
// stylesheet sets and both land in WebView 111. Under that the app draws holes
// where screens should be, so it says why instead.
//
// Styles inline: a stylesheet the engine cannot parse must not take the message
// down with it.
(function () {
  var ok = !!(window.CSS && window.CSS.supports)
    && CSS.supports('color', 'color-mix(in srgb, red 50%, blue)')
    && CSS.supports('height', '100dvh');
  if (ok) return;

  // Read by js/app.js, which stops rather than drawing over this.
  window.__hnUnsupported = true;

  var app = document.getElementById('app');
  if (!app) return;
  app.setAttribute('style', 'max-width:32em;margin:0 auto;padding:15vh 24px;'
    + 'font:16px/1.5 system-ui,sans-serif;color:#e6eaf0;background:#0a0c10');
  app.innerHTML =
    '<h1 style="font-size:22px;margin:0 0 12px;color:#ff5257">Update Android System WebView</h1>'
    + '<p style="margin:0;color:#97a1b0">Habit Nemesis draws through Android\'s '
    + 'browser engine, and this device\'s copy is too old to run it. Update '
    + '<b>Android System WebView</b> and <b>Chrome</b> in the Play Store, then '
    + 'open the app again.</p>';
})();
