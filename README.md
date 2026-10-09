# Menüplaner & Einkaufsliste

Menüs sammeln, Wochen planen, Einkaufsliste automatisch erzeugen. Mobile-first, als PWA installierbar, Oberfläche auf Deutsch.

**Stack:** React 19 · Vite · TypeScript · Tailwind 4 · Dexie (IndexedDB) · dnd-kit · vite-plugin-pwa · Vitest

## Starten

```bash
npm install
npm run dev        # Entwicklung: http://localhost:5173
npm test           # Tests der Einkaufslisten-Logik
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal ansehen
```

## Deployen

Die App ist rein statisch (`dist/`), es gibt kein Backend.

- **Netlify / Vercel / Cloudflare Pages:** Repo verbinden, Build-Befehl `npm run build`, Ausgabeordner `dist`. Für Client-Routing eine Fallback-Regel auf `index.html` setzen (Netlify: Datei `public/_redirects` mit `/* /index.html 200`).
- **GitHub Pages:** Der Workflow `.github/workflows/deploy.yml` baut bei jedem Push auf `main`/`master` und veröffentlicht automatisch. Einmalig in den Repo-Einstellungen unter *Settings → Pages → Source* **GitHub Actions** wählen. Die App läuft dann unter `https://<benutzer>.github.io/<repo-name>/` (Base-Pfad wird über `BASE_PATH` gesetzt; `404.html` ist eine Kopie von `index.html` für Deep-Links).
- **Eigener Server:** `dist/` mit nginx o. Ä. ausliefern (`try_files $uri /index.html;`).

Die Installation als App auf dem Handy erfordert **HTTPS** (alle genannten Dienste liefern das). Danach im Browser-Menü «Zur Startseite hinzufügen» / «App installieren».

## Daten & Backup

Alle Daten liegen lokal im Browser (IndexedDB) und funktionieren offline. Unter **Mehr** gibt es Export/Import als JSON-Datei, um Daten zu sichern oder auf ein anderes Gerät zu übertragen.

## Struktur

```
src/data/    Datenbank (db.ts), Typen, Repository (repo.ts = einzige Zugriffsschicht)
src/lib/     Reine Logik: Einkaufsliste (shopping.ts + Tests), Einheiten, Datum, Kategorien
src/pages/   Menüs, Plan, Einkauf, Einstellungen
```

Ein späterer Sync/Backend ersetzt nur `src/data/repo.ts`; IDs sind UUIDs und alle Datensätze haben `updatedAt`.

## Einkaufsliste: Regeln

- Zutaten werden auf die geplanten Portionen skaliert (Menge × geplant / Rezeptportionen).
- Gleiche Zutaten werden summiert; g/kg und ml/cl/dl/l werden umgerechnet, andere Einheiten (EL, TL, Stk, …) nur bei gleicher Einheit.
- Menüs ohne Rezept erscheinen mit ihrem Namen.
- Erneutes Erzeugen behält manuelle Artikel, Abhak-Status und manuell geänderte Mengen; nicht mehr benötigte, nicht abgehakte Plan-Einträge werden entfernt.
- Die Kategorie einer Zutat wird beim Ändern gemerkt.

## Icons

Die PNG-Icons werden aus `public/icon.svg` erzeugt (`node scripts/make-icons.mjs`). Zum Anpassen das SVG ersetzen und das Skript erneut ausführen.
