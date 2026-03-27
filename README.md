# Pracovné Záznamy APP (Work Records App)

Táto moderná webová aplikácia slúži na efektívnu evidenciu pracovných výkazov (time-tracking), správu zákaziek a priraďovanie aktivít. Je navrhnutá pre jednoduché logovanie odpracovaného času a prepojenie s podnikovým prostredím.

Aplikácia je postavená na rýchlom modernom frontende a priamo sa integruje s **Microsoft Power Apps (Dataverse)** a **Office 365**.

## 🚀 Aktuálne funkcie a stav aplikácie

1.  **Zobrazenie výkazov (Prehľad - HomePage):**
    *   Automatické načítanie používateľského profilu a fotografie z Office 365.
    *   Hiearchické zobrazenie zaznamenaných výkazov zoskupených podľa: **Rok -> Mesiac -> Deň**.
    *   Zobrazenie sumáriu odpracovaných hodín pre dané obdobie.
    *   Prístupový manažment (bežný používateľ vidí vlastné výkazy, administrátor vidí všetky zoskupené aj podľa konkrétneho zamestnanca).
2.  **Pridávanie výkazov (EditPage):**
    *   Výber zoznamu zákazníkov (Organizácie) a k nim prislúchajúcich Zákaziek s rýchlym vyhľadávaním využívaním `react-select`.
    *   Zvolenie **Kódu činnosti**, po ktorom sa automaticky nacítajú konkrétne **Aktivity (Podčinnosti)**.
    *   Hromadné zadávanie počtu hodín, množstva a sprievodných poznámok k jednotlivým aktivitám.
    *   Určenie lokality práce (Kancelária, U klienta, Z domu) a výber konkrétneho dátumu.

## 🛠️ Hlavné technológie

-   **Technologický stack:** React 19, TypeScript, Vite
-   **Užívateľské rozhranie:** Custom CSS rozloženie, integrácia `react-select` (pre pokročilé výbery v kódových zoznamoch s filtrom)
-   **Routovanie:** React Router v7 (`HashRouter`)
-   **Integrácie (Dataverse / Power Apps API):** 
    -   `@microsoft/power-apps` na OData komunikáciu.
    -   Prepojenie s entitami `Pracovné výkazy`, `Organizácie`, `Zákazky`, `Typy Činností` a ďalšími kódovníkmi so spracovaním paginácie.
    -   Office 365 Users API pre autentifikáciu používateľa a získavanie profilov / avatarov.

## ⚙️ Štruktúra projektu

-   `src/pages/HomePage.tsx` - Kmeňová stránka slúžiaca ako stromový prehľad pracovných záznamov.
-   `src/pages/EditPage.tsx` - Systémový formulár na hromadné zalogovanie času k vybranej zákazke pre viaceré druhy aktivít súčasne.
-   `src/appConfig.ts` - Konfigurácia aplikácie obsahujúca definíciu admin používateľov.
-   `src/generated/` - Modely a služby podľa Power Platform API vygenerovaných skriptami.

## 💻 Práca na projekte (Dostupné skripty)

Pre lokálny vývoj, inštaláciu závislostí a nasadenie môžete použiť nasledujúce príkazy v prostredí terminálu:

```bash
# Inštalácia všetkých potrebných NPM závislostí pre projekt
npm install

# Spustenie lokálneho vývojového servera (rýchly štart cez Vite)
npm run dev

# Vybudovanie produkčného buildu do zložky dist (vrátane overenia typov)
npm run build

# Zistenie potenciálnych chýb cez ESLint linter
npm run lint

# Lokálne prezeranie vybudovanej produkčnej verzie aplikácie
npm run preview
```