'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import { StaffRoleName } from '@/types/tadka';
import { ORDER_STATUS_LABELS, ROLE_DESCRIPTIONS } from '@/lib/constants';
import {
  getCurrentBusinessDate,
  getDiscount,
  getSessionRowStatus,
  getSubtotal,
  getTotal,
} from '@/lib/helpers';
import {
  CountryCodeMobileInput,
  TagOfflinePaidWidget,
} from '@/components/SharedWidgets';
import { GoogleStorageAdminCard } from '@/components/GoogleStoragePanel';

export function ChefPortalView() {
  const {
    S,
    sheetOrdersToday,
    updateSheetOrderStatus,
    toggleSheetOrderRush,
    pullFromGoogleSheets,
    toggleDishStock,
    staffOf,
    say,
  } = useTadka();
  const pullRef = useRef(pullFromGoogleSheets);
  pullRef.current = pullFromGoogleSheets;

  useEffect(() => {
    pullRef.current(undefined, true);
    const id = setInterval(() => {
      pullRef.current(undefined, true);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  // Combine live Google Sheet orders for today + any local S.orders not yet synced
  const combinedQueue = (() => {
    const map = new Map<
      string,
      {
        id: string;
        counterNo: string;
        table: number;
        round: number;
        mob: string;
        it: Record<number, number>;
        st: 1 | 2 | 3 | 4 | 5;
        vip: boolean;
        rush: boolean;
      }
    >();

    sheetOrdersToday.forEach((po) => {
      map.set(po.id, {
        id: po.id,
        counterNo: po.counterNo || 'Pending',
        table: po.table || 1,
        round: po.round || 1,
        mob: po.orderedByMob || po.principalMob || 'Guest',
        it: po.it,
        st: po.st,
        vip: po.vip,
        rush: po.rush,
      });
    });

    S.orders.forEach((o) => {
      if (!map.has(o.id)) {
        map.set(o.id, {
          id: o.id,
          counterNo: S.sess?.no || 'Pending',
          table: S.activeTable,
          round: o.k,
          mob: o.orderedByMob || S.sess?.mob || 'Guest',
          it: o.it,
          st: o.st,
          vip: Boolean(o.vip),
          rush: Boolean(o.rush),
        });
      }
    });

    return Array.from(map.values())
      .filter((x) => x.st < 3)
      .sort((a, b) => (b.rush ? 1 : 0) - (a.rush ? 1 : 0));
  })();

  const currentStaff = staffOf();
  const canCancel =
    currentStaff?.r === 'Admin' || currentStaff?.r === 'Manager';

  return (
    <>
      <div
        className="hero"
        style={{ background: 'linear-gradient(135deg,#ffb547,#ff8a4c)' }}
      >
        <div className="row sp">
          <h1 style={{ margin: 0 }}>Kitchen queue</h1>
          <button
            className="chip"
            style={{ background: 'rgba(0,0,0,0.22)', color: '#fff' }}
            onClick={() => pullFromGoogleSheets()}
          >
            🔄 Refresh
          </button>
        </div>
        <p>
          {combinedQueue.length
            ? `${combinedQueue.length} order(s) to cook across all tables`
            : 'All clear. New customer orders appear here automatically.'}
        </p>
      </div>

      {combinedQueue.map((o) => (
        <div key={o.id} className="card">
          <div className="row sp">
            <h3>
              {o.counterNo} · Table {o.table}
            </h3>
            <span className="row">
              {o.vip && <span className="tag vip">VIP</span>}
              {o.rush && <span className="tag hot">RUSH</span>}
              <span className="tag">{o.st === 1 ? 'NEW' : 'COOKING'}</span>
            </span>
          </div>
          <p className="mu" style={{ margin: '4px 0', fontSize: '12px' }}>
            📱 {o.mob} · Round {o.round}
          </p>
          <p className="mu" style={{ margin: '6px 0' }}>
            Order {o.round}:{' '}
            {S.menu
              .filter((m) => o.it[m.id])
              .map((m) => `${o.it[m.id]}× ${m.n.en}`)
              .join(', ')}
          </p>
          {o.st === 1 ? (
            <button
              className="btn"
              onClick={() => {
                updateSheetOrderStatus(o.id, 2);
                say(`${o.counterNo} Order ${o.round} -> Cooking 🍳`);
              }}
            >
              Start cooking
            </button>
          ) : (
            <button
              className="btn alt"
              onClick={() => {
                updateSheetOrderStatus(o.id, 3);
                say(`${o.counterNo} Order ${o.round} -> Ready for waiter 🛎️`);
              }}
            >
              Mark ready for waiter
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() => toggleSheetOrderRush(o.id)}
          >
            {o.rush ? 'Remove priority' : '⚡ Rush this order'}
          </button>
          {canCancel && (
            <button
              className="btn ghost"
              style={{ marginTop: '6px', color: '#f87171' }}
              onClick={() => {
                updateSheetOrderStatus(o.id, 5);
                say(`Order ${o.round} cancelled`);
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
    sheetOrdersToday,
    updateSheetOrderStatus,
    pullFromGoogleSheets,
    setWTab,
    setActiveTable,
    addTable,
    assignNo,
    setNo,
    changeWaiterDraftQty,
    bookWaiter,
    updateWorkspaceTable,
    updateOrderItemQty,
    say,
  } = useTadka();
  const [wnoInput, setWnoInput] = useState('');
  const [wmobInput, setWmobInput] = useState('');
  const [manualTableInput, setManualTableInput] = useState('');
  const [selectedWorkspaceCounter, setSelectedWorkspaceCounter] = useState<string | null>(null);
  const [showEditWsTable, setShowEditWsTable] = useState(false);
  const [editWsTableInput, setEditWsTableInput] = useState('');
  const pullRef = useRef(pullFromGoogleSheets);
  pullRef.current = pullFromGoogleSheets;

  useEffect(() => {
    pullRef.current(undefined, true);
    const id = setInterval(() => {
      pullRef.current(undefined, true);
    }, 8000);
    return () => clearInterval(id);
  }, []);

  const readyList = (() => {
    const map = new Map<
      string,
      {
        id: string;
        counterNo: string;
        table: number;
        round: number;
        it: Record<number, number>;
        st: 1 | 2 | 3 | 4 | 5;
      }
    >();
    sheetOrdersToday.forEach((po) => {
      map.set(po.id, {
        id: po.id,
        counterNo: po.counterNo || 'Pending',
        table: po.table || 1,
        round: po.round || 1,
        it: po.it,
        st: po.st,
      });
    });
    S.orders.forEach((o) => {
      if (!map.has(o.id)) {
        map.set(o.id, {
          id: o.id,
          counterNo: S.sess?.no || 'Pending',
          table: S.activeTable,
          round: o.k,
          it: o.it,
          st: o.st,
        });
      }
    });
    return Array.from(map.values()).filter((x) => x.st === 3);
  })();
  const readyCount = readyList.length;

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

          {readyList.map((o) => {
            const isPend = o.counterNo === 'Pending';
            return (
              <div key={o.id} className="card">
                <div className="row sp">
                  <h2>{o.counterNo}</h2>
                  <span className="tag">Table {o.table}</span>
                </div>
                <p className="mu" style={{ margin: '6px 0' }}>
                  Order {o.round}:{' '}
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
                  disabled={isPend}
                  onClick={() => {
                    updateSheetOrderStatus(o.id, 4);
                    say(`${o.counterNo} Order ${o.round} delivered ✅`);
                  }}
                >
                  {isPend
                    ? 'Set counter number first'
                    : `Mark delivered to ${o.counterNo}`}
                </button>
              </div>
            );
          })}

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
        (() => {
          type WorkspaceOrder = {
            id: string;
            round: number;
            itemsText: string;
            amt: number;
            status: string;
            st: 1 | 2 | 3 | 4 | 5;
            it: Record<number, number>;
            prices?: Record<number, number>;
          };
          type WorkspaceBox = {
            counterNo: string;
            table: number;
            mob: string;
            orders: WorkspaceOrder[];
            totalAmt: number;
          };

          const wsMap = new Map<string, WorkspaceBox>();

          const addOrderToWs = (
            counterNo: string,
            table: number,
            mob: string,
            ord: WorkspaceOrder
          ) => {
            if (!counterNo || counterNo === 'Pending') return;
            const existing = wsMap.get(counterNo) || {
              counterNo,
              table,
              mob: mob || 'Guest',
              orders: [],
              totalAmt: 0,
            };
            if (existing.orders.some((o) => o.id === ord.id)) return;
            existing.orders.push(ord);
            existing.totalAmt += ord.amt;
            if ((!existing.mob || existing.mob === 'Guest') && mob) {
              existing.mob = mob;
            }
            wsMap.set(counterNo, existing);
          };

          sheetOrdersToday
            .filter((po) => po.billStatus !== 'PAID' && po.st !== 5)
            .forEach((po) => {
              const itemsText =
                po.itemsRaw ||
                S.menu
                  .filter((m) => po.it[m.id])
                  .map((m) => `${po.it[m.id]}× ${m.n.en}`)
                  .join(', ');
              const amt =
                po.amountInr ||
                S.menu.reduce(
                  (sum, m) => sum + (po.prices?.[m.id] ?? m.p) * (po.it[m.id] || 0),
                  0
                );
              addOrderToWs(po.counterNo, po.table, po.principalMob || po.orderedByMob, {
                id: po.id,
                round: po.round,
                itemsText,
                amt,
                status: ORDER_STATUS_LABELS[po.st] || String(po.st),
                st: po.st,
                it: po.it,
                prices: po.prices,
              });
            });

          const addSnapToWs = (snap: {
            sess: typeof S.sess;
            paid: boolean;
            orders: typeof S.orders;
          }) => {
            if (!snap.sess || snap.paid || snap.sess.status === 'paid') return;
            const cno = snap.sess.no;
            snap.orders
              .filter((o) => o.st !== 5)
              .forEach((o) => {
                const itemsText = S.menu
                  .filter((m) => o.it[m.id])
                  .map((m) => `${o.it[m.id]}× ${m.n.en}`)
                  .join(', ');
                const amt = S.menu.reduce(
                  (sum, m) => sum + (o.prices?.[m.id] ?? m.p) * (o.it[m.id] || 0),
                  0
                );
                addOrderToWs(
                  cno,
                  snap.sess!.table,
                  snap.sess!.mob || o.orderedByMob || 'Guest',
                  {
                    id: o.id,
                    round: o.k,
                    itemsText,
                    amt,
                    status: ORDER_STATUS_LABELS[o.st] || String(o.st),
                    st: o.st,
                    it: o.it,
                    prices: o.prices,
                  }
                );
              });
          };

          Object.values(S.sessionsByUser || {}).forEach((snap) =>
            addSnapToWs(snap)
          );
          if (S.sess) {
            addSnapToWs({ sess: S.sess, paid: S.paid, orders: S.orders });
          }

          const workspaces = Array.from(wsMap.values()).sort((a, b) =>
            b.counterNo.localeCompare(a.counterNo, undefined, { numeric: true })
          );
          const selectedWs = selectedWorkspaceCounter
            ? workspaces.find((w) => w.counterNo === selectedWorkspaceCounter) ||
              null
            : null;

          const renderWsBox = (ws: WorkspaceBox) => {
            const isSelected = selectedWs?.counterNo === ws.counterNo;
            return (
              <button
                key={ws.counterNo}
                type="button"
                onClick={() => {
                  if (isSelected) {
                    setSelectedWorkspaceCounter(null);
                  } else {
                    setSelectedWorkspaceCounter(ws.counterNo);
                    setActiveTable(ws.table);
                  }
                }}
                style={{
                  textAlign: 'left',
                  padding: '10px',
                  borderRadius: '12px',
                  border: isSelected
                    ? '2px solid #5cf2c0'
                    : '1px solid #5a4690',
                  background: isSelected
                    ? 'rgba(92,242,192,0.14)'
                    : 'var(--bg)',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                <div className="row sp">
                  <b style={{ fontSize: '14px' }}>{ws.counterNo}</b>
                  <span className="tag" style={{ fontSize: '10px' }}>
                    T{ws.table}
                  </span>
                </div>
                <div
                  className="mu"
                  style={{
                    fontSize: '11px',
                    marginTop: '3px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  📱 {ws.mob}
                </div>
                <div style={{ fontSize: '12px', marginTop: '3px' }}>
                  {ws.orders.length} order{ws.orders.length === 1 ? '' : 's'} ·{' '}
                  <b>₹{ws.totalAmt}</b>
                </div>
              </button>
            );
          };

          const renderBookingForm = () => (
            <div>
              <h3 style={{ marginTop: selectedWs ? '10px' : 0 }}>
                {selectedWs
                  ? `➕ Add Another Order to ${selectedWs.counterNo} (Table ${selectedWs.table})`
                  : `📝 Book New Order (Table ${S.activeTable})`}
              </h3>

              {!selectedWs && (
                <>
                  <div
                    className="row"
                    style={{ flexWrap: 'wrap', gap: '6px', margin: '8px 0 6px' }}
                  >
                    {S.tables.map((t) => (
                      <button
                        key={t.id}
                        className={`chip ${S.activeTable === t.id ? 'on' : ''}`}
                        style={{ fontSize: '12px' }}
                        onClick={() => setActiveTable(t.id)}
                      >
                        🪑 {t.label || `Table ${t.id}`}
                      </button>
                    ))}
                  </div>
                  <div className="row" style={{ gap: '6px', marginBottom: '10px' }}>
                    <input
                      id="waiter-manual-table"
                      value={manualTableInput}
                      onChange={(e) => setManualTableInput(e.target.value)}
                      placeholder="Add/select table # (e.g. 5 or VIP 2)"
                      className="inp"
                      style={{ flex: 1, fontSize: '12px', padding: '7px 10px' }}
                    />
                    <button
                      type="button"
                      className="chip on"
                      style={{ fontSize: '12px' }}
                      onClick={() => {
                        const raw = manualTableInput.trim();
                        if (!raw) {
                          say('Enter a table number or name');
                          return;
                        }
                        const numMatch = raw.match(/^(?:table\s*)?(\d+)$/i);
                        if (numMatch) {
                          const num = Number(numMatch[1]);
                          if (num <= 0) {
                            say('Table number must be greater than 0');
                            return;
                          }
                          if (!S.tables.some((t) => t.id === num)) {
                            addTable('', num);
                          }
                          setActiveTable(num);
                        } else {
                          const existing = S.tables.find(
                            (t) => t.label.toLowerCase() === raw.toLowerCase()
                          );
                          if (existing) {
                            setActiveTable(existing.id);
                          } else {
                            const nextId =
                              Math.max(0, ...S.tables.map((t) => t.id)) + 1;
                            addTable(raw, nextId);
                            setActiveTable(nextId);
                          }
                        }
                        setManualTableInput('');
                      }}
                    >
                      + Set Table
                    </button>
                  </div>
                </>
              )}

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

              {!selectedWs && S.cmode !== 'auto' && (
                <>
                  <p className="mu" style={{ margin: '8px 0' }}>
                    Manual mode: enter the counter number you gave the customer,
                    or leave blank to set it later.
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

              {!selectedWs && (
                <>
                  <p className="mu" style={{ margin: '8px 0 6px' }}>
                    Customer WhatsApp / Mobile number (optional — for order
                    tracking &amp; final bill):
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
                  bookWaiter(
                    selectedWs
                      ? selectedWs.mob === 'Guest'
                        ? ''
                        : selectedWs.mob
                      : wmobInput,
                    wnoInput,
                    selectedWs ? selectedWs.counterNo : null
                  );
                  setWmobInput('');
                  setWnoInput('');
                }}
              >
                {selectedWs
                  ? `➕ Add to ${selectedWs.counterNo} · ₹${waiterDraftTotal}`
                  : `🆕 Book New Order · ₹${waiterDraftTotal}`}
              </button>
            </div>
          );

          const otherWorkspaces = selectedWs
            ? workspaces.filter((w) => w.counterNo !== selectedWs.counterNo)
            : workspaces;

          return (
            <>
              <div className="card">
                <div className="row sp">
                  <h3 style={{ margin: 0 }}>🗂️ Active Order Workspaces</h3>
                  <span className="mu" style={{ fontSize: '12px' }}>
                    {workspaces.length} open
                  </span>
                </div>
                <p className="mu" style={{ margin: '4px 0 10px', fontSize: '12px' }}>
                  Tap any counter box to view its orders &amp; add another round
                  right there, or tap &ldquo;+ New Order&rdquo;.
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '8px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedWorkspaceCounter(null)}
                    style={{
                      textAlign: 'left',
                      padding: '10px',
                      borderRadius: '12px',
                      border:
                        selectedWs === null
                          ? '2px solid #5cf2c0'
                          : '1px solid #5a4690',
                      background:
                        selectedWs === null
                          ? 'rgba(92,242,192,0.14)'
                          : 'var(--bg)',
                      color: 'inherit',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>
                      🆕 + New Order
                    </div>
                    <div className="mu" style={{ fontSize: '11px', marginTop: '4px' }}>
                      Fresh customer &amp; counter
                    </div>
                  </button>

                  {selectedWs && renderWsBox(selectedWs)}

                  {selectedWs && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: '12px',
                        borderRadius: '12px',
                        background: 'rgba(92,242,192,0.06)',
                        border: '1px solid #5cf2c0',
                      }}
                    >
                      <div className="row sp">
                        <h3 style={{ margin: 0 }}>
                          📋 {selectedWs.counterNo} · Table {selectedWs.table}
                        </h3>
                        <div className="row" style={{ gap: '6px' }}>
                          <button
                            className="chip"
                            style={{ fontSize: '11px' }}
                            onClick={() => {
                              setShowEditWsTable((prev) => !prev);
                              setEditWsTableInput(String(selectedWs.table));
                            }}
                          >
                            ✏️ Edit Table
                          </button>
                          <button
                            className="chip"
                            style={{ fontSize: '11px' }}
                            onClick={() => {
                              setSelectedWorkspaceCounter(null);
                              setShowEditWsTable(false);
                            }}
                          >
                            ✕ Close
                          </button>
                        </div>
                      </div>
                      {showEditWsTable && (
                        <div className="row" style={{ gap: '6px', marginTop: '8px' }}>
                          <input
                            value={editWsTableInput}
                            onChange={(e) => setEditWsTableInput(e.target.value)}
                            placeholder="New table # (e.g. 5)"
                            className="inp"
                            style={{ flex: 1, fontSize: '12px', padding: '6px 10px' }}
                          />
                          <button
                            type="button"
                            className="chip on"
                            style={{ fontSize: '12px' }}
                            onClick={() => {
                              const num = Number(
                                editWsTableInput.replace(/[^\d]/g, '')
                              );
                              if (!num || num <= 0) {
                                say('Enter a valid table number');
                                return;
                              }
                              if (!S.tables.some((t) => t.id === num)) {
                                addTable('', num);
                              }
                              updateWorkspaceTable(selectedWs.counterNo, num);
                              setShowEditWsTable(false);
                            }}
                          >
                            Save Table
                          </button>
                        </div>
                      )}
                      <p
                        className="mu"
                        style={{ margin: '4px 0 8px', fontSize: '12px' }}
                      >
                        Customer: <b>📱 {selectedWs.mob}</b> · Total:{' '}
                        <b>₹{selectedWs.totalAmt}</b>
                      </p>
                      {selectedWs.orders.map((ord) => {
                        const isEditable = ord.st === 1;
                        return (
                          <div
                            key={ord.id}
                            style={{
                              padding: '8px',
                              borderRadius: '10px',
                              background: 'var(--bg)',
                              border: '1px solid #382562',
                              marginBottom: '6px',
                            }}
                          >
                            <div className="row sp">
                              <b>Order {ord.round}</b>
                              <div className="row" style={{ gap: '6px' }}>
                                <span className="tag" style={{ fontSize: '11px' }}>
                                  {ord.status}
                                </span>
                                {isEditable && (
                                  <button
                                    type="button"
                                    className="chip"
                                    style={{
                                      fontSize: '11px',
                                      color: '#f87171',
                                      borderColor: '#f87171',
                                    }}
                                    onClick={() => {
                                      updateSheetOrderStatus(ord.id, 5);
                                      say(`Order ${ord.round} deleted`);
                                    }}
                                  >
                                    🗑 Delete
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditable ? (
                              <div style={{ marginTop: '6px' }}>
                                {S.menu
                                  .filter((m) => (ord.it[m.id] || 0) > 0)
                                  .map((m) => {
                                    const q = ord.it[m.id] || 0;
                                    const price = ord.prices?.[m.id] ?? m.p;
                                    return (
                                      <div
                                        key={m.id}
                                        className="row sp"
                                        style={{
                                          marginTop: '4px',
                                          fontSize: '13px',
                                        }}
                                      >
                                        <span>
                                          {m.e} {m.n.en} (₹{price * q})
                                        </span>
                                        <span className="row" style={{ gap: '4px' }}>
                                          <button
                                            type="button"
                                            className="chip"
                                            style={{
                                              padding: '2px 8px',
                                              fontSize: '12px',
                                            }}
                                            onClick={() =>
                                              updateOrderItemQty(ord.id, m.id, -1)
                                            }
                                          >
                                            −
                                          </button>
                                          <b>{q}</b>
                                          <button
                                            type="button"
                                            className="chip"
                                            style={{
                                              padding: '2px 8px',
                                              fontSize: '12px',
                                            }}
                                            onClick={() =>
                                              updateOrderItemQty(ord.id, m.id, 1)
                                            }
                                          >
                                            +
                                          </button>
                                        </span>
                                      </div>
                                    );
                                  })}
                              </div>
                            ) : (
                              <>
                                <div
                                  className="line"
                                  style={{ marginTop: '4px', fontSize: '13px' }}
                                >
                                  <span>{ord.itemsText}</span>
                                  <span>₹{ord.amt}</span>
                                </div>
                                <div
                                  className="mu"
                                  style={{ fontSize: '11px', marginTop: '2px' }}
                                >
                                  🔒 In kitchen ({ord.status}) — cannot edit/delete
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}

                      <div
                        style={{
                          marginTop: '10px',
                          paddingTop: '10px',
                          borderTop: '1px dashed #5a4690',
                        }}
                      >
                        {renderBookingForm()}
                      </div>
                    </div>
                  )}

                  {otherWorkspaces.map((ws) => renderWsBox(ws))}
                </div>
              </div>

              {!selectedWs && <div className="card">{renderBookingForm()}</div>}
            </>
          );
        })()
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
            mob: S.sess.mob || S.me.mob,
            me: true,
            i: -1,
          },
        ]
      : [];

  // Also include open sessions from other logged-in customer accounts stored in sessionsByUser
  const otherUserOpenRows = Object.entries(S.sessionsByUser || {})
    .filter(
      ([mobKey, snap]) =>
        snap.sess &&
        !snap.paid &&
        snap.sess.id !== S.sess?.id &&
        mobKey !== '__guest__'
    )
    .map(([mobKey, snap], idx) => {
      const subVal = getSubtotal(S.menu, snap.cart);
      const discVal = getDiscount(subVal, snap.reel, snap.review);
      const totVal = getTotal(subVal, discVal);
      return {
        id: snap.sess!.id,
        no: snap.sess!.pend ? 'Pending' : snap.sess!.no,
        t: snap.sess!.table || S.activeTable,
        a: totVal,
        s: snap.billSrc === 'waiter' ? 'Bill pushed' : 'In kitchen',
        mob: snap.sess!.mob || mobKey,
        me: false,
        i: -100 - idx,
      };
    });

  const rows = [
    ...live,
    ...otherUserOpenRows,
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
  const { S, setMode, reissueNumber, assignNo, updateState, say } = useTadka();
  const bizDate = S.counterBusinessDate || getCurrentBusinessDate();

  return (
    <div className="card">
      <div className="row sp">
        <h3>🎟️ Day-wise Counter Numbers</h3>
        <span className="tag ok">📅 {bizDate}</span>
      </div>
      <div className="row sp" style={{ marginTop: '6px' }}>
        <span className="mu">
          Next Auto Counter: <b>C{S.ctr}</b> · Issued today:{' '}
          <b>{S.usedCountersToday?.length || 0}</b>
        </span>
        <button
          className="chip"
          style={{ fontSize: '12px', padding: '4px 10px' }}
          onClick={() => {
            const today = getCurrentBusinessDate();
            updateState((p) => ({
              ...p,
              ctr: 1,
              counterBusinessDate: today,
              usedCountersToday: [],
            }));
            say(`Reset counter sequence to C1 for ${today} ✅`);
          }}
        >
          🔄 Reset Day to C1
        </button>
      </div>
      <div className="row" style={{ marginTop: '8px' }}>
        <button
          className={`chip ${S.cmode === 'auto' ? 'on' : ''}`}
          onClick={() => setMode('auto')}
        >
          Auto (C1, C2…)
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
          ? `Automatically assigns C1, C2, C3… per business day (${bizDate}, resets at 4 AM). Next up: C${S.ctr}.`
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

function CollapsibleSection({
  title,
  badge,
  isOpen,
  onToggle,
  wrapInCard = true,
  children,
}: {
  title: string;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  wrapInCard?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <button
        type="button"
        onClick={onToggle}
        className="row sp"
        style={{
          width: '100%',
          background: 'none',
          border: 0,
          color: 'inherit',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          font: 'inherit',
        }}
      >
        <span className="row" style={{ gap: '8px' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          {badge && (
            <span className="tag" style={{ fontSize: '11px' }}>
              {badge}
            </span>
          )}
        </span>
        <span className="chip" style={{ fontSize: '11px', padding: '3px 9px' }}>
          {isOpen ? '▲ Collapse' : '▼ Expand'}
        </span>
      </button>
      {isOpen && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: wrapInCard ? '10px' : 0,
            borderTop: wrapInCard ? '1px dashed #382562' : 'none',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function OwnerPortalView() {
  const { S, sheetOrdersToday, updateState, say } = useTadka();
  const [offerMsg, setOfferMsg] = useState(
    '🔥 We miss you at Tadka Truck! Show this WhatsApp message today for 15% OFF your order + a free Gulab Jamun! 🍮'
  );
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    bills: true,
    counter: false,
    openSession: false,
    rewards: false,
    bestsellers: false,
    growth: false,
    offer: false,
    storage: false,
  });

  const toggleSection = (key: string) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const setAllOwner = (val: boolean) =>
    setOpenSections({
      bills: val,
      counter: val,
      openSession: val,
      rewards: val,
      bestsellers: val,
      growth: val,
      offer: val,
      storage: val,
    });

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

      <div className="row sp" style={{ marginBottom: '10px' }}>
        <span className="mu" style={{ fontSize: '12px' }}>
          Tap any section to expand or collapse
        </span>
        <div className="row" style={{ gap: '6px' }}>
          <button
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllOwner(true)}
          >
            Expand All
          </button>
          <button
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllOwner(false)}
          >
            Collapse All
          </button>
        </div>
      </div>

      <CollapsibleSection
        title="💳 Live & Pending Bills"
        isOpen={!!openSections.bills}
        onToggle={() => toggleSection('bills')}
        wrapInCard={false}
      >
        <LiveAndPendingBillsCard />
      </CollapsibleSection>

      <CollapsibleSection
        title="🎟️ Counter Numbers Mode"
        badge={S.cmode === 'auto' ? 'Auto' : 'Manual'}
        isOpen={!!openSections.counter}
        onToggle={() => toggleSection('counter')}
        wrapInCard={false}
      >
        <CounterNumbersModeCard />
      </CollapsibleSection>

      <CollapsibleSection
        title="🧾 Bill for Open Session"
        isOpen={!!openSections.openSession}
        onToggle={() => toggleSection('openSession')}
        wrapInCard={false}
      >
        <BillForOpenSessionCard />
      </CollapsibleSection>

      <CollapsibleSection
        title="🎬 Reward Approvals"
        badge={S.reel === 'wait' ? '1 pending' : undefined}
        isOpen={!!openSections.rewards}
        onToggle={() => toggleSection('rewards')}
      >
        {S.reel === 'wait' ? (
          <div className="row sp">
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
          <p className="mu">
            Nothing waiting. Upload a reel as a customer to see it here.
          </p>
        )}
      </CollapsibleSection>

      <CollapsibleSection
        title="🏆 Best Sellers"
        isOpen={!!openSections.bestsellers}
        onToggle={() => toggleSection('bestsellers')}
      >
        {bestSellers.map(([n, w]) => (
          <React.Fragment key={n}>
            <div className="mu" style={{ marginTop: '8px' }}>
              {n}
            </div>
            <div className="bar" style={{ width: `${w}%` }} />
          </React.Fragment>
        ))}
      </CollapsibleSection>

      <CollapsibleSection
        title="📈 Growth This Week"
        isOpen={!!openSections.growth}
        onToggle={() => toggleSection('growth')}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title="📲 Send WhatsApp Offer"
        isOpen={!!openSections.offer}
        onToggle={() => toggleSection('offer')}
      >
        {(() => {
          const customerMobs = Array.from(
            new Set([
              ...S.hist.map((h) => h.customerMob).filter(Boolean),
              ...sheetOrdersToday
                .map((po) => po.principalMob || po.orderedByMob)
                .filter(Boolean),
            ])
          ).filter(
            (m): m is string =>
              typeof m === 'string' && m !== 'Guest' && /^\+?\d{10,15}$/.test(m)
          );

          return (
            <>
              <div className="row" style={{ flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                <button
                  className="chip"
                  style={{ fontSize: '11px' }}
                  onClick={() =>
                    setOfferMsg(
                      '🔥 We miss you at Tadka Truck! Show this WhatsApp message today for 15% OFF your order + a free Gulab Jamun! 🍮'
                    )
                  }
                >
                  🍮 Miss You 15% Off
                </button>
                <button
                  className="chip"
                  style={{ fontSize: '11px' }}
                  onClick={() =>
                    setOfferMsg(
                      '🎉 Weekend Special at Tadka Truck! Order ₹299+ & get a FREE Mango Masala Cooler 🥤'
                    )
                  }
                >
                  🥤 Free Cooler Combo
                </button>
              </div>
              <textarea
                value={offerMsg}
                onChange={(e) => setOfferMsg(e.target.value)}
                rows={3}
                className="inp"
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
              />
              {customerMobs.length > 0 ? (
                <div style={{ marginTop: '8px' }}>
                  <div className="mu" style={{ fontSize: '12px', marginBottom: '6px' }}>
                    Recent customers ({customerMobs.length}):
                  </div>
                  {customerMobs.slice(0, 10).map((m) => (
                    <div
                      key={m}
                      className="row sp"
                      style={{
                        padding: '6px 8px',
                        borderRadius: '8px',
                        background: 'var(--bg)',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '13px' }}>📱 {m}</span>
                      <button
                        className="chip on"
                        style={{ fontSize: '11px' }}
                        onClick={() => {
                          const digits = m.replace(/\D/g, '');
                          window.open(
                            `https://wa.me/${digits}?text=${encodeURIComponent(offerMsg)}`,
                            '_blank',
                            'noopener,noreferrer'
                          );
                          say(`Opening WhatsApp offer for ${m} ✅`);
                        }}
                      >
                        📲 Send WA
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mu" style={{ marginTop: '8px', fontSize: '12px' }}>
                  Customer mobile numbers from paid bills &amp; orders will appear
                  here for 1-tap WhatsApp offers.
                </p>
              )}
            </>
          );
        })()}
      </CollapsibleSection>

      <CollapsibleSection
        title="☁️ Google Drive & Sheets Storage"
        isOpen={!!openSections.storage}
        onToggle={() => toggleSection('storage')}
        wrapInCard={false}
      >
        <GoogleStorageAdminCard />
      </CollapsibleSection>
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
    addTable,
    updateTable,
    removeTable,
    resetTables,
    regenerateTableQr,
    setActiveTable,
    resetDemoState,
    saveGoogleConfig,
    syncToGoogleSheets,
    say,
  } = useTadka();

  const [staffName, setStaffName] = useState('');
  const [staffMob, setStaffMob] = useState('');
  const [checkMob, setCheckMob] = useState('');
  const [revUrlInput, setRevUrlInput] = useState(
    S.googleConfig.googleReviewUrl || ''
  );
  const [igHandleInput, setIgHandleInput] = useState(
    S.googleConfig.instagramHandle || '@tadkatruck'
  );
  const [fbUrlInput, setFbUrlInput] = useState(S.googleConfig.facebookUrl || '');
  const [socTagInput, setSocTagInput] = useState(
    S.googleConfig.socialTag || '#TadkaTruck @tadkatruck'
  );
  const [upiIdInput, setUpiIdInput] = useState(S.googleConfig.upiId || '');
  const [upiNameInput, setUpiNameInput] = useState(
    S.googleConfig.upiName || 'Tadka Truck'
  );
  const [gstEnabledInput, setGstEnabledInput] = useState(
    S.googleConfig.gstEnabled !== false
  );
  const [gstRateInput, setGstRateInput] = useState(
    String(S.googleConfig.gstRate ?? 5)
  );
  const [gstModeInput, setGstModeInput] = useState<'bill' | 'item'>(
    S.googleConfig.gstMode === 'item' ? 'item' : 'bill'
  );
  const [gstinInput, setGstinInput] = useState(S.googleConfig.gstin || '');

  const [openAdminSections, setOpenAdminSections] = useState<
    Record<string, boolean>
  >({
    team: true,
    giveAccess: false,
    whatsappBill: false,
    gstSettings: false,
    loginTest: false,
    menuAdmin: false,
    tablesQr: false,
    socialLinks: false,
    storage: false,
    resetDemo: false,
  });

  const toggleAdminSection = (key: string) =>
    setOpenAdminSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const setAllAdmin = (val: boolean) => {
    setOpenAdminSections({
      team: val,
      giveAccess: val,
      whatsappBill: val,
      gstSettings: val,
      loginTest: val,
      menuAdmin: val,
      tablesQr: val,
      socialLinks: val,
      storage: val,
      resetDemo: val,
    });
    setShowMenuAdmin(val);
    setShowQrAdmin(val);
  };

  // Menu editor collapsible state
  const [showMenuAdmin, setShowMenuAdmin] = useState(false);
  const [newDishEn, setNewDishEn] = useState('');
  const [newDishHi, setNewDishHi] = useState('');
  const [newDishGu, setNewDishGu] = useState('');
  const [newDishPrice, setNewDishPrice] = useState('100');
  const [newDishEmoji, setNewDishEmoji] = useState('🍲');
  const [newDishVeg, setNewDishVeg] = useState(true);
  const [newDishGst, setNewDishGst] = useState('');

  const [showQrAdmin, setShowQrAdmin] = useState(false);
  const [newTableNo, setNewTableNo] = useState('');
  const [newTableLabel, setNewTableLabel] = useState('');
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [editTableNo, setEditTableNo] = useState('');
  const [editTableLabel, setEditTableLabel] = useState('');
  const [selectedQrTableId, setSelectedQrTableId] = useState<number>(
    S.activeTable || 1
  );

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

      <div className="row sp" style={{ marginBottom: '10px' }}>
        <span className="mu" style={{ fontSize: '12px' }}>
          Tap any section to expand or collapse
        </span>
        <div className="row" style={{ gap: '6px' }}>
          <button
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllAdmin(true)}
          >
            Expand All
          </button>
          <button
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllAdmin(false)}
          >
            Collapse All
          </button>
        </div>
      </div>

      <CollapsibleSection
        title="👥 Team"
        badge={`${S.staff.length}`}
        isOpen={!!openAdminSections.team}
        onToggle={() => toggleAdminSection('team')}
      >
        {S.staff.map((x, i) => (
          <div
            key={x.id || x.ph}
            style={{ marginTop: i > 0 ? '12px' : 0, opacity: x.on ? 1 : 0.5 }}
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
      </CollapsibleSection>

      <CollapsibleSection
        title="🔑 Give Access"
        isOpen={!!openAdminSections.giveAccess}
        onToggle={() => toggleAdminSection('giveAccess')}
      >
        <p className="mu" style={{ margin: '0 0 8px' }}>
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
      </CollapsibleSection>

      <CollapsibleSection
        title="💬 Final Bill on WhatsApp"
        badge={S.wab ? 'On' : 'Off'}
        isOpen={!!openAdminSections.whatsappBill}
        onToggle={() => toggleAdminSection('whatsappBill')}
      >
        <div className="row">
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
      </CollapsibleSection>

      <CollapsibleSection
        title="🧾 GST &amp; GSTIN Master"
        badge={
          S.googleConfig.gstEnabled !== false
            ? `${S.googleConfig.gstRate ?? 5}%${
                S.googleConfig.gstin ? ` · ${S.googleConfig.gstin}` : ''
              }`
            : 'Off'
        }
        isOpen={!!openAdminSections.gstSettings}
        onToggle={() => toggleAdminSection('gstSettings')}
      >
        <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
          Configure GST billing rate and your restaurant&apos;s GSTIN number.
          Shown on customer bills &amp; digital GST receipts, and synced via
          Google Sheets (`Restaurant_Config`).
        </p>
        <div className="row" style={{ gap: '6px', marginBottom: '10px' }}>
          <button
            className={`chip ${gstEnabledInput ? 'on' : ''}`}
            onClick={() => setGstEnabledInput(true)}
          >
            ✅ Charge GST
          </button>
          <button
            className={`chip ${!gstEnabledInput ? 'on' : ''}`}
            onClick={() => setGstEnabledInput(false)}
          >
            🚫 No GST (Exempt)
          </button>
        </div>

        {gstEnabledInput && (
          <>
            <div style={{ marginBottom: '10px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
                Apply GST On:
              </div>
              <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                <button
                  className={`chip ${gstModeInput === 'bill' ? 'on' : ''}`}
                  onClick={() => setGstModeInput('bill')}
                >
                  🧾 Bottom of Bill (Single %)
                </button>
                <button
                  className={`chip ${gstModeInput === 'item' ? 'on' : ''}`}
                  onClick={() => setGstModeInput('item')}
                >
                  🍽️ Each Menu Item (Item-wise %)
                </button>
              </div>
              <p className="mu" style={{ fontSize: '11px', marginTop: '4px' }}>
                {gstModeInput === 'item'
                  ? 'Uses each dish’s GST % from Menu Admin (falls back to default % below if blank).'
                  : 'Applies a single flat GST % at the bottom of the bill.'}
              </p>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
                {gstModeInput === 'item' ? 'Default GST Rate (%):' : 'GST Rate (%):'}
              </div>
              <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                {['5', '12', '18'].map((r) => (
                  <button
                    key={r}
                    className={`chip ${gstRateInput === r ? 'on' : ''}`}
                    onClick={() => setGstRateInput(r)}
                  >
                    {r}%
                  </button>
                ))}
                <input
                  type="number"
                  min="0"
                  max="28"
                  step="0.5"
                  value={gstRateInput}
                  onChange={(e) => setGstRateInput(e.target.value)}
                  placeholder="%"
                  className="inp"
                  style={{ width: '80px', padding: '5px 8px', fontSize: '12px' }}
                />
              </div>
            </div>
          </>
        )}

        <div style={{ marginBottom: '10px' }}>
          <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
            GSTIN Number (Master):
          </div>
          <input
            value={gstinInput}
            onChange={(e) => setGstinInput(e.target.value.toUpperCase())}
            placeholder="e.g. 24ABCDE1234F1Z5"
            maxLength={15}
            className="inp"
            style={{ width: '100%' }}
          />
        </div>

        <button
          className="btn alt"
          onClick={async () => {
            const parsedRate = Math.max(0, Number(gstRateInput) || 0);
            const nextGst = {
              gstEnabled: gstEnabledInput,
              gstRate: gstEnabledInput ? parsedRate : 0,
              gstMode: gstModeInput,
              gstin: gstinInput.trim().toUpperCase(),
            };
            saveGoogleConfig(nextGst);
            await syncToGoogleSheets(nextGst);
            say('GST & GSTIN settings saved & synced ✅');
          }}
        >
          Save &amp; Sync GST Settings
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        title="🔐 What Happens at Login?"
        isOpen={!!openAdminSections.loginTest}
        onToggle={() => toggleAdminSection('loginTest')}
      >
        <p className="mu" style={{ margin: '0 0 8px' }}>
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
      </CollapsibleSection>

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
              <div
                key={m.id}
                className="line"
                style={{ alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}
              >
                <span>
                  {m.e} {m.n.en} (₹{m.p})
                  <span className="mu" style={{ fontSize: '11px', marginLeft: '4px' }}>
                    · GST{' '}
                    {typeof m.gstRate === 'number'
                      ? `${m.gstRate}%`
                      : `Default (${S.googleConfig.gstRate ?? 5}%)`}
                  </span>
                </span>
                <div className="row" style={{ gap: '4px' }}>
                  <select
                    aria-label={`GST % for ${m.n.en}`}
                    value={typeof m.gstRate === 'number' ? String(m.gstRate) : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      saveMenuDish({
                        id: m.id,
                        gstRate: val === '' ? undefined : Number(val),
                      });
                    }}
                    className="sel-cc"
                    style={{ fontSize: '11px', padding: '4px 6px' }}
                  >
                    <option value="">Default GST</option>
                    <option value="0">0% GST</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                  </select>
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
              <div className="row" style={{ marginTop: '6px', flexWrap: 'wrap', gap: '6px' }}>
                <input
                  value={newDishPrice}
                  onChange={(e) => setNewDishPrice(e.target.value)}
                  placeholder="Price ₹"
                  inputMode="numeric"
                  className="inp"
                  style={{ flex: 1, minWidth: '80px' }}
                />
                <select
                  aria-label="New dish GST %"
                  value={newDishGst}
                  onChange={(e) => setNewDishGst(e.target.value)}
                  className="sel-cc"
                >
                  <option value="">Default GST</option>
                  <option value="0">0% GST</option>
                  <option value="5">5% GST</option>
                  <option value="12">12% GST</option>
                  <option value="18">18% GST</option>
                </select>
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
                    ...(newDishGst !== '' ? { gstRate: Number(newDishGst) } : {}),
                    n: {
                      en: newDishEn.trim(),
                      hi: newDishHi.trim() || newDishEn.trim(),
                      gu: newDishGu.trim() || newDishEn.trim(),
                    },
                  });
                  setNewDishEn('');
                  setNewDishHi('');
                  setNewDishGu('');
                  setNewDishGst('');
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
          <h3>📱 Tables & QR Code Generator</h3>
          <div className="row" style={{ gap: '6px' }}>
            <button
              className="chip"
              style={{ fontSize: '12px' }}
              onClick={resetTables}
            >
              🔄 Reset Tables
            </button>
            <button
              className="chip"
              onClick={() => setShowQrAdmin((prev) => !prev)}
            >
              {showQrAdmin ? 'Close' : 'Manage tables'}
            </button>
          </div>
        </div>
        {showQrAdmin && (
          <div style={{ marginTop: '10px' }}>
            {/* Add / Set Manual Table Number */}
            <div className="row" style={{ marginBottom: '12px', gap: '6px' }}>
              <input
                value={newTableNo}
                onChange={(e) => setNewTableNo(e.target.value.replace(/\D/g, ''))}
                placeholder="No. (e.g. 10)"
                inputMode="numeric"
                className="inp"
                style={{ maxWidth: '100px' }}
              />
              <input
                value={newTableLabel}
                onChange={(e) => setNewTableLabel(e.target.value)}
                placeholder="Name (e.g. Table 10, Patio 1)"
                className="inp"
              />
              <button
                className="chip on"
                onClick={() => {
                  const parsedNo = Number(newTableNo) || undefined;
                  addTable(newTableLabel, parsedNo);
                  setNewTableNo('');
                  setNewTableLabel('');
                }}
              >
                + Add
              </button>
            </div>

            {/* Table List */}
            {S.tables.map((t) => {
              const baseUrl =
                typeof window !== 'undefined'
                  ? `${window.location.origin}${
                      window.location.pathname.includes('/My_Restaurants')
                        ? '/My_Restaurants'
                        : ''
                    }`
                  : 'https://pradeepparmar902.github.io/My_Restaurants';
              const qrTargetUrl = `${baseUrl}/?t=${encodeURIComponent(
                t.token
              )}&table=${t.id}&label=${encodeURIComponent(t.label)}`;
              const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                qrTargetUrl
              )}`;
              const isQrOpen = selectedQrTableId === t.id;
              const isEditing = editingTableId === t.id;

              return (
                <div
                  key={t.id}
                  style={{
                    borderTop: '1px dashed #5a4690',
                    paddingTop: '10px',
                    marginTop: '10px',
                  }}
                >
                  {isEditing ? (
                    <div className="row" style={{ gap: '6px', marginBottom: '8px' }}>
                      <input
                        value={editTableNo}
                        onChange={(e) =>
                          setEditTableNo(e.target.value.replace(/\D/g, ''))
                        }
                        placeholder="No."
                        inputMode="numeric"
                        className="inp"
                        style={{ maxWidth: '72px' }}
                      />
                      <input
                        value={editTableLabel}
                        onChange={(e) => setEditTableLabel(e.target.value)}
                        placeholder="Table label"
                        className="inp"
                      />
                      <button
                        className="chip on"
                        onClick={() => {
                          updateTable(
                            t.id,
                            editTableLabel,
                            Number(editTableNo) || t.id
                          );
                          setEditingTableId(null);
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="chip"
                        onClick={() => setEditingTableId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="row sp" style={{ flexWrap: 'wrap', gap: '6px' }}>
                      <span>
                        <b>
                          #{t.id} · {t.label}
                        </b>{' '}
                        {S.activeTable === t.id && (
                          <span className="tag ok">Active</span>
                        )}
                        <br />
                        <span className="mu" style={{ fontSize: '11px' }}>
                          Token: {t.token}
                        </span>
                      </span>
                      <div className="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
                        <button
                          className={`chip ${isQrOpen ? 'on' : ''}`}
                          onClick={() => setSelectedQrTableId(t.id)}
                        >
                          📷 {isQrOpen ? 'Viewing QR' : 'Create QR'}
                        </button>
                        <button
                          className={`chip ${S.activeTable === t.id ? 'on' : ''}`}
                          onClick={() => setActiveTable(t.id)}
                        >
                          {S.activeTable === t.id ? 'Active' : 'Use'}
                        </button>
                        <button
                          className="chip"
                          onClick={() => {
                            setEditingTableId(t.id);
                            setEditTableNo(String(t.id));
                            setEditTableLabel(t.label);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="chip"
                          onClick={() => regenerateTableQr(t.id)}
                        >
                          ↻ Token
                        </button>
                        {S.tables.length > 1 && (
                          <button
                            className="chip"
                            style={{ color: '#f87171' }}
                            onClick={() => removeTable(t.id)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {isQrOpen && (
                    <div
                      style={{
                        marginTop: '10px',
                        background: '#fff',
                        color: '#1b1030',
                        borderRadius: '16px',
                        padding: '14px',
                        textAlign: 'center',
                      }}
                    >
                      <b style={{ fontSize: '18px' }}>
                        Tadka Truck · {t.label}
                      </b>
                      <p style={{ fontSize: '12px', color: '#4a3680', margin: '4px 0 10px' }}>
                        Scan to view menu, order & pay
                      </p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrImageUrl}
                        alt={`QR Code for ${t.label}`}
                        width={180}
                        height={180}
                        style={{
                          display: 'block',
                          margin: '0 auto',
                          borderRadius: '8px',
                        }}
                      />
                      <p
                        style={{
                          fontSize: '10px',
                          color: '#5a4690',
                          wordBreak: 'break-all',
                          marginTop: '8px',
                        }}
                      >
                        {qrTargetUrl}
                      </p>
                      <div
                        className="row"
                        style={{
                          justifyContent: 'center',
                          marginTop: '10px',
                          gap: '8px',
                        }}
                      >
                        <button
                          className="chip on"
                          onClick={() => {
                            navigator.clipboard?.writeText(qrTargetUrl);
                            say(`Copied ${t.label} QR link ✅`);
                          }}
                        >
                          📋 Copy Link
                        </button>
                        <a
                          href={qrImageUrl}
                          download={`Tadka_${t.label.replace(/\s+/g, '_')}_QR.png`}
                          target="_blank"
                          rel="noreferrer"
                          className="chip"
                          style={{
                            textDecoration: 'none',
                            color: '#1b1030',
                            borderColor: '#1b1030',
                          }}
                        >
                          ⬇️ Open / Print QR
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <CollapsibleSection
        title="📣 Social Media & Google Review Links"
        badge={S.googleConfig.googleReviewUrl ? 'Configured' : undefined}
        isOpen={!!openAdminSections.socialLinks}
        onToggle={() => toggleAdminSection('socialLinks')}
      >
        <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
          Customers open these real links when posting a Google Review or
          sharing reels/snaps. Saved to Google Sheets (`Restaurant_Config`) so
          every customer device gets them automatically.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              ⭐ Google Review URL (from Google Business Profile → Ask for reviews)
            </div>
            <input
              value={revUrlInput}
              onChange={(e) => setRevUrlInput(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              📸 Instagram Handle or Profile URL
            </div>
            <input
              value={igHandleInput}
              onChange={(e) => setIgHandleInput(e.target.value)}
              placeholder="@tadkatruck or https://instagram.com/tadkatruck"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              📘 Facebook Page URL (optional)
            </div>
            <input
              value={fbUrlInput}
              onChange={(e) => setFbUrlInput(e.target.value)}
              placeholder="https://facebook.com/tadkatruck"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              #️⃣ Caption / Tag for Customer Reels &amp; Snaps
            </div>
            <input
              value={socTagInput}
              onChange={(e) => setSocTagInput(e.target.value)}
              placeholder="#TadkaTruck @tadkatruck"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              💳 Direct UPI ID for 0%-Fee Customer QR Payments
            </div>
            <input
              value={upiIdInput}
              onChange={(e) => setUpiIdInput(e.target.value)}
              placeholder="e.g. tadkatruck@okicici"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div>
            <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
              🏪 UPI Payee Display Name
            </div>
            <input
              value={upiNameInput}
              onChange={(e) => setUpiNameInput(e.target.value)}
              placeholder="Tadka Truck"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <button
            className="btn alt"
            onClick={async () => {
              const nextSocial = {
                googleReviewUrl: revUrlInput.trim(),
                instagramHandle: igHandleInput.trim(),
                facebookUrl: fbUrlInput.trim(),
                socialTag: socTagInput.trim(),
                upiId: upiIdInput.trim(),
                upiName: upiNameInput.trim() || 'Tadka Truck',
              };
              saveGoogleConfig(nextSocial);
              await syncToGoogleSheets(nextSocial);
              say('Social, Review & UPI settings saved & synced ✅');
            }}
          >
            Save &amp; Sync Social &amp; UPI Settings
          </button>
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="☁️ Google Drive & Sheets Storage"
        isOpen={!!openAdminSections.storage}
        onToggle={() => toggleAdminSection('storage')}
        wrapInCard={false}
      >
        <GoogleStorageAdminCard />
      </CollapsibleSection>

      <CollapsibleSection
        title="🔄 Reset Prototype / Demo State"
        isOpen={!!openAdminSections.resetDemo}
        onToggle={() => toggleAdminSection('resetDemo')}
      >
        <div className="row sp">
          <span className="mu">Reset prototype / demo state</span>
          <button className="chip" onClick={resetDemoState}>
            Reset All
          </button>
        </div>
      </CollapsibleSection>
    </>
  );
}
