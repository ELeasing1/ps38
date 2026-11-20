import { cardHTML, money, esc, NB, productUrl, productImg } from './card.js';

const CFG = window.TD_CONFIG || {};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const plural = (n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; };
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
};
const ICON = {
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.1 11.1a2 2 0 0 1-2 1.9H8.1a2 2 0 0 1-2-1.9L5 8z"/><path d="M9 10V7a3 3 0 0 1 6 0v3"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>',
};

/* ================= данные каталога ================= */
let DATA = null;
function loadData() {
  if (!DATA) {
    DATA = fetch('data/products.json?v=mwoqu0m2', { cache: 'force-cache' }).then((r) => r.json()).then((d) => {
      d.byId = new Map(d.items.map((i) => [i.id, i]));
      return d;
    });
  }
  return DATA;
}

/* ================= тосты ================= */
function toast({ img, title, text, action }) {
  const box = $('[data-toasts]'); if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${img ? `<img src="${img}" alt="">` : ''}<div class="toast__txt">${esc(title)}${text ? `<small>${esc(text)}</small>` : ''}</div>${action ? `<a href="${action.href}" ${action.cart ? 'data-open-cart' : ''}>${esc(action.label)}</a>` : ''}`;
  box.appendChild(el);
  setTimeout(() => { el.classList.add('is-out'); setTimeout(() => el.remove(), 400); }, 3800);
}

/* ================= избранное ================= */
const Fav = {
  ids: new Set(store.get('sp-fav', [])),
  save() { store.set('sp-fav', [...this.ids]); this.paint(); },
  toggle(id) {
    if (this.ids.has(id)) { this.ids.delete(id); } else { this.ids.add(id); toast({ title: 'Добавили в избранное', action: { label: 'Открыть', href: 'personal/favorite/' } }); }
    this.save();
  },
  paint() {
    $$('[data-fav]').forEach((b) => { const on = this.ids.has(b.dataset.fav); b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on); });
    $$('[data-fav-count]').forEach((c) => { c.textContent = this.ids.size || ''; c.classList.toggle('is-on', this.ids.size > 0); });
  },
};

/* ================= корзина ================= */
const Cart = {
  items: store.get('sp-cart', []), // {id, oid, q, n, l, p, img, u}
  save() { store.set('sp-cart', this.items); this.paint(); },
  count() { return this.items.reduce((s, i) => s + i.q, 0); },
  total() { return this.items.reduce((s, i) => s + i.q * i.p, 0); },
  clubTotal() { return this.items.reduce((s, i) => s + i.q * (i.k || i.p), 0); },
  add(snap, q = 1) {
    const ex = this.items.find((i) => i.id === snap.id && i.oid === snap.oid);
    if (ex) ex.q = Math.min(99, ex.q + q); else this.items.push({ ...snap, q });
    this.save();
    toast({ img: snap.img, title: 'Добавили в корзину', text: snap.n + (snap.l ? ` · ${snap.l}` : ''), action: { label: 'Корзина', href: '#', cart: true } });
  },
  setQty(idx, q) { if (q <= 0) this.items.splice(idx, 1); else this.items[idx].q = Math.min(99, q); this.save(); },
  clear() { this.items = []; this.save(); },
  paint() {
    $$('[data-cart-count]').forEach((c) => { const n = this.count(); c.textContent = n || ''; c.classList.toggle('is-on', n > 0); });
    renderDrawer();
    if ($('[data-basket]')) renderBasket();
  },
  async refresh() {
    // сверяем цены с актуальным каталогом
    if (!this.items.length) return;
    const d = await loadData();
    let changed = false;
    for (const it of this.items) {
      const p = d.byId.get(it.id); if (!p) continue;
      const v = p.v.find((x) => x[0] === it.oid); if (!v) continue;
      if (v[2] !== it.p) { it.p = v[2]; changed = true; }
    }
    if (changed) this.save();
  },
};

function snapFromItem(p, D, v) {
  return { id: p.id, oid: v[0], n: p.n, l: v[1], p: v[2], k: v[8] || 0, img: productImg(p), u: productUrl(p) };
}

function shipInfo(total) {
  const left = (CFG.freeFrom || 3500) - total;
  const pct = Math.min(100, Math.round(total / (CFG.freeFrom || 3500) * 100));
  return `<div class="ship"><div class="ship__txt">${left > 0 ? `До бесплатной доставки по Иркутску — <b>${money(left)}</b>` : `<b>Доставка по Иркутску — бесплатно</b>`}</div><div class="ship__bar"><i style="--p:${pct}%"></i></div></div>`;
}

function cartItemHTML(it, i) {
  return `<div class="citem">
    <a class="citem__img" href="${it.u}"><img src="${it.img}" alt=""></a>
    <div>
      <a class="citem__name" href="${it.u}">${esc(it.n)}</a>
      ${it.l ? `<div class="citem__opt">${esc(it.l)} · ${money(it.p)}</div>` : `<div class="citem__opt">${money(it.p)} за шт.</div>`}
      <div class="citem__row">
        <div class="qty"><button type="button" data-ci="${i}" data-d="-1" aria-label="Меньше">−</button><input type="number" value="${it.q}" min="1" max="99" data-ci-input="${i}" aria-label="Количество"><button type="button" data-ci="${i}" data-d="1" aria-label="Больше">+</button></div>
        <div class="citem__price">${money(it.p * it.q)}</div>
      </div>
      <button class="citem__del" type="button" data-ci-del="${i}">Удалить</button>
    </div>
  </div>`;
}

function renderDrawer() {
  const body = $('[data-cart-body]'); if (!body) return;
  const foot = $('[data-cart-foot]');
  const n = Cart.count();
  $('[data-cart-n]').textContent = n ? `· ${n}` : '';
  if (!Cart.items.length) {
    body.innerHTML = `<div class="empty" style="background:transparent"><div class="h3">Пока пусто</div><p class="muted">Добавьте корм, лакомства или игрушку — и мы привезём завтра.</p><a class="btn btn--ink" href="c/">В каталог</a></div>`;
    foot.innerHTML = '';
    return;
  }
  body.innerHTML = Cart.items.map(cartItemHTML).join('');
  const total = Cart.total();
  foot.innerHTML = `${shipInfo(total)}
    <div class="total-row"><span>Итого</span><b>${money(total)}</b></div>
    ${Cart.clubTotal() < total ? `<div class="total-row" style="color:var(--brand-ink)"><span>По клубной карте</span><b style="font-size:20px">${money(Cart.clubTotal())}</b></div>` : ''}
    <a class="btn btn--ink btn--lg btn--block" href="cart/">Оформить заказ ${ICON.arrow}</a>`;
}

/* ================= оверлеи ================= */
let lastFocus = null;
function lockScroll(on) { document.documentElement.style.overflow = on ? 'hidden' : ''; }
function openCart() { $$('.toast').forEach((t) => t.remove()); lastFocus = document.activeElement; Cart.refresh(); renderDrawer(); $('#cart').classList.add('is-open'); $('#cart').setAttribute('aria-hidden', 'false'); $('.drawer-veil').classList.add('is-on'); lockScroll(true); setTimeout(() => $('#cart [data-close-cart]')?.focus(), 50); }
function closeCart() { $('#cart').classList.remove('is-open'); $('#cart').setAttribute('aria-hidden', 'true'); $('.drawer-veil').classList.remove('is-on'); lockScroll(false); lastFocus?.focus?.(); }
function openMenu() { $('#mnav').classList.add('is-open'); $('#mnav').setAttribute('aria-hidden', 'false'); lockScroll(true); }
function closeMenu() { $('#mnav').classList.remove('is-open'); $('#mnav').setAttribute('aria-hidden', 'true'); lockScroll(false); }
function openModal(id) { lastFocus = document.activeElement; $(id).classList.add('is-open'); lockScroll(true); setTimeout(() => $(`${id} input:not([type=hidden]):not(.sr-only)`)?.focus(), 80); }
function closeModal() { $$('.modal.is-open').forEach((m) => m.classList.remove('is-open')); lockScroll(false); lastFocus?.focus?.(); }

/* ================= поиск ================= */
const SYN = [
  [/роял|ройал|роял канин|рк\b/g, 'royal canin'], [/канин/g, 'canin'], [/про ?план|проплан/g, 'pro plan'], [/пурина/g, 'purina'], [/грандорф/g, 'grandorf'],
  [/монж|монже/g, 'monge'], [/фармина/g, 'farmina'], [/хиллс|хилс/g, "hill's"], [/акана/g, 'acana'], [/ориджен/g, 'orijen'], [/бош/g, 'bosch'],
  [/хэппи дог|хеппи дог/g, 'happy dog'], [/хэппи кэт|хеппи кет|хэппи кет/g, 'happy cat'], [/санабель/g, 'sanabelle'], [/брит/g, 'brit'], [/вискас/g, 'whiskas'],
  [/феликс/g, 'felix'], [/шеба/g, 'sheba'], [/педигри/g, 'pedigree'], [/фрискис/g, 'friskies'], [/перфект фит/g, 'perfect fit'], [/велнес|веллнес/g, 'wellness'],
  [/вонпи|ванпи/g, 'wanpy'], [/аллева/g, 'alleva'], [/премьер/g, 'premier'], [/зилли/g, 'zilli'], [/эворд|авард/g, 'award'], [/трикси/g, 'trixie'],
  [/ферпласт/g, 'ferplast'], [/тетра/g, 'tetra'], [/фурминатор/g, 'furminator'], [/конг/g, 'kong'], [/гимкэт|гимкет/g, 'gimcat'], [/кэтс бест|кетс бест/g, 'cats best'],
  [/эвер клин/g, 'ever clean'], [/лиаумин/g, 'miaumi'], [/1ст чойс|ферст чойс/g, '1st choice'], [/бест диннер/g, 'best dinner'], [/элитпад/g, 'elitepad'],
];
const TR = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9%+]+/g, ' ').trim();
const translit = (s) => s.replace(/[а-я]/g, (c) => TR[c] ?? c);
let SEARCH_INDEX = null;
async function searchIndex() {
  if (SEARCH_INDEX) return SEARCH_INDEX;
  const d = await loadData();
  SEARCH_INDEX = d.items.map((p) => {
    const brand = p.b >= 0 ? d.brands[p.b] : '';
    const cat = d.names[d.cats[p.c]] || '';
    const hay = norm(`${p.n} ${brand} ${cat}`);
    return { p, hay, words: hay.split(' ') };
  });
  return SEARCH_INDEX;
}
async function doSearch(q, limit = 0) {
  const d = await loadData();
  const idx = await searchIndex();
  let nq = norm(q);
  if (!nq) return { d, res: [] };
  nq = ` ${nq} `;
  for (const [re, rep] of SYN) nq = nq.replace(new RegExp(`(?<= )(?:${re.source})(?= )`, 'g'), rep);
  nq = nq.trim();
  const tokens = nq.split(' ').filter(Boolean);
  const res = [];
  for (const e of idx) {
    let score = 0; let ok = true;
    for (const t of tokens) {
      const alt = translit(t);
      let s = 0;
      for (const w of e.words) {
        if (w === t || w === alt) { s = Math.max(s, 6); break; }
        if (w.startsWith(t) || (alt.length > 2 && w.startsWith(alt))) s = Math.max(s, 4);
        else if (t.length > 3 && w.includes(t.slice(0, -1))) s = Math.max(s, 2); // окончания: «корма» ~ «корм»
        else if (t.length > 2 && w.includes(t)) s = Math.max(s, 1);
      }
      if (!s) { ok = false; break; }
      score += s;
    }
    if (!ok) continue;
    score += e.p.a ? 3 : 0;
    score -= Math.min(3, e.p.r / 3000);
    res.push([score, e.p]);
  }
  res.sort((a, b) => b[0] - a[0]);
  const out = res.map((r) => r[1]);
  return { d, res: limit ? out.slice(0, limit) : out, total: out.length };
}
function hl(text, q) {
  const t = norm(q).split(' ').filter((x) => x.length > 1);
  let s = esc(text);
  for (const w of t) s = s.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>');
  return s;
}
function initSearch() {
  const box = $('#search'); if (!box) return;
  const input = $('[data-search-input]', box);
  const out = $('[data-search-out]', box);
  const initial = out.innerHTML;
  let active = -1;
  const open = () => { lastFocus = document.activeElement; box.classList.add('is-open'); lockScroll(true); setTimeout(() => input.focus(), 60); loadData(); };
  const close = () => { box.classList.remove('is-open'); lockScroll(false); };
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-search]')) { e.preventDefault(); open(); }
    if (e.target.closest('[data-close-search]')) close();
    const hint = e.target.closest('[data-q]');
    if (hint && box.contains(hint)) { input.value = hint.dataset.q; run(); input.focus(); }
  });
  let timer;
  const run = async () => {
    const q = input.value.trim();
    if (q.length < 2) { out.innerHTML = initial; return; }
    const { d, res, total } = await doSearch(q, 8);
    if (input.value.trim() !== q) return;
    active = -1;
    if (!res.length) { out.innerHTML = `<div class="search__empty">Ничего не нашли по запросу «${esc(q)}». Попробуйте иначе — например, по бренду или виду корма.</div>${initial}`; return; }
    const cats = Object.entries(d.names).filter(([k, n]) => norm(n).includes(norm(q))).slice(0, 4);
    out.innerHTML = `
      ${cats.length ? `<div class="eyebrow search__group-title">Разделы</div><div class="search__hints">${cats.map(([k, n]) => `<a class="chip" href="${d.urls[k]}">${esc(n)}</a>`).join('')}</div>` : ''}
      <div class="eyebrow search__group-title">Товары · ${fmt(total)}</div>
      <div class="search__results">${res.map((p) => `<a class="sres" href="${productUrl(p)}"><span class="sres__img"><img src="${productImg(p)}" alt="" loading="lazy"></span><span><span class="sres__name">${hl(p.n, q)}</span><span class="sres__meta">${p.b >= 0 ? esc(d.brands[p.b]) + ' · ' : ''}${esc(d.names[d.cats[p.c]] || '')}</span></span><span class="sres__price">${p.v.length > 1 ? 'от ' : ''}${money(p.p)}</span></a>`).join('')}</div>
      <a class="btn btn--ink mt-m" href="search/?q=${encodeURIComponent(q)}">Все результаты · ${fmt(total)} ${ICON.arrow}</a>`;
  };
  input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(run, 120); });
  input.addEventListener('keydown', (e) => {
    const links = $$('.sres', out);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault(); if (!links.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.classList.toggle('is-active', i === active)); links[active].scrollIntoView({ block: 'nearest' });
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && links[active]) location.href = links[active].href;
      else if (input.value.trim()) location.href = `search/?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
  window.__closeSearch = close;
}

/* ================= шапка ================= */
function initHeader() {
  const hdr = $('#hdr');
  const onScroll = () => hdr && hdr.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll(); window.addEventListener('scroll', onScroll, { passive: true });
  const veil = $('[data-mega-veil]');
  let t;
  const close = () => { $$('[data-mega].is-open').forEach((li) => { li.classList.remove('is-open'); $('.nav__link', li).setAttribute('aria-expanded', 'false'); }); veil?.classList.remove('is-on'); };
  const open = (li) => {
    if (li.classList.contains('is-open')) return;
    close();
    document.documentElement.style.setProperty('--mega-top', `${hdr.getBoundingClientRect().bottom}px`);
    li.classList.add('is-open'); $('.nav__link', li).setAttribute('aria-expanded', 'true'); veil?.classList.add('is-on');
  };
  $$('[data-mega]').forEach((li) => {
    li.addEventListener('mouseenter', () => { clearTimeout(t); t = setTimeout(() => open(li), 90); });
    li.addEventListener('mouseleave', () => { clearTimeout(t); t = setTimeout(close, 140); });
    li.addEventListener('focusin', () => open(li));
    li.addEventListener('focusout', (e) => { if (!li.contains(e.relatedTarget)) close(); });
  });
  window.addEventListener('scroll', () => { if ($('[data-mega].is-open')) close(); }, { passive: true });
  window.__closeMega = close;
}

/* ================= анимации ================= */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    const frag = document.createDocumentFragment();
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        for (const part of child.textContent.split(/([ \t\n\r]+)/)) {
          if (!part) continue;
          if (/^[ \t\n\r]+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span'); w.className = 'w';
          const inner = document.createElement('span'); inner.style.setProperty('--i', i++); inner.textContent = part;
          w.appendChild(inner); frag.appendChild(w);
        }
      } else if (child.nodeType === 1) {
        const clone = child.cloneNode(false);
        clone.appendChild(walk(child));
        frag.appendChild(clone);
      }
    }
    return frag;
  };
  const f = walk(el); el.textContent = ''; el.appendChild(f);
}
function initReveal() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $$('[data-split]').forEach((el) => { if (!reduce) splitWords(el); el.setAttribute('data-reveal', ''); el.classList.add('split'); });
  const io = new IntersectionObserver((ents) => {
    for (const e of ents) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('[data-reveal]').forEach((el) => io.observe(el));
  // счётчики
  const cio = new IntersectionObserver((ents) => {
    for (const e of ents) {
      if (!e.isIntersecting) continue;
      cio.unobserve(e.target);
      const el = e.target; const to = +el.dataset.countup; const plain = el.hasAttribute('data-plain');
      if (reduce) continue;
      const from = plain ? to - 9 : 0; const t0 = performance.now(); const dur = 1400;
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur); const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
        el.textContent = plain ? Math.round(v) : fmt(v);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }
  }, { threshold: 0.5 });
  $$('[data-countup]').forEach((el) => cio.observe(el));
  // параллакс героя
  const stage = $('[data-parallax]');
  if (stage && !reduce && matchMedia('(hover: hover)').matches) {
    const hero = stage.closest('.hero');
    hero.addEventListener('mousemove', (e) => {
      const r = hero.getBoundingClientRect();
      stage.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      stage.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    hero.addEventListener('mouseleave', () => { stage.style.setProperty('--px', 0); stage.style.setProperty('--py', 0); });
  }
}

/* ================= рельсы и вкладки ================= */
function initRails() {
  $$('[data-rail-ctrl]').forEach((ctrl) => {
    const getRail = () => { const id = ctrl.dataset.railCtrl; const r = document.getElementById(id); if (!r) return null; const panel = r.closest('[data-tabpanel]'); if (panel && panel.hidden) { const vis = $$('[data-tabpanel]', panel.parentElement).find((p) => !p.hidden); return vis ? $('[data-rail]', vis) : r; } return r; };
    const upd = () => { const r = getRail(); if (!r) return; const [a, b] = $$('button', ctrl); a.disabled = r.scrollLeft < 8; b.disabled = r.scrollLeft + r.clientWidth > r.scrollWidth - 8; };
    $$('button', ctrl).forEach((btn) => btn.addEventListener('click', () => { const r = getRail(); if (r) r.scrollBy({ left: r.clientWidth * 0.85 * +btn.dataset.dir, behavior: 'smooth' }); setTimeout(upd, 450); }));
    const r = document.getElementById(ctrl.dataset.railCtrl); r?.addEventListener('scroll', () => requestAnimationFrame(upd), { passive: true });
    setTimeout(upd, 300);
  });
  $$('[data-tabs]').forEach((tabs) => {
    tabs.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tab]'); if (!b) return;
      $$('[data-tab]', tabs).forEach((x) => { x.classList.toggle('is-active', x === b); x.setAttribute('aria-selected', x === b); });
      const wrap = tabs.parentElement;
      $$('[data-tabpanel]', wrap).forEach((p) => { p.hidden = p.dataset.tabpanel !== b.dataset.tab; });
      Fav.paint();
    });
  });
  // рельсы на странице товара (данные встроены в страницу)
  const raw = $('#rail-data');
  if (raw) {
    const mini = JSON.parse(raw.textContent);
    const by = new Map(mini.items.map((i) => [i.id, i]));
    $$('[data-rail-ids]').forEach((r) => {
      r.innerHTML = r.dataset.railIds.split(',').map((id) => by.get(id)).filter(Boolean).map((p) => cardHTML(p, mini)).join('');
    });
    window.__mini = mini;
    Fav.paint();
  }
}

/* ================= клики: карточки, корзина, избранное ================= */
async function addFromCard(id, btn) {
  const mini = window.__mini;
  let d = mini && mini.items.find((i) => i.id === id) ? mini : null;
  let p = d ? d.items.find((i) => i.id === id) : null;
  if (!p) { d = await loadData(); p = d.byId.get(id); }
  if (!p) return;
  const v = p.v.find((x) => x[4] === null || x[4] > 0) || p.v[0];
  Cart.add(snapFromItem(p, d, v));
  if (btn) { btn.classList.add('is-added'); btn.innerHTML = ICON.check; setTimeout(() => { btn.classList.remove('is-added'); btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'; }, 1600); }
  if (p.v.length > 1) setTimeout(() => toast({ title: `Положили «${v[1]}»`, text: 'Другие варианты — на странице товара', action: { label: 'Выбрать', href: productUrl(p) } }), 250);
}
function initClicks() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    const add = t.closest('[data-add]'); if (add) { e.preventDefault(); addFromCard(add.dataset.add, add); return; }
    const fav = t.closest('[data-fav]'); if (fav) { e.preventDefault(); Fav.toggle(fav.dataset.fav); if ($('[data-favorites]')) renderFavorites(); return; }
    if (t.closest('[data-open-cart]')) { e.preventDefault(); window.__closeSearch?.(); openCart(); return; }
    if (t.closest('[data-close-cart]')) { closeCart(); return; }
    if (t.closest('[data-open-menu]')) { openMenu(); return; }
    if (t.closest('[data-close-menu]')) { closeMenu(); return; }
    if (t.closest('[data-close-modal]') || t.classList.contains('modal')) { closeModal(); return; }
    const ci = t.closest('[data-ci]'); if (ci) { const i = +ci.dataset.ci; Cart.setQty(i, Cart.items[i].q + +ci.dataset.d); return; }
    const del = t.closest('[data-ci-del]'); if (del) { Cart.setQty(+del.dataset.ciDel, 0); return; }
  });
  document.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-ci-input]'); if (inp) Cart.setQty(+inp.dataset.ciInput, Math.max(0, parseInt(inp.value, 10) || 0));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeCart(); closeMenu(); closeModal(); window.__closeSearch?.(); window.__closeMega?.(); $('[data-filters].is-open')?.classList.remove('is-open'); }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('[data-open-search]')?.click(); }
  });
}

/* ================= каталог: фильтры ================= */
const FACET_NAMES = { brand: 'Бренд', vet: 'Назначение', type: 'Тип', feat: 'Особенности', taste: 'Вкус', mat: 'Материал', cls: 'Класс корма', kind: 'Вид корма', age: 'Возраст', size: 'Размер породы', lit: 'Тип наполнителя', toy: 'Тип игрушки', toyp: 'Особенность', rest: 'Место для отдыха', wear: 'Одежда', carry: 'Тип переноски', ammo: 'Амуниция', groom: 'Инструмент', care: 'Средства ухода', bowl: 'Миски', decor: 'Декор', equip: 'Оборудование', animal: 'Питомец', gender: 'Пол' };
const FACET_ORDER = Object.keys(FACET_NAMES);
const PAGE = 24;

async function initListing() {
  const root = $('[data-listing]'); if (!root) return;
  const grid = $('[data-grid]', root);
  const facetsBox = $('[data-facets]', root);
  const sortSel = $('[data-sort]', root);
  const stockCb = $('[data-f-stock]', root);
  const minIn = $('[data-f-min]', root), maxIn = $('[data-f-max]', root);
  const more = $('[data-more]', root), moreBtn = $('[data-more-btn]', root);
  const params = new URLSearchParams(location.search);
  const isSearch = root.hasAttribute('data-search-page');
  const d = await loadData();

  // базовый набор
  let base;
  let relevance = null;
  if (isSearch) {
    const q = params.get('q') || '';
    const { res } = await doSearch(q);
    base = res; relevance = new Map(res.map((p, i) => [p.id, i]));
    const t = $('[data-search-title]'); if (t) t.textContent = q ? `«${q}»` : 'Поиск по каталогу';
    document.title = `${q} — поиск — Умный зоомагазин`;
  } else {
    const cat = root.dataset.cat; const brand = root.dataset.brand; const filter = root.dataset.filter;
    base = d.items.filter((p) => {
      if (cat) { const cs = p.cs || [p.c]; if (!cs.some((i) => { const k = d.cats[i]; return k === cat || k.startsWith(cat + '/'); })) return false; }
      if (brand && (p.b < 0 || d.brands[p.b] !== brand)) return false;
      if (filter === 'sale' && !((p.o && p.o > p.p) || (p.s || []).some((s) => s === 'sale' || s === 'promo11'))) return false;
      return true;
    });
  }

  // состояние
  const sel = new Map(); // group -> Set(values)
  for (const [k, v] of params) {
    if (k === 'brand') { sel.set('brand', new Set(v.split('|'))); }
    else if (FACET_NAMES[k]) sel.set(k, new Set(v.split('|')));
  }
  if (params.get('sort')) sortSel.value = params.get('sort');
  if (params.get('all') === '1' && stockCb) stockCb.checked = false;
  if (params.get('min') && minIn) minIn.value = params.get('min');
  if (params.get('max') && maxIn) maxIn.value = params.get('max');
  if (isSearch && !params.get('sort')) sortSel.value = 'rel';
  let shown = PAGE;

  const facetVals = (p) => {
    const m = {};
    if (p.b >= 0) m.brand = [d.brands[p.b]];
    for (const f of p.f || []) { const i = f.indexOf(':'); const g = f.slice(0, i); (m[g] = m[g] || []).push(f.slice(i + 1)); }
    return m;
  };
  base.forEach((p) => { p._fv = p._fv || facetVals(p); });

  const passes = (p, skipGroup) => {
    if (stockCb && stockCb.checked && !p.a) return false;
    const mn = +(minIn?.value || 0), mx = +(maxIn?.value || 0);
    if (mn && p.p < mn) return false;
    if (mx && p.p > mx) return false;
    for (const [g, set] of sel) {
      if (g === skipGroup || !set.size) continue;
      const vals = p._fv[g] || [];
      if (!vals.some((v) => set.has(v))) return false;
    }
    return true;
  };

  const sorters = {
    pop: (a, b) => (b.a - a.a) || (a.r - b.r),
    rel: (a, b) => (b.a - a.a) || (relevance.get(a.id) - relevance.get(b.id)),
    cheap: (a, b) => (b.a - a.a) || (a.p - b.p),
    exp: (a, b) => (b.a - a.a) || (b.p - a.p),
    ppu: (a, b) => (b.a - a.a) || ((a.u || 1e9) - (b.u || 1e9)) || (a.p - b.p),
    new: (a, b) => (b.a - a.a) || (((b.s || []).includes('new')) - ((a.s || []).includes('new'))) || (a.r - b.r),
    sale: (a, b) => (b.a - a.a) || ((b.o ? 1 - b.p / b.o : 0) - (a.o ? 1 - a.p / a.o : 0)) || (a.r - b.r),
  };

  const groupsPresent = () => {
    const groups = {};
    for (const p of base) for (const [g, vals] of Object.entries(p._fv)) for (const v of vals) { (groups[g] = groups[g] || new Map()).set(v, 0); }
    return groups;
  };
  const allGroups = groupsPresent();
  const openState = store.get('sp-fopen', {});

  function renderFacets() {
    if (!facetsBox) return;
    const html = [];
    for (const g of FACET_ORDER) {
      const vals = allGroups[g]; if (!vals || vals.size < 2) continue;
      if (root.dataset.brand && g === 'brand') continue;
      const counts = new Map([...vals.keys()].map((v) => [v, 0]));
      for (const p of base) { if (!passes(p, g)) continue; for (const v of p._fv[g] || []) counts.set(v, (counts.get(v) || 0) + 1); }
      const chosen = sel.get(g) || new Set();
      const entries = [...counts.entries()].sort((a, b) => (chosen.has(b[0]) - chosen.has(a[0])) || (b[1] - a[1]) || a[0].localeCompare(b[0], 'ru'));
      const isOpen = openState[g] ?? (g === 'brand' || g === 'cls' || g === 'vet' || g === 'kind' || chosen.size > 0);
      html.push(`<details class="fgroup" data-g="${g}" ${isOpen ? 'open' : ''}>
        <summary>${FACET_NAMES[g]}${chosen.size ? ` · ${chosen.size}` : ''} ${ICON.chevron}</summary>
        <div class="fgroup__body">
          ${g === 'brand' && entries.length > 10 ? `<input class="field" style="min-height:40px;border-radius:12px;border:0;box-shadow:inset 0 0 0 1.5px var(--line);padding:8px 12px;margin-bottom:6px" placeholder="Найти бренд" data-fsearch>` : ''}
          ${entries.map(([v, c]) => `<label class="fcheck" data-fv="${esc(v.toLowerCase())}"><input type="checkbox" value="${esc(v)}" ${chosen.has(v) ? 'checked' : ''} ${!c && !chosen.has(v) ? 'disabled' : ''}><span>${esc(v)}</span><em>${c}</em></label>`).join('')}
        </div>
      </details>`);
    }
    facetsBox.innerHTML = html.join('');
  }

  function renderActive() {
    const box = $('[data-active]', root); if (!box) return;
    const chips = [];
    for (const [g, set] of sel) for (const v of set) chips.push(`<button type="button" data-rm="${g}" data-v="${esc(v)}">${esc(v)} ${ICON.close}</button>`);
    if (minIn && (+minIn.value || +maxIn.value)) chips.push(`<button type="button" data-rm="price">Цена ${minIn.value ? 'от ' + fmt(minIn.value) : ''} ${maxIn.value ? 'до ' + fmt(maxIn.value) : ''} ${ICON.close}</button>`);
    if (chips.length) chips.push(`<button type="button" class="clear" data-rm="all">Сбросить всё</button>`);
    box.innerHTML = chips.join('');
  }

  let list = [];
  function apply(resetPage = true) {
    if (resetPage) shown = PAGE;
    list = base.filter((p) => passes(p, null)).sort(sorters[sortSel.value] || sorters.pop);
    renderGrid();
    renderFacets();
    renderActive();
    const n = list.length;
    $('[data-count]', root).textContent = fmt(n);
    $('[data-count-word]', root).textContent = plural(n, 'товар', 'товара', 'товаров');
    const cb = $('[data-count-btn]', root); if (cb) cb.textContent = `· ${fmt(n)}`;
    syncUrl();
  }
  function renderGrid() {
    const slice = list.slice(0, shown);
    grid.innerHTML = slice.length ? slice.map((p) => cardHTML(p, d)).join('') : `<div class="empty" style="grid-column:1/-1"><div class="h3">Ничего не нашлось</div><p class="muted">Попробуйте ослабить фильтры или поищите по названию.</p><button class="btn btn--ink" type="button" data-rm="all">Сбросить фильтры</button></div>`;
    more.hidden = list.length <= shown;
    $('[data-more-txt]', root).textContent = `Показано ${fmt(Math.min(shown, list.length))} из ${fmt(list.length)}`;
    $('[data-more-bar]', root).style.width = `${Math.round(Math.min(shown, list.length) / Math.max(1, list.length) * 100)}%`;
    Fav.paint();
  }
  function syncUrl() {
    const u = new URLSearchParams();
    if (isSearch) u.set('q', params.get('q') || '');
    for (const [g, set] of sel) if (set.size) u.set(g, [...set].join('|'));
    if (sortSel.value !== (isSearch ? 'rel' : 'pop')) u.set('sort', sortSel.value);
    if (stockCb && !stockCb.checked) u.set('all', '1');
    if (minIn?.value) u.set('min', minIn.value);
    if (maxIn?.value) u.set('max', maxIn.value);
    const qs = u.toString();
    history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
  }

  facetsBox?.addEventListener('change', (e) => {
    const cb = e.target.closest('input[type=checkbox]'); if (!cb) return;
    const g = cb.closest('[data-g]').dataset.g;
    if (!sel.has(g)) sel.set(g, new Set());
    cb.checked ? sel.get(g).add(cb.value) : sel.get(g).delete(cb.value);
    apply();
  });
  facetsBox?.addEventListener('toggle', (e) => { const g = e.target.dataset?.g; if (g) { openState[g] = e.target.open; store.set('sp-fopen', openState); } }, true);
  facetsBox?.addEventListener('input', (e) => {
    const s = e.target.closest('[data-fsearch]'); if (!s) return;
    const q = s.value.toLowerCase().trim();
    $$('[data-fv]', s.parentElement).forEach((l) => { l.hidden = q && !l.dataset.fv.includes(q); });
  });
  root.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]'); if (!rm) return;
    const g = rm.dataset.rm;
    if (g === 'all') { sel.clear(); if (minIn) { minIn.value = ''; maxIn.value = ''; } }
    else if (g === 'price') { minIn.value = ''; maxIn.value = ''; }
    else sel.get(g)?.delete(rm.dataset.v);
    apply();
  });
  sortSel.addEventListener('change', () => apply());
  stockCb?.addEventListener('change', () => apply());
  let pt; [minIn, maxIn].forEach((i) => i?.addEventListener('input', () => { clearTimeout(pt); pt = setTimeout(() => apply(), 400); }));
  moreBtn.addEventListener('click', () => { shown += PAGE; renderGrid(); });
  $('[data-open-filters]', root)?.addEventListener('click', () => $('[data-filters]', root).classList.add('is-open'));
  $$('[data-close-filters]', root).forEach((b) => b.addEventListener('click', () => $('[data-filters]', root).classList.remove('is-open')));

  // ссылки вида /catalog/?brand=Royal Canin&kind=Влажный корм
  apply(false);
}

/* ================= страница товара ================= */
function initProduct() {
  const root = $('[data-product]'); if (!root) return;
  const P = JSON.parse($('#pdata').textContent);
  let sel = P.sel || 0;
  const qtyIn = $('[data-qty-input]', root);
  const price = $('[data-price]', root), old = $('[data-old]', root), ppu = $('[data-ppu]', root), save = $('[data-save]', root), stock = $('[data-stock]', root);
  const stickyPrice = $('[data-sticky-price]'), stickyLabel = $('[data-sticky-label]');
  const upd = () => {
    const o = P.o[sel];
    price.textContent = money(o.p);
    if (old) { old.hidden = !o.old; old.textContent = o.old ? money(o.old) : ''; }
    if (ppu) ppu.textContent = o.ppu ? `${money(o.ppu)}/${o.uu === 'l' ? 'л' : 'кг'}` : '';
    if (save) { save.hidden = !o.s; save.textContent = o.s ? `выгоднее на ${o.s}% за кг` : ''; }
    if (stock && o.q !== null) {
      stock.className = 'stock' + (o.q <= 0 ? ' stock--out' : o.q <= 3 ? ' stock--low' : '');
      stock.textContent = o.q <= 0 ? 'Нет в наличии' : o.q <= 3 ? `Осталось мало: ${o.q} шт.` : 'В наличии';
    }
    const nm = $('[data-opt-name]', root); if (nm) nm.textContent = o.l;
    const art = $('[data-art]', root); if (art && o.a) art.textContent = o.a;
    const cl = $('[data-club]', root); if (cl) { $('[data-club-wrap]', root).hidden = !o.c; cl.textContent = money(o.c); }
    if (stickyPrice) stickyPrice.textContent = money(o.p);
    if (stickyLabel) stickyLabel.textContent = o.l;
    $$('[data-opt]', root).forEach((b) => b.setAttribute('aria-pressed', +b.dataset.opt === sel));
    document.dispatchEvent(new CustomEvent('td:offer', { detail: o }));
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-opt]'); if (b) { sel = +b.dataset.opt; upd(); }
    const q = e.target.closest('[data-q]'); if (q && qtyIn) qtyIn.value = Math.max(1, Math.min(99, (+qtyIn.value || 1) + +q.dataset.q));
    const th = e.target.closest('[data-thumb]');
    if (th) { const img = $('[data-main-img]', root); img.style.opacity = 0; setTimeout(() => { img.src = th.dataset.thumb; img.style.opacity = 1; }, 160); $$('[data-thumb]', root).forEach((x) => x.classList.toggle('is-active', x === th)); }
  });
  const buy = () => {
    const o = P.o[sel];
    Cart.add({ id: P.id, oid: o.id, n: P.n, l: o.l, p: o.p, k: o.c || 0, img: P.im, u: P.u }, Math.max(1, +(qtyIn?.value) || 1));
  };
  $$('[data-buy]').forEach((b) => b.addEventListener('click', buy));
  // быстрый заказ
  $('[data-quick-open]', root)?.addEventListener('click', () => {
    const o = P.o[sel];
    $('[data-quick-item]').textContent = `${P.n}${o.l ? ' · ' + o.l : ''} — ${money(o.p)} × ${Math.max(1, +(qtyIn?.value) || 1)}`;
    window.__quick = { items: [{ id: P.id, oid: o.id, name: P.n, label: o.l, price: o.p, q: Math.max(1, +(qtyIn?.value) || 1) }] };
    openModal('#quick');
  });
  // описание
  $('[data-prose-toggle]')?.addEventListener('click', (e) => { $('[data-prose]').classList.remove('prose--collapsed'); e.currentTarget.remove(); });
  // липкая панель покупки на мобильных
  const sticky = $('[data-sticky-buy]');
  const panel = $('.buy__panel', root);
  if (sticky && panel) new IntersectionObserver(([e]) => sticky.classList.toggle('is-on', !e.isIntersecting && e.boundingClientRect.top < 0)).observe(panel);
  // калькулятор
  const calc = $('[data-pcalc]');
  if (calc) {
    const pet = calc.dataset.pet; const kcal = +calc.dataset.kcal;
    const w = $('[data-pc-w]', calc); let act = +($$('[data-pc-act][aria-pressed="true"]', calc)[0]?.dataset.pcAct ?? 1);
    const run = () => {
      const o = P.o[sel];
      const W = +w.value; $('[data-pc-wv]', calc).textContent = String(W).replace('.', ',');
      w.style.setProperty('--p', `${(W - +w.min) / (+w.max - +w.min) * 100}%`);
      const f = pet === 'cat' ? [1.0, 1.2, 1.4, 2.5][act] : [1.3, 1.6, 2.0, 2.5][act];
      const g = 70 * Math.pow(W, 0.75) * f / kcal;
      $('[data-pc-g]', calc).textContent = fmt(g);
      $('[data-pc-pack]', calc).textContent = o.l || 'упаковку';
      if (o.k) {
        const days = o.k * 1000 / g;
        $('[data-pc-days]', calc).textContent = days >= 1 ? fmt(days) : '<1';
        $('[data-pc-rub]', calc).textContent = fmt(o.p / Math.max(days, 0.01));
      } else { $('[data-pc-days]', calc).textContent = '—'; $('[data-pc-rub]', calc).textContent = '—'; }
    };
    w.addEventListener('input', run);
    calc.addEventListener('click', (e) => { const b = e.target.closest('[data-pc-act]'); if (!b) return; act = +b.dataset.pcAct; $$('[data-pc-act]', calc).forEach((x) => x.setAttribute('aria-pressed', x === b)); run(); });
    document.addEventListener('td:offer', run);
    run();
  }
  // запомнить просмотренное
  const seen = store.get('sp-seen', []).filter((x) => x !== P.id); seen.unshift(P.id); store.set('sp-seen', seen.slice(0, 20));
}

/* ================= калькулятор на главной ================= */
function initHomeCalc() {
  const calc = $('[data-calc]'); if (!calc) return;
  const data = JSON.parse($('[data-calc-json]', calc).textContent);
  let pet = 'cat'; let food = null; let pack = 0;
  const w = $('[data-calc-w]', calc), sel = $('[data-calc-food]', calc), packs = $('[data-calc-packs]', calc);
  const fillFoods = () => {
    const list = data[pet];
    sel.innerHTML = list.map((f, i) => `<option value="${i}">${esc(f.b ? f.b + ' — ' : '')}${esc(f.n.length > 70 ? f.n.slice(0, 68) + '…' : f.n)}</option>`).join('');
    food = list[0]; pack = Math.max(0, food ? food.o.length - 1 : 0);
    w.max = pet === 'cat' ? 10 : 60; w.min = 1; w.step = pet === 'cat' ? 0.5 : 1; w.value = pet === 'cat' ? 4 : 15;
    fillPacks();
  };
  const fillPacks = () => {
    if (!food) { packs.innerHTML = ''; return; }
    packs.innerHTML = food.o.map((o, i) => `<button class="chip${i === pack ? ' is-active' : ''}" type="button" data-pack="${i}">${esc(o[0])} · ${money(o[2])}</button>`).join('') + `<a class="chip" href="${food.u}">Открыть товар ${ICON.arrow.replace('<svg ', '<svg width="14" height="14" ')}</a>`;
    run();
  };
  const run = () => {
    const W = +w.value; $('[data-calc-wv]', calc).textContent = String(W).replace('.', ',');
    w.style.setProperty('--p', `${(W - +w.min) / (+w.max - +w.min) * 100}%`);
    const g = 70 * Math.pow(W, 0.75) * (pet === 'cat' ? 1.2 : 1.6) / 3.7;
    $('[data-calc-g]', calc).textContent = fmt(g);
    if (!food) return;
    const o = food.o[pack]; const days = o[1] * 1000 / g;
    $('[data-calc-days]', calc).textContent = fmt(days);
    $('[data-calc-rub]', calc).textContent = fmt(o[2] / days);
  };
  calc.addEventListener('click', (e) => {
    const pb = e.target.closest('[data-calc-pet]');
    if (pb) { pet = pb.dataset.calcPet; $$('[data-calc-pet]', calc).forEach((x) => x.setAttribute('aria-pressed', x === pb)); fillFoods(); }
    const pk = e.target.closest('[data-pack]');
    if (pk) { pack = +pk.dataset.pack; fillPacks(); }
  });
  sel.addEventListener('change', () => { food = data[pet][+sel.value]; pack = food.o.length - 1; fillPacks(); });
  w.addEventListener('input', run);
  fillFoods();
}

/* ================= магазины ================= */
function irkNow() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Irkutsk', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: get('weekday'), min: (+get('hour') % 24) * 60 + +get('minute') };
}
function parseSchedule(s) {
  s = s.replace(/\\n/g, '\n');
  const times = (str) => [...str.matchAll(/(\d{1,2})(?::(\d{2}))?/g)].map((m) => +m[1] * 60 + (+m[2] || 0));
  if (/пн-сб/i.test(s) && /вс/i.test(s)) {
    const [a, b] = s.split(/вс/i); const ta = times(a), tb = times(b);
    return { wk: [ta[0], ta[1]], sun: [tb[0], tb[1]] };
  }
  const t = times(s); return { wk: [t[0], t[1]], sun: [t[0], t[1]] };
}
const hhmm = (m) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
function storeStatus(schedule) {
  const sch = parseSchedule(schedule); const now = irkNow();
  const [o, c] = now.day === 'Sun' ? sch.sun : sch.wk;
  if (o === undefined || c === undefined) return null;
  const open = now.min >= o && now.min < c;
  return { open, text: open ? `Открыто до ${hhmm(c)}` : `Закрыто · откроется в ${hhmm(o)}` };
}
function initStores() {
  const list = $('[data-store-list]'); if (!list) return;
  $$('[data-store]', list).forEach((s) => {
    const st = storeStatus(s.dataset.schedule); const el = $('[data-status]', s);
    if (st && el) { el.textContent = st.text; el.classList.add(st.open ? 'is-open' : 'is-closed'); s.dataset.open = st.open ? '1' : '0'; }
  });
  const mapBox = $('[data-store-map]');
  const stores = $$('[data-store]', list);
  let map = null; const markers = new Map();
  const PIN = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8.6-5.2-10.3-10.6C.4 6.4 2.9 3 6.6 3c2.2 0 4.1 1.2 5.4 3.1C13.3 4.2 15.2 3 17.4 3c3.7 0 6.2 3.4 4.9 7.4C20.6 15.8 12 21 12 21z"/></svg>';
  const loadLeaflet = () => new Promise((res, rej) => {
    if (window.L) return res(window.L);
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    const js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = () => res(window.L); js.onerror = rej; document.head.appendChild(js);
  });
  const fitCity = (c) => {
    if (!map) return;
    const pts = stores.filter((s) => s.dataset.city === c).map((s) => [+s.dataset.lat, +s.dataset.lon]);
    if (pts.length) map.fitBounds(pts, { padding: [40, 40], maxZoom: 14 });
  };
  const focusStore = (s) => {
    stores.forEach((x) => x.classList.toggle('is-active', x === s));
    markers.forEach((m, el) => m.getElement()?.querySelector('.mpin')?.classList.toggle('is-active', el === s));
    const m = markers.get(s); if (map && m) { map.flyTo(m.getLatLng(), 15, { duration: 0.6 }); m.openPopup(); }
  };
  const initMap = async () => {
    try {
      const L = await loadLeaflet();
      map = L.map(mapBox, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
      L.tileLayer(CFG.mapTiles || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; участники OpenStreetMap' }).addTo(map);
      const icon = L.divIcon({ className: '', html: `<div class="mpin">${PIN}</div>`, iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36] });
      for (const s of stores) {
        const addr = $('.store__addr', s).textContent; const place = $('.store__place', s).textContent.trim();
        const sched = s.dataset.schedule.split('\\n').join(', ');
        const m = L.marker([+s.dataset.lat, +s.dataset.lon], { icon, title: addr }).addTo(map)
          .bindPopup(`<b>${esc(addr)}</b>${place ? esc(place) + '<br>' : ''}${esc(sched)}<br><a href="https://yandex.ru/maps/?pt=${s.dataset.lon},${s.dataset.lat}&z=17&l=map" target="_blank" rel="noopener">Построить маршрут →</a>`);
        m.on('click', () => { stores.forEach((x) => x.classList.toggle('is-active', x === s)); s.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
        markers.set(s, m);
      }
      fitCity(city);
    } catch (err) {
      mapBox.innerHTML = '<div class="map-fallback">Карта не загрузилась. Адреса и маршруты — в списке справа.</div>';
    }
  };
  if (mapBox) {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); initMap(); } }, { rootMargin: '400px' });
    io.observe(mapBox);
  }
  list.addEventListener('click', (e) => { const s = e.target.closest('[data-store]'); if (s && !e.target.closest('a')) focusStore(s); });
  const tabs = $('[data-store-tabs]');
  let city = 'Иркутск'; let onlyOpen = false;
  const filter = () => stores.forEach((s) => { s.hidden = s.dataset.city !== city || (onlyOpen && s.dataset.open !== '1'); });
  tabs?.addEventListener('click', (e) => {
    const t = e.target.closest('[data-city-tab]');
    if (t) { city = t.dataset.cityTab; $$('[data-city-tab]', tabs).forEach((x) => x.classList.toggle('is-active', x === t)); fitCity(city); filter(); }
    const o = e.target.closest('[data-open-now]');
    if (o) { onlyOpen = !onlyOpen; o.classList.toggle('is-active', onlyOpen); filter(); }
  });
  filter();
}

/* ================= обратный отсчёт акций ================= */
function initCountdown() {
  $$('[data-countdown]').forEach((el) => {
    const end = new Date(`${el.dataset.countdown}T23:59:59+08:00`);
    const tick = () => {
      const ms = end - Date.now();
      if (ms <= 0) { el.textContent = 'Акция завершена'; return; }
      const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
      el.innerHTML = d > 0 ? `Осталось <b>${d} ${plural(d, 'день', 'дня', 'дней')} ${h} ч</b>` : `Осталось <b>${h} ч ${m} мин</b>`;
    };
    tick(); setInterval(tick, 30000);
  });
}

/* ================= отправка заказа ================= */
async function sendOrder(payload) {
  if (CFG.orderEndpoint) {
    try {
      const r = await fetch(CFG.orderEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok) return { ok: true, id: j.id };
    } catch { /* нет сети или нет PHP — покажем запасной вариант */ }
  }
  return { ok: false };
}
function orderText(p) {
  const lines = [`Заказ с сайта smartpetstore.ru`, `Имя: ${p.name}`, `Телефон: ${p.phone}`];
  if (p.delivery) lines.push(`Получение: ${p.delivery}`);
  if (p.store) lines.push(`Магазин: ${p.store}`);
  if (p.address) lines.push(`Адрес: ${p.address}`);
  if (p.payment) lines.push(`Оплата: ${p.payment}`);
  if (p.bonusCard) lines.push(`Бонусная карта: ${p.bonusCard}`);
  if (p.comment) lines.push(`Комментарий: ${p.comment}`);
  lines.push('', 'Товары:');
  for (const it of p.items) lines.push(`— ${it.name}${it.label ? ' (' + it.label + ')' : ''} × ${it.q} = ${fmt(it.price * it.q)} ₽`);
  if (p.total) lines.push('', `Итого: ${fmt(p.total)} ₽`);
  return lines.join('\n');
}
function fallbackHTML(p) {
  const text = orderText(p);
  return `<div class="notice notice--warn">${ICON.info}<div>Не получилось отправить заказ автоматически. Это не страшно — отправьте его одним касанием или позвоните, оператор всё оформит.</div></div>
    <div class="row mt-m"><a class="btn btn--ink" href="mailto:${CFG.email}?subject=${encodeURIComponent('Заказ с сайта')}&body=${encodeURIComponent(text)}">Отправить письмом</a><a class="btn btn--ghost" href="${CFG.phoneHref}">Позвонить ${esc(CFG.phone)}</a><button class="btn btn--ghost" type="button" data-copy>Скопировать заказ</button></div>
    <textarea class="sr-only" data-copy-src>${esc(text)}</textarea>`;
}
document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-copy]'); if (!c) return;
  const t = $('[data-copy-src]')?.value || '';
  navigator.clipboard?.writeText(t).then(() => toast({ title: 'Заказ скопирован' }));
});

function phoneMask(input) {
  input.addEventListener('input', () => {
    let d = input.value.replace(/\D/g, '');
    if (d.startsWith('8')) d = '7' + d.slice(1);
    if (!d.startsWith('7')) d = '7' + d;
    d = d.slice(0, 11);
    const p = d.slice(1);
    let s = '+7';
    if (p.length) s += ' (' + p.slice(0, 3);
    if (p.length >= 3) s += ')';
    if (p.length > 3) s += ' ' + p.slice(3, 6);
    if (p.length > 6) s += '-' + p.slice(6, 8);
    if (p.length > 8) s += '-' + p.slice(8, 10);
    input.value = s;
  });
}
const phoneOk = (v) => v.replace(/\D/g, '').length === 11;

function initQuick() {
  const form = $('[data-quick-form]'); if (!form) return;
  phoneMask(form.phone);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let bad = false;
    for (const [f, ok] of [[form.name, form.name.value.trim().length > 1], [form.phone, phoneOk(form.phone.value)]]) { f.closest('.field').classList.toggle('is-error', !ok); bad = bad || !ok; }
    if (!form.agree.checked) bad = true;
    if (bad) return;
    const btn = $('button[type=submit]', form); btn.disabled = true; btn.textContent = 'Отправляем…';
    const items = (window.__quick && window.__quick.items) || [];
    const payload = { type: 'quick', name: form.name.value.trim(), phone: form.phone.value, items, total: items.reduce((s, i) => s + i.price * i.q, 0), website: form.website.value };
    const res = await sendOrder(payload);
    const box = form.closest('.modal__box');
    if (res.ok) {
      box.innerHTML = `<div class="stack" style="--stack:16px;text-align:center;justify-items:center;padding:12px 0"><div class="vcard__ico" style="width:64px;height:64px;border-radius:50%">${ICON.check}</div><div class="h3">Заявка №${esc(res.id)} принята</div><p class="muted">Оператор перезвонит, уточнит детали и оформит заказ.</p><button class="btn btn--ink" type="button" data-close-modal>Отлично</button></div>`;
    } else {
      box.querySelector('form').insertAdjacentHTML('beforebegin', fallbackHTML(payload));
      btn.disabled = false; btn.textContent = 'Жду звонка';
    }
  });
}

/* ================= корзина: страница оформления ================= */
function renderBasket() {
  const root = $('[data-basket]'); if (!root) return;
  if (root.dataset.done) return;
  const items = Cart.items;
  if (!items.length) {
    root.innerHTML = `<div class="empty"><div class="h2">В корзине пусто</div><p class="lead">Самое время порадовать питомца.</p><div class="row" style="justify-content:center"><a class="btn btn--ink btn--lg" href="c/">Перейти в каталог</a><a class="btn btn--ghost btn--lg" href="personal/favorite/">Избранное</a></div></div>`;
    return;
  }
  const keepForm = $('[data-checkout]', root);
  const saved = keepForm ? Object.fromEntries(new FormData(keepForm)) : store.get('sp-checkout', {});
  const total = Cart.total();
  const clubTotal = Cart.clubTotal();
  root.innerHTML = `
  <div class="cart-page">
    <div class="stack" style="--stack:12px">
      <div class="stack" style="--stack:10px">${items.map(cartItemHTML).join('')}</div>
      <button class="link" type="button" data-clear-cart style="justify-self:start;color:var(--ink-3)">Очистить корзину</button>
      <form class="form mt-l" data-checkout novalidate>
        <div class="h3">Оформление</div>
        <div class="form__grid">
          <div class="field"><label for="c-name">Имя *</label><input id="c-name" name="name" autocomplete="name" required maxlength="80"></div>
          <div class="field"><label for="c-phone">Телефон *</label><input id="c-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 (___) ___-__-__" required maxlength="20"></div>
        </div>
        <div class="field"><label>Куда доставить</label>
          <div class="radio-cards">
            <label class="rcard"><input type="radio" name="delivery" value="Иркутск"><b>Иркутск</b><span>0 ₽ от ${fmt(CFG.freeFrom)} ₽, иначе ${CFG.deliveryCost} ₽</span></label>
            <label class="rcard"><input type="radio" name="delivery" value="Ангарск"><b>Ангарск</b><span>0 ₽ от ${fmt(CFG.freeFrom)} ₽, иначе ${CFG.deliveryCost} ₽</span></label>
            <label class="rcard"><input type="radio" name="delivery" value="Хомутово"><b>Хомутово</b><span>Стоимость уточнит оператор</span></label>
          </div>
        </div>
        <div class="field"><label for="c-addr">Адрес доставки *</label><input id="c-addr" name="address" autocomplete="street-address" placeholder="Улица, дом, квартира, подъезд" maxlength="300"></div>
        <div class="field"><label>Клубная карта −15%</label>
          <label class="consent"><input type="checkbox" name="club" value="1"> <span>У меня есть клубная карта или я зарегистрирован на сайте — посчитать по клубной цене</span></label>
          <input name="bonusCard" inputmode="numeric" placeholder="Номер клубной карты (если есть)" maxlength="40" style="margin-top:8px">
        </div>
        <div class="field"><label>Оплата</label>
          <div class="radio-cards">
            <label class="rcard"><input type="radio" name="payment" value="При получении"><b>При получении</b><span>Курьеру</span></label>
            <label class="rcard"><input type="radio" name="payment" value="Онлайн"><b>Онлайн</b><span>Оператор подтвердит заказ и способ оплаты</span></label>
            <label class="rcard"><input type="radio" name="payment" value="По счёту (юрлицо)"><b>По счёту</b><span>Для юридических лиц</span></label>
          </div>
        </div>
        <div class="field"><label for="c-comment">Комментарий</label><textarea id="c-comment" name="comment" placeholder="Домофон, этаж, удобное время доставки" maxlength="1000"></textarea></div>
        <input type="text" name="website" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true">
        <label class="consent"><input type="checkbox" name="agree" value="1" checked required> <span>Принимаю условия <a href="term/" target="_blank">пользовательского соглашения</a> и даю согласие на обработку персональных данных по <a href="privacy/" target="_blank">политике конфиденциальности</a></span></label>
        <div data-order-msg></div>
      </form>
    </div>
    <aside class="summary">
      <div class="h4">Ваш заказ</div>
      <div class="summary__line"><span>Товары · ${Cart.count()}</span><b>${money(total)}</b></div>
      <div class="summary__line" data-club-line hidden><span>Клубная скидка −15%</span><b>−${money(total - clubTotal)}</b></div>
      <div class="summary__line"><span>Доставка</span><b data-ship-cost>—</b></div>
      <div data-ship-info>${shipInfo(total)}</div>
      <hr class="divider">
      <div class="total-row"><span>Итого</span><b data-grand>${money(total)}</b></div>
      <p class="small" style="color:var(--brand-ink)" data-club-hint>По клубной карте было бы ${money(clubTotal)}</p>
      <button class="btn btn--ink btn--lg btn--block" type="submit" form="__checkout" data-submit>Оформить заказ</button>
      <p class="tiny muted">Оператор позвонит, чтобы подтвердить заказ. Доставка — на следующий день; при отказе от заказа оплачивается выезд курьера.</p>
    </aside>
  </div>`;
  const form = $('[data-checkout]', root);
  form.id = '__checkout';
  for (const [k, v] of Object.entries(saved)) {
    const els = form.elements[k]; if (!els) continue;
    if (els instanceof RadioNodeList) { for (const r of els) if (r.value === v) r.checked = true; }
    else if (els.type === 'checkbox') els.checked = !!v; else els.value = v;
  }
  if (!form.delivery.value) form.querySelector('input[name=delivery]').checked = true;
  if (!form.payment.value) form.querySelector('input[name=payment]').checked = true;
  phoneMask(form.phone);
  const calc = () => {
    const club = form.club.checked;
    const goods = club ? clubTotal : total;
    const cost = form.delivery.value === 'Хомутово' ? null : (goods >= CFG.freeFrom ? 0 : CFG.deliveryCost);
    return { club, goods, cost };
  };
  const sync = () => {
    const { club, goods, cost } = calc();
    $('[data-club-line]', root).hidden = !club;
    $('[data-club-hint]', root).hidden = club || clubTotal >= total;
    $('[data-ship-cost]', root).textContent = cost === null ? 'уточнит оператор' : cost ? money(cost) : 'бесплатно';
    $('[data-ship-info]', root).innerHTML = shipInfo(goods);
    $('[data-grand]', root).textContent = money(goods + (cost || 0));
    store.set('sp-checkout', Object.fromEntries([...new FormData(form)].filter(([k]) => !['website', 'agree'].includes(k))));
  };
  form.addEventListener('change', sync);
  form.addEventListener('input', () => store.set('sp-checkout', Object.fromEntries([...new FormData(form)].filter(([k]) => !['website', 'agree'].includes(k)))));
  sync();
  $('[data-clear-cart]', root).addEventListener('click', () => { if (confirm('Очистить корзину?')) Cart.clear(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const checks = [[form.name, form.name.value.trim().length > 1], [form.phone, phoneOk(form.phone.value)], [form.address, form.address.value.trim().length > 4]];
    let bad = false;
    for (const [f, ok] of checks) { f.closest('.field').classList.toggle('is-error', !ok); if (!ok && !bad) { f.focus(); bad = true; } }
    if (!form.agree.checked) { bad = true; toast({ title: 'Нужно согласие с условиями' }); }
    if (bad) return;
    const btn = $('[data-submit]', root); btn.disabled = true; btn.textContent = 'Отправляем…';
    const { club, goods, cost } = calc();
    const payload = {
      type: 'cart', name: form.name.value.trim(), phone: form.phone.value, delivery: 'Курьер, ' + form.delivery.value,
      address: form.address.value.trim(), payment: form.payment.value,
      bonusCard: (club ? 'клубная цена; ' : '') + form.bonusCard.value.trim(), comment: form.comment.value.trim(),
      items: Cart.items.map((i) => ({ id: i.id, oid: i.oid, name: i.n, label: i.l, price: club && i.k ? i.k : i.p, q: i.q })),
      deliveryCost: cost || 0, total: goods + (cost || 0), website: form.website.value,
    };
    const res = await sendOrder(payload);
    if (res.ok) {
      root.dataset.done = '1';
      Cart.clear();
      store.set('sp-checkout', { name: payload.name, phone: payload.phone, delivery: form.delivery.value, address: payload.address, payment: payload.payment, club: club ? '1' : '' });
      root.innerHTML = `<div class="empty" style="padding:clamp(40px,6vw,80px) 24px"><div class="vcard__ico" style="width:72px;height:72px;border-radius:50%">${ICON.check}</div><div class="h2">Заказ №${esc(res.id)} принят</div><p class="lead" style="max-width:560px">Спасибо! Оператор позвонит по номеру ${esc(payload.phone)}, чтобы подтвердить заказ. Доставим на следующий день.</p><div class="row" style="justify-content:center"><a class="btn btn--ink btn--lg" href="c/">Продолжить покупки</a><a class="btn btn--ghost btn--lg" href="/">На главную</a></div></div>`;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      $('[data-order-msg]', root).innerHTML = fallbackHTML(payload);
      btn.disabled = false; btn.textContent = 'Оформить заказ';
    }
  });
}

/* ================= избранное: страница ================= */
async function renderFavorites() {
  const root = $('[data-favorites]'); if (!root) return;
  const ids = [...Fav.ids];
  if (!ids.length) { root.innerHTML = `<div class="empty"><div class="h3">Здесь пока пусто</div><p class="muted">Нажимайте ♡ на карточках — и любимые товары будут под рукой.</p><a class="btn btn--ink" href="c/">В каталог</a></div>`; return; }
  const d = await loadData();
  const list = ids.map((id) => d.byId.get(id)).filter(Boolean);
  root.innerHTML = `<div class="grid-products">${list.map((p) => cardHTML(p, d)).join('')}</div>`;
  Fav.paint();
}

/* ================= запуск ================= */
function boot() {
  initHeader();
  initSearch();
  initClicks();
  initReveal();
  initRails();
  initProduct();
  initHomeCalc();
  initStores();
  initCountdown();
  initQuick();
  initListing();
  renderFavorites();
  Cart.paint();
  Fav.paint();
  if ($('[data-basket]')) Cart.refresh();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
