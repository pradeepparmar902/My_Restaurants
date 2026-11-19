'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import {
  DietaryFilterOption,
  Language,
  MenuLanguageOption,
  RewardRulesConfig,
  StaffRoleName,
  WorkspaceTenantRecord,
} from '@/types/tadka';
import {
  DEFAULT_DIETARY_FILTERS,
  DEFAULT_MENU_LANGUAGES,
} from '@/lib/googleSheetsShared';
import { downloadStandaloneRestaurantZip } from '@/lib/standalonePackBuilder';
import {
  DEFAULT_REWARD_RULES,
  ORDER_STATUS_LABELS,
  ROLE_DESCRIPTIONS,
} from '@/lib/constants';
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

export function RewardRulesMasterContent() {
  const { S, saveGoogleConfig, syncToGoogleSheets, say } = useTadka();
  const [rewardRulesInput, setRewardRulesInput] = useState<RewardRulesConfig>(
    S.googleConfig.rewardRules || DEFAULT_REWARD_RULES
  );

  return (
    <>
      <p className="mu" style={{ margin: '0 0 10px', fontSize: '12px' }}>
        Configure minimum bill conditions, star targets, free rewards, coupon
        codes, referral codes, and social/review discounts.
      </p>

      <div
        style={{
          padding: '10px',
          borderRadius: '10px',
          background: 'var(--bg)',
          border: '1px solid #382562',
          marginBottom: '10px',
        }}
      >
        <b>⭐ Stars &amp; Free Item Rules</b>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Min Bill ₹ for 1 Star (0 = any bill)
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.minBillForStar}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  minBillForStar: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '130px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Stars Needed for Free Reward
            </div>
            <input
              type="number"
              min="1"
              max="20"
              value={rewardRulesInput.starsTarget}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  starsTarget: Math.max(1, Number(e.target.value) || 5),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '160px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Free Reward Name
            </div>
            <input
              value={rewardRulesInput.starFreeRewardLabel}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  starFreeRewardLabel: e.target.value,
                }))
              }
              placeholder="Free Dessert (Gulab Jamun)"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '100px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Free Value (₹ Off)
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.starFreeValueInr}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  starFreeValueInr: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px',
          borderRadius: '10px',
          background: 'var(--bg)',
          border: '1px solid #382562',
          marginBottom: '10px',
        }}
      >
        <b>🎟️ Promo Coupon Code</b>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Coupon Code</div>
            <input
              value={rewardRulesInput.couponCode}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  couponCode: e.target.value.toUpperCase(),
                }))
              }
              placeholder="TADKA50"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Type</div>
            <select
              value={rewardRulesInput.couponType}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  couponType: e.target.value === 'percent' ? 'percent' : 'flat',
                }))
              }
              className="sel-cc"
              style={{ width: '100%' }}
            >
              <option value="flat">₹ Flat Off</option>
              <option value="percent">% Off</option>
            </select>
          </div>
        </div>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Discount ({rewardRulesInput.couponType === 'percent' ? '%' : '₹'})
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.couponValue}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  couponValue: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Min Bill ₹ (0 = any)
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.couponMinBill}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  couponMinBill: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px',
          borderRadius: '10px',
          background: 'var(--bg)',
          border: '1px solid #382562',
          marginBottom: '10px',
        }}
      >
        <b>🤝 Referral Free / Discount Code</b>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Referral Code</div>
            <input
              value={rewardRulesInput.referralCode}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  referralCode: e.target.value.toUpperCase(),
                }))
              }
              placeholder="FRIEND50"
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '90px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>₹ Off</div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.referralDiscountInr}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  referralDiscountInr: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '90px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Min Bill ₹</div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.referralMinBill}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  referralMinBill: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: '10px',
          borderRadius: '10px',
          background: 'var(--bg)',
          border: '1px solid #382562',
          marginBottom: '10px',
        }}
      >
        <b>📣 Social Media &amp; Google Review Rewards</b>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Review ₹ Off</div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.reviewDiscountInr}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  reviewDiscountInr: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Review Min Bill ₹</div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.reviewMinBill}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  reviewMinBill: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>Reel % Off</div>
            <input
              type="number"
              min="0"
              max="100"
              value={rewardRulesInput.reelDiscountPercent}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  reelDiscountPercent: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
        <div className="row" style={{ gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Social Share Bonus Pts
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.socialSharePoints}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  socialSharePoints: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: '110px' }}>
            <div className="mu" style={{ fontSize: '11px' }}>
              Social Share ₹ Off
            </div>
            <input
              type="number"
              min="0"
              value={rewardRulesInput.socialShareDiscountInr}
              onChange={(e) =>
                setRewardRulesInput((p) => ({
                  ...p,
                  socialShareDiscountInr: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="inp"
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      <button
        className="btn alt"
        onClick={async () => {
          const nextCfg = { rewardRules: rewardRulesInput };
          saveGoogleConfig(nextCfg);
          await syncToGoogleSheets(nextCfg);
          say('Reward, Coupon & Star rules saved & synced ✅');
        }}
      >
        Save &amp; Sync Reward Rules
      </button>
    </>
  );
}

function RewardApprovalsSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const {
    S,
    proofSubmissions,
    decideSocialProof,
    pullFromGoogleSheets,
    updateState,
  } = useTadka();

  const pendingProofs = proofSubmissions.filter((p) => p.status === 'PENDING');
  const decidedProofs = proofSubmissions
    .filter((p) => p.status !== 'PENDING')
    .slice(0, 10);
  const pendingCount = pendingProofs.length + (S.reel === 'wait' ? 1 : 0);

  return (
    <CollapsibleSection
      title="🎬 Reward Approvals"
      badge={pendingCount > 0 ? `${pendingCount} pending` : undefined}
      isOpen={isOpen}
      onToggle={() => {
        if (!isOpen) pullFromGoogleSheets();
        onToggle();
      }}
    >
      <div className="row sp" style={{ marginBottom: '10px', flexWrap: 'wrap', gap: '6px' }}>
        <span className="mu" style={{ fontSize: '12px' }}>
          Verify customer Reels, Posts &amp; Google Reviews before releasing rewards
        </span>
        <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
          <a
            href="https://business.facebook.com/latest/inbox/all"
            target="_blank"
            rel="noreferrer"
            className="chip"
            style={{ fontSize: '11px', textDecoration: 'none' }}
          >
            🔔 Meta Business Suite ↗
          </a>
          {S.googleConfig.googleReviewUrl && (
            <a
              href={S.googleConfig.googleReviewUrl}
              target="_blank"
              rel="noreferrer"
              className="chip"
              style={{ fontSize: '11px', textDecoration: 'none' }}
            >
              ⭐ Google Reviews ↗
            </a>
          )}
          <button
            type="button"
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => pullFromGoogleSheets()}
          >
            🔄 Refresh Queue
          </button>
        </div>
      </div>

      {S.reel === 'wait' && (
        <div
          className="row sp"
          style={{
            marginBottom: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.05)',
          }}
        >
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
      )}

      {pendingProofs.length === 0 && decidedProofs.length === 0 && S.reel !== 'wait' && (
        <p className="mu">
          No customer proof submissions yet. When a customer submits a Reel/Post link or Google Reviewer name, it will appear here.
        </p>
      )}

      {pendingProofs.length > 0 && (
        <div style={{ display: 'grid', gap: '8px', marginBottom: '10px' }}>
          {pendingProofs.map((p) => (
            <div
              key={p.id}
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(251,191,36,0.35)',
              }}
            >
              <div className="row sp" style={{ marginBottom: '4px', gap: '8px' }}>
                <strong style={{ fontSize: '13px' }}>
                  {p.kind === 'review' ? '⭐ Google Review' : `🎬 ${p.platform}`}
                </strong>
                <span className="mu" style={{ fontSize: '11px' }}>
                  Counter {p.counterNo || '—'} · {p.customerMob || 'Guest'}
                </span>
              </div>
              {p.note && (
                <div style={{ fontSize: '12px', marginBottom: '4px' }}>
                  Note: {p.note}
                </div>
              )}
              {p.proofUrl && (
                <div style={{ marginBottom: '8px' }}>
                  <a
                    href={p.proofUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#93c5fd', fontSize: '12px', wordBreak: 'break-all' }}
                  >
                    🔗 Open Customer Proof ({p.proofUrl}) ↗
                  </a>
                </div>
              )}
              <div className="row" style={{ flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => decideSocialProof(p.id, 'APPROVED', 'COUPON')}
                >
                  🎟️ Approve Coupon
                </button>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => decideSocialProof(p.id, 'APPROVED', 'STAR')}
                >
                  ⭐ Approve +1 Star
                </button>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => decideSocialProof(p.id, 'APPROVED', 'DISCOUNT')}
                >
                  💸 Approve Discount
                </button>
                <button
                  type="button"
                  className="chip"
                  style={{ borderColor: 'rgba(248,113,113,0.5)' }}
                  onClick={() => decideSocialProof(p.id, 'REJECTED')}
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {decidedProofs.length > 0 && (
        <div style={{ marginTop: '8px' }}>
          <div className="mu" style={{ fontSize: '11px', marginBottom: '6px' }}>
            Recent Decisions
          </div>
          <div style={{ display: 'grid', gap: '5px' }}>
            {decidedProofs.map((p) => (
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
                <span style={{ minWidth: 0 }}>
                  <strong>{p.kind === 'review' ? '⭐ Google' : p.platform}</strong>
                  {' · '}
                  {p.customerMob || 'Guest'}
                  {p.note ? ` (${p.note})` : ''}
                </span>
                <span className={`chip ${p.status === 'APPROVED' ? 'on' : ''}`} style={{ fontSize: '10px' }}>
                  {p.status === 'APPROVED'
                    ? `✅ ${p.rewardType || 'APPROVED'}${p.rewardValue ? ` (${p.rewardValue})` : ''}`
                    : '❌ REJECTED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </CollapsibleSection>
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
    rewardMaster: false,
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
      rewardMaster: val,
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

      <RewardApprovalsSection
        isOpen={!!openSections.rewards}
        onToggle={() => toggleSection('rewards')}
      />

      <CollapsibleSection
        title="🎁 Rewards, Discounts, Coupons &amp; Stars Master"
        badge={S.googleConfig.rewardRules?.couponCode || DEFAULT_REWARD_RULES.couponCode}
        isOpen={!!openSections.rewardMaster}
        onToggle={() => toggleSection('rewardMaster')}
      >
        <RewardRulesMasterContent />
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
    </>
  );
}

function extractGoogleIdFromUrl(raw: string, kind: 'sheet' | 'folder'): string {
  const s = (raw || '').trim();
  if (!s) return '';
  if (kind === 'sheet') {
    const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];
  } else {
    const m = s.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (m?.[1]) return m[1];
  }
  return s;
}

export function SuperAdminPortalView() {
  const {
    S,
    isSuperAdmin,
    unlockSuperAdmin,
    createAndProvisionWorkspace,
    updateWorkspaceRecord,
    removeWorkspaceRecord,
    syncToGoogleSheets,
    pullFromGoogleSheets,
    checkLogin,
    resetDemoState,
    say,
  } = useTadka();

  const [pinInput, setPinInput] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsDefaultStyle, setWsDefaultStyle] = useState<
    'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6'
  >('style2');
  const [wsPlanName, setWsPlanName] = useState<'Starter' | 'Growth' | 'Pro'>('Growth');
  const [wsMonthlyFee, setWsMonthlyFee] = useState('999');
  const [wsOwnerName, setWsOwnerName] = useState('');
  const [wsOwnerMob, setWsOwnerMob] = useState('');
  const [wsSheetRaw, setWsSheetRaw] = useState('');
  const [wsDriveRaw, setWsDriveRaw] = useState('');
  const [wsScriptUrl, setWsScriptUrl] = useState(
    S.googleConfig.appsScriptWebAppUrl || ''
  );
  const [provisioning, setProvisioning] = useState(false);
  const [lastHandoverUrl, setLastHandoverUrl] = useState('');
  const [checkMob, setCheckMob] = useState('');

  const [openSaSections, setOpenSaSections] = useState<Record<string, boolean>>({
    clients: true,
    addClient: false,
    standalonePack: false,
    storage: false,
    loginTest: false,
    resetDemo: false,
  });
  const [selectedPackSlug, setSelectedPackSlug] = useState<string>('');

  const toggleSaSection = (key: string) =>
    setOpenSaSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const setAllSa = (val: boolean) =>
    setOpenSaSections({
      clients: val,
      addClient: val,
      standalonePack: val,
      storage: val,
      loginTest: val,
      resetDemo: val,
    });

  const registry = S.googleConfig.workspacesRegistry || [];
  const activeCount = registry.filter((w) => (w.status || 'ACTIVE') === 'ACTIVE').length;
  const trialCount = registry.filter((w) => w.status === 'TRIAL').length;
  const suspendedCount = registry.filter((w) => w.status === 'SUSPENDED').length;
  const totalMrr = registry
    .filter((w) => (w.status || 'ACTIVE') === 'ACTIVE')
    .reduce((sum, w) => sum + (Number(w.monthlyFeeInr) || 999), 0);

  const filteredRegistry = registry.filter((w) => {
    if (!searchClient.trim()) return true;
    const q = searchClient.trim().toLowerCase();
    return (
      w.restaurantName.toLowerCase().includes(q) ||
      w.slug.toLowerCase().includes(q) ||
      (w.ownerName || '').toLowerCase().includes(q) ||
      (w.ownerMobile || '').toLowerCase().includes(q)
    );
  });

  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${
          window.location.pathname.includes('/My_Restaurants')
            ? '/My_Restaurants'
            : ''
        }`
      : 'https://pradeepparmar902.github.io/My_Restaurants';

  const masterSheetUrl = S.googleConfig.spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${S.googleConfig.spreadsheetId}/edit`
    : '';

  if (!isSuperAdmin) {
    return (
      <div className="card">
        <h3>🏢 Super Admin Dashboard</h3>
        <p className="mu" style={{ margin: '6px 0 10px' }}>
          Enter your Super Admin PIN (<code>SUPER123</code>) or log in with your
          Super Admin mobile number (<code>+919800000001</code>) to manage all
          restaurant clients.
        </p>
        <div className="row" style={{ gap: '6px' }}>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Super Admin PIN (SUPER123)"
            className="inp"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="chip on"
            onClick={() => unlockSuperAdmin(pinInput)}
          >
            🔓 Unlock
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Super Admin Summary Banner */}
      <div
        className="hero"
        style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4f46e5 100%)',
          color: '#ffffff',
        }}
      >
        <div className="row sp" style={{ alignItems: 'flex-start' }}>
          <div>
            <span
              style={{
                display: 'inline-block',
                background: 'rgba(255,255,255,0.18)',
                padding: '3px 10px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                marginBottom: '6px',
              }}
            >
              🏢 Super Admin · Master Business Dashboard
            </span>
            <h1 style={{ color: '#ffffff' }}>
              {registry.length} {registry.length === 1 ? 'Restaurant' : 'Restaurants'}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.88)' }}>
              🟢 {activeCount} Active · 🟡 {trialCount} Trial · 🔴 {suspendedCount} Paused · Monthly Income ₹{totalMrr.toLocaleString('en-IN')}/mo
            </p>
          </div>
          <button
            type="button"
            className="chip"
            style={{
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.35)',
              fontSize: '11px',
            }}
            onClick={() => pullFromGoogleSheets()}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="pts" style={{ marginBottom: '10px' }}>
        <div>
          <div className="mu">Total Restaurants</div>
          <div className="big">{registry.length}</div>
          <div className="mu" style={{ fontSize: '11px' }}>
            {activeCount} currently active
          </div>
        </div>
        <div>
          <div className="mu">Monthly Income</div>
          <div className="big">₹{totalMrr.toLocaleString('en-IN')}</div>
          <div className="mu" style={{ fontSize: '11px' }}>
            From active plans
          </div>
        </div>
      </div>

      {/* Expand / Collapse All Row */}
      <div className="row sp" style={{ marginBottom: '10px' }}>
        <span className="mu" style={{ fontSize: '12px' }}>
          Tap any section below to expand or collapse
        </span>
        <div className="row" style={{ gap: '6px' }}>
          <button
            type="button"
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllSa(true)}
          >
            Expand All
          </button>
          <button
            type="button"
            className="chip"
            style={{ fontSize: '11px' }}
            onClick={() => setAllSa(false)}
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Section 1: All Restaurant Clients */}
      <CollapsibleSection
        title="🏪 All Restaurant Clients"
        badge={`${registry.length}`}
        isOpen={!!openSaSections.clients}
        onToggle={() => toggleSaSection('clients')}
      >
        <input
          value={searchClient}
          onChange={(e) => setSearchClient(e.target.value)}
          placeholder="🔍 Search by restaurant name, owner name or mobile..."
          className="inp"
          style={{ width: '100%', marginBottom: '10px' }}
        />

        {filteredRegistry.length === 0 ? (
          <p className="mu">
            No restaurants added yet. Open <b>➕ Add New Restaurant Client</b>{' '}
            below to create your first client restaurant.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {filteredRegistry.map((w) => {
              const link = `${baseUrl}/?w=${encodeURIComponent(w.slug)}${
                w.spreadsheetId
                  ? `&s=${encodeURIComponent(w.spreadsheetId)}`
                  : ''
              }`;
              const clientSheetUrl = w.spreadsheetId
                ? `https://docs.google.com/spreadsheets/d/${w.spreadsheetId}/edit`
                : '';
              const clientDriveUrl = w.driveFolderId
                ? `https://drive.google.com/drive/folders/${w.driveFolderId}`
                : '';
              const waText =
                `🏪 *Welcome to ${w.restaurantName} Digital QR Ordering & Growth Platform!*\n\n` +
                `🔗 *Your Restaurant Link:*\n${link}\n\n` +
                `👤 *Owner Login Mobile:* ${w.ownerMobile || 'Your registered mobile'}\n` +
                `🔑 *Demo OTP:* 1234\n\n` +
                `Log in with your mobile number to open your *Owner Panel* & *Admin Settings* (Menu, GST, Brand Profile, Table QR Codes & Rewards).`;
              const waHref = `https://wa.me/${(w.ownerMobile || '').replace(
                /\D/g,
                ''
              )}?text=${encodeURIComponent(waText)}`;
              const statusVal = w.status || 'ACTIVE';

              return (
                <div
                  key={w.slug}
                  style={{
                    padding: '12px',
                    borderRadius: '14px',
                    background: 'var(--sf2)',
                    border: '1px solid rgba(148,163,184,0.28)',
                  }}
                >
                  <div
                    className="row sp"
                    style={{ alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}
                  >
                    <div>
                      <strong style={{ fontSize: '15px' }}>
                        🏪 {w.restaurantName}
                      </strong>
                      <div className="mu" style={{ fontSize: '12px', marginTop: '3px' }}>
                        👤 Owner: <b>{w.ownerName || '—'}</b> · 📱{' '}
                        {w.ownerMobile || '—'}
                      </div>
                      <div className="mu" style={{ fontSize: '11.5px', marginTop: '2px' }}>
                        📦 Plan: <b>{w.planName || 'Growth'}</b> · ₹
                        {w.monthlyFeeInr ?? 999}/month
                      </div>
                    </div>

                    <span
                      className={`tag ${
                        statusVal === 'ACTIVE'
                          ? 'ok'
                          : statusVal === 'TRIAL'
                            ? 'vip'
                            : 'hot'
                      }`}
                    >
                      {statusVal === 'ACTIVE'
                        ? '🟢 Active'
                        : statusVal === 'TRIAL'
                          ? '🟡 Trial'
                          : '🔴 Paused'}
                    </span>
                  </div>

                  {/* Quick Edit Controls: Default Style & Status */}
                  <div
                    className="row"
                    style={{
                      gap: '6px',
                      flexWrap: 'wrap',
                      marginTop: '8px',
                    }}
                  >
                    <select
                      aria-label={`Default style for ${w.restaurantName}`}
                      value={w.appStyle || 'style2'}
                      onChange={(e) =>
                        updateWorkspaceRecord(w.slug, {
                          appStyle: e.target.value as WorkspaceTenantRecord['appStyle'],
                        })
                      }
                      className="sel-cc"
                      style={{ fontSize: '11px', padding: '5px 8px' }}
                    >
                      <option value="style1">🌙 Style 1 · Classic Dark</option>
                      <option value="style2">☀️ Style 2 · Fresh Emerald</option>
                      <option value="style3">🥛 Style 3 · Milky White</option>
                      <option value="style4">⚡ Style 4 · DotPe Blue</option>
                      <option value="style5">🎁 Style 5 · Reelo Teal</option>
                      <option value="style6">👑 Style 6 · Royal Gold</option>
                    </select>

                    <select
                      aria-label={`Status for ${w.restaurantName}`}
                      value={statusVal}
                      onChange={(e) =>
                        updateWorkspaceRecord(w.slug, {
                          status: e.target.value as WorkspaceTenantRecord['status'],
                        })
                      }
                      className="sel-cc"
                      style={{ fontSize: '11px', padding: '5px 8px' }}
                    >
                      <option value="ACTIVE">🟢 Active</option>
                      <option value="TRIAL">🟡 Trial</option>
                      <option value="SUSPENDED">🔴 Paused</option>
                    </select>
                  </div>

                  {/* Action Links */}
                  <div
                    className="row"
                    style={{ gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}
                  >
                    <button
                      type="button"
                      className="chip on"
                      style={{ fontSize: '11px' }}
                      onClick={() => {
                        navigator.clipboard?.writeText(link);
                        say(`Copied Owner link for ${w.restaurantName} ✅`);
                      }}
                    >
                      📋 Copy Owner Link
                    </button>
                    <button
                      type="button"
                      className="chip on"
                      style={{ fontSize: '11px' }}
                      onClick={() => {
                        downloadStandaloneRestaurantZip(w, baseUrl);
                        say(
                          `Extracted & downloaded ${w.slug}-standalone-app-pack.zip to Downloads 📦`
                        );
                      }}
                    >
                      📦 Download Standalone ZIP
                    </button>
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noreferrer"
                      className="chip"
                      style={{ fontSize: '11px', textDecoration: 'none' }}
                    >
                      📲 Send on WhatsApp
                    </a>
                    <a
                      href={link}
                      target="_blank"
                      rel="noreferrer"
                      className="chip"
                      style={{ fontSize: '11px', textDecoration: 'none' }}
                    >
                      ↗️ Open Restaurant
                    </a>
                    {clientSheetUrl && (
                      <a
                        href={clientSheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="chip"
                        style={{ fontSize: '11px', textDecoration: 'none' }}
                      >
                        📊 Open Google Sheet ↗
                      </a>
                    )}
                    {clientDriveUrl && (
                      <a
                        href={clientDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="chip"
                        style={{ fontSize: '11px', textDecoration: 'none' }}
                      >
                        📁 Open Drive Folder ↗
                      </a>
                    )}
                    <button
                      type="button"
                      className="chip"
                      style={{ fontSize: '11px', color: '#ef4444' }}
                      onClick={() => removeWorkspaceRecord(w.slug)}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* Section 2: Add New Restaurant Client */}
      <CollapsibleSection
        title="➕ Add New Restaurant Client"
        isOpen={!!openSaSections.addClient}
        onToggle={() => toggleSaSection('addClient')}
      >
        <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
          Create a separate workspace for a new restaurant owner with their own
          menu, bills, GST, and Google Sheet.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div className="mu" style={{ fontSize: '11px' }}>
            🏪 Restaurant Name
          </div>
          <input
            value={wsName}
            onChange={(e) => {
              const v = e.target.value;
              setWsName(v);
              setWsSlug(
                v
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              );
            }}
            placeholder="e.g. Royal Dhaba"
            className="inp"
          />

          <div className="mu" style={{ fontSize: '11px' }}>
            🔗 Short Web Link Name (auto-filled)
          </div>
          <input
            value={wsSlug}
            onChange={(e) =>
              setWsSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]/g, '-')
              )
            }
            placeholder="e.g. royal-dhaba"
            className="inp"
          />

          <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: '160px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                🎨 Default Theme Style
              </div>
              <select
                aria-label="Workspace Default App Style"
                value={wsDefaultStyle}
                onChange={(e) =>
                  setWsDefaultStyle(
                    e.target.value as
                      | 'style1'
                      | 'style2'
                      | 'style3'
                      | 'style4'
                      | 'style5'
                      | 'style6'
                  )
                }
                className="sel-cc"
                style={{ width: '100%' }}
              >
                <option value="style1">🌙 Style 1 · Classic Dark</option>
                <option value="style2">☀️ Style 2 · Fresh Emerald</option>
                <option value="style3">🥛 Style 3 · Milky White</option>
                <option value="style4">⚡ Style 4 · DotPe Blue</option>
                <option value="style5">🎁 Style 5 · Reelo Teal</option>
                <option value="style6">👑 Style 6 · Royal Gold</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '100px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                📦 Plan
              </div>
              <select
                aria-label="Subscription Plan"
                value={wsPlanName}
                onChange={(e) =>
                  setWsPlanName(e.target.value as 'Starter' | 'Growth' | 'Pro')
                }
                className="sel-cc"
                style={{ width: '100%' }}
              >
                <option value="Starter">Starter</option>
                <option value="Growth">Growth</option>
                <option value="Pro">Pro</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: '90px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                💳 Monthly Price (₹)
              </div>
              <input
                value={wsMonthlyFee}
                onChange={(e) => setWsMonthlyFee(e.target.value)}
                placeholder="999"
                inputMode="numeric"
                className="inp"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '140px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                👤 Owner Name
              </div>
              <input
                value={wsOwnerName}
                onChange={(e) => setWsOwnerName(e.target.value)}
                placeholder="e.g. Rajesh Patel"
                className="inp"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                📱 Owner Mobile Number
              </div>
              <CountryCodeMobileInput
                id="sa-ws-owner-mob"
                value={wsOwnerMob}
                onChange={setWsOwnerMob}
              />
            </div>
          </div>

          <div className="mu" style={{ fontSize: '11px' }}>
            📊 Restaurant&apos;s Google Sheet Link (Share → Anyone with link → Editor)
          </div>
          <input
            value={wsSheetRaw}
            onChange={(e) => setWsSheetRaw(e.target.value)}
            placeholder="Paste their blank Google Sheet link"
            className="inp"
          />

          <div className="mu" style={{ fontSize: '11px' }}>
            📁 Restaurant&apos;s Google Drive Folder Link (optional, for photos &amp; reels)
          </div>
          <input
            value={wsDriveRaw}
            onChange={(e) => setWsDriveRaw(e.target.value)}
            placeholder="Paste their Google Drive folder link (optional)"
            className="inp"
          />

          <button
            type="button"
            className="btn alt"
            disabled={provisioning}
            onClick={async () => {
              const cleanName = wsName.trim();
              const cleanSlug = wsSlug
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '-');
              const cleanSheetId = extractGoogleIdFromUrl(wsSheetRaw, 'sheet');
              const cleanDriveId = extractGoogleIdFromUrl(wsDriveRaw, 'folder');
              if (!cleanName || !cleanSlug) {
                say('Enter Restaurant Name first');
                return;
              }
              if (!cleanSheetId) {
                say('Paste a Google Sheet link for this restaurant');
                return;
              }
              const normOwnerMob = wsOwnerMob.trim()
                ? `${S.cc}${wsOwnerMob.replace(/\D/g, '')}`
                : '';
              setProvisioning(true);
              try {
                const url = await createAndProvisionWorkspace({
                  slug: cleanSlug,
                  restaurantName: cleanName,
                  appStyle: wsDefaultStyle,
                  status: 'ACTIVE',
                  planName: wsPlanName,
                  monthlyFeeInr: Number(wsMonthlyFee) || 999,
                  ownerName: wsOwnerName.trim() || 'Owner',
                  ownerMobile: normOwnerMob,
                  spreadsheetId: cleanSheetId,
                  driveFolderId: cleanDriveId,
                  appsScriptWebAppUrl:
                    wsScriptUrl.trim() ||
                    S.googleConfig.appsScriptWebAppUrl ||
                    '',
                });
                setLastHandoverUrl(url);
                setWsName('');
                setWsSlug('');
                setWsOwnerName('');
                setWsOwnerMob('');
                setWsSheetRaw('');
                setWsDriveRaw('');
              } finally {
                setProvisioning(false);
              }
            }}
          >
            {provisioning
              ? '⏳ Setting Up Restaurant Sheet...'
              : '✅ Create Restaurant & Get Owner Link'}
          </button>

          {lastHandoverUrl && (
            <div
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(92,242,192,0.12)',
                border: '1px solid rgba(92,242,192,0.35)',
                fontSize: '12px',
              }}
            >
              <b>✅ Restaurant Ready! Share This Link with the Owner:</b>
              <div
                style={{
                  wordBreak: 'break-all',
                  margin: '4px 0 8px',
                  color: '#3b82f6',
                }}
              >
                {lastHandoverUrl}
              </div>
              <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => {
                    navigator.clipboard?.writeText(lastHandoverUrl);
                    say('Owner link copied ✅');
                  }}
                >
                  📋 Copy Owner Link
                </button>
                <a
                  href={lastHandoverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="chip"
                  style={{ textDecoration: 'none' }}
                >
                  ↗️ Open Restaurant
                </a>
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Section 2B: Extract & Download Standalone App ZIP Pack */}
      <CollapsibleSection
        title="📦 Download Standalone App ZIP (Single-Restaurant Buyer Pack)"
        badge="ZIP Download"
        isOpen={!!openSaSections.standalonePack}
        onToggle={() => toggleSaSection('standalonePack')}
      >
        <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
          If a restaurant owner buys a standalone app to host on their own
          domain (without multiple restaurant creation or Super Admin), select
          their restaurant below and click the button to extract and save their
          ready-to-host <b>.zip</b> package into your <b>Downloads</b> folder.
        </p>
        {(() => {
          const allPackOptions: WorkspaceTenantRecord[] = [
            ...registry,
            {
              slug: 'tadka-truck',
              restaurantName:
                S.googleConfig.restaurantName || 'Tadka Truck',
              appStyle: S.googleConfig.appStyle || 'style2',
              ownerName: S.googleConfig.ownerName || 'Owner',
              ownerMobile: S.googleConfig.ownerMobile || S.me.mob || '',
              spreadsheetId: S.googleConfig.spreadsheetId || '',
              driveFolderId: S.googleConfig.driveFolderId || '',
              appsScriptWebAppUrl:
                S.googleConfig.appsScriptWebAppUrl || '',
              createdAt: new Date().toISOString(),
            },
          ];
          const activePackSlug =
            selectedPackSlug &&
            allPackOptions.some((o) => o.slug === selectedPackSlug)
              ? selectedPackSlug
              : allPackOptions[0]?.slug || 'tadka-truck';
          const selectedClient =
            allPackOptions.find((o) => o.slug === activePackSlug) ||
            allPackOptions[0];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="mu" style={{ fontSize: '11px' }}>
                🏪 Choose Restaurant to Package as Standalone App
              </div>
              <select
                aria-label="Choose restaurant for standalone ZIP download"
                value={activePackSlug}
                onChange={(e) => setSelectedPackSlug(e.target.value)}
                className="sel-cc"
                style={{ width: '100%' }}
              >
                {allPackOptions.map((o) => (
                  <option key={o.slug} value={o.slug}>
                    🏪 {o.restaurantName} ({o.slug}) · Owner:{' '}
                    {o.ownerName || '—'}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn alt"
                onClick={() => {
                  if (!selectedClient) return;
                  downloadStandaloneRestaurantZip(selectedClient, baseUrl);
                  say(
                    `Saved ${selectedClient.slug}-standalone-app-pack.zip to your Downloads folder 📦`
                  );
                }}
              >
                📦 Extract &amp; Download Standalone App ZIP
              </button>
            </div>
          );
        })()}
      </CollapsibleSection>

      {/* Section 3: Master Google Sheet & Drive Storage Setup */}
      <CollapsibleSection
        title="☁️ Google Sheet &amp; Drive Storage Setup"
        badge="Master Storage"
        isOpen={!!openSaSections.storage}
        onToggle={() => toggleSaSection('storage')}
      >
        <p className="mu" style={{ fontSize: '12px', margin: '0 0 8px' }}>
          All your restaurant clients, owner mobile numbers, and plans are saved
          automatically in your Master Google Sheet under the{' '}
          <b>SuperAdmin_Workspaces</b> tab.
        </p>
        <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {masterSheetUrl && (
            <a
              href={masterSheetUrl}
              target="_blank"
              rel="noreferrer"
              className="chip on"
              style={{ textDecoration: 'none', fontSize: '12px' }}
            >
              📊 Open Master Google Sheet ↗
            </a>
          )}
          <button
            type="button"
            className="chip"
            style={{ fontSize: '12px' }}
            onClick={() => syncToGoogleSheets()}
          >
            ☁️ Save All to Google Sheet Now
          </button>
        </div>
        <GoogleStorageAdminCard />
      </CollapsibleSection>

      {/* Section 4: Test Mobile Login Access */}
      <CollapsibleSection
        title="🔐 Check Mobile Login Access"
        isOpen={!!openSaSections.loginTest}
        onToggle={() => toggleSaSection('loginTest')}
      >
        <p className="mu" style={{ margin: '0 0 8px' }}>
          Enter any phone number to see which role and panel will open when they
          log in.
        </p>
        <CountryCodeMobileInput
          id="sa-alg"
          value={checkMob}
          onChange={setCheckMob}
        />
        <button className="btn ghost" onClick={() => checkLogin(checkMob)}>
          Check Access
        </button>
        {S.alr && <p style={{ marginTop: '8px' }}>{S.alr}</p>}
      </CollapsibleSection>

      {/* Section 5: Reset Demo Data */}
      <CollapsibleSection
        title="🔄 Reset Demo Data"
        isOpen={!!openSaSections.resetDemo}
        onToggle={() => toggleSaSection('resetDemo')}
      >
        <div className="row sp">
          <span className="mu">Reset current browser demo data</span>
          <button className="chip" onClick={resetDemoState}>
            Reset All
          </button>
        </div>
      </CollapsibleSection>
    </>
  );
}

function SuperAdminWorkspaceManagerSection({
  isOpen,
  onToggle,
}: {
  isOpen: boolean;
  onToggle: () => void;
}) {
  const {
    S,
    activeWorkspaceSlug,
    isSuperAdmin,
    unlockSuperAdmin,
    createAndProvisionWorkspace,
    say,
  } = useTadka();

  const [pinInput, setPinInput] = useState('');
  const [wsName, setWsName] = useState('');
  const [wsSlug, setWsSlug] = useState('');
  const [wsDefaultStyle, setWsDefaultStyle] = useState<
    'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6'
  >('style2');
  const [wsOwnerName, setWsOwnerName] = useState('');
  const [wsOwnerMob, setWsOwnerMob] = useState('');
  const [wsSheetRaw, setWsSheetRaw] = useState('');
  const [wsDriveRaw, setWsDriveRaw] = useState('');
  const [wsScriptUrl, setWsScriptUrl] = useState(
    S.googleConfig.appsScriptWebAppUrl || ''
  );
  const [provisioning, setProvisioning] = useState(false);
  const [lastHandoverUrl, setLastHandoverUrl] = useState('');

  // In any client workspace (?w=client-slug), completely hide Super Admin from the Restaurant Owner
  if (!isSuperAdmin && activeWorkspaceSlug !== 'tadka-truck') {
    return null;
  }

  const registry = S.googleConfig.workspacesRegistry || [];
  const baseUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${
          window.location.pathname.includes('/My_Restaurants')
            ? '/My_Restaurants'
            : ''
        }`
      : 'https://pradeepparmar902.github.io/My_Restaurants';

  return (
    <CollapsibleSection
      title="🏢 Super Admin — Multi-Workspace &amp; Client Handover"
      badge={`${registry.length} clients`}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      {!isSuperAdmin ? (
        <div>
          <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
            Enter Super Admin Master PIN (<code>SUPER123</code>) or log in with
            Super Admin mobile (<code>+919800000001</code>) to create &amp;
            hand over isolated restaurant workspaces.
          </p>
          <div className="row" style={{ gap: '6px' }}>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Super Admin PIN (SUPER123)"
              className="inp"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="chip on"
              onClick={() => unlockSuperAdmin(pinInput)}
            >
              🔓 Unlock Super Admin
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '8px',
              background: 'rgba(92,242,192,0.1)',
              border: '1px solid rgba(92,242,192,0.3)',
              fontSize: '12px',
            }}
          >
            🟢 <b>Super Admin Active</b> · Current Workspace:{' '}
            <code>{activeWorkspaceSlug}</code>
            <div className="mu" style={{ fontSize: '11px', marginTop: '3px' }}>
              Each workspace has 100% isolated Google Sheet, Drive folder, Menu,
              GST, Brand Profile &amp; Orders. When the Restaurant Owner logs in
              with their mobile number, they land directly on their{' '}
              <b>Owner Panel</b>.
            </div>
          </div>

          <div className="mu" style={{ fontSize: '11px' }}>
            🏪 Client Restaurant / Brand Name
          </div>
          <input
            value={wsName}
            onChange={(e) => {
              const v = e.target.value;
              setWsName(v);
              setWsSlug(
                v
                  .toLowerCase()
                  .trim()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              );
            }}
            placeholder="e.g. Royal Dhaba"
            className="inp"
          />

          <div className="mu" style={{ fontSize: '11px' }}>
            🔗 Workspace Slug (URL identifier: <code>?w={wsSlug || 'royal-dhaba'}</code>)
          </div>
          <input
            value={wsSlug}
            onChange={(e) =>
              setWsSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9_-]/g, '-')
              )
            }
            placeholder="e.g. royal-dhaba"
            className="inp"
          />

          <div className="mu" style={{ fontSize: '11px' }}>
            🎨 Default App Style for this Workspace
          </div>
          <select
            aria-label="Workspace Default App Style"
            value={wsDefaultStyle}
            onChange={(e) =>
              setWsDefaultStyle(
                e.target.value as
                  | 'style1'
                  | 'style2'
                  | 'style3'
                  | 'style4'
                  | 'style5'
                  | 'style6'
              )
            }
            className="sel-cc"
          >
            <option value="style1">🌙 Style 1 · Classic Neon Dark</option>
            <option value="style2">☀️ Style 2 · Fresh Food-App (Emerald &amp; Saffron)</option>
            <option value="style3">🥛 Style 3 · Milky White &amp; Gourmet Crimson</option>
            <option value="style4">⚡ Style 4 · DotPe Commerce (Electric Blue &amp; Navy)</option>
            <option value="style5">🎁 Style 5 · Reelo Loyalty (Teal-Cyan &amp; Gold)</option>
            <option value="style6">👑 Style 6 · Royal Gold &amp; Maharaja Amber</option>
          </select>

          <div className="row" style={{ gap: '6px' }}>
            <div style={{ flex: 1 }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                👤 Owner Name
              </div>
              <input
                value={wsOwnerName}
                onChange={(e) => setWsOwnerName(e.target.value)}
                placeholder="e.g. Rajesh Patel"
                className="inp"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
                📱 Owner Login Mobile (lands on Owner Panel)
              </div>
              <CountryCodeMobileInput
                id="ws-owner-mob"
                value={wsOwnerMob}
                onChange={setWsOwnerMob}
              />
            </div>
          </div>

          <div className="mu" style={{ fontSize: '11px' }}>
            📊 Client&apos;s Google Sheet URL or Spreadsheet ID (Set Share → Anyone with link → Editor)
          </div>
          <input
            value={wsSheetRaw}
            onChange={(e) => setWsSheetRaw(e.target.value)}
            placeholder="Paste new Google Sheet link or ID"
            className="inp"
          />

          <div className="mu" style={{ fontSize: '11px' }}>
            📁 Client&apos;s Google Drive Folder URL or ID (optional, for Reels/Screenshots)
          </div>
          <input
            value={wsDriveRaw}
            onChange={(e) => setWsDriveRaw(e.target.value)}
            placeholder="Paste Google Drive folder link or ID"
            className="inp"
          />

          <div className="row sp">
            <span className="mu" style={{ fontSize: '11px' }}>
              ⚙️ Apps Script Web App URL (writes to client&apos;s Sheet ID)
            </span>
            {S.googleConfig.appsScriptWebAppUrl && (
              <button
                type="button"
                className="chip"
                style={{ fontSize: '10px', padding: '2px 7px' }}
                onClick={() =>
                  setWsScriptUrl(S.googleConfig.appsScriptWebAppUrl)
                }
              >
                ⚡ Use Master Script URL
              </button>
            )}
          </div>
          <input
            value={wsScriptUrl}
            onChange={(e) => setWsScriptUrl(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            className="inp"
          />

          <button
            type="button"
            className="btn alt"
            disabled={provisioning}
            onClick={async () => {
              const cleanName = wsName.trim();
              const cleanSlug = wsSlug
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, '-');
              const cleanSheetId = extractGoogleIdFromUrl(wsSheetRaw, 'sheet');
              const cleanDriveId = extractGoogleIdFromUrl(wsDriveRaw, 'folder');
              if (!cleanName || !cleanSlug) {
                say('Enter Restaurant Name and Workspace Slug');
                return;
              }
              if (!cleanSheetId) {
                say('Paste a dedicated Google Sheet URL or ID for this workspace');
                return;
              }
              const normOwnerMob = wsOwnerMob.trim()
                ? `${S.cc}${wsOwnerMob.replace(/\D/g, '')}`
                : '';
              setProvisioning(true);
              try {
                const url = await createAndProvisionWorkspace({
                  slug: cleanSlug,
                  restaurantName: cleanName,
                  appStyle: wsDefaultStyle,
                  ownerName: wsOwnerName.trim() || 'Owner',
                  ownerMobile: normOwnerMob,
                  spreadsheetId: cleanSheetId,
                  driveFolderId: cleanDriveId,
                  appsScriptWebAppUrl:
                    wsScriptUrl.trim() ||
                    S.googleConfig.appsScriptWebAppUrl ||
                    '',
                });
                setLastHandoverUrl(url);
                setWsName('');
                setWsSlug('');
                setWsOwnerName('');
                setWsOwnerMob('');
                setWsSheetRaw('');
                setWsDriveRaw('');
              } finally {
                setProvisioning(false);
              }
            }}
          >
            {provisioning
              ? '⏳ Provisioning Client Sheet & Creating Workspace...'
              : '🚀 Create, Provision Sheet & Generate Owner Handover Link'}
          </button>

          {lastHandoverUrl && (
            <div
              style={{
                padding: '10px',
                borderRadius: '10px',
                background: 'rgba(92,242,192,0.12)',
                border: '1px solid rgba(92,242,192,0.35)',
                fontSize: '12px',
              }}
            >
              <b>✅ Workspace Provisioned! Handover Link:</b>
              <div
                style={{
                  wordBreak: 'break-all',
                  margin: '4px 0 8px',
                  color: '#93c5fd',
                }}
              >
                {lastHandoverUrl}
              </div>
              <div className="row" style={{ gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="chip on"
                  onClick={() => {
                    navigator.clipboard?.writeText(lastHandoverUrl);
                    say('Owner Handover Link copied ✅');
                  }}
                >
                  📋 Copy Handover Link
                </button>
                <a
                  href={lastHandoverUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="chip"
                  style={{ textDecoration: 'none' }}
                >
                  ↗️ Open Client Workspace
                </a>
              </div>
            </div>
          )}

          {registry.length > 0 && (
            <div style={{ marginTop: '6px' }}>
              <div className="mu" style={{ fontSize: '11px', marginBottom: '6px' }}>
                📋 Provisioned Client Workspaces ({registry.length})
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {registry.map((w) => {
                  const link = `${baseUrl}/?w=${encodeURIComponent(w.slug)}${
                    w.spreadsheetId
                      ? `&s=${encodeURIComponent(w.spreadsheetId)}`
                      : ''
                  }`;
                  const waText =
                    `🏪 *Welcome to ${w.restaurantName} Digital QR Ordering & Growth Platform!*\n\n` +
                    `🔗 *Your Dedicated Workspace Link:*\n${link}\n\n` +
                    `👤 *Owner Login Mobile:* ${w.ownerMobile || 'Your registered mobile'}\n` +
                    `🔑 *Demo OTP:* 1234\n\n` +
                    `Log in with your mobile number to open your *Owner Panel* & *Admin Settings* (Menu, GST, Brand Profile, Table QR Codes & Rewards).`;
                  const waHref = `https://wa.me/${(w.ownerMobile || '').replace(
                    /\D/g,
                    ''
                  )}?text=${encodeURIComponent(waText)}`;
                  return (
                    <div
                      key={w.slug}
                      style={{
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        fontSize: '12px',
                      }}
                    >
                      <div className="row sp" style={{ marginBottom: '4px' }}>
                        <strong>
                          🏪 {w.restaurantName}{' '}
                          <span className="mu" style={{ fontWeight: 400 }}>
                            (<code>?w={w.slug}</code>)
                          </span>
                        </strong>
                        <span className="mu" style={{ fontSize: '11px' }}>
                          Owner: {w.ownerName || '—'} ({w.ownerMobile || '—'})
                        </span>
                      </div>
                      <div
                        className="row"
                        style={{ gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}
                      >
                        <button
                          type="button"
                          className="chip on"
                          style={{ fontSize: '11px' }}
                          onClick={() => {
                            navigator.clipboard?.writeText(link);
                            say(`Copied handover link for ${w.restaurantName} ✅`);
                          }}
                        >
                          📋 Copy Owner Link
                        </button>
                        <a
                          href={waHref}
                          target="_blank"
                          rel="noreferrer"
                          className="chip"
                          style={{ fontSize: '11px', textDecoration: 'none' }}
                        >
                          📲 WhatsApp Handover to Owner
                        </a>
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="chip"
                          style={{ fontSize: '11px', textDecoration: 'none' }}
                        >
                          ↗️ Open Workspace
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}

export function AdminPortalView() {
  const {
    S,
    activeWorkspaceSlug,
    isStandaloneMode,
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
  const [appStyleInput, setAppStyleInput] = useState<
    'style1' | 'style2' | 'style3' | 'style4' | 'style5' | 'style6'
  >(
    S.googleConfig.appStyle === 'style6'
      ? 'style6'
      : S.googleConfig.appStyle === 'style5'
        ? 'style5'
        : S.googleConfig.appStyle === 'style4'
          ? 'style4'
          : S.googleConfig.appStyle === 'style3'
            ? 'style3'
            : S.googleConfig.appStyle === 'style2'
              ? 'style2'
              : 'style1'
  );
  const [restaurantNameInput, setRestaurantNameInput] = useState(
    S.googleConfig.restaurantName || 'Tadka Truck'
  );
  const [restaurantTaglineInput, setRestaurantTaglineInput] = useState(
    S.googleConfig.restaurantTagline || ''
  );
  const [menuLanguagesInput, setMenuLanguagesInput] = useState<MenuLanguageOption[]>(
    S.googleConfig.menuLanguages?.length
      ? S.googleConfig.menuLanguages
      : DEFAULT_MENU_LANGUAGES
  );
  const [newLangLabel, setNewLangLabel] = useState('');
  const [editingLangCode, setEditingLangCode] = useState<string | null>(null);
  const [editingLangLabel, setEditingLangLabel] = useState('');
  const [dietaryFiltersInput, setDietaryFiltersInput] = useState<DietaryFilterOption[]>(
    S.googleConfig.dietaryFilters
      ? S.googleConfig.dietaryFilters
      : DEFAULT_DIETARY_FILTERS
  );
  const [newDietaryEmoji, setNewDietaryEmoji] = useState('🍗');
  const [newDietaryLabel, setNewDietaryLabel] = useState('');
  const [editingDietaryId, setEditingDietaryId] = useState<string | null>(null);
  const [editingDietaryEmoji, setEditingDietaryEmoji] = useState('');
  const [editingDietaryLabel, setEditingDietaryLabel] = useState('');
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

  // Keep Admin form inputs synced when Google Sheets finishes pulling S.googleConfig
  useEffect(() => {
    setAppStyleInput(
      S.googleConfig.appStyle === 'style6'
        ? 'style6'
        : S.googleConfig.appStyle === 'style5'
          ? 'style5'
          : S.googleConfig.appStyle === 'style4'
            ? 'style4'
            : S.googleConfig.appStyle === 'style3'
              ? 'style3'
              : S.googleConfig.appStyle === 'style2'
                ? 'style2'
                : 'style1'
    );
    setRestaurantNameInput(S.googleConfig.restaurantName || 'Tadka Truck');
    setRestaurantTaglineInput(S.googleConfig.restaurantTagline || '');
    if (S.googleConfig.menuLanguages?.length) {
      setMenuLanguagesInput(S.googleConfig.menuLanguages);
    } else if (S.googleConfig.enabledLanguages?.length) {
      setMenuLanguagesInput(
        DEFAULT_MENU_LANGUAGES.map((l) => ({
          ...l,
          enabled: S.googleConfig.enabledLanguages!.includes(l.code),
        }))
      );
    }
    if (S.googleConfig.dietaryFilters) {
      setDietaryFiltersInput(S.googleConfig.dietaryFilters);
    } else {
      setDietaryFiltersInput(
        DEFAULT_DIETARY_FILTERS.map((f) => ({
          ...f,
          enabled:
            f.id === 'veg'
              ? S.googleConfig.showVegFilter !== false
              : f.id === 'jain'
                ? S.googleConfig.showJainFilter !== false
                : f.enabled,
        }))
      );
    }
    setRevUrlInput(S.googleConfig.googleReviewUrl || '');
    setIgHandleInput(S.googleConfig.instagramHandle || '@tadkatruck');
    setFbUrlInput(S.googleConfig.facebookUrl || '');
    setSocTagInput(S.googleConfig.socialTag || '#TadkaTruck @tadkatruck');
    setUpiIdInput(S.googleConfig.upiId || '');
    setUpiNameInput(S.googleConfig.upiName || 'Tadka Truck');
    setGstEnabledInput(S.googleConfig.gstEnabled !== false);
    setGstRateInput(String(S.googleConfig.gstRate ?? 5));
    setGstModeInput(S.googleConfig.gstMode === 'item' ? 'item' : 'bill');
    setGstinInput(S.googleConfig.gstin || '');
  }, [S.googleConfig]);

  const [openAdminSections, setOpenAdminSections] = useState<
    Record<string, boolean>
  >({
    team: true,
    giveAccess: false,
    whatsappBill: false,
    gstSettings: false,
    rewardMaster: false,
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
      brandProfile: val,
      gstSettings: val,
      rewardMaster: val,
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
  const [newDishLangCode, setNewDishLangCode] = useState('hi');
  const [newDishTranslations, setNewDishTranslations] = useState<Record<string, string>>({});
  const [newDishPrice, setNewDishPrice] = useState('100');
  const [newDishEmoji, setNewDishEmoji] = useState('🍲');
  const [newDishDietaryId, setNewDishDietaryId] = useState('veg');
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
        title="🏪 Restaurant / Brand Profile"
        badge={`${S.googleConfig.restaurantName || 'Tadka Truck'} · ${
          S.googleConfig.appStyle === 'style6'
            ? 'Style 6 (Royal Gold)'
            : S.googleConfig.appStyle === 'style5'
              ? 'Style 5 (Reelo)'
              : S.googleConfig.appStyle === 'style4'
                ? 'Style 4 (DotPe)'
                : S.googleConfig.appStyle === 'style3'
                  ? 'Style 3'
                  : S.googleConfig.appStyle === 'style2'
                    ? 'Style 2'
                    : 'Style 1'
        }`}
        isOpen={!!openAdminSections.brandProfile}
        onToggle={() => toggleAdminSection('brandProfile')}
      >
        <p className="mu" style={{ margin: '0 0 8px', fontSize: '12px' }}>
          Set your restaurant&apos;s app theme style, display name, tagline,
          menu languages, and dietary filter chips. Synced via Google Sheets
          (`Restaurant_Config`).
        </p>

        <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
          🎨 App Visual Style &amp; Colour Combination (Applies to Entire App)
        </div>
        <div
          className="row"
          style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}
        >
          <button
            type="button"
            className={`chip ${appStyleInput === 'style1' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style1');
              saveGoogleConfig({ appStyle: 'style1' });
            }}
          >
            {appStyleInput === 'style1' ? '✅ ' : ''}🌙 Style 1 · Classic Neon Dark
          </button>
          <button
            type="button"
            className={`chip ${appStyleInput === 'style2' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style2');
              saveGoogleConfig({ appStyle: 'style2' });
            }}
          >
            {appStyleInput === 'style2' ? '✅ ' : ''}☀️ Style 2 · Fresh Food-App (Emerald &amp; Saffron)
          </button>
          <button
            type="button"
            className={`chip ${appStyleInput === 'style3' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style3');
              saveGoogleConfig({ appStyle: 'style3' });
            }}
          >
            {appStyleInput === 'style3' ? '✅ ' : ''}🥛 Style 3 · Milky White &amp; Gourmet Crimson
          </button>
          <button
            type="button"
            className={`chip ${appStyleInput === 'style4' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style4');
              saveGoogleConfig({ appStyle: 'style4' });
            }}
          >
            {appStyleInput === 'style4' ? '✅ ' : ''}⚡ Style 4 · DotPe Commerce (Electric Blue &amp; Navy)
          </button>
          <button
            type="button"
            className={`chip ${appStyleInput === 'style5' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style5');
              saveGoogleConfig({ appStyle: 'style5' });
            }}
          >
            {appStyleInput === 'style5' ? '✅ ' : ''}🎁 Style 5 · Reelo Loyalty (Teal-Cyan &amp; Gold)
          </button>
          <button
            type="button"
            className={`chip ${appStyleInput === 'style6' ? 'on' : ''}`}
            style={{ flex: 1, minWidth: '150px', textAlign: 'center' }}
            onClick={() => {
              setAppStyleInput('style6');
              saveGoogleConfig({ appStyle: 'style6' });
            }}
          >
            {appStyleInput === 'style6' ? '✅ ' : ''}👑 Style 6 · Royal Gold &amp; Maharaja Amber
          </button>
        </div>

        <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
          🏪 Restaurant / Brand Name
        </div>
        <input
          value={restaurantNameInput}
          onChange={(e) => setRestaurantNameInput(e.target.value)}
          placeholder="Tadka Truck"
          className="inp"
          style={{ width: '100%', marginBottom: '8px' }}
        />
        <div className="mu" style={{ fontSize: '11px', marginBottom: '3px' }}>
          💬 Hero Tagline / Subtitle (leave blank for default: &ldquo;Scan done. Pick your food, we cook it fresh.&rdquo;)
        </div>
        <input
          value={restaurantTaglineInput}
          onChange={(e) => setRestaurantTaglineInput(e.target.value)}
          placeholder="Scan done. Pick your food, we cook it fresh."
          className="inp"
          style={{ width: '100%', marginBottom: '10px' }}
        />

        <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
          🌐 Customer Menu Languages (Toggle, Edit Label, Delete, or Add New)
        </div>
        <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {menuLanguagesInput.map((lang) =>
            editingLangCode === lang.code ? (
              <span
                key={lang.code}
                className="row"
                style={{
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                <input
                  value={editingLangLabel}
                  onChange={(e) => setEditingLangLabel(e.target.value)}
                  className="inp"
                  style={{ width: '110px', padding: '4px 8px', fontSize: '12px' }}
                  autoFocus
                />
                <button
                  type="button"
                  className="chip on"
                  style={{ margin: 0, padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => {
                    const nextLabel = editingLangLabel.trim();
                    if (!nextLabel) return;
                    setMenuLanguagesInput((prev) =>
                      prev.map((l) =>
                        l.code === lang.code ? { ...l, label: nextLabel } : l
                      )
                    );
                    setEditingLangCode(null);
                  }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="chip"
                  style={{ margin: 0, padding: '3px 7px', fontSize: '11px' }}
                  onClick={() => setEditingLangCode(null)}
                >
                  ✕
                </button>
              </span>
            ) : (
              <span
                key={lang.code}
                className="row"
                style={{
                  gap: '2px',
                  padding: '2px 6px 2px 2px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <button
                  type="button"
                  className={`chip ${lang.enabled ? 'on' : ''}`}
                  style={{ margin: 0 }}
                  onClick={() => {
                    const enabledCount = menuLanguagesInput.filter((l) => l.enabled).length;
                    if (lang.enabled && enabledCount <= 1) {
                      say('Keep at least 1 language enabled');
                      return;
                    }
                    setMenuLanguagesInput((prev) =>
                      prev.map((l) =>
                        l.code === lang.code ? { ...l, enabled: !l.enabled } : l
                      )
                    );
                  }}
                >
                  {lang.enabled ? '✅ ' : ''}{lang.label}
                </button>
                <button
                  type="button"
                  title={`Rename ${lang.label}`}
                  onClick={() => {
                    setEditingLangCode(lang.code);
                    setEditingLangLabel(lang.label);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '0 4px',
                  }}
                >
                  ✏️
                </button>
                {menuLanguagesInput.length > 1 && (
                  <button
                    type="button"
                    title={`Delete ${lang.label}`}
                    onClick={() => {
                      const remaining = menuLanguagesInput.filter(
                        (l) => l.code !== lang.code
                      );
                      if (!remaining.some((l) => l.enabled) && remaining[0]) {
                        remaining[0] = { ...remaining[0], enabled: true };
                      }
                      setMenuLanguagesInput(remaining);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#fca5a5',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '0 4px',
                    }}
                  >
                    ✕
                  </button>
                )}
              </span>
            )
          )}
        </div>
        <div className="row" style={{ gap: '6px', marginBottom: '10px' }}>
          <input
            value={newLangLabel}
            onChange={(e) => setNewLangLabel(e.target.value)}
            placeholder="Add language (e.g. मराठी, ਪੰਜਾਬੀ, Tamil)"
            className="inp"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="chip on"
            onClick={() => {
              const label = newLangLabel.trim();
              if (!label) return;
              const code =
                label
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '_')
                  .replace(/^_|_$/g, '') || `lang_${Date.now().toString(36)}`;
              if (
                menuLanguagesInput.some(
                  (l) =>
                    l.code === code ||
                    l.label.toLowerCase() === label.toLowerCase()
                )
              ) {
                say('Language already exists');
                return;
              }
              setMenuLanguagesInput((prev) => [
                ...prev,
                { code, label, enabled: true },
              ]);
              setNewLangLabel('');
            }}
          >
            + Add Language
          </button>
        </div>

        <div className="mu" style={{ fontSize: '11px', marginBottom: '4px' }}>
          🥗 Customer Dietary Filter Chips (Toggle, Edit Label, Delete, or Add New)
        </div>
        <div className="row" style={{ gap: '6px', flexWrap: 'wrap', marginBottom: '6px' }}>
          {dietaryFiltersInput.map((f) =>
            editingDietaryId === f.id ? (
              <span
                key={f.id}
                className="row"
                style={{
                  gap: '4px',
                  padding: '3px 6px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.1)',
                }}
              >
                <input
                  value={editingDietaryEmoji}
                  onChange={(e) => setEditingDietaryEmoji(e.target.value)}
                  className="inp"
                  style={{ width: '40px', padding: '4px', textAlign: 'center', fontSize: '12px' }}
                />
                <input
                  value={editingDietaryLabel}
                  onChange={(e) => setEditingDietaryLabel(e.target.value)}
                  className="inp"
                  style={{ width: '110px', padding: '4px 8px', fontSize: '12px' }}
                  autoFocus
                />
                <button
                  type="button"
                  className="chip on"
                  style={{ margin: 0, padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => {
                    const nextLabel = editingDietaryLabel.trim();
                    if (!nextLabel) return;
                    setDietaryFiltersInput((prev) =>
                      prev.map((x) =>
                        x.id === f.id
                          ? {
                              ...x,
                              emoji: editingDietaryEmoji.trim(),
                              label: nextLabel,
                            }
                          : x
                      )
                    );
                    setEditingDietaryId(null);
                  }}
                >
                  ✓
                </button>
                <button
                  type="button"
                  className="chip"
                  style={{ margin: 0, padding: '3px 7px', fontSize: '11px' }}
                  onClick={() => setEditingDietaryId(null)}
                >
                  ✕
                </button>
              </span>
            ) : (
              <span
                key={f.id}
                className="row"
                style={{
                  gap: '2px',
                  padding: '2px 6px 2px 2px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                }}
              >
                <button
                  type="button"
                  className={`chip ${f.enabled ? 'on' : ''}`}
                  style={{ margin: 0 }}
                  onClick={() =>
                    setDietaryFiltersInput((prev) =>
                      prev.map((x) =>
                        x.id === f.id ? { ...x, enabled: !x.enabled } : x
                      )
                    )
                  }
                >
                  {f.enabled ? '✅ ' : ''}{f.emoji ? `${f.emoji} ` : ''}{f.label}
                </button>
                <button
                  type="button"
                  title={`Rename ${f.label}`}
                  onClick={() => {
                    setEditingDietaryId(f.id);
                    setEditingDietaryEmoji(f.emoji || '');
                    setEditingDietaryLabel(f.label);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#93c5fd',
                    cursor: 'pointer',
                    fontSize: '11px',
                    padding: '0 4px',
                  }}
                >
                  ✏️
                </button>
                <button
                  type="button"
                  title={`Delete ${f.label}`}
                  onClick={() =>
                    setDietaryFiltersInput((prev) =>
                      prev.filter((x) => x.id !== f.id)
                    )
                  }
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#fca5a5',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 4px',
                  }}
                >
                  ✕
                </button>
              </span>
            )
          )}
        </div>
        <div className="row" style={{ gap: '6px', marginBottom: '10px' }}>
          <input
            value={newDietaryEmoji}
            onChange={(e) => setNewDietaryEmoji(e.target.value)}
            placeholder="🍗"
            className="inp"
            style={{ width: '52px', textAlign: 'center' }}
          />
          <input
            value={newDietaryLabel}
            onChange={(e) => setNewDietaryLabel(e.target.value)}
            placeholder="Add dietary filter (e.g. Non-Veg, Vegan, Spicy)"
            className="inp"
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="chip on"
            onClick={() => {
              const label = newDietaryLabel.trim();
              if (!label) return;
              const id =
                label
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '') || `diet_${Date.now().toString(36)}`;
              if (
                dietaryFiltersInput.some(
                  (x) =>
                    x.id === id ||
                    x.label.toLowerCase() === label.toLowerCase()
                )
              ) {
                say('Dietary filter already exists');
                return;
              }
              setDietaryFiltersInput((prev) => [
                ...prev,
                {
                  id,
                  label,
                  emoji: newDietaryEmoji.trim() || '🍽️',
                  enabled: true,
                },
              ]);
              setNewDietaryLabel('');
            }}
          >
            + Add Filter
          </button>
        </div>

        <button
          className="btn alt"
          onClick={async () => {
            const enabledLangs = menuLanguagesInput
              .filter((l) => l.enabled)
              .map((l) => l.code as Language);
            const vegItem = dietaryFiltersInput.find((f) => f.id === 'veg');
            const jainItem = dietaryFiltersInput.find((f) => f.id === 'jain');
            const nextBrand = {
              appStyle: appStyleInput,
              restaurantName: restaurantNameInput.trim() || 'Tadka Truck',
              restaurantTagline: restaurantTaglineInput.trim(),
              menuLanguages: menuLanguagesInput,
              enabledLanguages: enabledLangs.length
                ? enabledLangs
                : (['en'] as Language[]),
              dietaryFilters: dietaryFiltersInput,
              showVegFilter: vegItem ? vegItem.enabled : false,
              showJainFilter: jainItem ? jainItem.enabled : false,
            };
            saveGoogleConfig(nextBrand);
            await syncToGoogleSheets(nextBrand);
            say('Brand profile, languages & dietary filters saved & synced ✅');
          }}
        >
          Save &amp; Sync Brand Profile
        </button>
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

      <RewardApprovalsSection
        isOpen={!!openAdminSections.rewards}
        onToggle={() => toggleAdminSection('rewards')}
      />

      <CollapsibleSection
        title="🎁 Rewards, Discounts, Coupons &amp; Stars Master"
        badge={S.googleConfig.rewardRules?.couponCode || DEFAULT_REWARD_RULES.couponCode}
        isOpen={!!openAdminSections.rewardMaster}
        onToggle={() => toggleAdminSection('rewardMaster')}
      >
        <RewardRulesMasterContent />
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
                  placeholder="Dish name (Default / English)"
                  className="inp"
                />
              </div>
              {(() => {
                const langOptions = menuLanguagesInput.length
                  ? menuLanguagesInput
                  : DEFAULT_MENU_LANGUAGES;
                const activeLangCode = langOptions.some(
                  (l) => l.code === newDishLangCode
                )
                  ? newDishLangCode
                  : langOptions[0]?.code || 'en';
                const activeLangObj = langOptions.find(
                  (l) => l.code === activeLangCode
                );
                return (
                  <div className="row" style={{ marginTop: '6px', gap: '6px' }}>
                    <select
                      aria-label="Translation language"
                      value={activeLangCode}
                      onChange={(e) => setNewDishLangCode(e.target.value)}
                      className="sel-cc"
                      style={{ minWidth: '120px' }}
                    >
                      {langOptions.map((l) => (
                        <option key={l.code} value={l.code}>
                          🌐 {l.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={newDishTranslations[activeLangCode] || ''}
                      onChange={(e) =>
                        setNewDishTranslations((prev) => ({
                          ...prev,
                          [activeLangCode]: e.target.value,
                        }))
                      }
                      placeholder={`${activeLangObj?.label || 'Translated'} name (optional)`}
                      className="inp"
                      style={{ flex: 1 }}
                    />
                  </div>
                );
              })()}
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
                {(() => {
                  const dietaryOpts = dietaryFiltersInput.length
                    ? dietaryFiltersInput
                    : DEFAULT_DIETARY_FILTERS;
                  const activeDietId = dietaryOpts.some(
                    (d) => d.id === newDishDietaryId
                  )
                    ? newDishDietaryId
                    : dietaryOpts[0]?.id || 'veg';
                  return (
                    <select
                      aria-label="New dish dietary"
                      value={activeDietId}
                      onChange={(e) => setNewDishDietaryId(e.target.value)}
                      className="sel-cc"
                    >
                      {dietaryOpts.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.emoji ? `${d.emoji} ` : ''}
                          {d.label}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>
              <button
                className="btn alt"
                disabled={!newDishEn.trim()}
                onClick={() => {
                  const baseName = newDishEn.trim();
                  const dietaryOpts = dietaryFiltersInput.length
                    ? dietaryFiltersInput
                    : DEFAULT_DIETARY_FILTERS;
                  const activeDietId = dietaryOpts.some(
                    (d) => d.id === newDishDietaryId
                  )
                    ? newDishDietaryId
                    : dietaryOpts[0]?.id || 'veg';
                  const activeDietObj = dietaryOpts.find(
                    (d) => d.id === activeDietId
                  );
                  const dietLabel = (
                    activeDietObj?.label || activeDietId
                  ).toLowerCase();
                  const isNonVeg =
                    activeDietId === 'nonveg' ||
                    dietLabel.includes('non-veg') ||
                    dietLabel.includes('non veg');
                  const isJain =
                    activeDietId === 'jain' || dietLabel.includes('jain');

                  const translatedMap: {
                    en: string;
                    hi: string;
                    gu: string;
                    [lang: string]: string;
                  } = {
                    en: baseName,
                    hi: (newDishTranslations.hi || '').trim() || baseName,
                    gu: (newDishTranslations.gu || '').trim() || baseName,
                  };
                  Object.entries(newDishTranslations).forEach(([code, val]) => {
                    if (val.trim()) translatedMap[code] = val.trim();
                  });

                  saveMenuDish({
                    e: newDishEmoji || '🍲',
                    p: Number(newDishPrice) || 100,
                    v: isNonVeg ? 0 : 1,
                    ...(isJain ? { jain: true } : {}),
                    dietaryTags: [activeDietId],
                    available: true,
                    ...(newDishGst !== '' ? { gstRate: Number(newDishGst) } : {}),
                    n: translatedMap,
                  });
                  setNewDishEn('');
                  setNewDishTranslations({});
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
              const qrTargetUrl = `${baseUrl}/?w=${encodeURIComponent(
                activeWorkspaceSlug
              )}${
                S.googleConfig.spreadsheetId
                  ? `&s=${encodeURIComponent(S.googleConfig.spreadsheetId)}`
                  : ''
              }&t=${encodeURIComponent(
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
                        {(S.googleConfig.restaurantName || '').trim() || 'Tadka Truck'} · {t.label}
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

          <details
            style={{
              marginTop: '8px',
              padding: '10px',
              borderRadius: '10px',
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.25)',
              fontSize: '12px',
            }}
          >
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              📘 Setup Guide: Monitor @Tag Notifications via Meta Business Suite (100% Free)
            </summary>
            <ol style={{ margin: '8px 0 6px', paddingLeft: '18px', lineHeight: 1.55 }}>
              <li>
                <b>Instagram Business Account:</b> Instagram → Settings → Account type and tools → Switch to <b>Professional (Business)</b> → enable Notifications for <b>Photos of you / Mentions</b>.
              </li>
              <li>
                <b>Link Facebook Page:</b> Create/open your restaurant Facebook Page → Settings → Linked Accounts → <b>Connect Instagram</b> and allow Instagram messages in Inbox.
              </li>
              <li>
                <b>Meta Business Suite (Free Inbox):</b> Sign in at{' '}
                <a
                  href="https://business.facebook.com/latest/inbox/all"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: '#93c5fd' }}
                >
                  business.facebook.com
                </a>{' '}
                (or install the Meta Business Suite app on your counter phone) and enable push notifications for <b>Mentions, Tags &amp; Comments</b>.
              </li>
              <li>
                <b>Save Handles Above:</b> Enter your Instagram handle, Facebook Page URL, Caption Tag, and Google Review URL above, then tap <b>Save &amp; Sync</b>.
              </li>
              <li>
                <b>Daily Counter Workflow:</b> Customers tag your <code>@handle</code> and submit their <code>@handle</code>, 1-tap screenshot, or <b>⚡ Verify at Counter</b>. Check <b>🎬 Reward Approvals</b> → tap <b>🔔 Meta Business Suite ↗</b> → approve Coupon, +1 Star, or Discount.
              </li>
            </ol>
          </details>
        </div>
      </CollapsibleSection>

      {isStandaloneMode && (
        <CollapsibleSection
          title="☁️ Google Sheet &amp; Drive Storage Setup"
          isOpen={!!openAdminSections.storage}
          onToggle={() => toggleAdminSection('storage')}
          wrapInCard={false}
        >
          <GoogleStorageAdminCard />
        </CollapsibleSection>
      )}
    </>
  );
}
