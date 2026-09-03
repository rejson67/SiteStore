# SiteStore 🌐

**App Store dla stron internetowych** — jednostronicowa aplikacja (SPA) będąca katalogiem ciekawych i przydatnych witryn, utrzymana w stylistyce **ciemnego neomorfizmu (Soft UI Dark Mode)**.

## ✨ Funkcje

- 🎨 **Dark Neumorphism** — tło `#18191c`, wypukłe/wklęsłe karty z podwójnym `box-shadow`, akcent morska zieleń `#00E5A3`, przyciski z efektem wciśnięcia (inset shadow)
- 🗂️ **Siatka kart w stylu App Store** — favicon (Google Favicon API), tytuł, opis, przycisk „Otwórz” (nowa karta), polubienia z licznikiem
- 🔍 **Wyszukiwarka na żywo** — filtrowanie po tytule i opisie
- 📊 **Sortowanie** — zakładki „Popularne” (po polubieniach) i „Najnowsze” (po dacie dodania)
- 🎲 **Losuj stronę** — podświetla losową kartę i otwiera jej URL
- ❤️ **Polubienia** — atomowy inkrement w bazie (Supabase RPC z fallbackiem na update), blokada wielokrotnego klikania przez `localStorage`
- 📝 **Zgłaszanie stron bez logowania** — neomorficzny modal; rekordy trafiają do bazy z `is_approved = false` i czekają na weryfikację
- 🛡️ **Bezpieczeństwo** — RLS w Supabase: publiczny odczyt tylko zatwierdzonych rekordów, insert tylko niezatwierdzonych

## 🚀 Uruchomienie

```bash
npm install
cp .env.example .env   # uzupełnij SUPABASE_URL i SUPABASE_ANON_KEY
npm run dev
```

Bez skonfigurowanego Supabase aplikacja działa w **trybie demo** na danych przykładowych.

## 🗄️ Baza danych (Supabase)

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. W **SQL Editor** uruchom skrypt [`supabase/schema.sql`](supabase/schema.sql) — tworzy tabelę `websites`, polityki RLS oraz funkcję RPC `increment_likes`
3. Skopiuj `Project URL` i `anon public key` (Settings → API) do pliku `.env`

Struktura tabeli `websites`:

| kolumna       | typ         | domyślnie |
|---------------|-------------|-----------|
| `id`          | bigint (PK) | identity  |
| `created_at`  | timestamptz | `now()`   |
| `title`       | text        | —         |
| `url`         | text        | —         |
| `description` | text        | —         |
| `likes`       | integer     | `0`       |
| `is_approved` | boolean     | `false`   |

Aplikacja wyświetla **wyłącznie** rekordy z `is_approved = true`. Zgłoszenia zatwierdzasz ręcznie w panelu Supabase (Table Editor).

## 📦 Wdrożenie (Vercel / Netlify)

```bash
npm run build   # wynik w dist/
```

Ustaw zmienne środowiskowe `SUPABASE_URL` i `SUPABASE_ANON_KEY` w panelu hostingu. Plik `vercel.json` zawiera rewrite SPA.

## 🧰 Stack

- [Vite](https://vitejs.dev) — build i dev server
- [Supabase JS](https://supabase.com/docs/reference/javascript) — baza danych
- Vanilla JS + CSS — zero frameworków UI, ręcznie dopracowane mikro-interakcje
