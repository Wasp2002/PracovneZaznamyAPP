import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import claLogo from '../assets/claSK.png'
import '../App.css'
import { Crc5b_codedirectoriesService, Crc5b_activitycodedirectoriesService, Office365UsersService } from '../generated'
import type { Crc5b_codedirectories } from '../generated/models/Crc5b_codedirectoriesModel'
import type { Crc5b_activitycodedirectories } from '../generated/models/Crc5b_activitycodedirectoriesModel'

function EditPage() {
    const navigate = useNavigate()

    // Stav pre profil používateľa
    const [userProfile, setUserProfile] = useState<{ displayName: string; mail: string; photo?: string }>({ displayName: 'Načítavam...', mail: '...' })

    // Stavy pre formulár
    const [reportName, setReportName] = useState('')
    const [reportLocation, setReportLocation] = useState('')
    const [reportCode, setReportCode] = useState('')
    const [reportDate, setReportDate] = useState('')

    // Stavy pre data z Dataverse
    const [codes, setCodes] = useState<Crc5b_codedirectories[]>([])
    const [isLoadingCodes, setIsLoadingCodes] = useState(true)

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
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedCodeObj = codes.find(c => c.crc5b_codedirectoryid === reportCode);
        alert(`Výkaz udelený!\nNázov: ${reportName}\nLokalita: ${reportLocation}\nKód: ${selectedCodeObj ? selectedCodeObj.crc5b_code : reportCode}\nDátum: ${reportDate}\nSpolu hodín: ${totalHours.toFixed(1)}\nAktivity boli uložené v state: ${Object.values(activityForms).filter(a => a.time || a.count || a.note).length} záznamov.`);
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
                    <li>⚙️ Nastavenia</li>
                </ul>
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

                        {/* POLOŽKA: NÁZOV */}
                        <div>
                            <label style={{ fontWeight: 'bold' }}>Názov výkazu:</label>
                            <input
                                type="text"
                                placeholder="Napr. Práca na projekte X"
                                value={reportName}
                                onChange={(e) => setReportName(e.target.value)}
                                style={{ width: '100%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: '1px solid var(--bg-smoke)', backgroundColor: 'var(--bg-cloud)', color: 'var(--bg-black)', boxSizing: 'border-box' }}
                                required
                            />
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