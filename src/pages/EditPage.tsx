import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import claLogo from '../assets/claSK.png'
import Select from 'react-select'
import '../App.css'
import { Crc5b_codedirectoriesService, Crc5b_activitycodedirectoriesService, Office365UsersService, Crc5b_organizationsService, Crc5b_ordersesService, Crc5b_pracovnevykaziesService } from '../generated'
import type { Crc5b_codedirectories } from '../generated/models/Crc5b_codedirectoriesModel'
import type { Crc5b_activitycodedirectories } from '../generated/models/Crc5b_activitycodedirectoriesModel'
import type { Crc5b_orderses } from '../generated/models/Crc5b_ordersesModel'
import type { Crc5b_organizations } from '../generated/models/Crc5b_organizationsModel'

// Vite globálna premenná pre zobrazenie verzie z času buildu
declare const __BUILD_DATE__: string;

function EditPage() {
    const navigate = useNavigate()

    // Stav pre profil používateľa
    const [userProfile, setUserProfile] = useState<{ displayName: string; mail: string; photo?: string }>({ displayName: 'Načítavam...', mail: '...' })

    // Stavy pre formulár
    const [reportLocation, setReportLocation] = useState('Kancelária')
    const [reportCode, setReportCode] = useState('')
    const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedCustomer, setSelectedCustomer] = useState('')
    const [selectedOrder, setSelectedOrder] = useState('')

    // Stavy pre data z Dataverse
    const [codes, setCodes] = useState<Crc5b_codedirectories[]>([])
    const [isLoadingCodes, setIsLoadingCodes] = useState(true)
    const [customers, setCustomers] = useState<Crc5b_organizations[]>([])
    const [orders, setOrders] = useState<Crc5b_orderses[]>([])

    // Stavy pre podriadené činnosti (galéria)
    const [activities, setActivities] = useState<Crc5b_activitycodedirectories[]>([])
    const [isLoadingActivities, setIsLoadingActivities] = useState(false)
    const [activityForms, setActivityForms] = useState<Record<string, { time: string; count: string; note: string }>>({})

    // Načítanie profilu z Office 365
    useEffect(() => {
        async function fetchUserProfile() {
            try {
                const profileResult = await Office365UsersService.MyProfile_V2();
                if (profileResult.data) {
                    const currentMail = profileResult.data.mail || profileResult.data.userPrincipalName || '';

                    let photo = '';
                    try {
                        const photoRes = await Office365UsersService.UserPhoto_V2(currentMail);
                        if (photoRes.data) {
                            photo = photoRes.data.startsWith('data:') ? photoRes.data : `data:image/jpeg;base64,${photoRes.data}`;
                        }
                    } catch (e) {
                        console.log("Nepodarilo sa načítať fotku, použije sa predvolený avatar.");
                    }

                    setUserProfile({
                        displayName: profileResult.data.displayName || 'Neznámy Používateľ',
                        mail: currentMail,
                        photo
                    });
                }
            } catch (err) {
                console.error("Chyba pri načítaní profilu:", err);
                setUserProfile({ displayName: 'Chyba načítania', mail: '' });
            }
        }
        fetchUserProfile();
    }, []);

    // Načítanie dát z Dataverse po načítaní komponentu
    useEffect(() => {
        async function fetchCodes() {
            try {
                const result = await Crc5b_codedirectoriesService.getAll({
                    orderBy: ['crc5b_code asc']
                });

                if (result.error) {
                    console.error("Chyba pri načítaní číselníkov:", result.error);
                } else if (result.data) {
                    setCodes(result.data);
                }
            } catch (err) {
                console.error("Nepodarilo sa načítať kódovníky z Dataverse", err);
            } finally {
                setIsLoadingCodes(false);
            }
        }
        fetchCodes();
    }, []);

    // Načítanie zákazníkov (Organizácií) plnou pagináciou
    useEffect(() => {
        async function fetchCustomers() {
            try {
                let allData: Crc5b_organizations[] = [];
                let currentSkipToken: string | undefined = undefined;
                let loopCount = 0;

                do {
                    const result: any = await Crc5b_organizationsService.getAll({
                        orderBy: ['crc5b_organizationname asc'],
                        maxPageSize: 5000,
                        filter: "crc5b_collaborationstatus eq 'Súéasný klient'",
                        skipToken: currentSkipToken
                    });

                    if (result.error) {
                        console.error("Chyba API pri zákazníkoch:", result.error);
                        break;
                    }

                    if (result.data) {
                        allData = [...allData, ...result.data];
                    }

                    if (result['@odata.nextLink']) {
                        const tokenMatch = result['@odata.nextLink'].match(/skiptoken=([^&]+)/);
                        currentSkipToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
                    } else {
                        currentSkipToken = result.skipToken;
                    }

                    loopCount++;
                } while (currentSkipToken && loopCount < 100);

                setCustomers(allData);
            } catch (err) {
                console.error("Nepodarilo sa načítať zákazníkov z Dataverse", err);
            }
        }
        fetchCustomers();
    }, []);

    // Načítanie zákaziek podľa vybraného zákazníka s plnou pagináciou
    useEffect(() => {
        async function fetchOrders() {
            if (!selectedCustomer) {
                setOrders([]);
                setSelectedOrder('');
                return;
            }
            try {
                let allData: Crc5b_orderses[] = [];
                let currentSkipToken: string | undefined = undefined;
                let loopCount = 0;

                do {
                    const result: any = await Crc5b_ordersesService.getAll({
                        filter: `crc5b_customername eq '${selectedCustomer}'`,
                        orderBy: ['crc5b_projecttitle asc'],
                        maxPageSize: 5000,
                        skipToken: currentSkipToken,
                        select: ['crc5b_ordersid', 'crc5b_projecttitle', 'crc5b_customername']
                    });

                    if (result.error) {
                        console.error("Chyba API pri zákazkách:", result.error);
                        break;
                    }

                    if (result.data) {
                        allData = [...allData, ...result.data];
                    }

                    if (result['@odata.nextLink']) {
                        const tokenMatch = result['@odata.nextLink'].match(/skiptoken=([^&]+)/);
                        currentSkipToken = tokenMatch ? decodeURIComponent(tokenMatch[1]) : undefined;
                    } else {
                        currentSkipToken = result.skipToken;
                    }

                    loopCount++;
                } while (currentSkipToken && loopCount < 100);

                setOrders(allData);
            } catch (err) {
                console.error("Nepodarilo sa načítať zákazky z Dataverse", err);
            }
        }
        fetchOrders();
    }, [selectedCustomer]);

    // Načítanie podčinností, keď sa zmení vybraný Kód činnosti
    useEffect(() => {
        async function fetchActivities() {
            if (!reportCode) {
                setActivities([]);
                return;
            }
            setIsLoadingActivities(true);
            try {
                const result = await Crc5b_activitycodedirectoriesService.getAll({
                    filter: `_crc5b_codedirectory_value eq '${reportCode}'`,
                    orderBy: ['crc5b_kodcinnosti asc']
                });

                if (result.error) {
                    console.error("Chyba pri načítaní činností:", result.error);
                } else if (result.data) {
                    setActivities(result.data);
                    // Inicializácia prázdnych hodnôt pre každú aktivitu, aby sa Inputs dobre kontrolovali
                    const initialForms: Record<string, { time: string; count: string; note: string }> = {};
                    result.data.forEach(act => {
                        initialForms[act.crc5b_activitycodedirectoryid] = { time: '', count: '', note: '' };
                    });
                    setActivityForms(initialForms);
                }
            } catch (err) {
                console.error("Nepodarilo sa načítať činnosti z Dataverse", err);
            } finally {
                setIsLoadingActivities(false);
            }
        }
        fetchActivities();
    }, [reportCode]);

    // Funkcia pre zmenu hodnoty v konkrétnom riadku galérie
    const handleActivityChange = (activityId: string, field: 'time' | 'count' | 'note', value: string) => {
        setActivityForms(prev => ({
            ...prev,
            [activityId]: {
                ...prev[activityId],
                [field]: value
            }
        }));
    };

    // Vypočet celkových hodín z tabuľky
    const totalHours = Object.values(activityForms).reduce((acc, curr) => {
        const time = parseFloat(curr.time);
        return acc + (isNaN(time) ? 0 : time);
    }, 0);

    // Funkcia po odoslaní formulára
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        console.log("Prvá zákazka – všetky polia:", JSON.stringify(orders[0], null, 2));
        console.log("selectedOrder:", selectedOrder);

        if (!selectedOrder) {
            alert('Prosím, vyberte zákazku.');
            return;
        }

        const filledActivities = Object.entries(activityForms).filter(([, data]) => data.time || data.count || data.note);

        if (filledActivities.length === 0) {
            alert('Prosím, vyplňte aspoň jednu činnosť (vyplňte čas, počet alebo poznámku).');
            return;
        }

        const shouldSave = window.confirm(`Spolu zapísaných hodín: ${totalHours.toFixed(1)}. Chcete uložiť výkaz?`);
        if (!shouldSave) return;

        let lokZaznamu: any = 137690003; // Default Office
        if (reportLocation === 'Klient' || reportLocation === 'U klienta') lokZaznamu = 137690004;
        else if (reportLocation === 'Z domu' || reportLocation === 'Home Office') lokZaznamu = 137690005;

        let savedCount = 0;
        let errorsCount = 0;
        let lastErrorMsg = '';

        for (const [activityId, data] of filledActivities) {
            // Získame objekt sub-aktivity pre pomenovanie ak chceme
            const actObj = activities.find(a => a.crc5b_activitycodedirectoryid === activityId);
            const actName = actObj ? actObj.crc5b_cinnost : 'Aktivita';
            const vname = `Výkaz: ${reportDate} - ${selectedCustomer} - ${actName}`;

            // Parse time as decimal number, default to 0 if empty
            const hodinyDb = data.time ? parseFloat(data.time) : 0;

            const recordToSave: any = {
                crc5b_datum: reportDate,
                crc5b_hodiny: hodinyDb,
                crc5b_lokalita: lokZaznamu,
                crc5b_pracovnevykazyname: vname.substring(0, 100),
                crc5b_popiscinnosti: data.note || '',
                crc5b_pracovnik: userProfile.displayName,
                crc5b_zakaznik: selectedCustomer,
                crc5b_zakazkaklienta: orders.find(o => o.crc5b_ordersid === selectedOrder)?.crc5b_projecttitle || '',
                crc5b_email: userProfile.mail,
                crc5b_rok: reportDate.split('-')[0],
                crc5b_mesiac: reportDate.split('-')[1],
                crc5b_den: reportDate.split('-')[2]
                // statecode: 0  ← toto zmaž
            };

            //cordToSave["crc5b_Zakazka@odata.bind"] = `/crc5b_orderses(${selectedOrder})`;
            recordToSave["crc5b_ActivityCode@odata.bind"] = `/crc5b_activitycodedirectories(${activityId})`;

            if (reportCode) {
                recordToSave["crc5b_Code@odata.bind"] = `/crc5b_codedirectories(${reportCode})`;
            }

            console.log("recordToSave:", JSON.stringify(recordToSave, null, 2));

            try {
                const result = await Crc5b_pracovnevykaziesService.create(recordToSave);
                if (result.error) {
                    console.error("Chyba API pri ukladaní záznamu:", result.error);
                    lastErrorMsg = typeof result.error === 'object' ? JSON.stringify(result.error) : String(result.error);
                    errorsCount++;
                } else {
                    savedCount++;
                }
            } catch (err: any) {
                console.error("FULL ERROR:", JSON.stringify(err, null, 2));
                lastErrorMsg = err?.message || err?.error?.message || JSON.stringify(err);
                errorsCount++;
            }
        }

        if (errorsCount > 0) {
            alert(`Záznamy uložené s chybami.\nÚspešne: ${savedCount}\nChyby: ${errorsCount}\nPosledná chyba: ${lastErrorMsg}`);
        } else {
            alert(`Výkaz úspešne uložený!\nVytvorených záznamov: ${savedCount}`);
            
            // Vyčistíme iba vyplnené dáta z aktivít, ale necháme ich načítané (štruktúru z Dataverse),
            // rovnako ako aj zvoleného zákazníka, zákazku a hlavičku pre ďalšie rýchle zadávanie.
            setActivityForms({});

            // Namiesto redirectu na Home zostávame tu
            // navigate('/');
        }
    };

    return (
        <div className="main-layout">
            {/* ĽAVÉ MENU (zkopírované z HomePage) */}
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
                    {/* Tu presmerujeme späť na Home */}
                    <li onClick={() => navigate('/')}>🏠 Domov</li>
                    {/* Tu sme vizuálne označili, že sme aktuálne na tejto stránke */}
                    <li style={{ backgroundColor: 'var(--bg-navy)', color: 'white' }}>➕ Nový výkaz</li>
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
                    <h1>Nový výkaz</h1>
                    <a href="https://www.claslovakia.sk" target="_blank" className="logo-container">
                        <img src={claLogo} className="logo cla" alt="CLA Slovakia logo" />
                    </a>
                </div>

                <div className="card" style={{ textAlign: 'left', maxWidth: '2000px', margin: '0 auto', backgroundColor: 'var(--bg-white)', color: 'var(--bg-black)' }}>
                    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>

                        {/* POLOŽKA: ZÁKAZNÍK (ORGANIZÁCIA) */}
                        <div>
                            <label style={{ fontWeight: 'bold' }}>Zákazník:</label>
                            <div style={{ marginTop: '5px' }}>
                                <Select
                                    options={customers.map(c => ({
                                        value: c.crc5b_organizationname || '',
                                        label: c.crc5b_organizationname || 'Neznámy zákazník'
                                    }))}
                                    value={selectedCustomer ? { value: selectedCustomer, label: selectedCustomer } : null}
                                    onChange={(selected) => setSelectedCustomer(selected?.value || '')}
                                    placeholder="-- Vyhľadajte zákazníka --"
                                    isClearable
                                    styles={{
                                        control: (base) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            borderColor: 'var(--bg-smoke)',
                                            backgroundColor: 'var(--bg-cloud)',
                                            minHeight: '42px',
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: 'var(--bg-black)'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            color: 'var(--bg-black)'
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        {/* POLOŽKA: ZÁKAZKA (ZÁVISLÁ NA ZÁKAZNÍKOVI) */}
                        <div>
                            <label style={{ fontWeight: 'bold', color: selectedCustomer ? 'inherit' : 'gray' }}>Zákazka:</label>
                            <div style={{ marginTop: '5px' }}>
                                <Select
                                    options={orders.map(o => ({
                                        value: o.crc5b_ordersid,
                                        label: o.crc5b_projecttitle || o.crc5b_customername || 'Neznáma zákazka'
                                    }))}
                                    value={selectedOrder ? {
                                        value: selectedOrder,
                                        label: (() => {
                                            const o = orders.find(ord => ord.crc5b_ordersid === selectedOrder);
                                            return o ? (o.crc5b_projecttitle || o.crc5b_customername || 'Neznáma zákazka') : '';
                                        })()
                                    } : null}
                                    onChange={(selected) => setSelectedOrder(selected?.value || '')}
                                    isDisabled={!selectedCustomer}
                                    placeholder="-- Vyhľadajte zákazku --"
                                    isClearable
                                    styles={{
                                        control: (base, state) => ({
                                            ...base,
                                            borderRadius: '6px',
                                            borderColor: 'var(--bg-smoke)',
                                            backgroundColor: state.isDisabled ? '#e2e8f0' : 'var(--bg-cloud)',
                                            minHeight: '42px',
                                        }),
                                        singleValue: (base) => ({
                                            ...base,
                                            color: 'var(--bg-black)'
                                        }),
                                        menu: (base) => ({
                                            ...base,
                                            color: 'var(--bg-black)'
                                        })
                                    }}
                                />
                            </div>
                        </div>

                        {/* POLOŽKA: LOKALITA */}
                        <div>
                            <label style={{ fontWeight: 'bold' }}>Lokalita:</label>
                            <select
                                value={reportLocation}
                                onChange={(e) => setReportLocation(e.target.value)}
                                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)', boxSizing: 'border-box' }}
                                required
                            >
                                <option value="" disabled>Vyberte lokalitu</option>
                                <option value="Kancelária">Kancelária</option>
                                <option value="Klient">Klient</option>
                                <option value="Z domu">Z domu</option>
                            </select>
                        </div>

                        {/* POLOŽKA: DÁTUM */}
                        <div>
                            <label style={{ fontWeight: 'bold' }}>Dátum:</label>
                            <input
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)', boxSizing: 'border-box', colorScheme: 'light' }}
                                required
                            />
                        </div>

                        {/* POLOŽKA: KÓD ČINNOSTI */}
                        <div>
                            <label style={{ fontWeight: 'bold' }}>Kód činnosti <small style={{ fontWeight: 'normal', color: 'gray' }}></small>:</label>
                            <select
                                value={reportCode}
                                onChange={(e) => setReportCode(e.target.value)}
                                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)', boxSizing: 'border-box' }}
                                required
                                disabled={isLoadingCodes}
                            >
                                <option value="" disabled>
                                    {isLoadingCodes ? 'Načítavam z Dataverse...' : 'Vyberte kód činnosti'}
                                </option>
                                {codes.map((codeItem) => (
                                    <option key={codeItem.crc5b_codedirectoryid} value={codeItem.crc5b_codedirectoryid}>
                                        {codeItem.crc5b_code}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* TABUĽKA/GALÉRIA PODČINNOSTÍ */}
                        {isLoadingActivities && <div style={{ color: 'var(--bg-navy)', fontWeight: 'bold' }}>Načítavam zoznam činností...</div>}

                        {!isLoadingActivities && activities.length > 0 && (
                            <div style={{ marginTop: '10px', border: '1px solid var(--bg-smoke)', borderRadius: '6px', overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9em', backgroundColor: 'var(--bg-white)', minWidth: '600px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-cloud)', borderBottom: '2px solid var(--bg-smoke)' }}>
                                            <th style={{ padding: '10px', textAlign: 'left', width: '30%' }}>Názov</th>
                                            <th style={{ padding: '10px', textAlign: 'center', width: '10%' }}>Čas (h)</th>
                                            <th style={{ padding: '10px', textAlign: 'left', width: '60%' }}>Poznámka</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activities.map((act) => {
                                            const id = act.crc5b_activitycodedirectoryid;
                                            return (
                                                <tr key={id} style={{ borderBottom: '1px solid var(--bg-smoke)' }}>
                                                    <td style={{ padding: '8px 10px', borderRight: '1px solid var(--bg-black)' }}>
                                                        {act.crc5b_cinnost}
                                                    </td>
                                                    <td style={{ padding: '8px', borderRight: '1px solid var(--bg-black)' }}>
                                                        <input
                                                            type="number"
                                                            step="0.25"
                                                            value={activityForms[id]?.time || ''}
                                                            onChange={(e) => handleActivityChange(id, 'time', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px', borderRadius: '4px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px' }}>
                                                        <textarea
                                                            rows={2}
                                                            value={activityForms[id]?.note || ''}
                                                            onChange={(e) => handleActivityChange(id, 'note', e.target.value)}
                                                            style={{ width: '100%', boxSizing: 'border-box', padding: '6px', borderRadius: '4px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)', resize: 'vertical', fontFamily: 'inherit' }}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!isLoadingActivities && activities.length > 0 && (
                            <div style={{ textAlign: 'right', fontWeight: 'bold', fontSize: '1.2em', color: 'var(--bg-navy)' }}>
                                Celkový odpracovaný čas: {totalHours.toFixed(2)} h
                            </div>
                        )}

                        {/* TLAČIDLO ULOŽIŤ */}
                        <button type="submit" style={{ marginTop: '10px', backgroundColor: 'var(--bg-navy)', padding: '12px', fontSize: '1.1em', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            💾 Uložiť výkaz
                        </button>
                        <button type="button" onClick={() => navigate('/')} style={{ backgroundColor: 'var(--bg-smoke)', border: 'none', color: '#000', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
                            ❌ Zrušiť
                        </button>

                    </form>
                </div>
            </div>
        </div>
    )
}

export default EditPage