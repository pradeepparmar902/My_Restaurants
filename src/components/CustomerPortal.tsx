'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTadka } from '@/context/TadkaContext';
import { Language, PaymentMethod } from '@/types/tadka';
import { DEFAULT_REWARD_RULES, ORDER_STATUS_LABELS } from '@/lib/constants';
import {
  DEFAULT_DIETARY_FILTERS,
  DEFAULT_MENU_LANGUAGES,
} from '@/lib/googleSheetsShared';
import { normalizeMobile, buildUpiUri, isValidUpiId } from '@/lib/helpers';
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
    staffOf,
    sheetOrdersToday,
    saveGoogleConfig,
    setTab,
  } = useTadka();
  const [optMob, setOptMob] = useState('');
  const [showOptMob, setShowOptMob] = useState(false);
  const [activeCustomDietary, setActiveCustomDietary] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [onlyBestsellers, setOnlyBestsellers] = useState(false);
  const [sortPriceAsc, setSortPriceAsc] = useState(false);
  const [gridView, setGridView] = useState<'grid' | 'list'>('grid');
  const currentStyle:
    | 'style1'
    | 'style2'
    | 'style3'
    | 'style4'
    | 'style5'
    | 'style6' =
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
              : 'style1';
  const isStyle3 = currentStyle === 'style3';
  const isStyle4 = currentStyle === 'style4';
  const isStyle5 = currentStyle === 'style5';
  const isStyle6 = currentStyle === 'style6';
  const lightTheme = currentStyle !== 'style1';
  const accentCol = isStyle6
    ? '#b45309'
    : isStyle5
      ? '#0d9488'
      : isStyle4
        ? '#006aff'
        : isStyle3
          ? '#e11d48'
          : '#16a34a';
  const accentDark = isStyle6
    ? '#78350f'
    : isStyle5
      ? '#0f766e'
      : isStyle4
        ? '#0052cc'
        : isStyle3
          ? '#be123c'
          : '#15803d';
  const currentStaff = staffOf();

  const L: Record<string, string> = {
    en: 'RECOMMENDED FOR YOU',
    hi: 'आपके लिए खास मेन्यू',
    gu: 'તમારા માટે ખાસ મેનુ',
  };

  const configuredLanguages = S.googleConfig.menuLanguages?.length
    ? S.googleConfig.menuLanguages.filter((l) => l.enabled)
    : DEFAULT_MENU_LANGUAGES.filter(
        (l) =>
          !S.googleConfig.enabledLanguages?.length ||
          S.googleConfig.enabledLanguages.includes(l.code)
      );
  const visibleLanguages = configuredLanguages.length
    ? configuredLanguages
    : [DEFAULT_MENU_LANGUAGES[0]];

  const visibleDietaryFilters = S.googleConfig.dietaryFilters
    ? S.googleConfig.dietaryFilters.filter((f) => f.enabled)
    : DEFAULT_DIETARY_FILTERS.filter((f) => {
        if (f.id === 'veg') return S.googleConfig.showVegFilter !== false;
        if (f.id === 'jain') return S.googleConfig.showJainFilter !== false;
        return true;
      });

  const activeTableLabel =
    S.tables.find((t) => t.id === S.activeTable)?.label ||
    `Table ${S.activeTable}`;

  const { dishCountsToday, topDishId } = (() => {
    const counts: Record<number, number> = {};
    const seenIds = new Set<string>();
    sheetOrdersToday
      .filter((po) => po.st !== 5)
      .forEach((po) => {
        seenIds.add(po.id);
        Object.entries(po.it).forEach(([idStr, q]) => {
          const id = Number(idStr);
          if (q > 0) counts[id] = (counts[id] || 0) + q;
        });
      });
    S.orders
      .filter((o) => o.st !== 5 && !seenIds.has(o.id))
      .forEach((o) => {
        Object.entries(o.it).forEach(([idStr, q]) => {
          const id = Number(idStr);
          if (q > 0) counts[id] = (counts[id] || 0) + q;
        });
      });
    let bestId = -1;
    let bestCount = 1; // require at least 2 orders to show #1 Trending
    Object.entries(counts).forEach(([idStr, c]) => {
      if (c > bestCount) {
        bestCount = c;
        bestId = Number(idStr);
      }
    });
    return { dishCountsToday: counts, topDishId: bestId };
  })();

  const getDishCategory = (m: (typeof S.menu)[number]): string => {
    if (m.category) return m.category;
    const en = (m.n.en || '').toLowerCase();
    const em = m.e || '';
    if (
      em === '🌯' ||
      em === '🌮' ||
      em === '🥙' ||
      en.includes('roll') ||
      en.includes('wrap') ||
      en.includes('frankie') ||
      en.includes('shawarma')
    ) {
      return 'rolls';
    }
    if (
      em === '🍔' ||
      em === '🍟' ||
      em === '🍕' ||
      em === '🌭' ||
      en.includes('burger') ||
      en.includes('fries') ||
      en.includes('sandwich') ||
      en.includes('pizza') ||
      en.includes('samosa')
    ) {
      return 'burgers';
    }
    if (
      em === '🥤' ||
      em === '🍮' ||
      em === '🍰' ||
      em === '🍨' ||
      em === '☕' ||
      en.includes('cooler') ||
      en.includes('drink') ||
      en.includes('coffee') ||
      en.includes('tea') ||
      en.includes('jamun') ||
      en.includes('cake') ||
      en.includes('dessert') ||
      en.includes('shake')
    ) {
      return 'drinks';
    }
    return 'mains';
  };

  const categoryTabs = [
    { id: 'all', label: 'All', emoji: '🍽️', bg: 'linear-gradient(135deg,#fef3c7,#fde68a)' },
    { id: 'under100', label: 'Under ₹100', emoji: '🏷️', bg: 'linear-gradient(135deg,#dbeafe,#bfdbfe)' },
    { id: 'rolls', label: 'Rolls & Wraps', emoji: '🌯', bg: 'linear-gradient(135deg,#ffedd5,#fed7aa)' },
    { id: 'burgers', label: 'Burgers & Snacks', emoji: '🍔', bg: 'linear-gradient(135deg,#fee2e2,#fecaca)' },
    { id: 'mains', label: 'Noodles & Bowls', emoji: '🍜', bg: 'linear-gradient(135deg,#dcfce7,#bbf7d0)' },
    { id: 'drinks', label: 'Drinks & Sweets', emoji: '🥤', bg: 'linear-gradient(135deg,#f3e8ff,#e9d5ff)' },
  ];

  const filteredMenu = S.menu
    .filter((m) => {
      if (!m.available) return false;
      if (S.veg && m.v !== 1) return false;
      if (S.jainOnly && !m.jain) return false;
      for (const fid of activeCustomDietary) {
        const fObj = visibleDietaryFilters.find((x) => x.id === fid);
        const lbl = (fObj?.label || fid).toLowerCase();
        if (
          fid === 'nonveg' ||
          lbl.includes('non-veg') ||
          lbl.includes('non veg')
        ) {
          if (m.v !== 0) return false;
        } else if (
          !(m.dietaryTags || []).includes(fid) &&
          !m.n.en.toLowerCase().includes(lbl)
        ) {
          return false;
        }
      }
      if (activeCategory === 'under100' && m.p > 100) return false;
      if (
        activeCategory !== 'all' &&
        activeCategory !== 'under100' &&
        getDishCategory(m) !== activeCategory
      ) {
        return false;
      }
      if (onlyBestsellers && (dishCountsToday[m.id] || 0) === 0 && m.id > 3) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchEn = (m.n.en || '').toLowerCase().includes(q);
        const matchLang = (m.n[S.lang] || '').toLowerCase().includes(q);
        if (!matchEn && !matchLang) return false;
      }
      return true;
    })
    .sort((a, b) => (sortPriceAsc ? a.p - b.p : 0));

  const rules = {
    ...DEFAULT_REWARD_RULES,
    ...(S.googleConfig.rewardRules || {}),
  };
  const brandName = (S.googleConfig.restaurantName || '').trim() || 'Tadka Truck';
  const taglineText =
    S.sess && S.orders.length > 0 && !S.paid
      ? S.sess.pend
        ? 'Counter number pending. Get it from the waiter or reception and enter it in the Order tab.'
        : `Counter ${S.sess.no} · Add more anytime until you pay.`
      : (S.googleConfig.restaurantTagline || '').trim() ||
        'Scan done. Pick your food, we cook it fresh.';

  const cardBgGradients = [
    'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)',
    'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
    'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
    'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
    'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    'linear-gradient(135deg, #fefce8 0%, #fef9c3 100%)',
  ];

  const surfaceBg = isStyle6
    ? 'linear-gradient(180deg, #fef08a 0%, #fae596 100%)'
    : isStyle5
      ? '#f0fdfa'
      : isStyle4
        ? '#f4f7fe'
        : isStyle3
          ? '#fdfbf7'
          : lightTheme
            ? '#f4f6f8'
            : 'rgba(255,255,255,0.03)';
  const cardSurface = isStyle6
    ? '#fffbeb'
    : isStyle3
      ? '#fffdf9'
      : lightTheme
        ? '#ffffff'
        : '#23153c';
  const textPrimary = isStyle6
    ? '#2d1a04'
    : isStyle5
      ? '#02111a'
      : isStyle4
        ? '#191b41'
        : isStyle3
          ? '#291c14'
          : lightTheme
            ? '#0f172a'
            : '#f8fafc';
  const textMuted = isStyle6
    ? '#785216'
    : isStyle5
      ? '#335c67'
      : isStyle4
        ? '#52587a'
        : isStyle3
          ? '#786452'
          : lightTheme
            ? '#64748b'
            : '#b9a8e0';
  const borderCol = isStyle6
    ? '#e5c158'
    : isStyle5
      ? '#ccfbf1'
      : isStyle4
        ? '#dbe4ff'
        : isStyle3
          ? '#efe6d5'
          : lightTheme
            ? '#e2e8f0'
            : 'rgba(255,255,255,0.12)';

  return (
    <div
      style={{
        background: surfaceBg,
        color: textPrimary,
        borderRadius: '20px',
        padding: '12px',
        marginTop: '6px',
        boxShadow: lightTheme
          ? '0 10px 30px rgba(15, 23, 42, 0.12)'
          : 'none',
        transition: 'background 0.2s ease',
      }}
    >
      {/* Top Restaurant Header Bar + Language & Theme Controls */}
      <div
        style={{
          background: isStyle6
            ? 'linear-gradient(135deg, #451a03 0%, #92400e 45%, #d97706 78%, #f59e0b 100%)'
            : isStyle5
              ? 'linear-gradient(135deg, #02111a 0%, #0f766e 55%, #0d9488 100%)'
              : isStyle4
                ? 'linear-gradient(135deg, #191b41 0%, #0052cc 52%, #006aff 100%)'
                : isStyle3
                  ? 'linear-gradient(135deg, #431407 0%, #9a3412 52%, #e11d48 100%)'
                  : 'linear-gradient(135deg, #065f46 0%, #16a34a 55%, #ea580c 100%)',
          borderRadius: '16px',
          padding: '14px',
          color: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isStyle6
            ? '0 6px 20px rgba(180, 83, 9, 0.3)'
            : isStyle5
              ? '0 6px 18px rgba(13, 148, 136, 0.24)'
              : isStyle4
                ? '0 6px 18px rgba(0, 106, 255, 0.24)'
                : isStyle3
                  ? '0 6px 18px rgba(225, 29, 72, 0.22)'
                  : '0 6px 18px rgba(22, 163, 74, 0.25)',
        }}
      >
        <div className="row sp" style={{ alignItems: 'flex-start', gap: '8px' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(0,0,0,0.28)',
                padding: '3px 9px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: 700,
                marginBottom: '6px',
              }}
            >
              <span>📍 {activeTableLabel}</span>
              <span>·</span>
              <span>⚡ Fresh Dine-In / Takeaway</span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: '23px',
                fontWeight: 800,
                letterSpacing: '-0.3px',
                lineHeight: 1.15,
              }}
            >
              {brandName} 🔥
            </h1>
            <p
              style={{
                margin: '4px 0 0',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.92)',
              }}
            >
              {taglineText}
            </p>
          </div>
          {currentStaff && (
            <button
              type="button"
              onClick={() =>
                saveGoogleConfig({
                  appStyle:
                    currentStyle === 'style1'
                      ? 'style2'
                      : currentStyle === 'style2'
                        ? 'style3'
                        : currentStyle === 'style3'
                          ? 'style4'
                          : currentStyle === 'style4'
                            ? 'style5'
                            : currentStyle === 'style5'
                              ? 'style6'
                              : 'style1',
                })
              }
              title="Staff Preview: Cycle App Styles 1 to 6"
              style={{
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.35)',
                color: '#fff',
                borderRadius: '999px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {currentStyle === 'style1'
                ? '☀️ Style 2'
                : currentStyle === 'style2'
                  ? '🥛 Style 3'
                  : currentStyle === 'style3'
                    ? '⚡ Style 4'
                    : currentStyle === 'style4'
                      ? '🎁 Style 5'
                      : currentStyle === 'style5'
                        ? '👑 Style 6'
                        : '🌙 Style 1'}
            </button>
          )}
        </div>

        {/* Language Switcher Row inside Header */}
        <div
          className="row"
          style={{
            flexWrap: 'wrap',
            gap: '5px',
            marginTop: '10px',
          }}
        >
          {visibleLanguages.map((l) => {
            const active = S.lang === l.code;
            return (
              <button
                key={l.code}
                type="button"
                onClick={() => setLang(l.code as Language)}
                style={{
                  background: active ? '#ffffff' : 'rgba(0,0,0,0.25)',
                  color: active ? '#065f46' : '#ffffff',
                  border: active
                    ? '1px solid #ffffff'
                    : '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '999px',
                  padding: '4px 11px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                🌐 {l.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Promotional Offer Strip (Swiggy / EatClub Style) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '8px',
          marginTop: '10px',
        }}
      >
        <div
          style={{
            background: lightTheme
              ? 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)'
              : 'rgba(244,63,94,0.15)',
            border: lightTheme ? '1px solid #fecdd3' : '1px solid rgba(244,63,94,0.3)',
            borderRadius: '12px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '20px' }}>🏷️</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: lightTheme ? '#be123c' : '#fda4af',
              }}
            >
              {rules.couponType === 'percent'
                ? `${rules.couponValue}% OFF`
                : `FLAT ₹${rules.couponValue} OFF`}
              {rules.couponMinBill > 0 ? ` above ₹${rules.couponMinBill}` : ''}
            </div>
            <div style={{ fontSize: '10px', color: textMuted }}>
              Use code <b>{rules.couponCode}</b>
            </div>
          </div>
        </div>
        <div
          style={{
            background: lightTheme
              ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
              : 'rgba(16,185,129,0.15)',
            border: lightTheme ? '1px solid #a7f3d0' : '1px solid rgba(16,185,129,0.3)',
            borderRadius: '12px',
            padding: '8px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '20px' }}>⭐</span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 800,
                color: lightTheme ? '#047857' : '#6ee7b7',
              }}
            >
              {rules.starFreeRewardLabel}
            </div>
            <div style={{ fontSize: '10px', color: textMuted }}>
              Collect {rules.starsTarget} stars · Save ₹{rules.reviewDiscountInr} on review
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar + Prominent VEG Sliding Toggle (Images 5, 6, 7, 13) */}
      <div
        className="row"
        style={{
          marginTop: '12px',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: cardSurface,
            border: `1.5px solid ${borderCol}`,
            borderRadius: '14px',
            padding: '8px 12px',
            gap: '8px',
            boxShadow: lightTheme ? '0 2px 6px rgba(15,23,42,0.04)' : 'none',
          }}
        >
          <span style={{ fontSize: '15px', opacity: 0.7 }}>🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search "${S.menu[0]?.n.en || 'paneer'}", rolls, drinks...`}
            style={{
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: textPrimary,
              fontSize: '13px',
              width: '100%',
              padding: 0,
              margin: 0,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: textMuted,
                cursor: 'pointer',
                fontSize: '13px',
                padding: '0 2px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Dedicated VEG Toggle Switch */}
        {visibleDietaryFilters.some((f) => f.id === 'veg') && (
          <div
            onClick={toggleVeg}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              background: cardSurface,
              border: `1.5px solid ${S.veg ? '#16a34a' : borderCol}`,
              borderRadius: '14px',
              padding: '5px 10px',
              userSelect: 'none',
            }}
          >
            <span
              style={{
                fontSize: '9px',
                fontWeight: 800,
                letterSpacing: '0.5px',
                color: S.veg ? '#16a34a' : textMuted,
                marginBottom: '2px',
              }}
            >
              VEG
            </span>
            <div
              style={{
                width: '34px',
                height: '18px',
                borderRadius: '999px',
                background: S.veg ? '#16a34a' : '#cbd5e1',
                position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  position: 'absolute',
                  top: '2px',
                  left: S.veg ? '18px' : '2px',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Visual Category Carousel with Green Active Underline (Images 1-6, 13) */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '10px',
          marginTop: '12px',
          paddingBottom: '2px',
          borderBottom: `1px solid ${borderCol}`,
          scrollbarWidth: 'none',
        }}
      >
        {categoryTabs.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive
                  ? '3px solid #16a34a'
                  : '3px solid transparent',
                padding: '4px 8px 8px',
                cursor: 'pointer',
                minWidth: '68px',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '14px',
                  background: cat.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  boxShadow: isActive
                    ? '0 4px 10px rgba(22,163,74,0.22)'
                    : '0 2px 5px rgba(15,23,42,0.06)',
                  border: isActive
                    ? '2px solid #16a34a'
                    : '1px solid rgba(0,0,0,0.05)',
                  transform: isActive ? 'scale(1.05)' : 'scale(1)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat.emoji}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: isActive ? 800 : 600,
                  color: isActive ? '#16a34a' : textMuted,
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Horizontal Dietary & Quick Filter Pills + Grid/List Toggle (Images 1, 2, 5, 13) */}
      <div
        style={{
          display: 'flex',
          overflowX: 'auto',
          gap: '6px',
          marginTop: '10px',
          paddingBottom: '4px',
          alignItems: 'center',
        }}
      >
        {visibleDietaryFilters.map((f) => {
          const isVeg = f.id === 'veg';
          const isJain = f.id === 'jain';
          const isOn = isVeg
            ? S.veg
            : isJain
              ? S.jainOnly
              : activeCustomDietary.includes(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                if (isVeg) {
                  toggleVeg();
                } else if (isJain) {
                  updateState((p) => ({ ...p, jainOnly: !p.jainOnly }));
                } else {
                  setActiveCustomDietary((prev) =>
                    prev.includes(f.id)
                      ? prev.filter((id) => id !== f.id)
                      : [...prev, f.id]
                  );
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 11px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 700,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                background: isOn
                  ? '#dcfce7'
                  : cardSurface,
                color: isOn ? '#15803d' : textPrimary,
                border: isOn
                  ? '1.5px solid #16a34a'
                  : `1px solid ${borderCol}`,
                boxShadow: lightTheme ? '0 1px 3px rgba(15,23,42,0.04)' : 'none',
              }}
            >
              {f.emoji ? `${f.emoji} ` : ''}
              {f.label}
              {isOn ? ' ✓' : ''}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setOnlyBestsellers((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 11px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            background: onlyBestsellers ? '#ffedd5' : cardSurface,
            color: onlyBestsellers ? '#c2410c' : textPrimary,
            border: onlyBestsellers
              ? '1.5px solid #ea580c'
              : `1px solid ${borderCol}`,
          }}
        >
          🔥 Bestsellers
        </button>

        <button
          type="button"
          onClick={() => setSortPriceAsc((v) => !v)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '6px 11px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            background: sortPriceAsc ? '#dbeafe' : cardSurface,
            color: sortPriceAsc ? '#1d4ed8' : textPrimary,
            border: sortPriceAsc
              ? '1.5px solid #2563eb'
              : `1px solid ${borderCol}`,
          }}
        >
          ⇅ Price: Low to High
        </button>

        <button
          type="button"
          onClick={() => setGridView((v) => (v === 'grid' ? 'list' : 'grid'))}
          style={{
            marginLeft: 'auto',
            padding: '6px 10px',
            borderRadius: '10px',
            fontSize: '11px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            background: cardSurface,
            color: textMuted,
            border: `1px solid ${borderCol}`,
          }}
        >
          {gridView === 'grid' ? '☰ List' : '⊞ Grid'}
        </button>
      </div>

      {/* Section Heading */}
      <div
        className="row sp"
        style={{
          marginTop: '14px',
          marginBottom: '10px',
          alignItems: 'center',
        }}
      >
        <span
          style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '1.2px',
            color: textMuted,
            textTransform: 'uppercase',
          }}
        >
          {L[S.lang] || 'RECOMMENDED FOR YOU'} ({filteredMenu.length})
        </span>
        {(S.veg ||
          S.jainOnly ||
          activeCustomDietary.length > 0 ||
          activeCategory !== 'all' ||
          onlyBestsellers ||
          searchQuery) && (
          <button
            type="button"
            onClick={() => {
              if (S.veg) toggleVeg();
              if (S.jainOnly) updateState((p) => ({ ...p, jainOnly: false }));
              setActiveCustomDietary([]);
              setActiveCategory('all');
              setOnlyBestsellers(false);
              setSearchQuery('');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ea580c',
              fontSize: '11px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset Filters ✕
          </button>
        )}
      </div>

      {/* Empty Filter State */}
      {filteredMenu.length === 0 && (
        <div
          style={{
            background: cardSurface,
            border: `1px dashed ${borderCol}`,
            borderRadius: '14px',
            padding: '24px 16px',
            textAlign: 'center',
            color: textMuted,
            fontSize: '13px',
          }}
        >
          No dishes match the selected filters. Tap <b>Reset Filters</b> above to
          view all items.
        </div>
      )}

      {/* Dish Cards Grid / List (Images 1, 2, 3, 8, 10, 13) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            gridView === 'grid'
              ? 'repeat(auto-fill, minmax(152px, 1fr))'
              : '1fr',
          gap: '12px',
        }}
      >
        {filteredMenu.map((m, idx) => {
          const draftQty = S.draft[m.id] || 0;
          const todayOrderedCount = dishCountsToday[m.id] || 0;
          const isTop = m.id === topDishId;
          const ratingVal = (4.3 + ((m.id * 7) % 6) * 0.1).toFixed(1);
          const bgGrad = cardBgGradients[idx % cardBgGradients.length];

          // Authentic Indian FSSAI Veg/Non-Veg Square Symbol
          const fssaiBadge = (
            <span
              title={m.v ? 'Pure Veg' : 'Non-Veg'}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '14px',
                height: '14px',
                border: `1.5px solid ${m.v ? '#16a34a' : '#dc2626'}`,
                borderRadius: '3px',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: m.v ? '50%' : '1px',
                  background: m.v ? '#16a34a' : '#dc2626',
                }}
              />
            </span>
          );

          const addControl =
            draftQty === 0 ? (
              <button
                type="button"
                aria-label="Add"
                onClick={() => changeDraftQty(m.id, 1)}
                style={{
                  background: lightTheme ? '#ffffff' : accentCol,
                  color: lightTheme ? accentDark : '#ffffff',
                  border: `1.5px solid ${accentCol}`,
                  borderRadius: '10px',
                  padding: '5px 12px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  boxShadow: isStyle3
                    ? '0 2px 6px rgba(225,29,72,0.16)'
                    : '0 2px 6px rgba(22,163,74,0.18)',
                }}
              >
                ADD +
              </button>
            ) : (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: accentCol,
                  color: '#ffffff',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  flexShrink: 0,
                  boxShadow: isStyle3
                    ? '0 2px 6px rgba(225,29,72,0.28)'
                    : '0 2px 6px rgba(22,163,74,0.28)',
                }}
              >
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => changeDraftQty(m.id, -1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    padding: '5px 10px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: 800,
                    minWidth: '18px',
                    textAlign: 'center',
                  }}
                >
                  {draftQty}
                </span>
                <button
                  type="button"
                  aria-label="Add"
                  onClick={() => changeDraftQty(m.id, 1)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ffffff',
                    padding: '5px 10px',
                    fontSize: '14px',
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  +
                </button>
              </div>
            );

          if (gridView === 'list') {
            return (
              <div
                key={m.id}
                style={{
                  background: cardSurface,
                  border: `1px solid ${
                    draftQty > 0 ? '#16a34a' : borderCol
                  }`,
                  borderRadius: '16px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: lightTheme
                    ? '0 3px 10px rgba(15,23,42,0.05)'
                    : 'none',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    className="row"
                    style={{ gap: '6px', alignItems: 'center', marginBottom: '4px' }}
                  >
                    {fssaiBadge}
                    {isTop ? (
                      <span
                        style={{
                          background: '#ffedd5',
                          color: '#c2410c',
                          fontSize: '10px',
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: '6px',
                        }}
                      >
                        ⭐ #1 Bestseller
                      </span>
                    ) : todayOrderedCount > 0 ? (
                      <span
                        style={{
                          background: '#fef3c7',
                          color: '#b45309',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '6px',
                        }}
                      >
                        🔥 {todayOrderedCount} ordered today
                      </span>
                    ) : null}
                    {m.jain && (
                      <span
                        style={{
                          background: '#dcfce7',
                          color: '#15803d',
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '6px',
                        }}
                      >
                        🙏 Jain
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: '15px',
                      fontWeight: 800,
                      color: textPrimary,
                      lineHeight: 1.25,
                    }}
                  >
                    {m.n[S.lang] || m.n.en}
                  </div>
                  <div
                    className="row"
                    style={{
                      gap: '8px',
                      alignItems: 'center',
                      marginTop: '6px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: textPrimary,
                      }}
                    >
                      ₹{m.p}
                    </span>
                    <span
                      style={{
                        background: '#15803d',
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '6px',
                      }}
                    >
                      ★ {ratingVal}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <div
                    style={{
                      width: '78px',
                      height: '72px',
                      borderRadius: '14px',
                      background: bgGrad,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                      border: '1px solid rgba(0,0,0,0.05)',
                    }}
                  >
                    {m.e}
                  </div>
                  {addControl}
                </div>
              </div>
            );
          }

          // Default 2-Column Visual Grid Card (Images 1, 3, 8, 10, 13)
          return (
            <div
              key={m.id}
              style={{
                background: cardSurface,
                border: `1.5px solid ${
                  draftQty > 0 ? '#16a34a' : borderCol
                }`,
                borderRadius: '16px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: lightTheme
                  ? '0 4px 12px rgba(15,23,42,0.06)'
                  : 'none',
              }}
            >
              {/* Visual Food Plate Header with Live Photo or Emoji Illustration */}
              <div
                style={{
                  background: m.img ? '#0f172a' : bgGrad,
                  height: '112px',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '50px',
                  overflow: 'hidden',
                }}
              >
                {m.img ? (
                  <img
                    src={m.img}
                    alt={m.n[S.lang] || m.n.en}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                      const fallbackEl = e.currentTarget.parentElement?.querySelector(
                        '.dish-emoji-fallback'
                      ) as HTMLElement | null;
                      if (fallbackEl) fallbackEl.style.display = 'block';
                    }}
                  />
                ) : null}
                <span
                  className="dish-emoji-fallback"
                  style={{ display: m.img ? 'none' : 'block' }}
                >
                  {m.e || '🍲'}
                </span>

                {/* Top-Left Offer / Trending / Custom Badge */}
                <span
                  style={{
                    position: 'absolute',
                    top: '8px',
                    left: '8px',
                    background: isTop
                      ? '#ea580c'
                      : 'rgba(15, 23, 42, 0.78)',
                    color: '#ffffff',
                    fontSize: '9.5px',
                    fontWeight: 800,
                    padding: '3px 7px',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {m.badge ||
                    (isTop
                      ? `⭐ #1 Trending (${todayOrderedCount})`
                      : todayOrderedCount > 0
                        ? `🔥 ${todayOrderedCount} ordered`
                        : m.p <= 100
                          ? '🏷️ Pocket Friendly'
                          : '✨ Chef Special')}
                </span>

                {/* Bottom-Left Green Star Pill */}
                <span
                  style={{
                    position: 'absolute',
                    bottom: '8px',
                    left: '8px',
                    background: '#15803d',
                    color: '#ffffff',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 7px',
                    borderRadius: '999px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.18)',
                  }}
                >
                  ★ {typeof m.rating === 'number' ? m.rating.toFixed(1) : ratingVal}
                </span>

                {m.jain && (
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '8px',
                      right: '8px',
                      background: 'rgba(255,255,255,0.92)',
                      color: '#15803d',
                      fontSize: '9.5px',
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: '999px',
                      border: '1px solid #86efac',
                    }}
                  >
                    🙏 Jain
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div
                style={{
                  padding: '10px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  flex: 1,
                  justifyContent: 'space-between',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '6px',
                  }}
                >
                  <div style={{ marginTop: '2px' }}>{fssaiBadge}</div>
                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: 800,
                      color: textPrimary,
                      lineHeight: 1.25,
                    }}
                  >
                    {m.n[S.lang] || m.n.en}
                  </div>
                </div>

                <div
                  className="row sp"
                  style={{
                    marginTop: '4px',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '15px',
                        fontWeight: 800,
                        color: textPrimary,
                      }}
                    >
                      ₹{m.p}
                    </div>
                    <div style={{ fontSize: '9.5px', color: textMuted }}>
                      {m.prepTime
                        ? `⏱️ ${m.prepTime}`
                        : m.desc
                          ? m.desc
                          : '⏱️ Fresh · 8-12 mins'}
                    </div>
                  </div>
                  {addControl}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Optional Guest WhatsApp Bill Number Input */}
      {cnt() > 0 && !S.sess?.mob && !S.me.mob && (
        <div
          style={{
            marginTop: '14px',
            background: cardSurface,
            border: `1px solid ${borderCol}`,
            borderRadius: '14px',
            padding: '12px',
          }}
        >
          <div className="row sp">
            <span style={{ fontSize: '12px', color: textMuted }}>
              💬 Want your final bill &amp; offers on WhatsApp? (Optional)
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
                className="row"
                style={{
                  marginTop: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: textMuted,
                }}
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

      {/* Staff Ordering on Behalf of Customer */}
      {currentStaff && cnt() > 0 && (
        <div
          style={{
            marginTop: '14px',
            background: cardSurface,
            border: `1px solid ${borderCol}`,
            borderRadius: '14px',
            padding: '12px',
          }}
        >
          <div className="row sp">
            <b style={{ color: textPrimary }}>
              👤 Ordering on behalf of Customer ({currentStaff.r})
            </b>
          </div>
          <p style={{ margin: '4px 0 8px', fontSize: '12px', color: textMuted }}>
            Enter the customer&apos;s mobile number to place this order under
            their name &amp; counter (leave blank to use {S.me.mob}).
          </p>
          <CountryCodeMobileInput
            id="staff-cust-mob"
            value={optMob}
            onChange={setOptMob}
            placeholder="Customer mobile number"
          />
          <label
            className="row"
            style={{
              marginTop: '8px',
              cursor: 'pointer',
              fontSize: '12px',
              color: textMuted,
            }}
          >
            <input
              type="checkbox"
              checked={S.waOptIn}
              onChange={(e) =>
                updateState((p) => ({ ...p, waOptIn: e.target.checked }))
              }
            />
            <span>Send customer&apos;s final bill on WhatsApp</span>
          </label>
        </div>
      )}

      {/* Floating Frozen Bottom View Cart & Place Order Bar when items are selected */}
      {cnt() > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: 'calc(62px + env(safe-area-inset-bottom, 0px))',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 'calc(100% - 24px)',
            maxWidth: '406px',
            background: '#ffffff',
            color: '#0f172a',
            borderRadius: '16px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            boxShadow: '0 8px 30px rgba(15, 23, 42, 0.28)',
            border: '2px solid #16a34a',
            zIndex: 40,
          }}
        >
          <div
            onClick={() => setTab('order')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              flex: 1,
            }}
            title="Click to view &amp; review order"
          >
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                background: '#dcfce7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '19px',
                flexShrink: 0,
              }}
            >
              🛒
            </div>
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.2,
                }}
              >
                {brandName}
              </div>
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: 800,
                  color: '#15803d',
                  marginTop: '1px',
                }}
              >
                {cnt()} {cnt() === 1 ? 'item' : 'items'} · ₹{dsub()}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              placeOrder(optMob, S.waOptIn);
              if (currentStaff) setOptMob('');
            }}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '999px',
              padding: '10px 18px',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(22, 163, 74, 0.35)',
              whiteSpace: 'nowrap',
            }}
          >
            {!S.me.mob
              ? 'Login & Order ▸'
              : S.sess
                ? 'Add to Order ▸'
                : 'Place Order ▸'}
          </button>
        </div>
      )}

      {/* When no order is selected: keep current status with NO freeze */}
      {cnt() === 0 ? (
        <button
          className="btn"
          disabled
          style={{ marginTop: '14px', opacity: 0.6 }}
        >
          Pick dishes above to place order · ₹0
        </button>
      ) : (
        /* Bottom spacer so all menu dishes can scroll cleanly above the frozen bar */
        <div style={{ height: '70px' }} />
      )}
    </div>
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
    updateState,
    inviteMemberToSession,
    removeInvitedMember,
    pullFromGoogleSheets,
  } = useTadka();
  const [inviteMob, setInviteMob] = useState('');
  const stepIcons = ['📥', '🍳', '🛎️', '✅'];
  const hasInvitedMobs = (S.sess?.invitedMobs || []).length > 0;
  const hasPendingKitchenOrder = S.orders.some((o) => o.st < 4);
  const pullRef = useRef(pullFromGoogleSheets);
  pullRef.current = pullFromGoogleSheets;

  useEffect(() => {
    if (
      !S.sess ||
      S.paid ||
      S.sess.status === 'paid' ||
      (!hasInvitedMobs && !hasPendingKitchenOrder)
    )
      return;
    pullRef.current(undefined, true);
    const id = setInterval(() => {
      pullRef.current(undefined, true);
    }, 10000);
    return () => clearInterval(id);
  }, [
    S.sess?.id,
    S.paid,
    S.sess?.status,
    hasInvitedMobs,
    hasPendingKitchenOrder,
  ]);

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

  const pendingPrepaidOrders = S.orders.filter(
    (o) => o.paymentPending && o.st !== 5
  );
  const hasPrepaidPending = pendingPrepaidOrders.length > 0;
  const totalPayablePrepaid = (() => {
    let sub = 0;
    pendingPrepaidOrders.forEach((o) => {
      S.menu.forEach((m) => {
        const q = o.it[m.id] || 0;
        if (q > 0) sub += (o.prices?.[m.id] ?? m.p) * q;
      });
    });
    const gstEnabled = S.googleConfig?.gstEnabled !== false;
    const gstRate = S.googleConfig?.gstRate ?? 5;
    const gstAmt = gstEnabled ? Math.round((sub * gstRate) / 100) : 0;
    return sub + gstAmt;
  })();

  const rawUpiId = (S.googleConfig?.upiId || '').trim();
  const hasValidUpi = isValidUpiId(rawUpiId);
  const upiId = hasValidUpi ? rawUpiId : '';
  const upiName = (S.googleConfig?.upiName || S.googleConfig?.restaurantName || 'Restaurant').trim();
  const upiUri = hasValidUpi
    ? buildUpiUri({
        upiId,
        payeeName: upiName,
        amount: totalPayablePrepaid,
        note: `Counter ${S.sess?.no || 'C1'} Order`,
      })
    : '';

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

      {hasPrepaidPending && (
        <div
          className="card"
          style={{
            border: '2px solid #f59e0b',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(239, 68, 68, 0.1))',
            padding: '16px',
            borderRadius: '16px',
            marginBottom: '14px',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.2)',
          }}
        >
          <div className="row sp" style={{ alignItems: 'flex-start' }}>
            <div>
              <span
                className="tag"
                style={{
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 'bold',
                  fontSize: '11px',
                  padding: '3px 8px',
                }}
              >
                ⚡ PREPAID ORDER · PAYMENT REQUIRED
              </span>
              <h3 style={{ margin: '8px 0 3px', fontSize: '18px' }}>
                Complete Payment to Send to Kitchen
              </h3>
              <p className="mu" style={{ margin: 0, fontSize: '13px' }}>
                Total Payable: <strong style={{ color: '#10b981', fontSize: '16px' }}>₹{totalPayablePrepaid}</strong> · Counter {S.sess.no}
              </p>
            </div>
          </div>

          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            {hasValidUpi && upiUri ? (
              <>
                <div
                  style={{
                    display: 'inline-block',
                    padding: '10px',
                    background: '#ffffff',
                    borderRadius: '12px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                  }}
                >
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`}
                    alt="UPI Scan & Pay QR"
                    style={{ width: '170px', height: '170px', display: 'block', margin: '0 auto' }}
                  />
                  <span style={{ color: '#111827', fontSize: '11px', fontWeight: 600, display: 'block', marginTop: '6px' }}>
                    Pay to: <b>${upiName}</b> (${upiId})
                  </span>
                  <span style={{ color: '#4b5563', fontSize: '10px', display: 'block' }}>
                    Scan with GPay / PhonePe / Paytm / BHIM
                  </span>
                </div>

                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <a
                    href={upiUri}
                    className="btn"
                    style={{
                      background: 'linear-gradient(135deg, #10b981, #059669)',
                      color: '#ffffff',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      fontWeight: 'bold',
                      padding: '12px',
                      borderRadius: '10px',
                      fontSize: '14px',
                    }}
                  >
                    🚀 Tap to Pay via UPI App (GPay / PhonePe / Paytm)
                  </a>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => {
                      navigator.clipboard?.writeText?.(upiUri);
                      say('UPI Payment Link copied to clipboard! 📋');
                    }}
                  >
                    📋 Copy UPI Link
                  </button>

                  <div
                    style={{
                      background: 'rgba(245, 158, 11, 0.15)',
                      border: '1px dashed #f59e0b',
                      borderRadius: '8px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      color: '#fbbf24',
                      textAlign: 'center',
                    }}
                  >
                    ⏳ Once you make payment, counter staff/waiter verifies it and the chef starts cooking immediately!
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  padding: '16px 14px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px dashed #ef4444',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '28px', marginBottom: '4px' }}>⚠️</div>
                <b style={{ color: '#f87171', fontSize: '15px' }}>
                  Restaurant UPI ID Not Configured Yet
                </b>
                <p className="mu" style={{ fontSize: '12px', margin: '6px 0 0', lineHeight: 1.5 }}>
                  The restaurant owner has not entered their real Google Pay / PhonePe UPI ID in Admin settings.
                </p>
                <p style={{ fontSize: '12px', color: '#10b981', marginTop: '8px', fontWeight: 600 }}>
                  👉 Please pay with Cash or Card at the counter for now. Staff will verify your order.
                </p>
                {S.role !== 'c' && (
                  <button
                    type="button"
                    className="chip on"
                    style={{
                      marginTop: '10px',
                      fontSize: '12px',
                      background: '#3b82f6',
                      padding: '8px 14px',
                    }}
                    onClick={() => {
                      updateState((prev) => ({ ...prev, role: 'a' }));
                    }}
                  >
                    ⚙️ Switch to Admin Tab &rarr; Set Real UPI ID
                  </button>
                )}
              </div>
            )}
          </div>
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
                    <span
                      className="tag hot"
                      style={
                        o.paymentPending
                          ? { background: '#f59e0b', color: '#000', fontWeight: 'bold' }
                          : o.prepaid
                            ? { background: '#10b981', color: '#fff', fontWeight: 'bold' }
                            : {}
                      }
                    >
                      {o.paymentPending
                        ? '⏳ PENDING PAYMENT'
                        : o.prepaid
                          ? '🟢 PAID · PREPARING'
                          : ORDER_STATUS_LABELS[o.st]}
                    </span>
                  </div>
                  {o.paymentPending ? (
                    <div
                      style={{
                        margin: '10px 0 8px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(245, 158, 11, 0.12)',
                        border: '1px dashed #f59e0b',
                        fontSize: '12px',
                        color: '#fbbf24',
                      }}
                    >
                      💳 Order placed! Complete payment above so chef can start cooking.
                    </div>
                  ) : (
                    <div className="steps" style={{ margin: '10px 0 6px' }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`step ${o.st >= i ? 'on' : ''}`}>
                          <i>{stepIcons[i - 1]}</i>
                          {ORDER_STATUS_LABELS[i]}
                        </div>
                      ))}
                    </div>
                  )}
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
  const [couponInput, setCouponInput] = useState('');
  const rules = S.googleConfig?.rewardRules || DEFAULT_REWARD_RULES;

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
  const gstEnabled = S.googleConfig?.gstEnabled !== false;
  const gstRate = gstEnabled ? (S.googleConfig?.gstRate ?? 5) : 0;
  const gstMode = S.googleConfig?.gstMode === 'item' ? 'item' : 'bill';
  const gstin = (S.googleConfig?.gstin || '').trim();

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

        {/* #6 Post-Payment Scratch Card Reward */}
        <div className="card">
          <h3>🎁 Scratch &amp; Win Your Next-Visit Reward!</h3>
          {S.scratchReward?.scratched ? (
            <div
              style={{
                marginTop: '8px',
                padding: '14px',
                borderRadius: '14px',
                background:
                  'linear-gradient(135deg, rgba(92,242,192,0.18), rgba(58,168,255,0.18))',
                border: '1px solid #5cf2c0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '18px', fontWeight: 800 }}>
                🎉 {S.scratchReward.label}
              </div>
              <div
                style={{
                  marginTop: '6px',
                  fontSize: '13px',
                  letterSpacing: '1px',
                }}
              >
                Coupon Code: <b>{S.scratchReward.code}</b>
              </div>
              <p className="mu" style={{ fontSize: '11px', margin: '4px 0 8px' }}>
                Valid for 7 days on your next visit at Tadka Truck
              </p>
              <button
                className="chip on"
                onClick={() => {
                  const msg = `🎁 *Tadka Truck Reward*\nWon: *${S.scratchReward?.label}*\nCoupon Code: *${S.scratchReward?.code}*\nValid for 7 days on next visit!`;
                  const digits = S.sess?.mob
                    ? S.sess.mob.replace(/\D/g, '')
                    : '';
                  const url = digits
                    ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
                    : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
              >
                📲 Save Coupon on WhatsApp
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                const prizes = [
                  { label: '🥤 Free Mango Masala Cooler', bonusPts: 0 },
                  { label: '₹30 Off Next Visit', bonusPts: 0 },
                  { label: '🍮 Free Gulab Jamun Sizzler', bonusPts: 0 },
                  { label: '⭐ +25 Bonus Loyalty Points', bonusPts: 25 },
                  { label: '10% Off Next Order', bonusPts: 0 },
                ];
                const pick = prizes[Math.floor(Math.random() * prizes.length)];
                const code = `TADKA-${S.sess?.no || 'C1'}-${Math.random()
                  .toString(36)
                  .slice(2, 6)
                  .toUpperCase()}`;
                updateState((prev) => ({
                  ...prev,
                  pts: prev.pts + (pick.bonusPts || 0),
                  scratchReward: {
                    label: pick.label,
                    code,
                    scratched: true,
                    bonusPts: pick.bonusPts,
                  },
                }));
                say(`You won: ${pick.label}! 🎉`);
              }}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '22px 14px',
                borderRadius: '14px',
                border: '2px dashed #ffb547',
                background:
                  'linear-gradient(135deg, rgba(255,181,71,0.28), rgba(255,92,138,0.28))',
                color: '#fff',
                font: 'inherit',
                fontWeight: 800,
                fontSize: '15px',
                cursor: 'pointer',
              }}
            >
              ✨ Tap Here to Scratch &amp; Reveal Your Prize ✨
            </button>
          )}
        </div>

        {/* #2 Real Digital GST Receipt */}
        <div className="card">
          <div className="row sp">
            <h3 style={{ margin: 0 }}>🧾 Digital GST Receipt</h3>
            <span className="tag ok">PAID · {S.pm}</span>
          </div>
          <p className="mu" style={{ margin: '4px 0 8px', fontSize: '12px' }}>
            Counter {S.sess?.no || '—'} · Table {S.activeTable} ·{' '}
            {S.sess?.mob || 'Guest'}
            {gstin ? ` · GSTIN: ${gstin}` : ''}
          </p>
          {S.menu
            .filter((m) => S.cart[m.id])
            .map((m) => {
              const itemRate = m.gstRate ?? gstRate;
              return (
                <div key={m.id} className="line" style={{ fontSize: '13px' }}>
                  <span>
                    {m.n.en} × {S.cart[m.id]}
                    {gstEnabled && gstMode === 'item' ? (
                      <span className="mu" style={{ fontSize: '11px' }}>
                        {' '}
                        ({itemRate}% GST)
                      </span>
                    ) : null}
                  </span>
                  <span>₹{m.p * S.cart[m.id]}</span>
                </div>
              );
            })}
          <div className="line mu" style={{ fontSize: '12px', marginTop: '4px' }}>
            <span>Subtotal</span>
            <span>₹{s}</span>
          </div>
          {disc() > 0 && (
            <div className="line mu" style={{ fontSize: '12px' }}>
              <span>Discounts</span>
              <span>−₹{disc()}</span>
            </div>
          )}
          {gstEnabled && g > 0 && (
            <div className="line mu" style={{ fontSize: '12px' }}>
              <span>
                {gstMode === 'item' ? 'GST (Item-wise)' : `GST ${gstRate}%`}
              </span>
              <span>₹{g}</span>
            </div>
          )}
          <div className="line tot">
            <span>Total Paid</span>
            <span>₹{t}</span>
          </div>
          {(() => {
            const buildReceiptText = () => {
              const lines = S.menu
                .filter((m) => S.cart[m.id])
                .map((m) => `• ${m.n.en} × ${S.cart[m.id]} — ₹${m.p * S.cart[m.id]}`)
                .join('\n');
              const couponLine = S.scratchReward?.scratched
                ? `\n🎁 Comeback Coupon: *${S.scratchReward.code}* (${S.scratchReward.label})`
                : '';
              return (
                `🧾 *Tadka Truck — Paid Receipt*\n` +
                (gstin ? `GSTIN: ${gstin}\n` : '') +
                `Counter: ${S.sess?.no || '—'} · Table ${S.activeTable}\n` +
                `Payment: ${S.pm}\n\n` +
                `${lines}\n\n` +
                `Subtotal: ₹${s}\n` +
                (disc() > 0 ? `Discounts: -₹${disc()}\n` : '') +
                (gstEnabled && gstRate > 0 ? `GST (${gstRate}%): ₹${g}\n` : '') +
                `*Total Paid: ₹${t}*` +
                `${couponLine}\n\nThank you for dining with us! 🙏`
              );
            };
            return (
              <div className="row" style={{ gap: '8px', marginTop: '10px' }}>
                <button
                  className="btn alt"
                  style={{ flex: 1, marginTop: 0 }}
                  onClick={() => {
                    const msg = buildReceiptText();
                    const digits = S.sess?.mob
                      ? S.sess.mob.replace(/\D/g, '')
                      : '';
                    const url = digits
                      ? `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
                      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
                    window.open(url, '_blank', 'noopener,noreferrer');
                    say('Opening WhatsApp with your receipt ✅');
                  }}
                >
                  📲 Send Receipt on WhatsApp
                </button>
                <button
                  className="chip"
                  onClick={async () => {
                    try {
                      await navigator.clipboard?.writeText(buildReceiptText());
                      say('Receipt copied ✅');
                    } catch {
                      say('Use Send Receipt on WhatsApp');
                    }
                  }}
                >
                  📋 Copy
                </button>
              </div>
            );
          })()}
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
          <b>🧾 Bill from {(S.googleConfig.restaurantName || '').trim() || 'Tadka Truck'}</b>
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
          .map((m) => {
            const itemRate = m.gstRate ?? gstRate;
            return (
              <div key={m.id} className="line">
                <span>
                  {m.e} {m.n.en} × {S.cart[m.id]}
                  {gstEnabled && gstMode === 'item' ? (
                    <span className="mu" style={{ fontSize: '11px' }}>
                      {' '}
                      ({itemRate}% GST)
                    </span>
                  ) : null}
                </span>
                <span>₹{m.p * S.cart[m.id]}</span>
              </div>
            );
          })}
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
            <span>Reel discount ({rules.reelDiscountPercent}%)</span>
            <span>−₹{Math.round(s * ((rules.reelDiscountPercent ?? 10) / 100))}</span>
          </div>
        )}
        {S.review && s >= (rules.reviewMinBill ?? 0) && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>Google review</span>
            <span>−₹{rules.reviewDiscountInr ?? 50}</span>
          </div>
        )}
        {S.shared && (rules.socialShareDiscountInr ?? 0) > 0 && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>Social share reward</span>
            <span>−₹{rules.socialShareDiscountInr}</span>
          </div>
        )}
        {S.starClaimed && (rules.starFreeValueInr ?? 0) > 0 && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>⭐ {rules.starFreeRewardLabel}</span>
            <span>−₹{rules.starFreeValueInr}</span>
          </div>
        )}
        {S.appliedCoupon && disc() > 0 && (
          <div className="line" style={{ color: 'var(--mn)' }}>
            <span>🎟️ Coupon ({S.appliedCoupon})</span>
            <span>Applied</span>
          </div>
        )}
        {gstEnabled && g > 0 && (
          <div className="line">
            <span>
              {gstMode === 'item' ? 'GST (Item-wise)' : `GST ${gstRate}%`}
              {gstin ? ` (${gstin})` : ''}
            </span>
            <span>₹{g}</span>
          </div>
        )}
        <div className="line tot">
          <span>Total</span>
          <span>₹{t}</span>
        </div>
      </div>

      {/* Coupon, Referral & Star Free Reward */}
      <div className="card">
        <b>🎟️ Apply Coupon / Referral Code</b>
        {S.appliedCoupon ? (
          <div className="row sp" style={{ marginTop: '8px' }}>
            <span>
              ✅ Code <b>{S.appliedCoupon}</b> applied
            </span>
            <button
              className="chip"
              onClick={() => updateState((p) => ({ ...p, appliedCoupon: '' }))}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div className="row" style={{ gap: '6px', marginTop: '8px' }}>
              <input
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder={`Try ${rules.couponCode || 'TADKA50'} or ${
                  rules.referralCode || 'FRIEND50'
                }`}
                className="inp"
                style={{ flex: 1 }}
              />
              <button
                className="chip on"
                onClick={() => {
                  const code = couponInput.trim().toUpperCase();
                  if (!code) {
                    say('Enter a coupon or referral code');
                    return;
                  }
                  const isPromo =
                    rules.couponCode &&
                    code === rules.couponCode.trim().toUpperCase();
                  const isRef =
                    rules.referralCode &&
                    code === rules.referralCode.trim().toUpperCase();
                  if (!isPromo && !isRef) {
                    say('Invalid coupon or referral code');
                    return;
                  }
                  const minRequired = isPromo
                    ? rules.couponMinBill || 0
                    : rules.referralMinBill || 0;
                  if (s < minRequired) {
                    say(`Minimum bill of ₹${minRequired} required for ${code}`);
                    return;
                  }
                  updateState((p) => ({ ...p, appliedCoupon: code }));
                  setCouponInput('');
                  say(`Coupon ${code} applied! 🎉`);
                }}
              >
                Apply
              </button>
            </div>
            <p className="mu" style={{ fontSize: '11px', marginTop: '6px' }}>
              {rules.couponCode
                ? `Promo: ${rules.couponCode} (${
                    rules.couponType === 'percent'
                      ? `${rules.couponValue}% off`
                      : `₹${rules.couponValue} off`
                  }${rules.couponMinBill > 0 ? ` on ₹${rules.couponMinBill}+` : ''})`
                : ''}
              {rules.referralCode
                ? ` · Referral: ${rules.referralCode} (₹${rules.referralDiscountInr} off${
                    rules.referralMinBill > 0 ? ` on ₹${rules.referralMinBill}+` : ''
                  })`
                : ''}
            </p>
          </>
        )}
        {S.stars >= (rules.starsTarget || 5) && !S.starClaimed && (
          <button
            className="btn alt"
            style={{ marginTop: '10px' }}
            onClick={() => {
              updateState((p) => ({ ...p, starClaimed: true }));
              say(
                `Claimed ${rules.starFreeRewardLabel} (−₹${rules.starFreeValueInr}) 🎉`
              );
            }}
          >
            ⭐ Claim {rules.starFreeRewardLabel} (−₹{rules.starFreeValueInr})
          </button>
        )}
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
      ) : S.pm === 'UPI' && (S.googleConfig.upiId || '').trim() ? (
        (() => {
          const upiId = (S.googleConfig.upiId || '').trim();
          const upiName =
            (S.googleConfig.upiName || '').trim() || 'Restaurant';
          const upiNote = `Order ${S.sess?.no || 'C1'} T${S.activeTable}`;
          const upiUri = buildUpiUri({
            upiId,
            payeeName: upiName,
            amount: per,
            note: upiNote,
          });
          const upiQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=190x190&data=${encodeURIComponent(
            upiUri
          )}`;
          return (
            <div className="card" style={{ textAlign: 'center' }}>
              <h3>💳 Pay ₹{per} via UPI (0% Fee)</h3>
              <p className="mu" style={{ fontSize: '12px', margin: '4px 0 8px' }}>
                Scan QR or tap below to pay directly to <b>{upiName}</b> (
                {upiId})
              </p>
              <div
                style={{
                  background: '#fff',
                  display: 'inline-block',
                  padding: '10px',
                  borderRadius: '12px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={upiQrUrl}
                  alt="UPI Payment QR"
                  width={180}
                  height={180}
                  style={{ display: 'block' }}
                />
              </div>
              <a
                href={upiUri}
                className="btn alt"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  marginTop: '10px',
                }}
              >
                📱 Open GPay / PhonePe / Paytm (₹{per})
              </a>
              <button
                className="btn"
                style={{ marginTop: '8px' }}
                onClick={() => doPay('UPI', 'app')}
              >
                ✅ I have paid ₹{per} via UPI
              </button>
            </div>
          );
        })()
      ) : (
        <button className="btn" onClick={() => doPay(S.pm, 'app')}>
          Pay ₹{per} with {S.pm}
        </button>
      )}
    </>
  );
}
