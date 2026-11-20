import { WorkspaceTenantRecord } from '@/types/tadka';
import { GOOGLE_APPS_SCRIPT_TEMPLATE } from '@/lib/googleSheetsShared';

/**
 * Standard IEEE 802.3 CRC-32 implementation for valid ZIP archives
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Zero-dependency browser ZIP file generator (Store / method 0).
 * Compatible with Windows Explorer, macOS Archive Utility, 7-Zip, WinRAR, and cPanel.
 */
export function createZipBlob(
  files: { path: string; content: string }[]
): Blob {
  const encoder = new TextEncoder();
  const encodedFiles = files.map((f) => {
    const nameBytes = encoder.encode(f.path.replace(/^\/+/, ''));
    const dataBytes = encoder.encode(f.content);
    const checksum = crc32(dataBytes);
    return { nameBytes, dataBytes, checksum };
  });

  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of encodedFiles) {
    const nameLen = file.nameBytes.length;
    const dataLen = file.dataBytes.length;

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameLen);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract (2.0)
    lv.setUint16(6, 0x0800, true); // General purpose bit flag (UTF-8)
    lv.setUint16(8, 0, true); // Compression method (0 = Store)
    lv.setUint16(10, 0, true); // Last mod file time
    lv.setUint16(12, 0x5421, true); // Last mod file date
    lv.setUint32(14, file.checksum, true); // CRC-32
    lv.setUint32(18, dataLen, true); // Compressed size
    lv.setUint32(22, dataLen, true); // Uncompressed size
    lv.setUint16(26, nameLen, true); // File name length
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(file.nameBytes, 30);

    localParts.push(localHeader, file.dataBytes);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameLen);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory file header signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed to extract
    cv.setUint16(8, 0x0800, true); // General purpose bit flag (UTF-8)
    cv.setUint16(10, 0, true); // Compression method (0 = Store)
    cv.setUint16(12, 0, true); // Last mod file time
    cv.setUint16(14, 0x5421, true); // Last mod file date
    cv.setUint32(16, file.checksum, true); // CRC-32
    cv.setUint32(20, dataLen, true); // Compressed size
    cv.setUint32(24, dataLen, true); // Uncompressed size
    cv.setUint16(28, nameLen, true); // File name length
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, offset, true); // Relative offset of local header
    centralHeader.set(file.nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + dataLen;
  }

  const centralDirSize = centralParts.reduce((acc, p) => acc + p.length, 0);

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // EOCD signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, encodedFiles.length, true); // Number of central dir records on this disk
  ev.setUint16(10, encodedFiles.length, true); // Total number of central dir records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, offset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  return new Blob(
    [...localParts, ...centralParts, eocd] as unknown as BlobPart[],
    {
      type: 'application/zip',
    }
  );
}

/**
 * Generates the complete, zero-dependency standalone HTML single-file launcher.
 * Can be opened directly on a local machine (double-clicked) or deployed to free static hosting
 * (GitHub Pages, Netlify Drop, Cloudflare Pages, Vercel, or shared cPanel).
 */
export function generateStandaloneHtml(
  client: WorkspaceTenantRecord,
  appBaseUrl: string
): string {
  const cleanSlug =
    (client.slug || 'my-restaurant')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-') || 'my-restaurant';
  const restaurantName = client.restaurantName || 'My Restaurant';

  const standaloneTargetUrl = `${appBaseUrl}/?standalone=1&w=${encodeURIComponent(
    cleanSlug
  )}${
    client.spreadsheetId ? `&s=${encodeURIComponent(client.spreadsheetId)}` : ''
  }`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <meta name="theme-color" content="#0f172a" />
  <meta name="description" content="Digital QR Ordering, Chef Kitchen Queue, Waiter Portal & Rewards for ${restaurantName}" />
  <title>${restaurantName} — Digital QR Ordering & Rewards</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #0f172a;
      color: #f8fafc;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #loading-overlay {
      position: fixed;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #0f172a;
      z-index: 9999;
      transition: opacity 0.4s ease;
      text-align: center;
      padding: 20px;
    }
    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(255, 255, 255, 0.12);
      border-top-color: #5cf2c0;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      display: block;
    }
    .fallback-msg {
      display: none;
      margin-top: 16px;
      font-size: 13px;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div id="loading-overlay">
    <div class="spinner"></div>
    <h2 style="margin: 16px 0 6px; font-size: 20px; color: #5cf2c0;">${restaurantName}</h2>
    <p style="margin: 0; font-size: 13px; color: #94a3b8;">Connecting to live menu & orders...</p>
    <div id="fallback-msg" class="fallback-msg">
      Taking longer than usual? Click <a href="${standaloneTargetUrl}" style="color: #38bdf8;" target="_blank">here to open directly</a>.
    </div>
  </div>

  <!-- Standalone Single-Restaurant Web App for ${restaurantName} (Super Admin disabled) -->
  <iframe
    id="restaurant-app"
    src="${standaloneTargetUrl}"
    allow="clipboard-read; clipboard-write; geolocation; camera; microphone"
    title="${restaurantName}"
    onload="var o=document.getElementById('loading-overlay'); if(o){o.style.opacity='0'; setTimeout(function(){o.style.display='none';}, 400);}"
  ></iframe>

  <script>
    // Show fallback link if network is slow after 5 seconds
    setTimeout(function() {
      var fb = document.getElementById('fallback-msg');
      if (fb) fb.style.display = 'block';
    }, 5000);

    // Forward QR table parameters (?t=...&table=...&label=...) from custom domain to standalone app
    (function() {
      try {
        var sp = new URLSearchParams(window.location.search);
        var frame = document.getElementById('restaurant-app');
        if (frame && sp.toString()) {
          var base = new URL(frame.src);
          sp.forEach(function(val, key) {
            if (key !== 'w' && key !== 's' && key !== 'standalone') {
              base.searchParams.set(key, val);
            }
          });
          frame.src = base.toString();
        }
      } catch (e) {
        console.error('Param forward error:', e);
      }
    })();
  </script>
</body>
</html>
`;
}

/**
 * Downloads a standalone single-file HTML launcher (.html) directly to the user's Downloads folder.
 * Owner can double-click it on local machine or deploy it to free static hosting (Netlify, Cloudflare, GitHub Pages).
 */
export function downloadStandaloneHtmlFile(
  client: WorkspaceTenantRecord,
  appBaseUrl: string
) {
  const cleanSlug =
    (client.slug || 'my-restaurant')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-') || 'my-restaurant';
  const htmlContent = generateStandaloneHtml(client, appBaseUrl);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanSlug}-standalone.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Generates and downloads a complete Standalone Single-Restaurant App ZIP package
 * directly to the browser's Downloads folder.
 */
export function downloadStandaloneRestaurantZip(
  client: WorkspaceTenantRecord,
  appBaseUrl: string
) {
  const cleanSlug =
    (client.slug || 'my-restaurant')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-') || 'my-restaurant';
  const restaurantName = client.restaurantName || 'My Restaurant';

  const standaloneRestaurantsJson = JSON.stringify(
    {
      standaloneMode: true,
      defaultRestaurant: cleanSlug,
      restaurants: {
        [cleanSlug]: {
          name: restaurantName,
          slug: cleanSlug,
          appStyle: client.appStyle || 'style2',
          ownerName: client.ownerName || 'Owner',
          ownerMobile: client.ownerMobile || '',
          appsScriptWebAppUrl: client.appsScriptWebAppUrl || '',
          spreadsheetId: client.spreadsheetId || '',
          driveFolderId: client.driveFolderId || '',
          updatedAt: new Date().toISOString(),
        },
      },
    },
    null,
    2
  );

  const standaloneIndexHtml = generateStandaloneHtml(client, appBaseUrl);

  const envLocalContent = `# Standalone Single-Restaurant Build Configuration for ${restaurantName}
NEXT_PUBLIC_STANDALONE_MODE=true
NEXT_PUBLIC_DEFAULT_RESTAURANT_SLUG=${cleanSlug}
`;

  const readmeContent = `===============================================================================
🏪 ${restaurantName.toUpperCase()} — STANDALONE RESTAURANT APP PACKAGE
===============================================================================

Owner Name:       ${client.ownerName || 'Owner'}
Owner Login:      ${client.ownerMobile || 'Registered Mobile'} (Demo OTP: 1234)
Default Theme:    ${client.appStyle || 'style2'}
Google Sheet ID:  ${client.spreadsheetId || 'Not set'}
Google Drive ID:  ${client.driveFolderId || 'Not set'}

What is included in this Standalone ZIP Pack:
-------------------------------------------------------------------------------
1. index.html
   - Instant, zero-build standalone web launcher pre-configured for ${restaurantName}
     with Super Admin / multi-restaurant creation completely disabled.
   - Upload this single file to ANY free domain or hosting (Netlify Drop,
     Cloudflare Pages, GitHub Pages, Vercel, Hostinger, GoDaddy, or cPanel)
     and your restaurant app works immediately on the owner's custom domain at ₹0/month!
   - Can also be double-clicked on a local machine (PC, laptop, iPad, or Android tablet)
     to run directly without needing any server running!

2. public/config/restaurants.json  &  .env.production
   - If you are building the full Next.js project exclusively for ${restaurantName}:
     a) Copy "public/config/restaurants.json" into your project's "public/config/restaurants.json"
     b) Copy ".env.production" into your project root
     c) Run "npm run build"
     - Because "standaloneMode": true is set, the built app runs exclusively
       for ${restaurantName} with NO Super Admin tab and NO multi-restaurant
       creation options, while keeping "Google Sheet & Drive Storage Setup"
       available inside the Owner's Admin tab.

3. google-apps-script/Code.gs
   - Complete Google Apps Script backend code.
   - If the owner wants their own independent Apps Script inside their Google
     Sheet (${client.spreadsheetId || 'their Google Sheet'}), open the Sheet ->
     Extensions -> Apps Script -> paste Code.gs -> Deploy -> New deployment ->
     Web app (Execute as: Me, Who has access: Anyone).
===============================================================================
`;

  const zipBlob = createZipBlob([
    { path: 'index.html', content: standaloneIndexHtml },
    { path: 'public/config/restaurants.json', content: standaloneRestaurantsJson },
    { path: '.env.production', content: envLocalContent },
    { path: 'google-apps-script/Code.gs', content: GOOGLE_APPS_SCRIPT_TEMPLATE },
    { path: 'DEPLOY_README.txt', content: readmeContent },
  ]);

  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanSlug}-standalone-app-pack.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
