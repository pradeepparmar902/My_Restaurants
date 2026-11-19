'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import { COUNTRY_CODES, SOCIAL_PLATFORMS } from '@/lib/constants';
import {
  isSessionGated,
  switchUserSessionInState,
} from '@/lib/helpers';

export function CountryCodeMobileInput({
  id,
  value,
  onChange,
  placeholder = 'Mobile number',
}: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const { S, setCountryCode } = useTadka();
  return (
    <div className="row">
      <select
        aria-label="Country code"
        value={S.cc}
        onChange={(e) => setCountryCode(e.target.value)}
        className="sel-cc"
      >
        {COUNTRY_CODES.map(([c, n]) => (
          <option key={c} value={c}>
            {c} {n}
          </option>
        ))}
      </select>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        className="inp"
      />
    </div>
  );
}

export function LoginBar() {
  const {
    S,
    staffOf,
    logoutOrOpenLogin,
    updateState,
    activeWorkspaceSlug,
    isStandaloneMode,
  } = useTadka();
  const st = staffOf();
  const roleDisplay =
    S.role === 'sa'
      ? 'Super Admin'
      : st
      ? st.r
      : S.role === 'o'
      ? 'Owner'
      : S.role === 'a'
      ? 'Admin'
      : 'User';
  return (
    <div className="row sp" style={{ marginBottom: '10px' }}>
      <span className="mu">
        {S.me.mob
          ? `📱 ${S.me.mob} · ${roleDisplay}`
          : 'Guest · login to find your orders'}
      </span>
      <div className="row">
        {!S.me.mob && (
          <>
            {!isStandaloneMode && activeWorkspaceSlug === 'tadka-truck' && (
              <button
                className="chip"
                title="Open Super Admin SaaS Dashboard"
                onClick={() =>
                  updateState((p) =>
                    switchUserSessionInState(p, '+919800000001', 'sa')
                  )
                }
              >
                🏢 Super Admin
              </button>
            )}
            <button
              className="chip"
              title="Quick Demo Staff Switcher"
              onClick={() =>
                updateState((p) =>
                  switchUserSessionInState(p, '+919800000001', 'a')
                )
              }
            >
              ⚡ Demo Staff
            </button>
          </>
        )}
        <button className="chip" onClick={logoutOrOpenLogin}>
          {S.me.mob ? 'Logout' : 'Login'}
        </button>
      </div>
    </div>
  );
}

export function RoleBar() {
  const { S, portals, setRole } = useTadka();
  const allowed = portals();
  if (allowed.length <= 1) return null;

  const roleLabels: [typeof S.role, string][] = [
    ['c', 'Customer'],
    ['k', 'Chef'],
    ['w', 'Waiter'],
    ['o', 'Owner'],
    ['a', 'Admin'],
    ['sa', 'Super'],
  ];

  const activeTabs = roleLabels.filter(([r]) => allowed.includes(r));

  return (
    <div className={`roles ${activeTabs.length >= 6 ? 'has-6-tabs' : ''}`}>
      {activeTabs.map(([r, label]) => (
        <button
          key={r}
          className={S.role === r ? 'on' : ''}
          onClick={() => setRole(r)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function StarsStrip() {
  const { S, total, staffOf } = useTadka();
  const t = total();
  const isStaff = Boolean(staffOf());
  const currentMob = S.me.mob;
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const ONE_HOUR_MS = 60 * 60 * 1000;
  const isRecentWithinOneHour = (paidAt?: string) => {
    if (!paidAt) return false;
    const paidMs = new Date(paidAt).getTime();
    return (
      !Number.isNaN(paidMs) &&
      nowMs - paidMs >= -60000 &&
      nowMs - paidMs <= ONE_HOUR_MS
    );
  };

  // Show paid bills on the first page ONLY for 1 hour after payment so the list never grows large
  const visibleHist = S.hist
    .filter((x) => {
      if (!isRecentWithinOneHour(x.paidAt)) return false;
      if (isStaff) return true;
      return currentMob
        ? x.customerMob === currentMob
        : !x.customerMob || x.customerMob === 'Guest';
    })
    .slice(0, 3);

  const cur =
    S.status && !S.paid && S.sess ? (
      <div className="line">
        <span>
          Table {S.activeTable} · ₹{t}
        </span>
        <span className="tag">⏳ Unpaid</span>
      </div>
    ) : null;

  return (
    <div className="card">
      <div className="row sp">
        <b>Your stars</b>
        <span className="mu">
          {S.stars >= 5
            ? 'Reward unlocked 🎁'
            : `${S.stars} of 5 · ${5 - S.stars} more for a free dessert`}
        </span>
      </div>
      <div className="row" style={{ marginTop: '8px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`sbox ${S.stars >= i ? 'on' : ''} ${
              S.newStar && S.stars === i ? 'new' : ''
            }`}
          >
            {S.stars >= i ? '⭐' : ''}
          </div>
        ))}
      </div>
      {(Boolean(S.sess && S.orders.length > 0 && !S.paid) ||
        Boolean(cur) ||
        visibleHist.length > 0) && (
        <div
          style={{
            marginTop: '10px',
            borderTop: '1px dashed #5a4690',
            paddingTop: '6px',
          }}
        >
          {S.sess && S.orders.length > 0 && !S.paid && (
            <div className="row sp" style={{ marginBottom: '6px' }}>
              <span>🎟️ Counter number</span>
              <span className="tag hot" style={{ fontSize: '16px' }}>
                {S.sess.no}
              </span>
            </div>
          )}
          <div className="row sp">
            <div className="mu">Your bills</div>
            {visibleHist.length > 0 && (
              <span className="mu" style={{ fontSize: '10px' }}>
                ⏱️ Shown for 1 hr after payment
              </span>
            )}
          </div>
          {cur}
          {visibleHist.map((x, idx) => (
            <div key={x.id || idx} className="line">
              <span>
                {x.counterNo ? `${x.counterNo} · ` : ''}₹{x.a} · {x.m}
                {x.o === 'owner' ? ' · tagged by restaurant' : ''}
              </span>
              <span className="tag ok">✅ Paid</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PendingCounterBanner() {
  const { S, setTab } = useTadka();
  if (!S.sess || !S.sess.pend || S.tab === 'order') return null;
  return (
    <div className="wa" style={{ margin: '0 0 10px' }}>
      <b>🎟️ Counter number needed</b>
      <p>Get it from the waiter, owner or reception.</p>
      <button className="btn alt" onClick={() => setTab('order')}>
        Enter number
      </button>
    </div>
  );
}

export function BillReadyBanner() {
  const { S, total, setTab } = useTadka();
  if (S.billSrc !== 'waiter' || S.paid || S.tab === 'bill') return null;
  return (
    <div className="wa" style={{ margin: '0 0 10px' }}>
      <b>🧾 Your bill is ready · ₹{total()}</b>
      <button className="btn alt" onClick={() => setTab('bill')}>
        View and pay
      </button>
    </div>
  );
}

function buildInstagramUrl(handleOrUrl?: string): string {
  const v = (handleOrUrl || '@tadkatruck').trim();
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  return `https://www.instagram.com/${v.replace(/^@/, '')}/`;
}

export function ConnectedAccountsCard() {
  const { S, updateState, say } = useTadka();
  const igUrl = buildInstagramUrl(S.googleConfig.instagramHandle);
  const fbUrl =
    (S.googleConfig.facebookUrl || '').trim() || 'https://www.facebook.com/';

  return (
    <div className="card">
      <h3>🔗 Connected social accounts</h3>
      <p className="mu">
        Follow {S.googleConfig.instagramHandle || '@tadkatruck'} &amp; link once
        to share snaps/reels in one tap.
      </p>
      {SOCIAL_PLATFORMS.map(([p, icon]) => {
        const isConnected = !!S.soc[p];
        const profileUrl =
          p === 'Instagram'
            ? igUrl
            : p === 'Facebook'
              ? fbUrl
              : p === 'Snapchat'
                ? 'https://www.snapchat.com/'
                : 'https://wa.me/';
        return (
          <div key={p} className="row sp" style={{ marginTop: '10px' }}>
            <span>
              {icon} {p}
              <br />
              <span className="mu" style={{ fontSize: '12px' }}>
                {isConnected ? 'Ready to share' : 'Not linked'}
              </span>
            </span>
            <div className="row" style={{ gap: '6px' }}>
              {(p === 'Instagram' || p === 'Facebook') && (
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="chip"
                  style={{ textDecoration: 'none', fontSize: '11px' }}
                >
                  Open ↗
                </a>
              )}
              <button
                className={`chip ${isConnected ? '' : 'on'}`}
                onClick={() => {
                  updateState((prev) => ({
                    ...prev,
                    soc: { ...prev.soc, [p]: !isConnected },
                  }));
                  if (!isConnected) say(`${p} connected ✅`);
                }}
              >
                {isConnected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ShareMomentCard() {
  const { S, updateState, say, uploadMediaToDrive } = useTadka();
  const platforms = ['WhatsApp Status', 'Facebook', 'Instagram', 'Snapchat'];
  const snapInputRef = useRef<HTMLInputElement | null>(null);
  const reelInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const defaultTag = S.googleConfig.socialTag || '#TadkaTruck @tadkatruck';

  const postTemplates: { id: string; label: string; text: string }[] = [
    {
      id: 'foodie',
      label: '🔥 Foodie Vibe',
      text: `Fresh off the grill at Tadka Truck! 🌯🍔 Crazy good flavors & fast QR ordering 😋🔥`,
    },
    {
      id: 'fiveStar',
      label: '⭐ 5-Star Spot',
      text: `Found my new favorite street-food spot — Tadka Truck! 🚚✨ Must try if you're nearby 💯`,
    },
    {
      id: 'squad',
      label: '👥 Squad Hangout',
      text: `Good food + great company at Tadka Truck! 🥳🍽️ Come hungry!`,
    },
    {
      id: 'custom',
      label: '✏️ Write Custom',
      text: '',
    },
  ];

  const [selectedTemplateId, setSelectedTemplateId] = useState('foodie');
  const [caption, setCaption] = useState(postTemplates[0].text);

  const buildFullPostText = () => {
    const body = caption.trim() || postTemplates[0].text;
    const url =
      typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname
        : 'https://pradeepparmar902.github.io/My_Restaurants/';
    return `${body}\n${defaultTag}\n👉 ${url}`;
  };

  const handleFilePicked = (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: 'snap' | 'reel'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    try {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } catch {
      // ignore preview error
    }
    updateState((prev) => ({ ...prev, media: kind }));

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = typeof reader.result === 'string' ? reader.result : '';
      uploadMediaToDrive({
        fileName:
          file.name ||
          `tadka_${kind}_table${S.activeTable}_${Date.now()}.${
            kind === 'reel' ? 'mp4' : 'jpg'
          }`,
        kind,
        mimeType: file.type || (kind === 'reel' ? 'video/mp4' : 'image/jpeg'),
        base64Data: base64,
        caption: caption.trim() || `${defaultTag} · Table ${S.activeTable}`,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleShareToPlatform = async (platform: string) => {
    const shareText = buildFullPostText();
    try {
      await navigator.clipboard?.writeText(shareText);
    } catch {
      // ignore clipboard error
    }

    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
    };

    const sharePageUrl =
      (S.googleConfig.facebookUrl || '').trim() ||
      (typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname
        : 'https://pradeepparmar902.github.io/My_Restaurants/');

    if (selectedFile && typeof nav.share === 'function') {
      try {
        if (!nav.canShare || nav.canShare({ files: [selectedFile] })) {
          await nav.share({
            files: [selectedFile],
            title: 'Tadka Truck',
            text: shareText,
          });
          updateState((prev) => ({
            ...prev,
            soc: { ...prev.soc, [platform]: true },
            pts: !prev.shared ? prev.pts + 10 : prev.pts,
            shared: true,
          }));
          say(`Shared to ${platform} (+10 pts) 🎉`);
          return;
        }
      } catch {
        // user cancelled or browser fell back
      }
    }

    const targetUrl =
      platform === 'Instagram'
        ? buildInstagramUrl(S.googleConfig.instagramHandle)
        : platform === 'WhatsApp Status'
          ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
          : platform === 'Facebook'
            ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                sharePageUrl
              )}&quote=${encodeURIComponent(shareText)}`
            : 'https://www.snapchat.com/';

    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    updateState((prev) => ({
      ...prev,
      soc: { ...prev.soc, [platform]: true },
      pts: !prev.shared ? prev.pts + 10 : prev.pts,
      shared: true,
    }));
    say(`Post copied! Opening ${platform} (+10 pts) 🎉`);
  };

  const handleCopyPost = async () => {
    const text = buildFullPostText();
    try {
      await navigator.clipboard?.writeText(text);
      say('Post text copied! Paste on FB / WhatsApp Status ✅');
    } catch {
      say('Select & copy the text above');
    }
  };

  return (
    <div className="card">
      <h3>📸 Create Post &amp; Share</h3>
      <p className="mu">
        Pick a ready-made post or write your own, optionally attach a
        photo/reel, and share to <b>Facebook / WhatsApp Status</b> for{' '}
        <b>+10 bonus points</b>.
      </p>

      <input
        ref={snapInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFilePicked(e, 'snap')}
      />
      <input
        ref={reelInputRef}
        type="file"
        accept="video/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => handleFilePicked(e, 'reel')}
      />

      {/* Post Templates */}
      <div
        className="row"
        style={{ flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}
      >
        {postTemplates.map((tpl) => (
          <button
            key={tpl.id}
            type="button"
            className={`chip ${selectedTemplateId === tpl.id ? 'on' : ''}`}
            style={{ fontSize: '12px' }}
            onClick={() => {
              setSelectedTemplateId(tpl.id);
              if (tpl.id !== 'custom') setCaption(tpl.text);
              else setCaption('');
            }}
          >
            {tpl.label}
          </button>
        ))}
      </div>

      {/* Editable Post Textarea */}
      <textarea
        value={caption}
        onChange={(e) => {
          setCaption(e.target.value);
          setSelectedTemplateId('custom');
        }}
        rows={3}
        placeholder={`Write your Facebook / WhatsApp Status post here…`}
        className="inp"
        style={{
          width: '100%',
          marginTop: '8px',
          resize: 'vertical',
          fontFamily: 'inherit',
        }}
      />
      <div className="mu" style={{ fontSize: '11px', marginTop: '4px' }}>
        Auto-includes: <b>{defaultTag}</b>
      </div>

      {/* Optional Photo / Video Attachment */}
      {S.media ? (
        <div style={{ marginTop: '8px' }}>
          {previewUrl &&
            (S.media === 'reel' ? (
              <video
                src={previewUrl}
                controls
                style={{
                  width: '100%',
                  maxHeight: '220px',
                  borderRadius: '10px',
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Your snap preview"
                style={{
                  width: '100%',
                  maxHeight: '220px',
                  objectFit: 'cover',
                  borderRadius: '10px',
                }}
              />
            ))}
          <div className="row sp" style={{ marginTop: '6px' }}>
            <span style={{ fontSize: '12px' }}>
              ✅ {S.media === 'reel' ? 'Reel' : 'Snap'} saved to Google Drive
            </span>
            <button
              className="chip"
              style={{ fontSize: '11px' }}
              onClick={() => {
                setSelectedFile(null);
                setPreviewUrl('');
                updateState((prev) => ({ ...prev, media: null }));
              }}
            >
              🔄 Change Media
            </button>
          </div>
        </div>
      ) : (
        <div className="row" style={{ gap: '8px', marginTop: '8px' }}>
          <button
            className="btn ghost"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => snapInputRef.current?.click()}
          >
            📸 Attach Snap
          </button>
          <button
            className="btn ghost"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => reelInputRef.current?.click()}
          >
            🎬 Attach Reel
          </button>
        </div>
      )}

      {/* Share & Copy Actions */}
      <div
        className="row"
        style={{ flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}
      >
        {selectedFile && (
          <button
            className="btn alt"
            style={{ width: '100%', marginTop: 0, marginBottom: '2px' }}
            onClick={() => handleShareToPlatform('Social App')}
          >
            📲 Share Photo/Reel to Any App (FB / IG / WA)
          </button>
        )}
        {platforms.map((p) => (
          <button
            key={p}
            className={`chip ${S.soc[p] ? 'on' : ''}`}
            onClick={() => handleShareToPlatform(p)}
          >
            📲 {p}
          </button>
        ))}
        <button className="chip" onClick={handleCopyPost}>
          📋 Copy Post
        </button>
      </div>

      <ProofSubmissionBox kind="social" />
    </div>
  );
}

function ProofSubmissionBox({ kind }: { kind: 'social' | 'review' }) {
  const {
    S,
    proofSubmissions,
    submitSocialProof,
    pullFromGoogleSheets,
    uploadMediaToDrive,
    say,
  } = useTadka();
  const socialPlatforms = ['Instagram', 'Facebook', 'WhatsApp Status', 'Snapchat'];
  const [platform, setPlatform] = useState(
    kind === 'review' ? 'Google Review' : 'Instagram'
  );
  const [proofUrl, setProofUrl] = useState('');
  const [note, setNote] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [screenshotPreview, setScreenshotPreview] = useState('');
  const [uploadingShot, setUploadingShot] = useState(false);
  const shotInputRef = useRef<HTMLInputElement | null>(null);

  const myMob = S.sess?.mob || '';
  const myProofs = proofSubmissions
    .filter(
      (p) =>
        p.kind === kind &&
        (!myMob || !p.customerMob || p.customerMob === myMob)
    )
    .slice(0, 5);

  const handleScreenshotPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotName(file.name);
    try {
      setScreenshotPreview(URL.createObjectURL(file));
    } catch {
      // ignore preview error
    }
    setUploadingShot(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = typeof reader.result === 'string' ? reader.result : '';
        const driveUrl = await uploadMediaToDrive({
          fileName:
            file.name ||
            `proof_${kind}_table${S.activeTable}_${Date.now()}.jpg`,
          kind: 'snap',
          mimeType: file.type || 'image/jpeg',
          base64Data: base64,
          caption: `${kind === 'review' ? 'Google Review' : platform} Proof · Counter ${S.sess?.no || 'C27'}`,
        });
        if (driveUrl && !proofUrl.trim()) {
          setProofUrl(driveUrl);
        }
        if (!note.trim()) {
          setNote(`Screenshot: ${file.name}`);
        }
      } finally {
        setUploadingShot(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = () => {
    if (!proofUrl.trim() && !note.trim() && !screenshotName) {
      say(
        kind === 'review'
          ? 'Attach a screenshot, enter your Google reviewer name, or tap Verify at Counter'
          : 'Attach a screenshot, paste a link/@handle, or tap Verify at Counter'
      );
      return;
    }
    submitSocialProof({
      kind,
      platform: kind === 'review' ? 'Google Review' : platform,
      proofUrl: proofUrl.trim() || undefined,
      note:
        note.trim() ||
        (screenshotName ? `Screenshot: ${screenshotName}` : undefined),
    });
    setProofUrl('');
    setNote('');
    setScreenshotName('');
    setScreenshotPreview('');
  };

  const handleVerifyAtCounter = () => {
    submitSocialProof({
      kind,
      platform: kind === 'review' ? 'Google Review' : platform,
      proofUrl: proofUrl.trim() || undefined,
      note: note.trim() || '⚡ Verify at Counter (customer will show phone)',
    });
    setProofUrl('');
    setNote('');
    setScreenshotName('');
    setScreenshotPreview('');
  };

  return (
    <div
      style={{
        marginTop: '12px',
        padding: '10px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div className="row sp" style={{ marginBottom: '6px' }}>
        <strong style={{ fontSize: '12px' }}>
          📤 Submit Proof for Admin Approval
        </strong>
        <button
          type="button"
          className="chip"
          style={{ fontSize: '11px', padding: '3px 8px' }}
          onClick={() => pullFromGoogleSheets()}
        >
          🔄 Check Status
        </button>
      </div>
      <p className="mu" style={{ fontSize: '11px', margin: '0 0 8px' }}>
        {kind === 'review'
          ? 'Posted your Google review? Upload a screenshot, enter your reviewer name, or tap Verify at Counter. Admin will release your Coupon, +1 Star, or Discount.'
          : 'Posted your Reel / Story / WhatsApp Status? Upload a screenshot, paste your @handle/link, or tap Verify at Counter.'}
      </p>

      {kind === 'social' && (
        <>
          <div className="row" style={{ flexWrap: 'wrap', gap: '5px', marginBottom: '8px' }}>
            {socialPlatforms.map((p) => (
              <button
                key={p}
                type="button"
                className={`chip ${platform === p ? 'on' : ''}`}
                style={{ fontSize: '11px', padding: '3px 8px' }}
                onClick={() => setPlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
          {(platform === 'Instagram' || platform === 'Facebook') && (
            <div
              className="mu"
              style={{
                fontSize: '11px',
                marginBottom: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                background: 'rgba(59,130,246,0.12)',
                border: '1px solid rgba(59,130,246,0.28)',
              }}
            >
              🏷️ Tag{' '}
              <b>
                {S.googleConfig.instagramHandle
                  ? `@${S.googleConfig.instagramHandle.replace(/^@/, '')}`
                  : S.googleConfig.socialTag || '@tadkatruck'}
              </b>{' '}
              in your Reel/Story/Post so our team gets an instant notification, then enter your{' '}
              <b>@handle</b> below!
            </div>
          )}
        </>
      )}

      <input
        ref={shotInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleScreenshotPicked}
      />

      <button
        type="button"
        className="btn ghost"
        style={{ width: '100%', marginTop: 0, marginBottom: '8px' }}
        onClick={() => shotInputRef.current?.click()}
        disabled={uploadingShot}
      >
        {uploadingShot
          ? '⏳ Uploading Screenshot to Drive...'
          : screenshotName
            ? `✅ Screenshot Attached (${screenshotName})`
            : '📸 Upload Screenshot Proof (1-Tap)'}
      </button>

      {screenshotPreview && (
        <div style={{ marginBottom: '8px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotPreview}
            alt="Proof screenshot preview"
            style={{
              width: '100%',
              maxHeight: '140px',
              objectFit: 'cover',
              borderRadius: '8px',
            }}
          />
        </div>
      )}

      <input
        type="url"
        value={proofUrl}
        onChange={(e) => setProofUrl(e.target.value)}
        placeholder={
          kind === 'review'
            ? 'Paste Google Review link (optional)'
            : 'Paste Reel / Post link (optional)'
        }
        style={{ marginBottom: '6px' }}
      />
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={
          kind === 'review'
            ? 'Your Google Reviewer Name (e.g. Rahul S.)'
            : platform === 'Instagram' || platform === 'Facebook'
              ? 'Your IG / FB @handle (e.g. @rahul_foodie)'
              : 'Your @handle or caption note'
        }
        style={{ marginBottom: '8px' }}
      />
      <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn alt"
          style={{ flex: 1, marginTop: 0, minWidth: '150px' }}
          onClick={handleSubmit}
          disabled={uploadingShot}
        >
          📤 Submit Proof
        </button>
        <button
          type="button"
          className="btn ghost"
          style={{ flex: 1, marginTop: 0, minWidth: '150px' }}
          onClick={handleVerifyAtCounter}
          disabled={uploadingShot}
        >
          ⚡ Verify at Counter
        </button>
      </div>

      {myProofs.length > 0 && (
        <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
          {myProofs.map((p) => (
            <div
              key={p.id}
              className="row sp"
              style={{
                fontSize: '11px',
                padding: '6px 8px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.2)',
                gap: '8px',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div>
                  <strong>{p.platform}</strong>
                  {p.note ? ` · ${p.note}` : ''}
                </div>
                {p.proofUrl && (
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#93c5fd', wordBreak: 'break-all' }}
                  >
                    View link ↗
                  </a>
                )}
              </div>
              <span
                className={`chip ${p.status === 'APPROVED' ? 'on' : ''}`}
                style={{
                  fontSize: '10px',
                  whiteSpace: 'nowrap',
                  borderColor:
                    p.status === 'REJECTED'
                      ? 'rgba(248,113,113,0.5)'
                      : p.status === 'PENDING'
                        ? 'rgba(251,191,36,0.5)'
                        : undefined,
                }}
              >
                {p.status === 'PENDING' && '⏳ PENDING'}
                {p.status === 'APPROVED' &&
                  `✅ ${p.rewardType || 'APPROVED'}${p.rewardValue ? ` (${p.rewardValue})` : ''}`}
                {p.status === 'REJECTED' && '❌ REJECTED'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ReviewAndShareCard() {
  const { S, updateState, say } = useTadka();
  const platforms = ['Instagram', 'WhatsApp Status', 'Snapchat', 'Facebook'];
  const g = S.review || S.reviewed;
  const defaultTag = S.googleConfig.socialTag || '#TadkaTruck @tadkatruck';
  const googleReviewLink =
    (S.googleConfig.googleReviewUrl || '').trim() ||
    'https://www.google.com/search?q=Tadka+Truck+reviews';

  const handleOpenGoogleReview = () => {
    window.open(googleReviewLink, '_blank', 'noopener,noreferrer');
    say('Opening Google Review — post your review, then submit proof below for Admin approval ⭐');
  };

  const handleQuickShare = async (p: string) => {
    const shareText = `Loved the food at Tadka Truck! ${defaultTag}`;
    try {
      await navigator.clipboard?.writeText(shareText);
    } catch {
      // ignore
    }
    const sharePageUrl =
      (S.googleConfig.facebookUrl || '').trim() ||
      (typeof window !== 'undefined'
        ? window.location.origin + window.location.pathname
        : 'https://pradeepparmar902.github.io/My_Restaurants/');
    const targetUrl =
      p === 'Instagram'
        ? buildInstagramUrl(S.googleConfig.instagramHandle)
        : p === 'WhatsApp Status'
          ? `https://wa.me/?text=${encodeURIComponent(shareText)}`
          : p === 'Facebook'
            ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                sharePageUrl
              )}&quote=${encodeURIComponent(shareText)}`
            : 'https://www.snapchat.com/';
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    updateState((prev) => ({
      ...prev,
      soc: { ...prev.soc, [p]: true },
      pts: !prev.shared ? prev.pts + 10 : prev.pts,
      shared: true,
    }));
    say(`Tag copied! Opening ${p} (+10 pts) 🎉`);
  };

  return (
    <div className="card">
      <h3>⭐ Review and share</h3>
      <p className="mu">
        {S.paid
          ? 'Loved it? Post a Google Review or share on social media for 10 bonus points.'
          : 'Post a Google review to save ₹50 on this bill, or share on social media for 10 bonus points.'}
      </p>
      {g ? (
        <div className="row sp" style={{ margin: '8px 0' }}>
          <span>✅ Google review posted</span>
          <a
            href={googleReviewLink}
            target="_blank"
            rel="noreferrer"
            className="chip"
            style={{ textDecoration: 'none', fontSize: '11px' }}
          >
            Open Google ↗
          </a>
        </div>
      ) : (
        <>
          <div className="stars" style={{ marginTop: '6px' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={S.rating >= i ? 'on' : ''}
                onClick={() => updateState((prev) => ({ ...prev, rating: i }))}
              >
                ⭐
              </span>
            ))}
          </div>
          {S.rating >= 4 ? (
            <button className="btn alt" onClick={handleOpenGoogleReview}>
              ⭐ Open Google Review
            </button>
          ) : S.rating ? (
            <p className="mu">
              Thanks. Tell the manager privately and we will fix it.
            </p>
          ) : null}
        </>
      )}
      <ProofSubmissionBox kind="review" />
      <div className="row" style={{ flexWrap: 'wrap', marginTop: '10px', gap: '6px' }}>
        {platforms.map((p) => (
          <button
            key={p}
            className={`chip ${S.soc[p] ? 'on' : ''}`}
            onClick={() => handleQuickShare(p)}
          >
            📲 Share to {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TagOfflinePaidWidget() {
  const { doPay } = useTadka();
  return (
    <>
      <p className="mu" style={{ margin: '8px 0 4px' }}>
        Customer paid offline? Tag the bill as paid:
      </p>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="chip on" onClick={() => doPay('Cash', 'owner')}>
          Cash
        </button>
        <button className="chip on" onClick={() => doPay('Card machine', 'owner')}>
          Card machine
        </button>
        <button className="chip on" onClick={() => doPay('UPI at counter', 'owner')}>
          UPI at counter
        </button>
      </div>
    </>
  );
}

export function LoginScreen() {
  const { S, sendOtp, verifyOtp, updateState } = useTadka();
  const [mobInput, setMobInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const g = S.lg;
  const gated = isSessionGated(S);

  return (
    <>
      <div
        className="hero"
        style={{ background: 'linear-gradient(135deg,#ff5c8a,#ff8a4c)' }}
      >
        <h1>Login with mobile</h1>
        <p>
          See your orders, live status and bill. Orders booked by the waiter or
          owner show up after you login.
        </p>
      </div>
      <div className="card">
        {g.step === 0 ? (
          <>
            <p className="mu" style={{ marginBottom: '8px' }}>
              Demo staff numbers:{' '}
              {S.staff
                .filter((x) => x.on)
                .map((x) => `${x.r} ${x.ph}`)
                .join(' · ')}
            </p>
            <div className="row" style={{ flexWrap: 'wrap', marginBottom: '10px' }}>
              {S.staff
                .filter((x) => x.on)
                .map((x) => (
                  <button
                    key={x.ph}
                    className="chip"
                    onClick={() => setMobInput(x.ph.replace(/^\+91/, ''))}
                  >
                    Fill {x.r}
                  </button>
                ))}
            </div>
            <CountryCodeMobileInput
              id="lm"
              value={mobInput}
              onChange={setMobInput}
            />
            <button className="btn" onClick={() => sendOtp(mobInput)}>
              Send OTP
            </button>
          </>
        ) : (
          <>
            <p className="mu" style={{ marginBottom: '8px' }}>
              OTP sent to {g.mob}. Demo OTP: 1234
            </p>
            <input
              id="lo"
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              placeholder="4-digit OTP"
              inputMode="numeric"
              className="inp"
              style={{ width: '100%' }}
            />
            <button className="btn" onClick={() => verifyOtp(otpInput)}>
              Verify and login
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setOtpInput('');
                updateState((prev) => ({ ...prev, lg: { step: 0, mob: '' } }));
              }}
            >
              Change number
            </button>
          </>
        )}
        {S.showLogin && !gated && (
          <button
            className="btn ghost"
            onClick={() => updateState((prev) => ({ ...prev, showLogin: false }))}
          >
            Back
          </button>
        )}
      </div>
    </>
  );
}
