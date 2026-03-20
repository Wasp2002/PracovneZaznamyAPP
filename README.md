# Pracovné Záznamy APP (Work Records App)

Táto moderná webová aplikácia slúži na efektívnu evidenciu pracovných výkazov (time-tracking), správu zákaziek a priraďovanie aktivít. Je navrhnutá pre jednoduché logovanie odpracovaného času a prepojenie s podnikovým prostredím.

Aplikácia je postavená na rýchlom modernom frontende a priamo sa integruje s **Microsoft Power Apps** a **Office 365**.

## Hlavné technológie
- **Technologický stack:** React 19, TypeScript, Vite
- **Routovanie:** React Router v7
- **Integrácie:** 
  - `@microsoft/power-apps` (prístup k Power Apps / Dataverse)
  - Office 365 Users API (informácie o používateľoch)
- **Komponenty / Modely:** Zákazky (Orders), Pracovné výkazy (Timesheets), Číselníky aktivít.

## Spustenie a vývoj

Pre lokálny vývoj naklonujte repozitár a nainštalujte závislosti:

```bash
npm install
npm run dev