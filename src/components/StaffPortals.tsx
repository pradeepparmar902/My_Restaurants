'use client';

import React, { useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import { StaffRoleName } from '@/types/tadka';
import { ROLE_DESCRIPTIONS } from '@/lib/constants';
import { getSessionRowStatus } from '@/lib/helpers';
import {
  CountryCodeMobileInput,
  TagOfflinePaidWidget,
} from '@/components/SharedWidgets';
import { GoogleStorageAdminCard } from '@/components/GoogleStoragePanel';

export function ChefPortalView() {
  const { S, advanceOrderStatus, toggleOrderRush, toggleDishStock, staffOf, say } =
    useTadka();

  const q = S.orders
    .map((o, i) => ({ o, i }))
    .filter((x) => x.o.st < 3)
    .sort((a, b) => (b.o.rush ? 1 : 0) - (a.o.rush ? 1 : 0));

  const currentStaff = staffOf();
  const canCancel =
    currentStaff?.r === 'Admin' || currentStaff?.r === 'Manager';

  return (
    <>
      <div
        className="hero"
        style={{ background: 'linear-gradient(135deg,#ffb547,#ff8a4c)' }}
      >
        <h1>Kitchen queue</h1>
        <p>
          {q.length
            ? `${q.length} order(s) to cook`
            : 'All clear. Place an order on the Customer tab.'}
        </p>
      </div>

      {q.map(({ o, i }) => (
        <div key={o.id || i} className="card">
          <div className="row sp">
            <h3>
              {S.sess?.no || 'Pending'} · Table {S.activeTable}
            </h3>
            <span className="row">
              {o.vip && <span className="tag vip">VIP</span>}
              {o.rush && <span className="tag hot">RUSH</span>}
              <span className="tag">{o.st === 1 ? 'NEW' : 'COOKING'}</span>
            </span>
          </div>
          <p className="mu" style={{ margin: '6px 0' }}>
            Order {o.k}:{' '}
            {S.menu
              .filter((m) => o.it[m.id])
              .map((m) => `${o.it[m.id]}× ${m.n.en}`)
              .join(', ')}
          </p>
          {o.st === 1 ? (
            <button
              className="btn"
              onClick={() => advanceOrderStatus(i, 2)}
            >
              Start cooking
            </button>
          ) : (
            <button
              className="btn alt"
              onClick={() => advanceOrderStatus(i, 3)}
            >
              Mark ready for waiter
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => toggleOrderRush(i)}
          >
            {o.rush ? 'Remove priority' : '⚡ Rush this order'}
          </button>
          {canCancel && (
            <button
              className="btn ghost"
              style={{ marginTop: '6px', color: '#f87171' }}
              onClick={() => {
                advanceOrderStatus(i, 5);
                say(`Order ${o.k} cancelled`);
              }}
            >
              ✕ Cancel order
            </button>
          )}
        </div>
      ))}

      <h3 style={{ marginTop: '14px' }}>Stock</h3>
      {S.menu.map((m) => (
        <div key={m.id} className="card row sp">
          <span>
            {m.e} {m.n.en}
          </span>
          <button
            className={`chip ${m.available ? 'on' : ''}`}
            onClick={() => toggleDishStock(m.id)}
          >
            {m.available ? 'In stock' : 'Out of stock'}
          </button>
        </div>
      ))}
    </>
  );
}

export function WaiterPortalView() {
  const {
    S,
    setWTab,
    assignNo,
    setNo,
    advanceOrderStatus,
    changeWaiterDraftQty,
    bookWaiter,
  } = useTadka();
  const [wnoInput, setWnoInput] = useState('');
  const [wmobInput, setWmobInput] = useState('');

  const readyCount = S.orders.filter((o) => o.st === 3).length;
  const readyList = S.orders
    .map((o, i) => ({ o, i }))
    .filter((x) => x.o.st === 3);

  const waiterItemCount = Object.values(S.WD).reduce((a, b) => a + b, 0);
  const waiterDraftTotal = S.menu.reduce(
    (a, m) => a + (S.WD[m.id] || 0) * m.p,
    0
  );

  return (
    <>
      <div className="row" style={{ marginBottom: '12px' }}>
        <button
          className={`chip ${S.wtab === 'serve' ? 'on' : ''}`}
          style={{ flex: 1 }}
          onClick={() => setWTab('serve')}
        >
          🛎️ Ready to serve{readyCount ? ` (${readyCount})` : ''}
        </button>
        <button
          className={`chip ${S.wtab === 'book' ? 'on' : ''}`}
          style={{ flex: 1 }}
          onClick={() => setWTab('book')}
        >
          📝 Book order
        </button>
      </div>

      {S.wtab === 'serve' ? (
        <>
          <div
            className="hero"
            style={{ background: 'linear-gradient(135deg,#ff5c8a,#b86bff)' }}
          >
            <h1>Ready to serve</h1>
            <p>
              {readyList.length
                ? `${readyList.length} order(s) waiting`
                : 'Nothing ready right now.'}
            </p>
          </div>

          {S.sess && S.sess.pend && (
            <div className="card">
              <h3>🎟️ Table {S.activeTable} needs a counter number</h3>
              <p className="mu" style={{ margin: '6px 0' }}>
                Give the customer a number, or assign one here. Delivery is
                locked until it is set.
              </p>
              <button className="btn" onClick={assignNo}>
                Assign C{S.ctr}
              </button>
            </div>
          )}

          {readyList.map(({ o, i }) => (
            <div key={o.id || i} className="card">
              <div className="row sp">
                <h2>{S.sess?.no}</h2>
                <span className="tag">Table {S.activeTable}</span>
              </div>
              <p className="mu" style={{ margin: '6px 0' }}>
                Order {o.k}:{' '}
                {S.menu
                  .filter((m) => o.it[m.id])
                  .map((m) => `${o.it[m.id]}× ${m.n.en}`)
                  .join(', ')}
              </p>
              <p className="mu">
                Match this counter number with the customer’s phone before
                serving.
              </p>
              <button
                className="btn alt"
                disabled={!!S.sess?.pend}
                onClick={() => advanceOrderStatus(i, 4)}
              >
                {S.sess?.pend
                  ? 'Set counter number first'
                  : `Mark delivered to ${S.sess?.no}`}
              </button>
            </div>
          ))}

          <h3 style={{ marginTop: '14px' }}>Open counters</h3>
          {S.sess ? (
            <div className="card row sp">
              <span>
                {S.sess.no} · Table {S.activeTable}
              </span>
              <span className="tag">
                {S.orders.filter((o) => o.st === 4).length}/{S.orders.length}{' '}
                delivered
              </span>
            </div>
          ) : (
            <p className="mu">No open counters.</p>
          )}
        </>
      ) : (
        <div className="card">
          <h3>📝 Book order for Table {S.activeTable}</h3>
          <p className="mu">
            Take the order for the customer. It goes to the kitchen and joins
            their session.
          </p>

          {S.menu
            .filter((m) => m.available)
            .map((m) => (
              <div key={m.id} className="row sp" style={{ marginTop: '8px' }}>
                <span>
                  {m.e} {m.n.en} <span className="mu">₹{m.p}</span>
                </span>
                <span className="row">
                  <button
                    className="chip"
                    aria-label="Remove"
                    onClick={() => changeWaiterDraftQty(m.id, -1)}
                  >
                    −
                  </button>
                  <b>{S.WD[m.id] || 0}</b>
                  <button
                    className="chip"
                    aria-label="Add"
                    onClick={() => changeWaiterDraftQty(m.id, 1)}
                  >
                    +
                  </button>
                </span>
              </div>
            ))}

          <div className="line tot">
            <span>{waiterItemCount} items</span>
            <span>₹{waiterDraftTotal}</span>
          </div>

          {S.sess ? (
            S.sess.pend ? (
              <>
                <p style={{ margin: '8px 0' }}>
                  ⏳ Table {S.activeTable} has no counter number yet.
                </p>
                <div className="row">
                  <input
                    id="wno"
                    value={wnoInput}
                    onChange={(e) => setWnoInput(e.target.value)}
                    placeholder="e.g. C27"
                    className="inp"
                  />
                  <button
                    className="chip on"
                    onClick={() => setNo(wnoInput)}
                  >
                    Save
                  </button>
                </div>
                <button className="btn ghost" onClick={assignNo}>
                  Assign C{S.ctr}
                </button>
              </>
            ) : (
              <p className="mu" style={{ margin: '8px 0' }}>
                Adding to counter <b>{S.sess.no}</b>. Same session, same bill.
              </p>
            )
          ) : S.cmode === 'auto' ? (
            <p className="mu" style={{ margin: '8px 0' }}>
              A counter number will be assigned automatically.
            </p>
          ) : (
            <>
              <p className="mu" style={{ margin: '8px 0' }}>
                Manual mode: enter the counter number you gave the customer, or
                leave it blank and set it later.
              </p>
              <input
                id="wno"
                value={wnoInput}
                onChange={(e) => setWnoInput(e.target.value)}
                placeholder="e.g. C27"
                className="inp"
                style={{ width: '100%' }}
              />
            </>
          )}

          {S.sess && S.sess.mob ? (
            <p className="mu" style={{ margin: '8px 0' }}>
              Customer WhatsApp: {S.sess.mob}
            </p>
          ) : (
            <>
              <p className="mu" style={{ margin: '8px 0' }}>
                Customer WhatsApp number with country code (optional). They see
                this order after login, and the final bill goes here.
              </p>
              <CountryCodeMobileInput
                id="wmob"
                value={wmobInput}
                onChange={setWmobInput}
              />
            </>
          )}

          <button
            className="btn"
            disabled={waiterItemCount === 0}
            onClick={() => {
              bookWaiter(wmobInput, wnoInput);
              setWmobInput('');
              setWnoInput('');
            }}
          >
            Book order · ₹{waiterDraftTotal}
          </button>
        </div>
      )}
    </>
  );
}

export function LiveAndPendingBillsCard() {
  const { S, total, pushWaiter, paySamp } = useTadka();
  const live =
    S.sess && !S.paid
      ? [
          {
            id: S.sess.id,
            no: S.sess.pend ? 'Pending' : S.sess.no,
            t: S.activeTable,
            a: total(),
            s: getSessionRowStatus(S),
            mob: S.sess.mob,
            me: true,
            i: -1,
          },
        ]
      : [];

  const rows = [
    ...live,
    ...S.samp.map((x, i) => ({ ...x, me: false, i })),
  ];

  const pendingTotal = rows.reduce((a, x) => a + x.a, 0);
  const paidTodayTotal =
    S.hist.reduce((a, x) => a + x.a, 0) + S.spaid;

  return (
    <div className="card">
      <h3>📋 Live and pending bills</h3>
      <div className="pts" style={{ margin: '8px 0' }}>
        <div>
          <div className="mu">Pending</div>
          <div className="big">₹{pendingTotal}</div>
        </div>
        <div>
          <div className="mu">Paid today</div>
          <div className="big">₹{paidTodayTotal}</div>
        </div>
      </div>

      {rows.length ? (
        rows.map((x, idx) => (
          <div
            key={x.id || idx}
            className="line"
            style={{ alignItems: 'center' }}
          >
            <span>
              {x.no} · Table {x.t}
              <br />
              <span className="mu">
                {x.s}
                {x.mob ? ` · ${x.mob}` : ''}
              </span>
            </span>
            <span className="row">
              <b>₹{x.a}</b>
              {x.me ? (
                S.billSrc ? null : (
                  <button
                    className="chip on"
                    onClick={() => pushWaiter()}
                  >
                    Push bill
                  </button>
                )
              ) : (
                <button
                  className="chip on"
                  onClick={() => paySamp(x.i)}
                >
                  Tag paid
                </button>
              )}
            </span>
          </div>
        ))
      ) : (
        <p className="mu">No open bills.</p>
      )}

      {S.hist.slice(0, 3).map((x, idx) => (
        <div key={x.id || idx} className="line">
          <span className="mu">
            ₹{x.a} · {x.m}
          </span>
          <span className="tag ok">✅ Paid</span>
        </div>
      ))}
    </div>
  );
}

export function CounterNumbersModeCard() {
  const { S, setMode, reissueNumber, assignNo } = useTadka();
  return (
    <div className="card">
      <h3>🎟️ Counter numbers</h3>
      <div className="row" style={{ marginTop: '8px' }}>
        <button
          className={`chip ${S.cmode === 'auto' ? 'on' : ''}`}
          onClick={() => setMode('auto')}
        >
          Auto
        </button>
        <button
          className={`chip ${S.cmode === 'manual' ? 'on' : ''}`}
          onClick={() => setMode('manual')}
        >
          Manual
        </button>
      </div>
      <p className="mu" style={{ marginTop: '8px' }}>
        {S.cmode === 'auto'
          ? 'The app gives every new session the next number (C27, C28…).'
          : 'Staff give each customer a number (waiter, owner or reception). The customer enters it in the app, or staff assign it here.'}
      </p>
      {S.sess && !S.sess.pend && (
        <>
          <p className="mu" style={{ marginTop: '8px' }}>
            Table {S.activeTable} already has {S.sess.no}. The mode applies to
            new sessions.
          </p>
          <button className="btn ghost" onClick={reissueNumber}>
            Re-issue number ({S.cmode})
          </button>
        </>
      )}
      {S.sess && S.sess.pend && (
        <>
          <p style={{ marginTop: '8px' }}>
            ⏳ Table {S.activeTable} is waiting for a number.
          </p>
          <button className="btn" onClick={assignNo}>
            Assign C{S.ctr}
          </button>
        </>
      )}
    </div>
  );
}

export function BillForOpenSessionCard() {
  const { S, total, sub, pushWaiter, cancelWaiter } = useTadka();
  const [omobInput, setOmobInput] = useState('');

  if (S.billSrc !== 'waiter' && S.status && !S.paid && S.cashReq) {
    return (
      <div className="card">
        <h3>🧾 Table {S.activeTable} · cash request</h3>
        <p className="mu">Customer will pay ₹{total()} at the counter.</p>
        <TagOfflinePaidWidget />
      </div>
    );
  }

  if (S.billSrc === 'waiter') {
    return (
      <div className="card">
        <h3>🧾 Bill pushed · Table {S.activeTable}</h3>
        <p style={{ margin: '8px 0' }}>
          {S.paid
            ? `✅ Paid ₹${total()} via ${S.pm}.${
                S.wab
                  ? ` Receipt sent on WhatsApp${
                      S.sess && S.sess.mob
                        ? ` to ${S.sess.mob}`
                        : ' once a number is added'
                    }.`
                  : ' WhatsApp bill is switched off.'
              }`
            : `📲 Bill of ₹${total()} pushed to the customer. Waiting for payment…`}
        </p>
        {!S.paid && (
          <>
            <TagOfflinePaidWidget />
            <button
              className="btn ghost"
              style={{ marginTop: '10px' }}
              onClick={cancelWaiter}
            >
              Recall bill
            </button>
          </>
        )}
      </div>
    );
  }

  const cartItemCount = Object.values(S.cart).reduce((a, b) => a + b, 0);

  return (
    <div className="card">
      <h3>🧾 Bill for open session</h3>
      {S.sess ? (
        <>
          <p className="mu" style={{ margin: '6px 0' }}>
            Counter {S.sess.pend ? 'pending' : S.sess.no} · Table{' '}
            {S.activeTable}
          </p>
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
          <div className="line tot">
            <span>{cartItemCount} items</span>
            <span>₹{sub()}</span>
          </div>
        </>
      ) : (
        <p className="mu">
          No open session. Orders booked by the waiter or the customer appear
          here.
        </p>
      )}

      {S.sess && S.sess.mob ? (
        <p className="mu">Send to: {S.sess.mob} (WhatsApp)</p>
      ) : (
        <>
          <p className="mu" style={{ margin: '8px 0' }}>
            Customer WhatsApp number with country code. They see the bill after
            login.
          </p>
          <CountryCodeMobileInput
            id="omob"
            value={omobInput}
            onChange={setOmobInput}
          />
        </>
      )}

      <button
        className="btn"
        disabled={!S.sess}
        onClick={() => pushWaiter(omobInput)}
      >
        Push bill to customer
      </button>
    </div>
  );
}

export function OwnerPortalView() {
  const { S, updateState, say } = useTadka();

  const bestSellers: [string, number][] = [
    ['Paneer Kathi Roll', 90],
    ['Smash Burger', 70],
    ['Mango Cooler', 55],
  ];

  return (
    <>
      <div
        className="hero"
        style={{ background: 'linear-gradient(135deg,#5cf2c0,#3aa8ff)' }}
      >
        <h1>Today ₹18,420</h1>
        <p>64 orders · 38% repeat customers</p>
      </div>

      <LiveAndPendingBillsCard />
      <CounterNumbersModeCard />
      <BillForOpenSessionCard />

      <div className="card">
        <h3>Reward approvals</h3>
        {S.reel === 'wait' ? (
          <div className="row sp" style={{ marginTop: '8px' }}>
            <span>
              🎬 Table {S.activeTable} reel
              {S.reelCaption ? ` (“${S.reelCaption}”)` : ''}
            </span>
            <button
              className="chip on"
              onClick={() => updateState((p) => ({ ...p, reel: 'ok' }))}
            >
              Approve 10%
            </button>
          </div>
        ) : (
          <p className="mu" style={{ marginTop: '6px' }}>
            Nothing waiting. Upload a reel as a customer to see it here.
          </p>
        )}
      </div>

      <div className="card">
        <h3>Best sellers</h3>
        {bestSellers.map(([n, w]) => (
          <React.Fragment key={n}>
            <div className="mu" style={{ marginTop: '8px' }}>
              {n}
            </div>
            <div className="bar" style={{ width: `${w}%` }} />
          </React.Fragment>
        ))}
      </div>

      <div className="card">
        <h3>Growth this week</h3>
        <div className="line">
          <span>Google reviews</span>
          <b>+{S.review || S.reviewed ? 24 : 23}</b>
        </div>
        <div className="line">
          <span>Reels posted</span>
          <b>+{S.reel === 'ok' ? 12 : 11}</b>
        </div>
        <div className="line">
          <span>Referrals</span>
          <b>+9</b>
        </div>
        <div className="line">
          <span>Coupons used</span>
          <b>31</b>
        </div>
      </div>

      <div className="card">
        <h3>Send WhatsApp offer</h3>
        <p className="mu">Customers who haven’t visited in 30 days</p>
        <button
          className="btn"
          onClick={() => say('Offer sent to 42 customers')}
        >
          Send “We miss you” offer
        </button>
      </div>

      <GoogleStorageAdminCard />
    </>
  );
}

export function AdminPortalView() {
  const {
    S,
    updateState,
    addStaff,
    toggleManagerAccess,
    toggleStaffActive,
    checkLogin,
    saveMenuDish,
    regenerateTableQr,
    setActiveTable,
    resetDemoState,
  } = useTadka();

  const [staffName, setStaffName] = useState('');
  const [staffMob, setStaffMob] = useState('');
  const [checkMob, setCheckMob] = useState('');

  // Menu editor collapsible state
  const [showMenuAdmin, setShowMenuAdmin] = useState(false);
  const [newDishEn, setNewDishEn] = useState('');
  const [newDishHi, setNewDishHi] = useState('');
  const [newDishGu, setNewDishGu] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('100');
  const [newDishEmoji, setNewDishEmoji] = useState('🍲');
  const [newDishVeg, setNewDishVeg] = useState(true);

  const [showQrAdmin, setShowQrAdmin] = useState(false);

  const assignableRoles: StaffRoleName[] = [
    'Manager',
    'Chef',
    'Waiter',
    'Reception',
  ];

  return (
    <>
      <div
        className="hero"
        style={{ background: 'linear-gradient(135deg,#b86bff,#ff5c8a)' }}
      >
        <h1>Access control</h1>
        <p>
          Admin gives each person a role. Everyone else sees only the customer
          portal.
        </p>
      </div>

      <div className="card">
        <h3>Team</h3>
        {S.staff.map((x, i) => (
          <div
            key={x.id || x.ph}
            style={{ marginTop: '12px', opacity: x.on ? 1 : 0.5 }}
          >
            <div className="row sp">
              <b>{x.n}</b>
              <span className={`tag ${x.r === 'Admin' ? 'hot' : ''}`}>
                {x.r}
              </span>
            </div>
            <div className="mu">{x.ph}</div>
            <div className="mu">
              {x.r === 'Manager' && x.mg
                ? ROLE_DESCRIPTIONS.Admin
                : ROLE_DESCRIPTIONS[x.r]}
            </div>
            {x.r !== 'Admin' && (
              <div
                className="row"
                style={{ marginTop: '6px', flexWrap: 'wrap' }}
              >
                {x.r === 'Manager' && (
                  <button
                    className={`chip ${x.mg ? 'on' : ''}`}
                    onClick={() => toggleManagerAccess(i)}
                  >
                    Can manage access: {x.mg ? 'On' : 'Off'}
                  </button>
                )}
                <button
                  className="chip"
                  onClick={() => toggleStaffActive(i)}
                >
                  {x.on ? 'Remove access' : 'Restore access'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Give access</h3>
        <p className="mu" style={{ margin: '6px 0 8px' }}>
          Enter their mobile number. They log in with it and see their portal.
        </p>
        <div className="row" style={{ marginBottom: '8px' }}>
          <input
            id="asn"
            value={staffName}
            onChange={(e) => setStaffName(e.target.value)}
            placeholder="Name"
            className="inp"
          />
        </div>
        <CountryCodeMobileInput
          id="asph"
          value={staffMob}
          onChange={setStaffMob}
        />
        <div className="row" style={{ flexWrap: 'wrap', margin: '8px 0' }}>
          {assignableRoles.map((r) => (
            <button
              key={r}
              className={`chip ${S.sf === r ? 'on' : ''}`}
              onClick={() => updateState((p) => ({ ...p, sf: r }))}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="mu">{ROLE_DESCRIPTIONS[S.sf]}</p>
        <button
          className="btn"
          onClick={() => {
            addStaff(staffName, staffMob);
            setStaffName('');
            setStaffMob('');
          }}
        >
          Give access
        </button>
      </div>

      <div className="card">
        <h3>💬 Final bill on WhatsApp</h3>
        <div className="row" style={{ marginTop: '8px' }}>
          <button
            className={`chip ${S.wab ? 'on' : ''}`}
            onClick={() => updateState((p) => ({ ...p, wab: true }))}
          >
            Yes, send
          </button>
          <button
            className={`chip ${!S.wab ? 'on' : ''}`}
            onClick={() => updateState((p) => ({ ...p, wab: false }))}
          >
            No, don’t send
          </button>
        </div>
        <p className="mu" style={{ marginTop: '8px' }}>
          {S.wab
            ? 'After payment, customers who gave their WhatsApp number get the final bill.'
            : 'No bill is sent on WhatsApp. Customers still see it in the app.'}
        </p>
      </div>

      <div className="card">
        <h3>What happens at login?</h3>
        <p className="mu" style={{ margin: '6px 0 8px' }}>
          Try a number to see which portal opens.
        </p>
        <CountryCodeMobileInput
          id="alg"
          value={checkMob}
          onChange={setCheckMob}
        />
        <button className="btn ghost" onClick={() => checkLogin(checkMob)}>
          Check
        </button>
        {S.alr && <p style={{ marginTop: '8px' }}>{S.alr}</p>}
      </div>

      <div className="card">
        <div className="row sp">
          <h3>🍽️ Menu Admin</h3>
          <button
            className="chip"
            onClick={() => setShowMenuAdmin((prev) => !prev)}
          >
            {showMenuAdmin ? 'Close' : 'Manage dishes'}
          </button>
        </div>
        {showMenuAdmin && (
          <div style={{ marginTop: '10px' }}>
            {S.menu.map((m) => (
              <div key={m.id} className="line" style={{ alignItems: 'center' }}>
                <span>
                  {m.e} {m.n.en} (₹{m.p})
                </span>
                <div className="row">
                  <button
                    className="chip"
                    onClick={() =>
                      saveMenuDish({ id: m.id, p: Math.max(10, m.p - 10) })
                    }
                  >
                    −₹10
                  </button>
                  <button
                    className="chip"
                    onClick={() => saveMenuDish({ id: m.id, p: m.p + 10 })}
                  >
                    +₹10
                  </button>
                </div>
              </div>
            ))}
            <div
              style={{
                borderTop: '1px dashed #5a4690',
                marginTop: '10px',
                paddingTop: '10px',
              }}
            >
              <b>Add new dish</b>
              <div className="row" style={{ marginTop: '6px' }}>
                <input
                  value={newDishEmoji}
                  onChange={(e) => setNewDishEmoji(e.target.value)}
                  placeholder="🍲"
                  className="inp"
                  style={{ maxWidth: '58px' }}
                />
                <input
                  value={newDishEn}
                  onChange={(e) => setNewDishEn(e.target.value)}
                  placeholder="English name"
                  className="inp"
                />
              </div>
              <div className="row" style={{ marginTop: '6px' }}>
                <input
                  value={newDishHi}
                  onChange={(e) => setNewDishHi(e.target.value)}
                  placeholder="Hindi name (optional)"
                  className="inp"
                />
                <input
                  value={newDishGu}
                  onChange={(e) => setNewDishGu(e.target.value)}
                  placeholder="Gujarati name (optional)"
                  className="inp"
                />
              </div>
              <div className="row" style={{ marginTop: '6px' }}>
                <input
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(e.target.value)}
                  placeholder="Price ₹"
                  inputMode="numeric"
                  className="inp"
                />
                <button
                  className={`chip ${newDishVeg ? 'on' : ''}`}
                  onClick={() => setNewDishVeg((v) => !v)}
                >
                  {newDishVeg ? '🌱 Veg' : '🍗 Non-Veg'}
                </button>
              </div>
              <button
                className="btn alt"
                disabled={!newDishEn.trim()}
                onClick={() => {
                  saveMenuDish({
                    e: newDishEmoji || '🍲',
                    p: Number(newDishPrice) || 100,
                    v: newDishVeg ? 1 : 0,
                    available: true,
                    n: {
                      en: newDishEn.trim(),
                      hi: newDishHi.trim() || newDishEn.trim(),
                      gu: newDishGu.trim() || newDishEn.trim(),
                    },
                  });
                  setNewDishEn('');
                  setNewDishHi('');
                  setNewDishGu('');
                }}
              >
                + Add Dish to Menu
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="row sp">
          <h3>📱 Table QR Codes</h3>
          <button
            className="chip"
            onClick={() => setShowQrAdmin((prev) => !prev)}
          >
            {showQrAdmin ? 'Close' : 'View tables'}
          </button>
        </div>
        {showQrAdmin && (
          <div style={{ marginTop: '10px' }}>
            {S.tables.map((t) => (
              <div
                key={t.id}
                className="line"
                style={{ alignItems: 'center' }}
              >
                <span>
                  <b>{t.label}</b>
                  <br />
                  <span className="mu">/r/tadka-truck/t/{t.token}</span>
                </span>
                <div className="row">
                  <button
                    className={`chip ${S.activeTable === t.id ? 'on' : ''}`}
                    onClick={() => setActiveTable(t.id)}
                  >
                    {S.activeTable === t.id ? 'Active' : 'Switch'}
                  </button>
                  <button
                    className="chip"
                    onClick={() => regenerateTableQr(t.id)}
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <GoogleStorageAdminCard />

      <div className="card">
        <div className="row sp">
          <span className="mu">Reset prototype / demo state</span>
          <button className="chip" onClick={resetDemoState}>
            Reset All
          </button>
        </div>
      </div>
    </>
  );
}
