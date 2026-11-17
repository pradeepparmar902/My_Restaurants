'use client';

import React, { useEffect, useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import { Language, PaymentMethod } from '@/types/tadka';
import { ORDER_STATUS_LABELS } from '@/lib/constants';
import { normalizeMobile } from '@/lib/helpers';
import {
  ConnectedAccountsCard,
  CountryCodeMobileInput,
  ReviewAndShareCard,
  ShareMomentCard,
} from '@/components/SharedWidgets';

export function MenuTabView() {
  const {
    S,
    setLang,
    toggleVeg,
    changeDraftQty,
    placeOrder,
    cnt,
    dsub,
    updateState,
  } = useTadka();
  const [optMob, setOptMob] = useState('');
  const [showOptMob, setShowOptMob] = useState(false);

  const L: Record<Language, string> = {
    en: 'Menu',
    hi: 'मेन्यू',
    gu: 'મેનુ',
  };

  const langLabels: Record<Language, string> = {
    en: 'English',
    hi: 'हिन्दी',
    gu: 'ગુજરાતી',
  };

  const filteredMenu = S.menu.filter(
    (m) => m.available && (!S.veg || m.v === 1) && (!S.jainOnly || m.jain)
  );

  const activeTableLabel =
    S.tables.find((t) => t.id === S.activeTable)?.label ||
    `Table ${S.activeTable}`;

  return (
    <>
      <div className="hero">
        <h1>
          Tadka Truck
          <br />
          {activeTableLabel} 🔥
        </h1>
        <p>
          {S.sess && S.orders.length > 0 && !S.paid
            ? S.sess.pend
              ? 'Counter number pending. Get it from the waiter or reception and enter it in the Order tab.'
              : `Counter ${S.sess.no}. Add more anytime until you pay.`
            : 'Scan done. Pick your food, we cook it fresh.'}
        </p>
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        {(['en', 'hi', 'gu'] as Language[]).map((l) => (
          <button
            key={l}
            className={`chip ${S.lang === l ? 'on' : ''}`}
            onClick={() => setLang(l)}
          >
            {langLabels[l]}
          </button>
        ))}
        <button className={`chip ${S.veg ? 'on' : ''}`} onClick={toggleVeg}>
          🌱 Veg only
        </button>
        <button
          className={`chip ${S.jainOnly ? 'on' : ''}`}
          onClick={() => updateState((p) => ({ ...p, jainOnly: !p.jainOnly }))}
        >
          🙏 Jain
        </button>
      </div>

      <h2 style={{ marginTop: '14px' }}>{L[S.lang]}</h2>

      {filteredMenu.map((m) => {
        const draftQty = S.draft[m.id] || 0;
        return (
          <div key={m.id} className="card dish">
            <div className="em">{m.e}</div>
            <div>
              <b>
                <span className={`veg ${m.v ? '' : 'nv'}`} />
                {m.n[S.lang]}
              </b>
              <span className="mu">
                ₹{m.p}
                {m.jain ? ' · Jain' : ''}
              </span>
            </div>
            <div className="qty">
              {draftQty > 0 && (
                <>
                  <button
                    aria-label="Remove"
                    onClick={() => changeDraftQty(m.id, -1)}
                  >
                    −
                  </button>
                  <b>{draftQty}</b>
                </>
              )}
              <button
                aria-label="Add"
                onClick={() => changeDraftQty(m.id, 1)}
              >
                +
              </button>
            </div>
          </div>
        );
      })}

      {cnt() > 0 && !S.sess?.mob && !S.me.mob && (
        <div className="card">
          <div className="row sp">
            <span className="mu">
              💬 Want your final bill & offers on WhatsApp? (Optional)
            </span>
            <button
              className="chip"
              onClick={() => setShowOptMob((prev) => !prev)}
            >
              {showOptMob ? 'Hide' : 'Add number'}
            </button>
          </div>
          {showOptMob && (
            <div style={{ marginTop: '8px' }}>
              <CountryCodeMobileInput
                id="menu-mob"
                value={optMob}
                onChange={setOptMob}
                placeholder="WhatsApp mobile number"
              />
              <label
                className="row mu"
                style={{ marginTop: '8px', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={S.waOptIn}
                  onChange={(e) =>
                    updateState((p) => ({ ...p, waOptIn: e.target.checked }))
                  }
                />
                <span>Send my final bill on WhatsApp</span>
              </label>
            </div>
          )}
        </div>
      )}

      <button
        className="btn"
        disabled={cnt() === 0}
        onClick={() => placeOrder(optMob, S.waOptIn)}
      >
        {!S.me.mob
          ? 'Login & Place order'
          : S.sess
            ? 'Add to my order'
            : 'Place order'}{' '}
        · ₹{dsub()}
      </button>
    </>
  );
}

export function TrackByCounterCard() {
  const { S, trackCounter } = useTadka();
  const [trkInput, setTrkInput] = useState(S.track);

  return (
    <div className="card">
      <h3>🔎 Track by counter number</h3>
      <p className="mu">
        Enter the counter number from your receipt to check your order.
      </p>
      <div className="row" style={{ marginTop: '8px' }}>
        <input
          id="trk"
          value={trkInput}
          onChange={(e) => setTrkInput(e.target.value)}
          placeholder="e.g. C27"
          className="inp"
        />
        <button className="chip on" onClick={() => trackCounter(trkInput)}>
          Check
        </button>
      </div>
      {S.trackRes && <p style={{ marginTop: '8px' }}>{S.trackRes}</p>}
    </div>
  );
}

export function EnterCounterNumberCard() {
  const { setNo } = useTadka();
  const [cnoInput, setCnoInput] = useState('');

  return (
    <div
      className="hero"
      style={{ background: 'linear-gradient(135deg,#ffb547,#ff8a4c)' }}
    >
      <h1>Enter your counter number</h1>
      <p>
        Ask the waiter, owner or reception for your number, then type it here.
        It stays the same for your whole visit.
      </p>
      <div className="row" style={{ marginTop: '10px' }}>
        <input
          id="cno"
          value={cnoInput}
          onChange={(e) => setCnoInput(e.target.value)}
          placeholder="e.g. C27"
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px',
            borderRadius: '12px',
            border: 0,
            background: '#fff',
            color: '#2b0f1f',
            font: 'inherit',
          }}
        />
        <button className="chip on" onClick={() => setNo(cnoInput)}>
          Save number
        </button>
      </div>
    </div>
  );
}

export function OrderTabView() {
  const {
    S,
    setTab,
    say,
    inviteMemberToSession,
    removeInvitedMember,
    pullFromGoogleSheets,
  } = useTadka();
  const [inviteMob, setInviteMob] = useState('');
  const stepIcons = ['📥', '🍳', '🛎️', '✅'];
  const hasInvitedMobs = (S.sess?.invitedMobs || []).length > 0;

  useEffect(() => {
    if (!S.sess || S.paid || S.sess.status === 'paid' || !hasInvitedMobs) return;
    pullFromGoogleSheets(undefined, true);
    const id = setInterval(() => {
      pullFromGoogleSheets(undefined, true);
    }, 10000);
    return () => clearInterval(id);
  }, [S.sess, S.paid, hasInvitedMobs, pullFromGoogleSheets]);

  if (!S.sess) {
    return (
      <>
        <div className="card">
          <h3>No order yet</h3>
          <p className="mu">
            Add dishes from the menu to open your session. You get a counter
            number for the whole visit.
          </p>
        </div>
        <TrackByCounterCard />
      </>
    );
  }

  const isPrincipalUser = !S.sess.mob || S.sess.mob === S.me.mob;
  const activeTableLabel =
    S.tables.find((t) => t.id === S.activeTable)?.label ||
    `Table ${S.activeTable}`;

  return (
    <>
      {S.sess.pend ? (
        <EnterCounterNumberCard />
      ) : (
        <div
          className="hero"
          style={{ background: 'linear-gradient(135deg,#5cf2c0,#3aa8ff)' }}
        >
          <h1>Counter {S.sess.no}</h1>
          <p>
            {activeTableLabel} · one session until you pay. Show this number
            to the waiter.
          </p>
        </div>
      )}

      {!isPrincipalUser && S.sess.mob && (
        <div className="wa" style={{ margin: '0 0 10px' }}>
          <b>👥 Joined {S.sess.mob}’s Table (Clubbed Bill)</b>
          <p className="mu" style={{ marginTop: '4px' }}>
            Orders you place here will be added to Counter {S.sess.no} and billed
            to {S.sess.mob}.
          </p>
        </div>
      )}

      {(() => {
        const groupsMap = new Map<string, typeof S.orders>();
        const principalKey = S.sess!.mob || 'Guest';
        S.orders.forEach((o) => {
          const mobKey = o.orderedByMob || principalKey;
          const arr = groupsMap.get(mobKey) || [];
          arr.push(o);
          groupsMap.set(mobKey, arr);
        });
        const sortedGroups = Array.from(groupsMap.entries()).sort(([a], [b]) => {
          if (a === principalKey) return -1;
          if (b === principalKey) return 1;
          return a.localeCompare(b);
        });

        return sortedGroups.map(([mobKey, mobOrders]) => {
          let groupSubtotal = 0;
          mobOrders
            .filter((o) => o.st !== 5)
            .forEach((o) => {
              S.menu.forEach((m) => {
                const q = o.it[m.id] || 0;
                if (q > 0) groupSubtotal += (o.prices?.[m.id] ?? m.p) * q;
              });
            });
          const isPrincipalMob = mobKey === S.sess?.mob;

          return (
            <div key={mobKey} className="card">
              <div
                className="row sp"
                style={{
                  paddingBottom: '8px',
                  marginBottom: '10px',
                  borderBottom: '1px solid #382562',
                }}
              >
                <div>
                  <b>📱 {mobKey}</b>{' '}
                  <span className="tag" style={{ fontSize: '11px' }}>
                    {isPrincipalMob ? 'Principal' : 'Invited'}
                  </span>
                </div>
                <span className="mu" style={{ fontSize: '12px' }}>
                  {mobOrders.length} order{mobOrders.length === 1 ? '' : 's'} · ₹
                  {groupSubtotal}
                </span>
              </div>

              {mobOrders.map((o, idx) => (
                <div
                  key={o.id || o.k}
                  style={{
                    marginTop: idx > 0 ? '12px' : '0',
                    paddingTop: idx > 0 ? '10px' : '0',
                    borderTop: idx > 0 ? '1px dashed #382562' : 'none',
                  }}
                >
                  <div className="row sp">
                    <h3 style={{ margin: 0 }}>
                      Order {o.k}
                      {o.src === 'waiter' ? ' · by waiter' : ''}
                    </h3>
                    <span className="tag hot">{ORDER_STATUS_LABELS[o.st]}</span>
                  </div>
                  <div className="steps" style={{ margin: '10px 0 6px' }}>
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className={`step ${o.st >= i ? 'on' : ''}`}>
                        <i>{stepIcons[i - 1]}</i>
                        {ORDER_STATUS_LABELS[i]}
                      </div>
                    ))}
                  </div>
                  {S.menu
                    .filter((m) => o.it[m.id])
                    .map((m) => (
                      <div key={m.id} className="line">
                        <span>
                          {m.e} {m.n[S.lang]} × {o.it[m.id]}
                        </span>
                        <span>₹{(o.prices?.[m.id] ?? m.p) * o.it[m.id]}</span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          );
        });
      })()}

      {!S.paid && isPrincipalUser && (
        <div className="card">
          <h3>👥 Invite Friends to Your Table</h3>
          <p className="mu" style={{ margin: '4px 0 8px' }}>
            Invited mobile numbers can log in on their own phone and order for{' '}
            {activeTableLabel} — all orders club into your single bill (Counter{' '}
            {S.sess.no}).
          </p>
          <CountryCodeMobileInput
            id="inv-mob"
            value={inviteMob}
            onChange={setInviteMob}
            placeholder="Friend's mobile number"
          />
          <button
            className="btn alt"
            onClick={() => {
              inviteMemberToSession(inviteMob);
              setInviteMob('');
            }}
          >
            + Invite to Table Bill
          </button>
          {(S.sess.invitedMobs || []).length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div className="row sp" style={{ marginBottom: '6px' }}>
                <span className="mu">Invited members & their orders:</span>
                <button
                  className="chip"
                  style={{ fontSize: '11px', padding: '3px 8px' }}
                  onClick={() => pullFromGoogleSheets()}
                >
                  🔄 Refresh
                </button>
              </div>
              {(S.sess.invitedMobs || []).map((m) => {
                const memberOrders = S.orders.filter(
                  (o) => o.orderedByMob === m && o.st !== 5
                );
                let memberQty = 0;
                let memberSubtotal = 0;
                const memberItems: { name: string; qty: number; amt: number; status: string }[] = [];

                memberOrders.forEach((o) => {
                  S.menu.forEach((dish) => {
                    const q = o.it[dish.id] || 0;
                    if (q > 0) {
                      const amt = (o.prices?.[dish.id] ?? dish.p) * q;
                      memberQty += q;
                      memberSubtotal += amt;
                      memberItems.push({
                        name: `${dish.e} ${dish.n[S.lang]}`,
                        qty: q,
                        amt,
                        status: ORDER_STATUS_LABELS[o.st],
                      });
                    }
                  });
                });

                return (
                  <div
                    key={m}
                    style={{
                      background: 'var(--bg)',
                      borderRadius: '12px',
                      padding: '10px',
                      marginTop: '8px',
                      border: '1px solid #5a4690',
                    }}
                  >
                    <div className="row sp">
                      <span>
                        <b>📱 {m}</b>
                        <br />
                        <span className="mu" style={{ fontSize: '12px' }}>
                          {memberQty > 0
                            ? `${memberQty} item(s) · ₹${memberSubtotal}`
                            : '⏳ No order placed yet'}
                        </span>
                      </span>
                      <button
                        className="chip"
                        onClick={() => removeInvitedMember(m)}
                      >
                        Remove
                      </button>
                    </div>
                    {memberItems.length > 0 && (
                      <div
                        style={{
                          marginTop: '6px',
                          paddingTop: '6px',
                          borderTop: '1px dashed #382562',
                          fontSize: '13px',
                        }}
                      >
                        {memberItems.map((it, idx) => (
                          <div key={idx} className="line">
                            <span>
                              {it.name} × {it.qty}{' '}
                              <span className="mu">({it.status})</span>
                            </span>
                            <span>₹{it.amt}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button className="btn alt" onClick={() => setTab('menu')}>
        + Add more items
      </button>
      <button
        className="btn ghost"
        onClick={() =>
          say(
            `Waiter is coming to ${
              S.sess?.pend ? activeTableLabel : S.sess?.no
            } 🙋`
          )
        }
      >
        🙋 Call waiter
      </button>

      <ShareMomentCard />
      <TrackByCounterCard />
    </>
  );
}

export function RewardsTabView() {
  const { S, updateState, say, uploadMediaToDrive } = useTadka();
  const [feedbackText, setFeedbackText] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = typeof reader.result === 'string' ? reader.result : '';
      updateState((p) => ({ ...p, reel: 'wait' }));
      uploadMediaToDrive({
        fileName: file.name,
        kind: 'reel',
        mimeType: file.type || 'video/mp4',
        base64Data,
        caption: S.reelCaption || `Reel for Table ${S.activeTable}`,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <h2>Post and save</h2>
      <p className="mu">
        Post a reel or review. The manager approves it and your discount
        unlocks.
      </p>

      <ConnectedAccountsCard />

      <div className="card">
        <h3>🎬 Upload a reel</h3>
        <p className="mu">
          Tag @tadkatruck and say the dish name (type or speak). Stored in Google Drive.
        </p>
        {S.reel ? (
          <p style={{ marginTop: '8px' }}>
            {S.reel === 'ok'
              ? '✅ Approved: 10% off applied (Stored in Google Drive)'
              : '⏳ Waiting for manager approval (Uploaded to Google Drive)'}
          </p>
        ) : (
          <>
            <input
              value={S.reelCaption}
              onChange={(e) =>
                updateState((p) => ({ ...p, reelCaption: e.target.value }))
              }
              placeholder="e.g. Paneer Kathi Roll at @tadkatruck"
              className="inp"
              style={{ width: '100%', marginTop: '8px' }}
            />
            <label
              className="btn ghost"
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: '8px',
                cursor: 'pointer',
              }}
            >
              📁 Pick video/photo for Google Drive
              <input
                type="file"
                accept="video/*,image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
            <button
              className="btn alt"
              onClick={() => {
                updateState((p) => ({ ...p, reel: 'wait' }));
                uploadMediaToDrive({
                  fileName: `reel_table${S.activeTable}_${Date.now()}.mp4`,
                  kind: 'reel',
                  mimeType: 'video/mp4',
                  caption: S.reelCaption || 'Paneer Kathi Roll at @tadkatruck',
                });
              }}
            >
              Upload reel
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                updateState((p) => ({
                  ...p,
                  reelCaption: 'Paneer roll at Tadka Truck @tadkatruck',
                }));
                say('🎙️ Listening… “Paneer roll at Tadka Truck”');
              }}
            >
              🎙️ Speak the caption
            </button>
          </>
        )}
      </div>

      <div className="card">
        <h3>⭐ Rate your meal</h3>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className={S.rating >= i ? 'on' : ''}
              onClick={() => updateState((p) => ({ ...p, rating: i }))}
            >
              ⭐
            </span>
          ))}
        </div>
        {S.rating >= 4 && !S.review && (
          <button
            className="btn alt"
            onClick={() => updateState((p) => ({ ...p, review: true }))}
          >
            Post on Google · get ₹50 off
          </button>
        )}
        {S.rating > 0 && S.rating < 4 && (
          <>
            <p className="mu" style={{ marginTop: '6px' }}>
              Thanks. Tell the manager privately so we can fix it.
            </p>
            <input
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="What could we improve?"
              className="inp"
              style={{ width: '100%', marginTop: '6px' }}
            />
            <button
              className="btn ghost"
              onClick={() => {
                setFeedbackText('');
                say('Sent privately to manager');
              }}
            >
              Send feedback
            </button>
          </>
        )}
        {S.review && (
          <p style={{ marginTop: '8px' }}>
            ✅ Google review posted: ₹50 off applied
          </p>
        )}
      </div>
    </>
  );
}

export function BillTabView() {
  const {
    S,
    sub,
    disc,
    gst,
    total,
    doPay,
    sendBill,
    startNewOrder,
    updateState,
    say,
  } = useTadka();
  const [waInput, setWaInput] = useState('');
  const [friendWaMob, setFriendWaMob] = useState('');
  const [customSplitMobs, setCustomSplitMobs] = useState<string[]>([]);
  const [sentWaMobs, setSentWaMobs] = useState<string[]>([]);
  const [contactNames, setContactNames] = useState<Record<string, string>>({});

  if (!S.status) {
    return (
      <div className="card">
        <h3>No bill yet</h3>
        <p className="mu">Place an order first.</p>
      </div>
    );
  }

  const t = total();
  const per = Math.ceil(t / S.split);
  const s = sub();
  const g = gst();

  if (S.paid) {
    return (
      <>
        <div
          className="hero"
          style={{ background: 'linear-gradient(135deg,#5cf2c0,#3aa8ff)' }}
        >
          <h1>Paid 🎉</h1>
          <p>
            +1 star ⭐ and +{Math.floor(t / 10)} points added to your wallet
          </p>
        </div>

        {S.wab && !(S.sess && S.sess.mob) && (
          <div className="card">
            <b>Get the final bill on WhatsApp</b>
            <div style={{ marginTop: '8px' }}>
              <CountryCodeMobileInput
                id="pm"
                value={waInput}
                onChange={setWaInput}
              />
            </div>
            <button className="btn alt" onClick={() => sendBill(waInput)}>
              Send my bill
            </button>
          </div>
        )}

        {S.wab && (
          <div className="wa">
            <b>
              WhatsApp · Tadka Truck
              {S.sess && S.sess.mob ? ` to ${S.sess.mob}` : ''}
            </b>
            <p>
              Thanks for visiting! Bill #1042 ({S.sess?.no || 'C27'}): ₹{t}.
              Show this next time for a free Gulab Jamun on your 3rd visit 🍮
            </p>
          </div>
        )}

        <div className="card">
          <h3>💸 Split Paid Bill & Send on WhatsApp</h3>
          <p className="mu" style={{ margin: '4px 0 8px' }}>
            Total Paid: <b>₹{t}</b> (Counter {S.sess?.no || '—'} · Table{' '}
            {S.activeTable})
          </p>
          <div className="row" style={{ flexWrap: 'wrap', marginTop: '6px' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={`chip ${S.split === n ? 'on' : ''}`}
                onClick={() => updateState((p) => ({ ...p, split: n }))}
              >
                {n === 1 ? 'Just me' : `${n} people`}
              </button>
            ))}
          </div>
          {S.split > 1 && (
            <p style={{ marginTop: '8px', fontSize: '14px' }}>
              Each person&apos;s share: <b>₹{per}</b> ({S.split} ways)
            </p>
          )}

          {(() => {
            const memberTotals: Record<string, number> = {};
            S.orders
              .filter((o) => o.st !== 5)
              .forEach((o) => {
                const who = o.orderedByMob || S.sess?.mob || 'Principal';
                let amt = 0;
                S.menu.forEach((d) => {
                  const q = o.it[d.id] || 0;
                  if (q > 0) amt += (o.prices?.[d.id] ?? d.p) * q;
                });
                memberTotals[who] = (memberTotals[who] || 0) + amt;
              });
            const entries = Object.entries(memberTotals);
            const invitedList = S.sess?.invitedMobs || [];
            const allSplitMobs = Array.from(
              new Set([...invitedList, ...customSplitMobs])
            );

            const buildSplitMsg = (targetMob?: string) => {
              const itemsText = S.menu
                .filter((m) => S.cart[m.id])
                .map((m) => `• ${m.n.en} × ${S.cart[m.id]} (₹${m.p * S.cart[m.id]})`)
                .join('\n');
              const splitLine =
                S.split > 1
                  ? `Split (${S.split} people): *₹${per} per person*`
                  : `Total Bill: *₹${t}*`;
              const friendNote = targetMob
                ? `Hi ${targetMob}, your share is *₹${per}*.\n`
                : '';
              return (
                `🧾 *Tadka Truck — Paid Bill Split*\n` +
                `Counter: ${S.sess?.no || '—'} · Table ${S.activeTable}\n` +
                `Paid by: ${S.sess?.mob || 'Principal'} (${S.pm})\n\n` +
                (itemsText ? `*Items:*\n${itemsText}\n\n` : '') +
                `Total Paid: *₹${t}*\n` +
                `${splitLine}\n` +
                `${friendNote}` +
                `Please settle your share! 🙏`
              );
            };

            const openWhatsAppFor = (mob?: string) => {
              const msg = buildSplitMsg(mob);
              const digits = mob ? mob.replace(/\D/g, '') : '';
              const waUrl = digits
                ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
                : `https://wa.me/?text=${encodeURIComponent(msg)}`;
              window.open(waUrl, '_blank', 'noopener,noreferrer');
              if (mob) {
                setSentWaMobs((prev) =>
                  prev.includes(mob) ? prev : [...prev, mob]
                );
                say(`Opening WhatsApp for ${mob} ✅`);
              } else {
                say('Opening WhatsApp to share split ✅');
              }
            };

            const handleAddFriend = () => {
              const normalized = friendWaMob.trim()
                ? normalizeMobile(friendWaMob, S.cc)
                : '';
              if (!normalized) {
                say('Enter a valid mobile number to add');
                return;
              }
              if (normalized === S.sess?.mob) {
                say('That is your own principal number');
                return;
              }
              if (allSplitMobs.includes(normalized)) {
                say(`${normalized} is already in the split list`);
                return;
              }
              setCustomSplitMobs((prev) => [...prev, normalized]);
              setFriendWaMob('');
              say(`Added ${normalized} to split list ✅`);
            };

            const handleCopySplit = async () => {
              const msg = buildSplitMsg();
              try {
                await navigator.clipboard.writeText(msg);
                say('Split bill copied to clipboard ✅');
              } catch {
                say('Could not copy automatically — use Share on WhatsApp');
              }
            };

            const handlePickFromContacts = async () => {
              const nav = navigator as Navigator & {
                contacts?: {
                  select?: (
                    props: string[],
                    opts?: { multiple?: boolean }
                  ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
                };
              };
              if (!nav.contacts?.select) {
                say(
                  'Phone contact picker is supported on Android Chrome/Edge. On iPhone/Desktop, tap "Share in WhatsApp Group" to pick contacts in WhatsApp.'
                );
                return;
              }
              try {
                const picked = await nav.contacts.select(['name', 'tel'], {
                  multiple: true,
                });
                if (!picked || picked.length === 0) return;
                const newMobs: string[] = [];
                const newNames: Record<string, string> = {};
                for (const c of picked) {
                  const rawTel = c.tel?.[0] || '';
                  const norm = rawTel ? normalizeMobile(rawTel, S.cc) : '';
                  if (
                    norm &&
                    norm !== S.sess?.mob &&
                    !allSplitMobs.includes(norm) &&
                    !newMobs.includes(norm)
                  ) {
                    newMobs.push(norm);
                    if (c.name?.[0]) newNames[norm] = c.name[0];
                  }
                }
                if (newMobs.length > 0) {
                  setCustomSplitMobs((prev) => [...prev, ...newMobs]);
                  setContactNames((prev) => ({ ...prev, ...newNames }));
                  say(`Added ${newMobs.length} contact(s) to split list ✅`);
                } else {
                  say('No new valid mobile numbers found in selected contacts');
                }
              } catch {
                say('Contact selection cancelled');
              }
            };

            return (
              <>
                {(entries.length > 1 || invitedList.length > 0) && (
                  <div
                    style={{
                      borderTop: '1px dashed #5a4690',
                      marginTop: '10px',
                      paddingTop: '8px',
                    }}
                  >
                    <div
                      className="mu"
                      style={{ marginBottom: '4px', fontSize: '12px' }}
                    >
                      👥 Order-wise breakdown:
                    </div>
                    {entries.map(([who, amt]) => (
                      <div key={who} className="line mu">
                        <span>
                          {who === S.sess?.mob
                            ? `${who} (Principal)`
                            : `${who} (Invited)`}
                        </span>
                        <span>₹{amt} (before GST/disc)</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '10px' }}>
                  <div
                    className="mu"
                    style={{ marginBottom: '4px', fontSize: '12px' }}
                  >
                    Add friends&apos; WhatsApp numbers (add 1 or more):
                  </div>
                  <CountryCodeMobileInput
                    id="paid-split-wa"
                    value={friendWaMob}
                    onChange={setFriendWaMob}
                  />
                  <div className="row" style={{ gap: '8px', marginTop: '6px' }}>
                    <button
                      className="btn alt"
                      style={{ flex: 1, marginTop: 0 }}
                      onClick={handleAddFriend}
                    >
                      + Add Friend Number
                    </button>
                    <button
                      className="btn alt"
                      style={{ flex: 1, marginTop: 0 }}
                      onClick={handlePickFromContacts}
                    >
                      📒 Pick from Contacts
                    </button>
                  </div>
                </div>

                {allSplitMobs.length > 0 && (
                  <div
                    style={{
                      marginTop: '10px',
                      paddingTop: '8px',
                      borderTop: '1px dashed #5a4690',
                    }}
                  >
                    <div
                      className="mu"
                      style={{ marginBottom: '6px', fontSize: '12px' }}
                    >
                      Send split ({S.split > 1 ? `₹${per} each` : `₹${t}`}) to
                      each friend:
                    </div>
                    {allSplitMobs.map((m, idx) => {
                      const isSent = sentWaMobs.includes(m);
                      return (
                        <div
                          key={m}
                          className="row sp"
                          style={{
                            background: 'var(--bg)',
                            borderRadius: '10px',
                            padding: '8px 10px',
                            marginBottom: '6px',
                            border: '1px solid #5a4690',
                          }}
                        >
                          <div>
                            <b>
                              {idx + 1}.{' '}
                              {contactNames[m] ? `👤 ${contactNames[m]} · ` : ''}
                              📱 {m}
                            </b>
                            <div className="mu" style={{ fontSize: '11px' }}>
                              Share: ₹{S.split > 1 ? per : t}
                              {isSent ? ' · ✅ Sent' : ''}
                            </div>
                          </div>
                          <div className="row" style={{ gap: '6px' }}>
                            <button
                              className="chip on"
                              style={{ fontSize: '12px' }}
                              onClick={() => openWhatsAppFor(m)}
                            >
                              {isSent ? '↻ Resend' : '📲 Send WA'}
                            </button>
                            {!invitedList.includes(m) && (
                              <button
                                className="chip"
                                style={{ fontSize: '12px' }}
                                onClick={() =>
                                  setCustomSplitMobs((prev) =>
                                    prev.filter((x) => x !== m)
                                  )
                                }
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="row" style={{ gap: '8px', marginTop: '8px' }}>
                  <button
                    className="btn alt"
                    style={{ flex: 1, marginTop: 0 }}
                    onClick={() => openWhatsAppFor()}
                  >
                    📲 Share in WhatsApp Group
                  </button>
                  <button className="chip" onClick={handleCopySplit}>
                    📋 Copy
                  </button>
                </div>
              </>
            );
          })()}
        </div>

        <ReviewAndShareCard />

        <button className="btn ghost" onClick={startNewOrder}>
          Start a new order
        </button>
      </>
    );
  }

  const paymentMethods: PaymentMethod[] = [
    'UPI',
    'Card',
    'Net banking',
    'Cash at counter',
  ];

  const paymentHints: Record<string, string> = {
    UPI: 'GPay, PhonePe, Paytm or any UPI app',
    Card: 'Credit or debit card: Visa, Mastercard, RuPay',
    'Net banking': 'All major Indian banks',
    'Cash at counter': 'Pay the waiter. Your stars still count.',
  };

  const tierLabel = S.pts >= 200 ? '🥇 Gold' : '🥈 Silver';

  return (
    <>
      {S.billSrc === 'waiter' && (
        <div className="wa" style={{ margin: '0 0 10px' }}>
          <b>🧾 Bill from Tadka Truck</b>
          <p>
            Your waiter order for Table {S.activeTable}. Check the items and pay
            below.
          </p>
        </div>
      )}

      <div className="pts">
        <div>
          <div className="mu">Points</div>
          <div className="big">{S.pts}</div>
        </div>
        <div>
          <div className="mu">Tier</div>
          <div className="big">{tierLabel}</div>
        </div>
      </div>

      <p className="mu" style={{ marginTop: '8px' }}>
        {S.pts >= 200
          ? 'Gold tier unlocked! ✨'
          : `${200 - S.pts} points to Gold`}
      </p>
      <div
        className="bar"
        style={{ width: `${Math.min(100, S.pts / 2)}%` }}
      />

      <div className="card">
        {S.menu
          .filter((m) => S.cart[m.id])
          .map((m) => (
            <div key={m.id} className="line">
              <span>
                {m.e} {m.n.en} × {S.cart[m.id]}
              </span>
              <span>₹{m.p * S.cart[m.id]}</span>
            </div>
          ))}
        {(() => {
          const memberTotals: Record<string, number> = {};
          S.orders
            .filter((o) => o.st !== 5)
            .forEach((o) => {
              const who = o.orderedByMob || S.sess?.mob || 'Principal';
              let amt = 0;
              S.menu.forEach((d) => {
                const q = o.it[d.id] || 0;
                if (q > 0) amt += (o.prices?.[d.id] ?? d.p) * q;
              });
              memberTotals[who] = (memberTotals[who] || 0) + amt;
            });
          const entries = Object.entries(memberTotals);
          if (entries.length <= 1 && !(S.sess?.invitedMobs || []).length) {
            return null;
          }
          return (
            <div
              style={{
                borderTop: '1px dashed #5a4690',
                marginTop: '6px',
                paddingTop: '6px',
                marginBottom: '6px',
              }}
            >
              <div className="mu" style={{ marginBottom: '4px' }}>
                👥 Member-wise order breakdown:
              </div>
              {entries.map(([who, amt]) => (
                <div key={who} className="line mu">
                  <span>
                    {who === S.sess?.mob ? `${who} (Principal)` : `${who} (Invited)`}
                  </span>
                  <span>₹{amt}</span>
                </div>
              ))}
            </div>
          );
        })()}
        <div className="line">
          <span>Subtotal</span>
          <span>₹{s}</span>
        </div>
        {S.reel === 'ok' && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>Reel discount</span>
            <span>−₹{Math.round(s * 0.1)}</span>
          </div>
        )}
        {S.review && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>Google review</span>
            <span>−₹50</span>
          </div>
        )}
        <div className="line">
          <span>GST 5%</span>
          <span>₹{g}</span>
        </div>
        <div className="line tot">
          <span>Total</span>
          <span>₹{t}</span>
        </div>
      </div>

      <div className="card">
        <b>Split with friends</b>
        <div className="row" style={{ marginTop: '8px' }}>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={`chip ${S.split === n ? 'on' : ''}`}
              onClick={() => updateState((p) => ({ ...p, split: n }))}
            >
              {n === 1 ? 'Just me' : `${n} people`}
            </button>
          ))}
        </div>
        {S.split > 1 && (
          <p className="mu" style={{ marginTop: '8px' }}>
            Each pays ₹{per}. Friends get a UPI link on WhatsApp.
          </p>
        )}
      </div>

      <ReviewAndShareCard />

      <div className="card">
        <b>Pay with</b>
        <div className="row" style={{ flexWrap: 'wrap', marginTop: '8px' }}>
          {paymentMethods.map((m) => (
            <button
              key={m}
              className={`chip ${S.pm === m ? 'on' : ''}`}
              onClick={() => updateState((p) => ({ ...p, pm: m }))}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mu" style={{ marginTop: '8px' }}>
          {paymentHints[S.pm] || paymentHints.UPI}
        </p>
      </div>

      {S.pm === 'Cash at counter' ? (
        S.cashReq ? (
          <div className="wa">
            <b>⏳ Waiting for the restaurant</b>
            <p>
              Pay the waiter ₹{t}. Once the owner marks it paid, your star and
              receipt appear here.
            </p>
          </div>
        ) : (
          <button
            className="btn"
            onClick={() => updateState((p) => ({ ...p, cashReq: true }))}
          >
            Request waiter to collect ₹{t}
          </button>
        )
      ) : (
        <button className="btn" onClick={() => doPay(S.pm, 'app')}>
          Pay ₹{per} with {S.pm}
        </button>
      )}
    </>
  );
}
