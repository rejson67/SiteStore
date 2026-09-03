import { supabase, isSupabaseConfigured } from './supabaseClient.js';

/* ============================================================
   SiteStore — App Store dla stron internetowych
   ============================================================ */

const LIKED_KEY = 'sitestore_liked_ids';

const state = {
  sites: [],        // wszystkie zatwierdzone strony z bazy
  query: '',        // aktualna fraza wyszukiwania
  sort: 'popular',  // 'popular' | 'newest'
  likedIds: loadLikedIds(),
  demoMode: false,
};

/* ---------- DOM refs ---------- */
const $grid = document.getElementById('grid');
const $loader = document.getElementById('loader');
const $empty = document.getElementById('empty-state');
const $statusBar = document.getElementById('status-bar');
const $searchInput = document.getElementById('search-input');
const $searchClear = document.getElementById('search-clear');
const $searchWrap = $searchInput.closest('.search');
const $tabs = document.querySelectorAll('.tab');
const $randomBtn = document.getElementById('random-btn');
const $addBtn = document.getElementById('add-site-btn');
const $overlay = document.getElementById('modal-overlay');
const $modalClose = document.getElementById('modal-close');
const $form = document.getElementById('submit-form');
const $submitBtn = document.getElementById('submit-btn');
const $toast = document.getElementById('toast');

document.getElementById('year').textContent = new Date().getFullYear();

/* ============================================================
   DANE — Supabase (tabela `websites`)
   Struktura: id, created_at, title, url, description,
              likes (default 0), is_approved (default false)
   ============================================================ */

// Dane przykładowe (fallback, gdy brak konfiguracji Supabase)
const DEMO_SITES = [
  { id: 1,  created_at: '2025-01-12T10:00:00Z', title: 'Remove.bg',        url: 'https://www.remove.bg',        description: 'Automatyczne usuwanie tła ze zdjęć w kilka sekund dzięki AI. Wgraj obrazek, a algorytm zrobi resztę.', likes: 128, is_approved: true },
  { id: 2,  created_at: '2025-03-02T14:30:00Z', title: 'Slow Roads',       url: 'https://slowroads.io',         description: 'Relaksująca, nieskończona jazda samochodem przez proceduralnie generowane krajobrazy. Prosto w przeglądarce.', likes: 94, is_approved: true },
  { id: 3,  created_at: '2025-05-18T09:15:00Z', title: 'Excalidraw',       url: 'https://excalidraw.com',       description: 'Wirtualna tablica do szkicowania diagramów o ręcznie rysowanym charakterze. Idealna do szybkich schematów.', likes: 211, is_approved: true },
  { id: 4,  created_at: '2025-06-25T16:45:00Z', title: 'Photopea',         url: 'https://www.photopea.com',     description: 'Darmowy edytor graficzny w przeglądarce — niemal pełen Photoshop bez instalacji. Obsługuje PSD, XCF i Sketch.', likes: 187, is_approved: true },
  { id: 5,  created_at: '2025-07-30T11:20:00Z', title: 'Radio Garden',     url: 'https://radio.garden',         description: 'Obracaj globusem i słuchaj tysięcy stacji radiowych na żywo z całego świata. Podróżuj dźwiękiem.', likes: 156, is_approved: true },
  { id: 6,  created_at: '2025-08-10T08:05:00Z', title: 'TinyWow',          url: 'https://tinywow.com',          description: 'Ogromny zestaw darmowych narzędzi do PDF, wideo, obrazków i tekstu. Wszystko w jednym miejscu, bez rejestracji.', likes: 73, is_approved: true },
  { id: 7,  created_at: '2025-08-22T19:40:00Z', title: 'Musiclab',         url: 'https://musiclab.chromeexperiments.com', description: 'Eksperymenty muzyczne od Google — twórz rytmy, melodie i poznawaj teorię muzyki przez zabawę.', likes: 41, is_approved: true },
  { id: 8,  created_at: '2025-08-29T12:00:00Z', title: 'Ten Minute Mail',  url: 'https://10minutemail.com',     description: 'Tymczasowy adres e-mail ważny 10 minut. Idealny do jednorazowych rejestracji i ochrony prywatności.', likes: 65, is_approved: true },
];

async function fetchSites() {
  if (!isSupabaseConfigured) {
    state.demoMode = true;
    return DEMO_SITES.filter((s) => s.is_approved);
  }

  const { data, error } = await supabase
    .from('websites')
    .select('id, created_at, title, url, description, likes')
    .eq('is_approved', true); // WYŁĄCZNIE zatwierdzone rekordy

  if (error) throw error;
  return data ?? [];
}

async function likeSiteInDb(id) {
  if (state.demoMode) return true;

  // Preferowana ścieżka: atomowy inkrement przez RPC
  const { error: rpcError } = await supabase.rpc('increment_likes', {
    website_id: id,
  });
  if (!rpcError) return true;

  // Fallback: zwykły update (gdy funkcja RPC nie istnieje)
  const site = state.sites.find((s) => s.id === id);
  const { error } = await supabase
    .from('websites')
    .update({ likes: (site?.likes ?? 0) + 1 })
    .eq('id', id);

  return !error;
}

async function submitSite({ title, url, description }) {
  if (state.demoMode) return true; // symulacja w trybie demo

  const { error } = await supabase.from('websites').insert({
    title,
    url,
    description,
    is_approved: false, // zgłoszenia czekają na weryfikację
  });
  if (error) throw error;
  return true;
}

/* ============================================================
   LIKES — localStorage guard (blokada wielokrotnego klikania)
   ============================================================ */

function loadLikedIds() {
  try {
    return new Set(JSON.parse(localStorage.getItem(LIKED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function persistLikedIds() {
  localStorage.setItem(LIKED_KEY, JSON.stringify([...state.likedIds]));
}

/* ============================================================
   RENDER
   ============================================================ */

function getDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function faviconUrl(url) {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`;
}

function getVisibleSites() {
  const q = state.query.trim().toLowerCase();
  let list = state.sites;

  if (q) {
    list = list.filter(
      (s) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
    );
  }

  list = [...list];
  if (state.sort === 'popular') {
    list.sort((a, b) => (b.likes ?? 0) - (a.likes ?? 0));
  } else {
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }
  return list;
}

function render() {
  const list = getVisibleSites();
  $grid.innerHTML = '';
  $empty.hidden = list.length > 0;

  const frag = document.createDocumentFragment();
  list.forEach((site, i) => frag.appendChild(buildCard(site, i)));
  $grid.appendChild(frag);
}

function buildCard(site, index) {
  const liked = state.likedIds.has(site.id);
  const card = document.createElement('article');
  card.className = 'card neu-raised';
  card.dataset.id = site.id;
  card.style.animationDelay = `${Math.min(index * 45, 400)}ms`;

  const isNew =
    Date.now() - new Date(site.created_at).getTime() < 1000 * 60 * 60 * 24 * 14;

  card.innerHTML = `
    <div class="card__head">
      <div class="card__icon-wrap">
        <img class="card__icon" src="${faviconUrl(site.url)}" alt="" loading="lazy"
             onerror="this.style.display='none'" />
      </div>
      <div class="card__titles">
        <h3 class="card__title">${escapeHtml(site.title)}</h3>
        <span class="card__domain">${escapeHtml(getDomain(site.url))}</span>
      </div>
      ${isNew ? '<span class="card__tag" style="margin-left:auto">Nowe</span>' : ''}
    </div>
    <p class="card__desc">${escapeHtml(site.description || '')}</p>
    <div class="card__footer">
      <a class="btn-open" href="${escapeAttr(site.url)}" target="_blank" rel="noopener noreferrer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
          <polyline points="15 3 21 3 21 9"></polyline>
          <line x1="10" y1="14" x2="21" y2="3"></line>
        </svg>
        Otwórz
      </a>
      <button class="btn-like ${liked ? 'is-liked' : ''}" data-like="${site.id}"
              title="${liked ? 'Już polubiono' : 'Polub tę stronę'}" ${liked ? 'disabled' : ''}>
        <svg width="16" height="16" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>
        <span class="like-count">${site.likes ?? 0}</span>
      </button>
    </div>
  `;
  return card;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;');
}

/* ============================================================
   LIKES — obsługa kliknięć (delegacja)
   ============================================================ */

$grid.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-like]');
  if (!btn) return;

  const id = coerceId(btn.dataset.like);
  if (state.likedIds.has(id)) return; // blokada wielokrotnego like'a

  // Optymistyczna aktualizacja UI
  state.likedIds.add(id);
  persistLikedIds();

  const site = state.sites.find((s) => s.id === id);
  if (site) site.likes = (site.likes ?? 0) + 1;

  btn.classList.add('is-liked', 'pop');
  btn.disabled = true;
  btn.querySelector('.like-count').textContent = site?.likes ?? 1;

  const ok = await likeSiteInDb(id);
  if (!ok) {
    // wycofanie w razie błędu
    state.likedIds.delete(id);
    persistLikedIds();
    if (site) site.likes -= 1;
    btn.classList.remove('is-liked');
    btn.disabled = false;
    btn.querySelector('.like-count').textContent = site?.likes ?? 0;
    showToast('Nie udało się zapisać polubienia. Spróbuj ponownie.', true);
  }
});

function coerceId(raw) {
  // id może być liczbą (bigint) lub uuid — dopasuj typ do danych w stanie
  const asNum = Number(raw);
  return state.sites.some((s) => s.id === asNum) ? asNum : raw;
}

/* ============================================================
   WYSZUKIWARKA — filtrowanie na żywo
   ============================================================ */

$searchInput.addEventListener('input', () => {
  state.query = $searchInput.value;
  $searchWrap.classList.toggle('has-value', state.query.length > 0);
  render();
});

$searchClear.addEventListener('click', () => {
  $searchInput.value = '';
  state.query = '';
  $searchWrap.classList.remove('has-value');
  $searchInput.focus();
  render();
});

/* ============================================================
   ZAKŁADKI SORTOWANIA
   ============================================================ */

$tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    $tabs.forEach((t) => {
      t.classList.toggle('is-active', t === tab);
      t.setAttribute('aria-selected', String(t === tab));
    });
    state.sort = tab.dataset.sort;
    render();
  });
});

/* ============================================================
   LOSUJ STRONĘ
   ============================================================ */

$randomBtn.addEventListener('click', () => {
  const list = getVisibleSites();
  if (!list.length) return;

  const site = list[Math.floor(Math.random() * list.length)];

  // Podświetl wylosowaną kartę…
  const card = $grid.querySelector(`.card[data-id="${site.id}"]`);
  document
    .querySelectorAll('.card.is-highlighted')
    .forEach((c) => c.classList.remove('is-highlighted'));
  if (card) {
    card.classList.add('is-highlighted');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => card.classList.remove('is-highlighted'), 2500);
  }

  // …i otwórz losowy URL w nowej karcie
  window.open(site.url, '_blank', 'noopener');
});

/* ============================================================
   MODAL — ZGŁASZANIE STRON
   ============================================================ */

function openModal() {
  $overlay.hidden = false;
  document.body.style.overflow = 'hidden';
  $form.querySelector('input[name="title"]').focus();
}

function closeModal() {
  $overlay.hidden = true;
  document.body.style.overflow = '';
  $form.reset();
  $form.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid'));
}

$addBtn.addEventListener('click', openModal);
$modalClose.addEventListener('click', closeModal);
$overlay.addEventListener('click', (e) => {
  if (e.target === $overlay) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$overlay.hidden) closeModal();
});

$form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd = new FormData($form);
  const title = String(fd.get('title') || '').trim();
  let url = String(fd.get('url') || '').trim();
  const description = String(fd.get('description') || '').trim();

  // Walidacja
  let valid = true;
  const mark = (name, ok) => {
    const el = $form.querySelector(`[name="${name}"]`);
    el.classList.toggle('is-invalid', !ok);
    if (!ok) valid = false;
  };

  mark('title', title.length >= 2);

  if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`;
  let urlOk = false;
  try {
    const u = new URL(url);
    urlOk = ['http:', 'https:'].includes(u.protocol) && u.hostname.includes('.');
  } catch { /* invalid */ }
  mark('url', urlOk);

  mark('description', description.length >= 10);

  if (!valid) {
    showToast('Uzupełnij poprawnie wszystkie pola formularza.', true);
    return;
  }

  $submitBtn.disabled = true;
  $submitBtn.textContent = 'Wysyłanie…';

  try {
    await submitSite({ title, url, description });
    closeModal();
    showToast('Dziękujemy! Strona czeka na weryfikację.');
  } catch (err) {
    console.error(err);
    showToast('Ups! Nie udało się wysłać zgłoszenia. Spróbuj ponownie.', true);
  } finally {
    $submitBtn.disabled = false;
    $submitBtn.textContent = 'Wyślij zgłoszenie';
  }
});

/* ============================================================
   TOAST
   ============================================================ */

let toastTimer;
function showToast(msg, isError = false) {
  clearTimeout(toastTimer);
  $toast.textContent = msg;
  $toast.classList.toggle('toast--error', isError);
  $toast.hidden = false;
  toastTimer = setTimeout(() => ($toast.hidden = true), 4200);
}

/* ============================================================
   INIT
   ============================================================ */

(async function init() {
  try {
    state.sites = await fetchSites();
  } catch (err) {
    console.error('Błąd pobierania danych:', err);
    showToast('Nie udało się połączyć z bazą danych.', true);
    state.sites = [];
  }

  $loader.hidden = true;
  $loader.style.display = 'none';

  if (state.demoMode) {
    $statusBar.hidden = false;
    $statusBar.innerHTML =
      '<strong>Tryb demo</strong> — brak konfiguracji Supabase. Ustaw zmienne <code>SUPABASE_URL</code> i <code>SUPABASE_ANON_KEY</code> w pliku <code>.env</code>, aby połączyć się z bazą danych.';
  }

  render();
})();
