import { NextRequest, NextResponse } from 'next/server';
import { getStore, logAudit } from '@/lib/serverStore';
import {
  uploadFileToGoogleDriveAndMirror,
  syncStateToGoogleSheetsAndLocalMirror,
} from '@/lib/googleStorage';

export async function GET() {
  const store = getStore();
  return NextResponse.json({
    ok: true,
    driveFolderId: store.googleConfig.driveFolderId,
    driveAssets: store.driveAssets,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { fileName, kind, mimeType, base64Data, caption, counterNo, uploadedBy } = body;
    const store = getStore();

    const res = await uploadFileToGoogleDriveAndMirror(store, {
      fileName: fileName || `tadka_${kind || 'reel'}_${Date.now()}.mp4`,
      kind: kind || 'reel',
      mimeType: mimeType || 'video/mp4',
      base64Data,
      caption,
      counterNo,
      uploadedBy,
    });

    store.driveAssets.unshift(res.asset);
    logAudit(
      uploadedBy || store.me.mob || 'Customer',
      'storage.drive_upload',
      res.asset.name,
      `Uploaded ${res.asset.kind} to Google Drive (${res.asset.driveFileId})`
    );

    // Also update the Drive_Assets sheet tab
    await syncStateToGoogleSheetsAndLocalMirror(store);

    return NextResponse.json({
      ok: true,
      asset: res.asset,
      driveAssets: store.driveAssets,
      state: store,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
