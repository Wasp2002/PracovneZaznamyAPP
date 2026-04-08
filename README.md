# Pracovné Záznamy APP (Work Records App)

Táto moderná webová aplikácia slúži na efektívnu evidenciu pracovných výkazov (time-tracking), správu zákaziek a priraďovanie aktivít. Je navrhnutá pre jednoduché logovanie odpracovaného času a prepojenie s podnikovým prostredím.

Aplikácia je postavená na rýchlom modernom frontende a priamo sa integruje s **Microsoft Power Apps (Dataverse)** a **Office 365**.

## 🚀 Aktuálne funkcie a stav aplikácie

1.  **Zobrazenie výkazov (Prehľad - HomePage):**
    *   Automatické načítanie používateľského profilu a fotografie z Office 365.
    *   Hiearchické zobrazenie zaznamenaných výkazov zoskupených podľa: **Rok -> Mesiac -> Deň**.
    *   Zobrazenie sumáru odpracovaných hodín pre dané obdobie.
    *   Prístupový manažment (bežný používateľ vidí vlastné výkazy, administrátor vidí všetky zoskupené aj podľa konkrétneho zamestnanca).
2.  **Pridávanie výkazov (EditPage):**
    *   Výber zoznamu zákazníkov (Organizácie) a k nim prislúchajúcich Zákaziek s rýchlym vyhľadávaním využívaním `react-select`.
    *   Zvolenie **Kódu činnosti**, po ktorom sa automaticky načítajú konkrétne **Aktivity (Podčinnosti)**.
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

## 💻 Práca na projekte a nasadenie do Power Apps

Tento projekt využíva štandard "Power Apps code app" podľa [oficiálnej dokumentácie Microsoftu](https://learn.microsoft.com/en-us/power-apps/developer/code-apps/how-to/create-an-app-from-scratch?source=docs). Pre správny vývoj a nasadenie budete potrebovať okrem Node.js aj **Power Platform CLI (`pac`)**.

### 1. Inicializácia projektu (zo šablóny)
Ak začínate úplne od nuly (nový projekt), stiahnite si základnú štruktúru pre Vite šablónu a prejdite do priečinka:
```bash
npx degit github:microsoft/PowerAppsCodeApps/templates/vite my-app
cd my-app
```
*(Poznámka: Ak ste si už naklonovali tento repozitár s hotovou aplikáciou Pracovné Záznamy APP, tento krok preskočte).*

### 2. Prvotné nastavenie a autentifikácia
Najprv sa musíte prihlásiť a zvoliť správne Power Platform prostredie (environment), s ktorým bude aplikácia komunikovať a do ktorého sa nasadí:
```bash
# Vytvorenie autentifikačného profilu
pac auth create

# Výber cieľového prostredia
pac env select --environment <Vase_Environment_ID>
```

### 3. Inštalácia závislostí a lokálny vývoj
Pre stiahnutie NPM balíčkov a spustenie lokálneho testovania v prehliadači spustite:
```bash
npm install
npm run dev
```
Aplikácia sa spustí na lokálnom Vite servery. *Upozornenie: Otvorte zobrazenú URL adresu v takom profile prehliadača, kde ste prihlásený do svojho Power Platform tenanta.*

### 4. Vybudovanie (Build) a nasadenie (Push)
Akonáhle ste s úpravami spokojný, môžete aplikáciu vybudovať a jedným príkazom publikovať (pushnúť) priamo do vášho Power Apps prostredia:
```bash
npm run build | pac code push
```
Príkaz najskôr zbehne `tsc -b && vite build` a následne CLI presunie zmeny do cloudu. Na konci procesu dostanete URL adresu pre spustenie nasadenej aplikácie v Power Apps.

## 🚧 Plánované funkcionality (TODO)
- ✅ DONE **Editácia výkazov:** Pridanie možnosti upravovať už zapísané a uložené pracovné záznamy. 
- ✅ DONE **Kopírovanie záznamov (Šablóny):** Možnosť duplikovať (naklonovať) existujúci pracovný záznam a použiť ho ako predvyplnenú šablónu pre nový záznam s možnosťou úpravy údajov.
- **Exportovanie dát:** Pridanie funkcie na export mesačných výkazov do formátu Excel/CSV či PDF pre potreby fakturácie alebo mzdového oddelenia.
- ✅ DONE **Grafický Dashboard:** Zobrazenie vizuálnych štatistík (koláčové/stĺpcové grafy) pre odpracovaný čas rozdelený podľa projektov, zákazníkov alebo kategórie činnosti.
- **Sledovanie pracovného fondu:** Validácie a notifikácie, ktoré zamestnanca upozornia, ak si v daný deň nevykázal potrebných 8 hodín, alebo ak naopak presiahol limit.
- **Meranie v reálnom čase (Stopky):** Zabudovaný priamy časovač vo formulári pre automatické štartovanie a zastavenie nahrávania aktivity bez nutnosti manuálne vypisovať odpracované hodiny.