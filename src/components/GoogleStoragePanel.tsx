'use client';

import React, { useState, useEffect } from 'react';
import { useTadka } from '@/context/TadkaContext';
import {
  buildSheetRowsForState,
  extractDriveFolderIdFromUrl,
  extractSpreadsheetIdFromUrl,
  GOOGLE_APPS_SCRIPT_TEMPLATE,
  SheetTabName,
} from '@/lib/googleSheetsShared';

const SHEET_TABS: SheetTabName[] = [
  'Menu_Items',
  'Staff_Access',
  'Sessions',
  'Orders',
  'Bills_Payments',
  'Loyalty_Ledger',
  'Social_Reels_Reviews',
  'Audit_Log',
  'Drive_Assets',
];

export function GoogleStorageAdminCard() {
  const {
    S,
    syncToGoogleSheets,
    pullFromGoogleSheets,
    uploadMediaToDrive,
    say,
  } = useTadka();

  const [expanded, setExpanded] = useState(true);
  const [selectedTab, setSelectedTab] = useState<SheetTabName>('Menu_Items');
  const [showScriptModal, setShowScriptModal] = useState(false);

  const [webAppUrl, setWebAppUrl] = useState(
    S.googleConfig?.appsScriptWebAppUrl || ''
  );
  const [sheetId, setSheetId] = useState(
    S.googleConfig?.spreadsheetId || ''
  );
  const [folderId, setFolderId] = useState(
    S.googleConfig?.driveFolderId || ''
  );

  useEffect(() => {
    if (S.googleConfig?.appsScriptWebAppUrl && !webAppUrl) {
      setWebAppUrl(S.googleConfig.appsScriptWebAppUrl);
    }
    if (S.googleConfig?.spreadsheetId && !sheetId) {
      setSheetId(S.googleConfig.spreadsheetId);
    }
    if (S.googleConfig?.driveFolderId && !folderId) {
      setFolderId(S.googleConfig.driveFolderId);
    }
  }, [S.googleConfig, webAppUrl, sheetId, folderId]);

  const allSheets = buildSheetRowsForState(S);
  const activeRows = allSheets[selectedTab] || [];

  const downloadCsvClientSide = (tabName: SheetTabName) => {
    const rows = allSheets[tabName] || [];
    const csv = rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? '');
            return s.includes(',') || s.includes('"') || s.includes('\n')
              ? `"${s.replace(/"/g, '""')}"`
              : s;
          })
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Tadka_${tabName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSyncNow = async () => {
    const cleanedSheetId = extractSpreadsheetIdFromUrl(sheetId);
    const cleanedFolderId = extractDriveFolderIdFromUrl(folderId);
    setSheetId(cleanedSheetId);
    setFolderId(cleanedFolderId);

    const cfg = {
      appsScriptWebAppUrl: webAppUrl.trim(),
      spreadsheetId: cleanedSheetId,
      driveFolderId: cleanedFolderId,
      enabled: true,
    };

    // 1. Try direct browser-to-Google Apps Script POST (text/plain avoids CORS preflight & passes browser cookies if needed)
    if (cfg.appsScriptWebAppUrl.startsWith('https://script.google.com/')) {
      try {
        await fetch(cfg.appsScriptWebAppUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'SYNC_ALL_SHEETS',
            spreadsheetId: cfg.spreadsheetId,
            driveFolderId: cfg.driveFolderId,
            sheets: allSheets,
            timestamp: new Date().toISOString(),
          }),
        });
      } catch {
        // Ignore browser no-cors error; server sync below will report status
      }
    }

    // 2. Also run server-side sync & local CSV mirror
    await syncToGoogleSheets(cfg);
  };

  const handleDriveFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = typeof reader.result === 'string' ? reader.result : '';
      uploadMediaToDrive({
        fileName: file.name,
        kind: file.type.startsWith('video/') ? 'reel' : 'dish_photo',
        mimeType: file.type || 'application/octet-stream',
        base64Data,
        caption: `Uploaded from Admin Panel (${file.name})`,
      });
    };
    reader.readAsDataURL(file);
  };

  const isCloudConnected = Boolean(
    (webAppUrl || S.googleConfig?.appsScriptWebAppUrl || '').startsWith(
      'https://script.google.com/'
    )
  );

  return (
    <div className="card">
      <div className="row sp">
        <h3>☁️ Google Sheets & Drive Storage</h3>
        <button
          className="chip on"
          onClick={() => setExpanded((prev) => !prev)}
        >
          {expanded ? 'Hide' : 'Open'}
        </button>
      </div>

      <p className="mu" style={{ marginTop: '6px' }}>
        All database tables sync to a 9-tab Google Sheet workbook, and customer
        reels/snaps/dish photos are stored in Google Drive.
      </p>

      <div className="row sp" style={{ marginTop: '8px', flexWrap: 'wrap' }}>
        <span className={`tag ${isCloudConnected ? 'ok' : 'vip'}`}>
          {S.googleConfig?.lastSyncStatus === 'syncing'
            ? '⏳ Syncing…'
            : isCloudConnected
              ? '☁️ Live Google Cloud Connected'
              : '⚠️ Step Required: Paste Apps Script URL Below'}
        </span>
        <span className="mu">
          {S.driveAssets?.length || 0} Drive file(s) · 9 Sheet tabs
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '12px' }}>
          {/* STEP 1: Cloud Credentials & Apps Script Bridge Config AT THE TOP */}
          <div
            style={{
              marginBottom: '14px',
              background: '#1f1338',
              padding: '12px',
              borderRadius: '16px',
              border: isCloudConnected
                ? '1px solid var(--mn)'
                : '2px dashed var(--mg)',
            }}
          >
            <div className="row sp">
              <b>🔗 1. Connect Your Google Sheet & Drive</b>
              <button
                className="chip on"
                style={{ fontSize: '12px' }}
                onClick={() => setShowScriptModal((prev) => !prev)}
              >
                {showScriptModal ? 'Hide Script' : '📜 Get Apps Script Code'}
              </button>
            </div>
            <p className="mu" style={{ marginTop: '4px' }}>
              In your Google Sheet (<b>Tadka Truck Database</b>), click{' '}
              <b>Extensions → Apps Script</b>, paste the script, click{' '}
              <b>Deploy → New deployment → Web app</b> (Anyone), and paste the
              Web App URL here:
            </p>

            {showScriptModal && (
              <div
                style={{
                  marginTop: '10px',
                  marginBottom: '10px',
                  background: 'var(--bg)',
                  padding: '10px',
                  borderRadius: '12px',
                  border: '1px solid #5a4690',
                }}
              >
                <div className="row sp" style={{ marginBottom: '6px' }}>
                  <b style={{ fontSize: '13px' }}>
                    Google Apps Script (Code.gs)
                  </b>
                  <button
                    className="chip on"
                    style={{ fontSize: '12px' }}
                    onClick={() => {
                      navigator.clipboard?.writeText(
                        GOOGLE_APPS_SCRIPT_TEMPLATE
                      );
                      say('Copied Apps Script to clipboard ✅');
                    }}
                  >
                    Copy Code
                  </button>
                </div>
                <pre
                  style={{
                    fontSize: '11px',
                    overflowX: 'auto',
                    maxHeight: '180px',
                    color: 'var(--mn)',
                  }}
                >
                  {GOOGLE_APPS_SCRIPT_TEMPLATE}
                </pre>
              </div>
            )}

            <div className="row" style={{ marginTop: '8px' }}>
              <input
                value={webAppUrl}
                onChange={(e) => setWebAppUrl(e.target.value)}
                placeholder="Paste https://script.google.com/macros/s/.../exec here"
                className="inp"
              />
            </div>
            <div className="row" style={{ marginTop: '6px' }}>
              <input
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="Spreadsheet ID from URL (optional)"
                className="inp"
              />
              <input
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                placeholder="Drive Folder ID (optional)"
                className="inp"
              />
            </div>
            {S.googleConfig?.lastSyncError && (
              <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>
                ⚠️ Last error: {S.googleConfig.lastSyncError}
              </p>
            )}
            <div className="row" style={{ marginTop: '8px', gap: '8px' }}>
              <button
                className="btn alt"
                style={{ marginTop: 0, flex: 1 }}
                onClick={handleSyncNow}
              >
                ⚡ Save & Sync All 9 Tabs to Google Sheet
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="row" style={{ flexWrap: 'wrap', gap: '8px' }}>
            <button
              className="btn"
              style={{ marginTop: 0, flex: 1 }}
              onClick={handleSyncNow}
            >
              ⬆️ Push App ➔ Sheet
            </button>
            <button
              className="btn alt"
              style={{ marginTop: 0, flex: 1 }}
              onClick={() =>
                pullFromGoogleSheets({
                  appsScriptWebAppUrl: webAppUrl.trim(),
                  spreadsheetId: extractSpreadsheetIdFromUrl(sheetId),
                  driveFolderId: extractDriveFolderIdFromUrl(folderId),
                })
              }
            >
              ⬇️ Pull Sheet ➔ App
            </button>
            <button
              className="btn ghost"
              style={{ marginTop: 0, flex: 1 }}
              onClick={() => downloadCsvClientSide(selectedTab)}
            >
              ⬇️ {selectedTab}.csv
            </button>
          </div>

          {/* Live Google Sheet Tabs Explorer */}
          <div
            style={{
              marginTop: '14px',
              borderTop: '1px dashed #5a4690',
              paddingTop: '10px',
            }}
          >
            <b>📊 Google Sheets Live Workbook Preview</b>
            <div
              className="row"
              style={{
                flexWrap: 'wrap',
                marginTop: '8px',
                gap: '6px',
              }}
            >
              {SHEET_TABS.map((t) => (
                <button
                  key={t}
                  className={`chip ${selectedTab === t ? 'on' : ''}`}
                  style={{ fontSize: '12px', padding: '4px 10px' }}
                  onClick={() => setSelectedTab(t)}
                >
                  {t} ({Math.max(0, (allSheets[t]?.length || 1) - 1)})
                </button>
              ))}
            </div>

            <div
              style={{
                marginTop: '10px',
                overflowX: 'auto',
                background: 'var(--bg)',
                borderRadius: '12px',
                padding: '8px',
                border: '1px solid #5a4690',
              }}
            >
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  textAlign: 'left',
                }}
              >
                <thead>
                  <tr>
                    {(activeRows[0] || []).map((col, idx) => (
                      <th
                        key={idx}
                        style={{
                          padding: '6px 8px',
                          borderBottom: '1px solid #5a4690',
                          color: 'var(--mg)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {String(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeRows.length <= 1 ? (
                    <tr>
                      <td
                        colSpan={(activeRows[0] || []).length || 1}
                        className="mu"
                        style={{ padding: '10px 8px' }}
                      >
                        No rows in {selectedTab} yet.
                      </td>
                    </tr>
                  ) : (
                    activeRows.slice(1, 8).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {row.map((cell, cIdx) => (
                          <td
                            key={cIdx}
                            style={{
                              padding: '6px 8px',
                              borderBottom: '1px solid #2a1b4a',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Google Drive Stored Files */}
          <div
            style={{
              marginTop: '14px',
              borderTop: '1px dashed #5a4690',
              paddingTop: '10px',
            }}
          >
            <div className="row sp">
              <b>📁 Google Drive Media Vault ({S.driveAssets?.length || 0})</b>
              <label
                className="chip on"
                style={{ cursor: 'pointer', fontSize: '12px' }}
              >
                + Upload File to Drive
                <input
                  type="file"
                  onChange={handleDriveFileUpload}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
            <p className="mu" style={{ marginTop: '4px' }}>
              Stores customer reels, dish photos, and snap moments.
            </p>
            {(S.driveAssets || []).slice(0, 5).map((asset) => (
              <div
                key={asset.id}
                className="line"
                style={{ alignItems: 'center', marginTop: '6px' }}
              >
                <span style={{ minWidth: 0, flex: 1 }}>
                  <b>
                    {asset.kind === 'reel' ? '🎬' : '🖼️'} {asset.name}
                  </b>
                  <br />
                  <span className="mu">
                    {asset.counterNo || 'C27'} ·{' '}
                    {Math.round((asset.sizeBytes || 1024) / 1024)} KB ·{' '}
                    {asset.driveFileId}
                  </span>
                </span>
                {asset.driveViewUrl && (
                  <a
                    href={asset.driveViewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="chip"
                    style={{ textDecoration: 'none', fontSize: '12px' }}
                  >
                    Drive ↗
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
