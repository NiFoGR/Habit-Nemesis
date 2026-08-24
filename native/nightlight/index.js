// Nothing imports this file.
//
// NiFo ships raw ES modules with no bundler, so a bare specifier like
// `nifo-nightlight` would not resolve in the browser. The app reaches the
// plugin through `window.Capacitor.Plugins.NightLight` instead, which is the
// same way www/js/native.js reaches LocalNotifications. This exists so the
// package is a valid npm package and `capacitor` can find `android/`.
module.exports = {};
