/**
 * Runs after `expo export -p web`. Turns the single-page export into an
 * installable iOS / Android web app:
 *   - iOS "Add to Home Screen" tags (standalone, status bar, touch icon),
 *   - viewport-fit=cover so safe-area insets work on notched iPhones,
 *   - web manifest link and service worker registration,
 *   - a unique cache id so each deploy refreshes the offline cache.
 */
const fs = require('fs');
const path = require('path');

const dist = path.resolve(process.argv[2] || 'dist');
const indexPath = path.join(dist, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const head = [
  '<meta name="apple-mobile-web-app-capable" content="yes" />',
  '<meta name="mobile-web-app-capable" content="yes" />',
  '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '<meta name="apple-mobile-web-app-title" content="Daily Sync" />',
  '<meta name="theme-color" content="#0C0D0F" />',
  '<meta name="format-detection" content="telephone=no" />',
  '<link rel="apple-touch-icon" href="/apple-touch-icon.png" />',
  '<link rel="manifest" href="/manifest.json" />',
  '<style>html,body{background:#0C0D0F;overscroll-behavior:none;}</style>',
].join('\n    ');

html = html.replace(/<meta name="viewport"[^>]*>/i, '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />');
if (!/viewport-fit=cover/.test(html)) {
  html = html.replace('</head>', '  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />\n  </head>');
}
html = html.replace(/<title>[^<]*<\/title>/i, '<title>Daily Sync</title>');
html = html.replace('</head>', `    ${head}\n  </head>`);
html = html.replace(
  '</body>',
  `  <script>if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){});});}</script>\n  </body>`,
);
fs.writeFileSync(indexPath, html);

const swPath = path.join(dist, 'sw.js');
const buildId = Date.now().toString(36);
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('__BUILD_ID__', buildId));
console.log(`PWA post-build done (cache ${buildId})`);
