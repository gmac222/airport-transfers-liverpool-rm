const fs = require('fs');
const files = ['index.html', 'portal.html', 'admin.html', 'operator.html', 'driver-action.html', 'stats.html', 'thank-you/index.html'];

const metaTags = `
    <!-- PWA Meta Tags -->
    <link rel="manifest" href="/manifest.json" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="RM Transfers" />
    <link rel="apple-touch-icon" href="/assets/logo.png" />
`;

const swScript = `
    <!-- Service Worker Registration -->
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js').catch(err => {
            console.log('Service Worker registration failed:', err);
          });
        });
      }
    </script>
`;

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  
  if (!content.includes('<link rel="manifest"')) {
    content = content.replace('</head>', metaTags + '\n</head>');
  }
  
  if (!content.includes('serviceWorker.register')) {
    content = content.replace('</body>', swScript + '\n</body>');
  }
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
