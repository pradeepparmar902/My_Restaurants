'use client';

import React, { useState } from 'react';
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

export function ConnectedAccountsCard() {
  const { S, updateState, say } = useTadka();
  return (
    <div className="card">
      <h3>🔗 Connected accounts</h3>
      <p className="mu">Link once, then post in one tap. Disconnect anytime.</p>
      {SOCIAL_PLATFORMS.map(([p, icon]) => {
        const isConnected = !!S.soc[p];
        return (
          <div key={p} className="row sp" style={{ marginTop: '10px' }}>
            <span>
              {icon} {p}
              <br />
              <span className="mu">
                {isConnected ? 'Connected as @you.eats' : 'Not connected'}
              </span>
            </span>
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
        );
      })}
    </div>
  );
}

export function ShareMomentCard() {
  const { S, updateState, say, uploadMediaToDrive } = useTadka();
  const platforms = ['Instagram', 'WhatsApp Status', 'Snapchat', 'Facebook'];
  return (
    <div className="card">
      <h3>📸 Share your moment</h3>
      <p className="mu">
        Snap or record your dish. Tag @tadkatruck and earn 10 bonus points.
      </p>
      {S.media ? (
        <>
          <p style={{ margin: '8px 0' }}>
            ✅ {S.media === 'reel' ? 'Reel' : 'Snap'} ready & saved to Google Drive. Share it:
          </p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {platforms.map((p) =>
              S.soc[p] ? (
                <button
                  key={p}
                  className="chip on"
                  onClick={() => {
                    updateState((prev) => ({
                      ...prev,
                      pts: !prev.shared ? prev.pts + 10 : prev.pts,
                      shared: true,
                    }));
                    say(`Shared to ${p} 🎉`);
                  }}
                >
                  Share to {p}
                </button>
              ) : (
                <button
                  key={p}
                  className="chip"
                  onClick={() => {
                    updateState((prev) => ({
                      ...prev,
                      soc: { ...prev.soc, [p]: true },
                    }));
                    say(`${p} connected ✅`);
                  }}
                >
                  Connect {p}
                </button>
              )
            )}
          </div>
        </>
      ) : (
        <div className="row">
          <button
            className="btn alt"
            onClick={() => {
              updateState((prev) => ({ ...prev, media: 'snap' }));
              uploadMediaToDrive({
                fileName: `tadka_snap_table${S.activeTable}_${Date.now()}.jpg`,
                kind: 'snap',
                mimeType: 'image/jpeg',
                caption: `Moment snap at Table ${S.activeTable}`,
              });
            }}
          >
            📸 Take snap
          </button>
          <button
            className="btn alt"
            onClick={() => {
              updateState((prev) => ({ ...prev, media: 'reel' }));
              uploadMediaToDrive({
                fileName: `tadka_moment_reel_table${S.activeTable}_${Date.now()}.mp4`,
                kind: 'reel',
                mimeType: 'video/mp4',
                caption: `Moment reel at Table ${S.activeTable}`,
              });
            }}
          >
            🎬 Record reel
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

  return (
    <div className="card">
      <h3>⭐ Review and share</h3>
      <p className="mu">
        {S.paid
          ? 'Loved it? Tell others and earn bonus points.'
          : 'Post a Google review to save ₹50 on this bill, or share on social media for 10 bonus points.'}
      </p>
      {g ? (
        <p style={{ margin: '8px 0' }}>✅ Google review posted</p>
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
            <button
              className="btn alt"
              onClick={() =>
                updateState((prev) => ({
                  ...prev,
                  reviewed: prev.paid ? true : prev.reviewed,
                  review: prev.paid ? prev.review : true,
                }))
              }
            >
              Post on Google{S.paid ? '' : ' · ₹50 off'}
            </button>
          ) : S.rating ? (
            <p className="mu">
              Thanks. Tell the manager privately and we will fix it.
            </p>
          ) : null}
        </>
      )}
      <div className="row" style={{ flexWrap: 'wrap', marginTop: '10px' }}>
        {platforms.map((p) =>
          S.soc[p] ? (
            <button
              key={p}
              className="chip on"
              onClick={() => {
                updateState((prev) => ({
                  ...prev,
                  pts: !prev.shared ? prev.pts + 10 : prev.pts,
                  shared: true,
                }));
                say(`Shared to ${p} 🎉`);
              }}
            >
              Share to {p}
            </button>
          ) : (
            <button
              key={p}
              className="chip"
              onClick={() => {
                updateState((prev) => ({
                  ...prev,
                  soc: { ...prev.soc, [p]: true },
                }));
                say(`${p} connected ✅`);
              }}
            >
              Connect {p}
            </button>
          )
        )}
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
