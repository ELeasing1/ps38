// Карточка товара. Используется и сборщиком (Node), и браузером — разметка совпадает 1 в 1.
export const NB = ' ';

export const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function money(v) {
  if (v === null || v === undefined || isNaN(v)) return '';
  return String(Math.round(+v)).replace(/\B(?=(\d{3})+(?!\d))/g, NB) + NB + '₽';
}

export const plural = (n, a, b, c) => { const x = Math.abs(n) % 100, y = x % 10; return x > 10 && x < 20 ? c : y > 1 && y < 5 ? b : y === 1 ? a : c; };

export const STICKERS = { hit: ['Хит', 'badge--hit'], new: ['Новинка', 'badge--new'], rec: ['Советуем', 'badge--rec'], sale: ['Акция', 'badge--sale'], promo11: ['1+1', 'badge--sale'], order: ['Под заказ', 'badge--vet'] };

const I_HEART = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20.3s-7.4-4.5-9.1-9.3C1.7 7.6 4 4.6 7.3 4.6c2 0 3.5 1.1 4.7 2.8 1.2-1.7 2.7-2.8 4.7-2.8 3.3 0 5.6 3 4.4 6.4-1.7 4.8-9.1 9.3-9.1 9.3z"/></svg>';
const I_PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const I_SPARK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5c.9 4.7 2.6 6.4 7.5 7.5-4.9 1.1-6.6 2.8-7.5 7.5-.9-4.7-2.6-6.4-7.5-7.5 4.9-1.1 6.6-2.8 7.5-7.5z"/></svg>';

export const productUrl = (p) => p.h;
export const productImg = (p) => (p.im ? `img/p/${p.id}.webp` : 'assets/img/placeholder.svg');

export function cardHTML(p, D, opts = {}) {
  const url = productUrl(p, D);
  const brand = p.b >= 0 ? D.brands[p.b] : '';
  const multi = p.v && p.v.length > 1;
  const badges = [];
  if (p.o && p.o > p.p) badges.push(`<span class="badge badge--sale">−${Math.round((1 - p.p / p.o) * 100)}%</span>`);
  for (const s of p.s || []) {
    if (s === 'sale' && p.o && p.o > p.p) continue;
    const st = STICKERS[s]; if (st) badges.push(`<span class="badge ${st[1]}">${st[0]}</span>`);
    if (badges.length >= 2) break;
  }
  const z = p.z || [];
  const sizeLike = z.every((x) => /\d/.test(x) && x.length <= 16);
  const sizes = !z.length ? '' : sizeLike
    ? z.slice(0, 3).map((x) => `<span>${esc(x)}</span>`).join('') + (z.length > 3 ? `<span>+${z.length - 3}</span>` : '')
    : `<span>${z.length} ${plural(z.length, 'вариант', 'варианта', 'вариантов')}</span>`;
  const unit = p.u ? `от ${money(p.u)}/${p.uu === 'l' ? 'л' : 'кг'}` : (p.a ? '' : 'Нет в наличии');
  const lazy = opts.eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  return `<article class="pcard${p.a ? '' : ' pcard--out'}" data-pid="${p.id}">
  <a class="pcard__media" href="${url}" tabindex="-1" aria-hidden="true">
    <img src="${productImg(p)}" alt="" width="560" height="560" ${lazy}>
    ${badges.length ? `<span class="pcard__badges">${badges.join('')}</span>` : ''}
  </a>
  <button class="pcard__fav" type="button" data-fav="${p.id}" aria-label="В избранное" aria-pressed="false">${I_HEART}</button>
  <div class="pcard__body">
    ${brand ? `<div class="pcard__brand">${esc(brand)}</div>` : ''}
    <a class="pcard__title" href="${url}">${esc(p.n)}</a>
    ${p.t ? `<div class="pcard__why">${I_SPARK}${esc(p.t)}</div>` : ''}
    ${sizes ? `<div class="pcard__sizes">${sizes}</div>` : ''}
    <div class="pcard__foot">
      <div class="pcard__price">
        ${p.o && p.o > p.p ? `<s>${money(p.o)}</s>` : ''}
        <b>${multi ? 'от ' : ''}${money(p.p)}</b>
        ${p.k ? `<span class="pcard__club">${money(p.k)} по карте</span>` : ''}
        ${unit ? `<span class="pcard__unit">${unit}</span>` : ''}
      </div>
      ${p.a ? `<button class="pcard__add" type="button" data-add="${p.id}" aria-label="Добавить в корзину">${I_PLUS}</button>` : ''}
    </div>
  </div>
</article>`;
}
