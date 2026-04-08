import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import claLogo from '../assets/claSK.png'
import '../App.css'
import { Crc5b_pracovnevykaziesService, Office365UsersService, Crc5b_ordersesService } from '../generated'
import type { Crc5b_pracovnevykazies } from '../generated/models/Crc5b_pracovnevykaziesModel'
import { appConfig } from '../appConfig'

// Vite globálna premenná pre zobrazenie verzie z času buildu
declare const __BUILD_DATE__: string;

function HomePage() {
  const navigate = useNavigate()

  const [vykazy, setVykazy] = useState<Crc5b_pracovnevykazies[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [isAdmin, setIsAdmin] = useState(false)
  const [zakazkyMap, setZakazkyMap] = useState<Record<string, string>>({})
  // Stav pre prihláseného používateľa
  const [userProfile, setUserProfile] = useState<{ displayName: string, mail: string, photo?: string }>({
    displayName: 'Načítavam používateľa...',
    mail: ''
  })

  // Načítanie dát z Dataverse pre pracovné výkazy a profilu O365
  useEffect(() => {
    async function loadData() {
      try {
        let currentMail = '';
        // 1. Získať O365 profil
        try {
           const profileResult = await Office365UsersService.MyProfile_V2();
           if (profileResult.data) {
             currentMail = profileResult.data.mail || profileResult.data.userPrincipalName || '';
             
             // Načítať fotku
             let photo = '';
             try {
               const photoRes = await Office365UsersService.UserPhoto_V2(currentMail);
               if (photoRes.data) {
                 // Pokiaľ to nie je raw string s base64 obálkou, obalíme ho
                 photo = photoRes.data.startsWith('data:') ? photoRes.data : `data:image/jpeg;base64,${photoRes.data}`;
               }
             } catch (photoErr) {
               console.log("Nepodarilo sa načítať fotku, použije sa predvolený avatar.");
             }

             setUserProfile({
               displayName: profileResult.data.displayName || 'Neznámy Používateľ',
               mail: currentMail,
               photo
             });
           } else {
             setUserProfile({ displayName: 'Skúšobný Používateľ', mail: '' });
           }
        } catch (profileErr) {
           console.warn("Nepodarilo sa načítať Office 365 profil:", profileErr);
           setUserProfile({ displayName: 'Skúšobný Používateľ', mail: '' });
        }

        // Zatiaľ nefiltrujem Dataverse cez OData (filtre cez mail občas padajú ak v tabuľke nie je priamy stĺpec).
        // Namiesto toho Dataverse posiela väčšinou iba záznamy na ktoré má používateľ právo vlastnenia (Security Roles)
        // Sťahovanie dát z Dataverse s pagináciou cez skipToken
        let allData: any[] = [];
        let isError = false;
        let errorMessage = '';
        let currentSkipToken: string | undefined = undefined;
        let loopCount = 0; // len bezpečnostná brzda

        // Skontrolujeme, či je aktuálny používateľ adminom podľa globálnej konfigurácie
        const isAdminUser = !!(currentMail && appConfig.adminEmails.includes(currentMail.toLowerCase()));
        setIsAdmin(isAdminUser);

        // STIAHNUTIE MAPOVANIA ODPORÚČANÝCH ZÁKAZIEK -> PROJECT TITLE
        try {
          let ordersAll: any[] = [];
          let ordSkipToken: string | undefined = undefined;
          let ordLoop = 0;
          do {
            const ordResult: any = await Crc5b_ordersesService.getAll({ 
               maxPageSize: 5000, 
               select: ['crc5b_ordersid', 'crc5b_projecttitle'],
               skipToken: ordSkipToken
            });
            if (ordResult.data) {
               ordersAll = [...ordersAll, ...ordResult.data];
            }
            if (ordResult['@odata.nextLink']) {
               const tokenMatch = ordResult['@odata.nextLink'].match(/skiptoken=([^&]+)/);
               ordSkipToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
            } else {
               ordSkipToken = ordResult.skipToken; 
            }
            ordLoop++;
          } while (ordSkipToken && ordLoop < 100);

          const ordMap: Record<string, string> = {};
          ordersAll.forEach(o => {
            ordMap[o.crc5b_ordersid] = o.crc5b_projecttitle || 'Bez názvu projektu';
          });
          console.log("Nacitanych zakaziek:", ordersAll.length, "Prva zakazka v mape pre", ordersAll[0]?.crc5b_ordersid, ":", ordMap[ordersAll[0]?.crc5b_ordersid]);
          setZakazkyMap(ordMap);
        } catch (e) {
          console.error("Zlyhalo načítanie orders", e);
        }

        do {
          const result: any = await Crc5b_pracovnevykaziesService.getAll({ 
             // Miesto 'top' (čo v OData znamená "maximálny celkový počet") musíme použiť 'maxPageSize'. 
             // Tým povolíme Dataverse vrátiť skipToken pre ďalšiu stranu a neprerušiť pýtanie po 5000 záznamoch.
             maxPageSize: 5000, 
             orderBy: ['crc5b_datum desc', 'createdon desc'],
             // Ak je admin, filter sa neaplikuje (stiahne všetko), inak filtruje len svoj email
             filter: isAdminUser ? undefined : (currentMail ? `crc5b_email eq '${currentMail}'` : undefined),
             expand: 'crc5b_Zakazka_klienta($select=crc5b_projecttitle)',
             skipToken: currentSkipToken
          });

          if (result.error) {
            isError = true;
            errorMessage = result.error.message || JSON.stringify(result.error);
            if (errorMessage === '{}') errorMessage = 'Kritická chyba Dataverse. Pozrite si Konzolu (F12)';
            break;
          }

          if (result.data) {
             if (allData.length === 0 && result.data.length > 0) {
                console.log("PRVÝ ZÁZNAM PRE DEBUG:", result.data[0]);
             }
             allData = [...allData, ...result.data];
          }

          // Ak máme URL pre ďalšiu stranu (Dataverse často vracia celú URL do @odata.nextLink a niekedy iba token do skipToken)
          // skontrolujeme oboje.
          if (result['@odata.nextLink']) {
             // Z Dataverse @odata.nextLink musime vyextrahovat skiptoken, ak ho tam pridáva
             const tokenMatch = result['@odata.nextLink'].match(/skiptoken=([^&]+)/);
             currentSkipToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
          } else {
             currentSkipToken = result.skipToken; // fallback
          }

          loopCount++;
        } while (currentSkipToken && loopCount < 1000); // 1000 iterácií pri 5000 záznamoch nám dovolí stiahnuť až 5 miliónov záznamov

        if (isError) {
          setErrorMsg(errorMessage);
        } else {
          // Ak je používateľ admin, priradíme všetky stiahnuté dáta bez ďalšieho osobného filtrovania
          if (isAdminUser) {
             setVykazy(allData);
          } else {
             // Pre bežného používateľa skontrolujeme, či stĺpec obsahuje aspoň časť displayName.
             const namePart = userProfile.displayName ? userProfile.displayName.split(' ')[0] : currentMail;
             
             const userVykazy = allData.filter(rec => {
                if (!rec.crc5b_pracovnik) return false;
                // ak sa zhoduje mail (fallback) alebo text obsahuje aspon cast mojho mena
                return rec.crc5b_pracovnik === currentMail || rec.crc5b_pracovnik.includes(namePart);
             });

             if (userVykazy.length === 0 && allData.length > 0) {
                console.warn("Filtrovanie neodhalilo žiadne výkazy. Zobrazujem všetky pre ladenie.");
                setVykazy(allData);
             } else {
                setVykazy(userVykazy);
             }
          }
        }
      } catch (err: any) {
        console.error("Nepodarilo sa načítať štruktúru dát", err);
        setErrorMsg(err.message || String(err));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Zoskupenie výkazov: Pracovník (pre admina) -> Rok -> Mesiac -> Deň (s použitím useMemo pre výkon)
  const groupedVykazy = useMemo(() => {
    // Štruktúra: { Zamestnanec: { Rok: { Mesiac: { Deň: [...] } } } }
    const employees: Record<string, Record<number, Record<number, Record<number | string, Crc5b_pracovnevykazies[]>>>> = {};

    vykazy.forEach(vykaz => {
      // Ak záznam nemá dátum, dáme ho do "0" aby sa aspoň zobrazil
      let y = 0;
      let m = 0;
      let d: number | string = 'Neznámy dátum';

      if (vykaz.crc5b_datum) {
        const dateObj = new Date(vykaz.crc5b_datum);
        if (!isNaN(dateObj.getTime())) {
          y = dateObj.getFullYear();
          m = dateObj.getMonth() + 1; // getMonth je 0-11
          d = dateObj.getDate();
        }
      }

      // Zistíme meno do top level štruktúry
      const worker = isAdmin ? (vykaz.crc5b_pracovnik || 'Nezaradený pracovník') : 'MOJ_VYKAZ';

      if (!employees[worker]) employees[worker] = {};
      if (!employees[worker][y]) employees[worker][y] = {};
      if (!employees[worker][y][m]) employees[worker][y][m] = {};
      if (!employees[worker][y][m][d]) employees[worker][y][m][d] = [];

      employees[worker][y][m][d].push(vykaz);
    });
    return employees;
  }, [vykazy, isAdmin]);

  // Prepínanie rozbalenia podľa identifikátora
  const toggleExpand = (key: string) => {
    setExpanded(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Celkový súčet hodín pre všetkých zobrazených výkazov (pre ne-admina to sú jeho všetky hodiny)
  const totalHours = useMemo(() => {
    return vykazy.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);
  }, [vykazy]);

  return (
    <div className="main-layout">
      {/* ĽAVÉ MENU */}
      <div className="sidebar-container">

        {/* PROFIL POUŽÍVATEĽA */}
        <div className="user-profile">
          <div className="user-avatar" style={userProfile.photo ? { background: 'none' } : {}}>
            {userProfile.photo ? (
              <img src={userProfile.photo} alt="Profil" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              "👤"
            )}
          </div>
          <div className="user-info">
            <span className="user-name">{userProfile.displayName}</span>
            <span className="user-email">{userProfile.mail}</span>
          </div>
        </div>

        <h2>Menu</h2>
        <ul className="menu-list">
          <li style={{ backgroundColor: 'var(--bg-navy)', color: 'white' }}>🏠 Domov</li>
          <li onClick={() => navigate('/EditPage')}>➕ Nový výkaz</li>
          <li onClick={() => navigate('/DashboardPage')}>📊 Dashboard</li>
          <li onClick={() => window.open('https://apps.powerapps.com/play/e/86485853-792a-e67b-9761-e3ce683ba850/a/188b2b48-acfb-4a15-8142-75561b73805d?tenantId=1bc48a9d-3e02-4c94-a104-04b1960c5b3b&hint=2a9daae8-78d7-4372-b087-fbb3235e38c1&sourcetime=1774618589242&source=portal', '_blank')}>📅 Dochádzka</li>
        </ul>

        {/* VERZIA APLIKÁCIE (Čas buildu) */}
        <div style={{ marginTop: 'auto', paddingTop: '20px', fontSize: '0.8em', color: 'var(--bg-smoke)', textAlign: 'center', opacity: 0.7 }}>
          Verzia: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Dev'}
        </div>
      </div>

      {/* HLAVNÉ OKNO */}
      <div className="content-container">
        <div className="header">
          <h1>Pracovné výkazy</h1>
          <a href="https://www.claslovakia.sk" target="_blank" className="logo-container">
            <img src={claLogo} className="logo cla" alt="CLA Slovakia logo" />
          </a>
        </div>

        <div className="card" style={{ textAlign: 'left', backgroundColor: 'var(--bg-white)', color: 'var(--bg-black)' }}>
          <h2 style={{ marginTop: '0', borderBottom: '2px solid var(--bg-smoke)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Moje pracovné výkazy</span>
            {!isAdmin && (
              <span style={{ fontSize: '0.85em', backgroundColor: 'var(--bg-navy)', color: 'white', padding: '4px 12px', borderRadius: '4px', fontWeight: 'normal' }}>
                Spolu: {totalHours.toFixed(2)} h
              </span>
            )}
          </h2>

          {isLoading ? (
            <div style={{ color: 'var(--bg-navy)' }}>Načítavam dáta z Dataverse...</div>
          ) : errorMsg ? (
            <div style={{ color: 'red', fontWeight: 'bold' }}>Chyba pri načítaní: {errorMsg}</div>
          ) : wykazyLength(groupedVykazy) === 0 ? (
            <div>Žiadne pracovné výkazy neboli nájdené. V systéme nie sú prístupné dáta.</div>
          ) : (
            <div style={{ marginTop: '20px' }}>
              {Object.entries(groupedVykazy)
                .sort(([e1], [e2]) => e1.localeCompare(e2))
                .map(([empKey, years]) => {
                  const eId = `e-${empKey}`;
                  const isEmpExp = !isAdmin || expanded[eId]; // Nezamestnanec (bez admina) má túto úroveň vždy zobrazenú
                  
                  // Suma pre zamestnanca
                  const empRecords = Object.values(years).flatMap(y => Object.values(y).flatMap(m => Object.values(m).flat()));
                  const empSum = empRecords.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);

                  return (
                    <div key={empKey} style={{ marginBottom: isAdmin ? '25px' : '0' }}>
                      {/* HLAVIČKA ZAMESTNANCA (iba pre admina) */}
                      {isAdmin && (
                        <div
                          onClick={() => toggleExpand(eId)}
                          style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2em', padding: '12px', backgroundColor: '#e2e8f0', color: 'var(--bg-navy)', borderLeft: '5px solid var(--bg-navy)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}
                        >
                          <span>{expanded[eId] ? '▼' : '▶'} 👤 {empKey}</span>
                          <span style={{ fontSize: '0.9em', backgroundColor: 'white', padding: '4px 10px', borderRadius: '4px' }}>Spolu: {empSum.toFixed(2)} h</span>
                        </div>
                      )}

                      {/* ROKY */}
                      {isEmpExp && (
                        <div style={{ marginLeft: isAdmin ? '15px' : '0' }}>
                          {Object.entries(years)
                            .sort(([y1], [y2]) => Number(y2) - Number(y1)) // Zoradiť roky od najnovšieho
                            .map(([yKey, months]) => {
                              const yId = `y-${empKey}-${yKey}`;
                              const isYearExp = expanded[yId];
                              const displayYear = yKey === "0" ? "Bez priradeného dátumu" : `Rok ${yKey}`;

                              // Výpočet sumy pre ROK
                              const yearRecords = Object.values(months).flatMap(daysMap => Object.values(daysMap).flat());
                              const yearSum = yearRecords.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);

                              return (
                                <div key={yKey} style={{ marginBottom: '15px' }}>
                                  {/* ROK hlavička */}
                      <div
                        onClick={() => toggleExpand(yId)}
                        style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2em', padding: '12px', backgroundColor: 'var(--bg-navy)', color: 'white', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span>{isYearExp ? '▼' : '▶'} {displayYear}</span>
                        <span style={{ fontSize: '0.85em', backgroundColor: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: '4px' }}>Spolu: {yearSum.toFixed(2)} h</span>
                      </div>

                      {/* MESIACE pod rokom */}
                      {isYearExp && (
                        <div style={{ marginLeft: '15px', marginTop: '10px' }}>
                          {Object.entries(months)
                            .sort(([m1], [m2]) => Number(m2) - Number(m1)) // Zoradiť mesiace zostupne
                            .map(([mKey, days]) => {
                              const mId = `m-${empKey}-${yKey}-${mKey}`;
                              const isMonthExp = expanded[mId];

                              let monthCapitalized = "Nezaradené";
                              if (mKey !== "0") {
                                const dateForm = new Date(Number(yKey), Number(mKey) - 1, 1);
                                const monthName = dateForm.toLocaleString('sk-SK', { month: 'long' });
                                monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                              }

                              // Výpočet sumy pre MESIAC
                              const monthRecords = Object.values(days).flat();
                              const monthSum = monthRecords.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);

                              return (
                                <div key={mKey} style={{ marginBottom: '10px' }}>
                                  {/* MESIAC hlavička */}
                                  <div
                                    onClick={() => toggleExpand(mId)}
                                    style={{ cursor: 'pointer', fontWeight: 'bold', padding: '10px', backgroundColor: 'var(--bg-cloud)', borderRadius: '6px', border: '1px solid var(--bg-smoke)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                  >
                                    <span>{isMonthExp ? '▼' : '▶'} {monthCapitalized}</span>
                                    <span style={{ fontSize: '0.9em', backgroundColor: 'var(--bg-white)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--bg-smoke)' }}>Spolu: {monthSum.toFixed(2)} h</span>
                                  </div>

                                  {/* DNI pod mesiacom */}
                                  {isMonthExp && (
                                    <div style={{ marginLeft: '15px', marginTop: '8px' }}>
                                      {Object.entries(days)
                                        .sort(([d1], [d2]) => {
                                          if (d1 === 'Neznámy dátum') return 1;
                                          if (d2 === 'Neznámy dátum') return -1;
                                          return Number(d2) - Number(d1);
                                        }) // Zoradiť dni zostupne
                                        .map(([dKey, records]) => {
                                          const dId = `d-${empKey}-${yKey}-${mKey}-${dKey}`;
                                          const isDayExp = expanded[dId];

                                          const displayDay = dKey === 'Neznámy dátum' ? dKey : `${dKey}. ${monthCapitalized.toLowerCase()}`;

                                          // Výpočet sumy pre DEŇ
                                          const daySum = records.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);

                                          return (
                                            <div key={dKey} style={{ marginBottom: '8px' }}>
                                              {/* DEŇ hlavička */}
                                              <div
                                                onClick={() => toggleExpand(dId)}
                                                style={{ cursor: 'pointer', padding: '8px', backgroundColor: 'var(--bg-smoke)', borderRadius: '4px', borderLeft: '4px solid var(--bg-navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}
                                              >
                                                <span>{isDayExp ? '▼' : '▶'} {displayDay}</span>
                                                <span style={{ fontSize: '0.9em', color: 'var(--bg-navy)' }}>{daySum.toFixed(2)} h</span>
                                              </div>

                                              {/* TABUĽKA VÝKAZOV O KONKRÉTNOM DNI */}
                                              {isDayExp && (
                                                <div style={{ marginLeft: '10px', marginTop: '8px', overflowX: 'auto' }}>
                                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', minWidth: '700px', backgroundColor: 'white', tableLayout: 'fixed' }}>
                                                    <thead>
                                                      <tr style={{ borderBottom: '2px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)' }}>
                                                        <th style={{ padding: '8px', textAlign: 'left', width: '20%' }}>Zákazník</th>
                                                        <th style={{ padding: '8px', textAlign: 'left', width: '25%' }}>Zákazka</th>
                                                        <th style={{ padding: '8px', textAlign: 'center', width: '35%' }}>Popis</th>
                                                        <th style={{ padding: '8px', textAlign: 'left', width: '8%' }}>Hodiny</th>
                                                        <th style={{ padding: '8px', textAlign: 'right', width: '12%' }}>Akcia</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {records.map(rec => (
                                                        <tr key={(rec as any).crc5b_pracovnevykaziesid || rec.crc5b_pracovnevykazyid} style={{ borderBottom: '1px solid var(--bg-smoke)' }}>
                                                          <td style={{ padding: '8px' }}>
                                                            {rec.crc5b_zakaznik || '-'}
                                                          </td>
                                                          <td style={{ padding: '8px' }}>
                                                            {((rec as any)._crc5b_zakazka_klienta_value && zakazkyMap[(rec as any)._crc5b_zakazka_klienta_value]) || 
                                                             ((rec as any)['_crc5b_zakazka_klienta_value@OData.Community.Display.V1.FormattedValue']) || 
                                                             ((rec as any).crc5b_zakazka_klienta) || 
                                                             '-'}
                                                          </td>
                                                          <td style={{ padding: '16px', textAlign: 'center', fontWeight: 'bold' }}>
                                                            {rec.crc5b_popiscinnosti || '-'}
                                                          </td>
                                                          <td style={{ padding: '8px' }}>
                                                            {rec.crc5b_hodiny ? `${parseFloat(String(rec.crc5b_hodiny) || '0').toFixed(2)} h` : '-'}
                                                          </td>
                                                          <td style={{ padding: '4px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                            <button 
                                                              title="Upraviť záznam"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/EditPage', { state: { editRecord: rec } });
                                                              }}
                                                              style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-navy)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.85em', marginRight: '5px' }}
                                                            >
                                                              ✏️
                                                            </button>
                                                            <button 
                                                              title="Kopírovať záznam"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                navigate('/EditPage', { state: { copyRecord: rec } });
                                                              }}
                                                              style={{ padding: '4px 10px', cursor: 'pointer', backgroundColor: 'var(--bg-navy)', color: 'var(--bg-navy)', border: '1px solid var(--bg-smoke)', borderRadius: '4px', fontSize: '0.85em', fontWeight: 'bold' }}
                                                            >
                                                              📄
                                                            </button>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                              )}
                                            </div>
                                          )
                                        })}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>
                  )
                })}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Pomocná funkcia na zistenie, či sú nejaké záznamy
function wykazyLength(grouped: any) {
  return Object.keys(grouped).length;
}

export default HomePage
