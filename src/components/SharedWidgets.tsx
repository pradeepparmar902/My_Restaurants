'use client';

import React, { useRef, useState } from 'react';
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
  const { S, staffOf, logoutOrOpenLogin, updateState } = useTadka();
  const st = staffOf();
  return (
    <div className="row sp" style={{ marginBottom: '10px' }}>
      <span className="mu">
        {S.me.mob
          ? `📱 ${S.me.mob}${st ? ' · ' + st.r : ''}`
          : 'Guest · login to find your orders'}
      </span>
      <div className="row">
        {!S.me.mob && (
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
  ];

  return (
    <div className="roles">
      {roleLabels
        .filter(([r]) => allowed.includes(r))
        .map(([r, label]) => (
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

  // Customers only see their own paid bill history; Staff with designated access can see all or their own
  const visibleHist = isStaff
    ? S.hist.slice(0, 3)
    : S.hist
        .filter((x) =>
          currentMob
            ? x.customerMob === currentMob
            : !x.customerMob || x.customerMob === 'Guest'
        )
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
        <div className="mu">Your bills</div>
        {cur}
        {visibleHist.length === 0 && !cur && (
          <p className="mu" style={{ fontSize: '12px', marginTop: '4px' }}>
            No bills for {currentMob || 'Guest'} yet.
          </p>
        )}
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
  const platforms = ['Instagram', 'WhatsApp Status', 'Snapchat', 'Facebook'];
  const snapInputRef = useRef<HTMLInputElement | null>(null);
  const reelInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [caption, setCaption] = useState('');

  const defaultTag = S.googleConfig.socialTag || '#TadkaTruck @tadkatruck';

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
    const shareText = `${
      caption.trim() || 'Great food at Tadka Truck!'
    } ${defaultTag}`;
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
      (typeof window !== 'undefined' ? window.location.origin + window.location.pathname : 'https://pradeepparmar902.github.io/My_Restaurants/');

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
    say(`Tag copied! Opening ${platform} (+10 pts) 🎉`);
  };

  return (
    <div className="card">
      <h3>📸 Share your moment</h3>
      <p className="mu">
        Take a photo or record a reel from your phone, tag{' '}
        <b>{defaultTag}</b>, and earn <b>10 bonus points</b>.
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

      {S.media ? (
        <>
          {previewUrl &&
            (S.media === 'reel' ? (
              <video
                src={previewUrl}
                controls
                style={{
                  width: '100%',
                  maxHeight: '220px',
                  borderRadius: '10px',
                  marginTop: '8px',
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
                  marginTop: '8px',
                }}
              />
            ))}
          <p style={{ margin: '8px 0 4px', fontSize: '13px' }}>
            ✅ {S.media === 'reel' ? 'Reel' : 'Snap'} saved to Google Drive. Tap
            a platform to share:
          </p>
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder={`Add caption (${defaultTag})`}
            className="inp"
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <div className="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
            {selectedFile && (
              <button
                className="btn alt"
                style={{ width: '100%', marginTop: 0, marginBottom: '4px' }}
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
                📲 Share to {p}
              </button>
            ))}
          </div>
          <button
            className="btn ghost"
            style={{ marginTop: '8px' }}
            onClick={() => {
              setSelectedFile(null);
              setPreviewUrl('');
              updateState((prev) => ({ ...prev, media: null }));
            }}
          >
            🔄 Upload another snap / reel
          </button>
        </>
      ) : (
        <div className="row" style={{ gap: '8px', marginTop: '8px' }}>
          <button
            className="btn alt"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => snapInputRef.current?.click()}
          >
            📸 Take / Upload Snap
          </button>
          <button
            className="btn alt"
            style={{ flex: 1, marginTop: 0 }}
            onClick={() => reelInputRef.current?.click()}
          >
            🎬 Record / Upload Reel
          </button>
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
    updateState((prev) => ({
      ...prev,
      reviewed: prev.paid ? true : prev.reviewed,
      review: prev.paid ? prev.review : true,
    }));
    say(
      S.paid
        ? 'Opening Google Review — thank you! ⭐'
        : 'Opening Google Review · ₹50 off applied ✅'
    );
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
              ⭐ Post on Google{S.paid ? '' : ' · ₹50 off'}
            </button>
          ) : S.rating ? (
            <p className="mu">
              Thanks. Tell the manager privately and we will fix it.
            </p>
          ) : null}
        </>
      )}
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
