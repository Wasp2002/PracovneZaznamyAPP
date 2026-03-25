# Pracovné Záznamy APP (Work Records App)

Táto moderná webová aplikácia slúži na efektívnu evidenciu pracovných výkazov (time-tracking), správu zákaziek a priraďovanie aktivít. Je navrhnutá pre jednoduché logovanie odpracovaného času a prepojenie s podnikovým prostredím.

Aplikácia je postavená na rýchlom modernom frontende a priamo sa integruje s **Microsoft Power Apps** a **Office 365**.

## Hlavné technológie
- **Technologický stack:** React 19, TypeScript, Vite
- **Užívateľské rozhranie:** `react-select` (pre pokročilé výbery a vyhľadávanie v zoznamoch)
- **Routovanie:** React Router v7
- **Integrácie:** 
  - `@microsoft/power-apps` (prístup k Power Apps / Dataverse)
  - Office 365 Users API (informácie o používateľoch)
- **Komponenty / Modely:** Zákazky (Orders), Pracovné výkazy (Timesheets), Číselníky aktivít.

## Práca na projekte (Dostupné skripty)

Pre lokálny vývoj, inštaláciu závislostí a nasadenie môžete použiť nasledujúce príkazy:

```bash
# Inštalácia všetkých potrebných závislostí
npm install

# Spustenie lokálneho vývojového servera (Vite)
npm run dev

# Vybudovanie produkčného buildu a typová kontrola (TypeScript)
npm run build

# Analýza a kontrola kvality kódu (ESLint)
npm run lint

# Zobrazenie náhľadu po vybudovaní produkčnej verzie
npm run preview