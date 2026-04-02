import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import claLogo from '../assets/claSK.png'
import '../App.css'
import { Crc5b_pracovnevykaziesService, Office365UsersService, Crc5b_ordersesService } from '../generated'
import type { Crc5b_pracovnevykazies } from '../generated/models/Crc5b_pracovnevykaziesModel'
import { appConfig } from '../appConfig'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

declare const __BUILD_DATE__: string;

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];

export default function DashboardPage() {
  const navigate = useNavigate()

  const [vykazy, setVykazy] = useState<Crc5b_pracovnevykazies[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [zakazkyMap, setZakazkyMap] = useState<Record<string, string>>({})
  
  const [userProfile, setUserProfile] = useState<{ displayName: string, mail: string, photo?: string }>({
    displayName: 'Načítavam používateľa...',
    mail: ''
  })

  // Rovnaké načítanie dát ako na domovskej stránke
  useEffect(() => {
    async function loadData() {
      try {
        let currentMail = '';
        try {
           const profileResult = await Office365UsersService.MyProfile_V2();
           if (profileResult.data) {
             currentMail = profileResult.data.mail || profileResult.data.userPrincipalName || '';
             let photo = '';
             try {
               const photoRes = await Office365UsersService.UserPhoto_V2(currentMail);
               if (photoRes.data) photo = photoRes.data.startsWith('data:') ? photoRes.data : `data:image/jpeg;base64,${photoRes.data}`;
             } catch (photoErr) {
               console.log("Nepodarilo sa načítať fotku, použije sa predvolený avatar.");
             }
             setUserProfile({ displayName: profileResult.data.displayName || 'Neznámy Používateľ', mail: currentMail, photo });
           } else {
             setUserProfile({ displayName: 'Skúšobný Používateľ', mail: '' });
           }
        } catch (profileErr) {
           setUserProfile({ displayName: 'Skúšobný Používateľ', mail: '' });
        }

        let allData: any[] = [];
        let isError = false;
        let errorMessage = '';
        let currentSkipToken: string | undefined = undefined;
        let loopCount = 0;

        const isAdminUser = !!(currentMail && appConfig.adminEmails.includes(currentMail.toLowerCase()));
        setIsAdmin(isAdminUser);

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
            if (ordResult.data) ordersAll = [...ordersAll, ...ordResult.data];
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
          setZakazkyMap(ordMap);
        } catch (e) {
          console.error("Zlyhalo načítanie orders", e);
        }

        do {
          const result: any = await Crc5b_pracovnevykaziesService.getAll({ 
             maxPageSize: 5000, 
             orderBy: ['crc5b_datum desc', 'createdon desc'],
             filter: isAdminUser ? undefined : (currentMail ? `crc5b_email eq '${currentMail}'` : undefined),
             expand: 'crc5b_Zakazka_klienta($select=crc5b_projecttitle)',
             skipToken: currentSkipToken
          });

          if (result.error) {
            isError = true;
            errorMessage = result.error.message || JSON.stringify(result.error);
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
        } while (currentSkipToken && loopCount < 1000);

        if (isError) {
          setErrorMsg(errorMessage);
        } else {
          if (isAdminUser) {
             setVykazy(allData);
          } else {
             const namePart = userProfile.displayName ? userProfile.displayName.split(' ')[0] : currentMail;
             const userVykazy = allData.filter(rec => {
                if (!rec.crc5b_pracovnik) return false;
                return rec.crc5b_pracovnik === currentMail || rec.crc5b_pracovnik.includes(namePart);
             });

             if (userVykazy.length === 0 && allData.length > 0) {
                setVykazy(allData);
             } else {
                setVykazy(userVykazy);
             }
          }
        }
      } catch (err: any) {
        setErrorMsg(err.message || String(err));
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // Príprava dát pre grafy
  const chartData = useMemo(() => {
    const byCustomer: Record<string, number> = {};
    const byOrder: Record<string, number> = {};
    const byActivity: Record<string, number> = {};
    const byEmployee: Record<string, number> = {};

    vykazy.forEach(rec => {
      const hodiny = parseFloat(String(rec.crc5b_hodiny) || '0') || 0;
      
      const zakaznik = rec.crc5b_zakaznik || 'Neznámy zákazník';
      
      const zakazkaId = (rec as any)._crc5b_zakazka_klienta_value || (rec as any)['_crc5b_zakazka_klienta_value@OData.Community.Display.V1.FormattedValue'] || rec.crc5b_zakazka_klienta;
      const zakazka = zakazkyMap[zakazkaId] || 'Neznáma zákazka';
      
      const aktivita = rec.crc5b_popiscinnosti || 'Bez popisu činnosti';
      const zamestnanec = rec.crc5b_pracovnik || 'Nezaradený';

      byCustomer[zakaznik] = (byCustomer[zakaznik] || 0) + hodiny;
      byOrder[zakazka] = (byOrder[zakazka] || 0) + hodiny;
      byActivity[aktivita] = (byActivity[aktivita] || 0) + hodiny;
      byEmployee[zamestnanec] = (byEmployee[zamestnanec] || 0) + hodiny;
    });

    const formatData = (obj: Record<string, number>) => {
      return Object.entries(obj)
        .map(([name, value]) => ({ name, value: Number(value.toFixed(2)) }))
        .sort((a, b) => b.value - a.value)
        .filter(item => item.value > 0);
    };

    return {
      byCustomer: formatData(byCustomer),
      byOrder: formatData(byOrder).slice(0, 15), // zoberie top 15 aby sa graf nepreplnil
      byActivity: formatData(byActivity).slice(0, 10),
      byEmployee: formatData(byEmployee)
    };
  }, [vykazy, zakazkyMap]);

  const totalHours = useMemo(() => {
    return vykazy.reduce((acc, rec) => acc + (parseFloat(String(rec.crc5b_hodiny) || '0') || 0), 0);
  }, [vykazy]);


  return (
    <div className="main-layout">
      {/* ĽAVÉ MENU */}
      <div className="sidebar-container">
        <div className="user-profile">
          <div className="user-avatar" style={userProfile.photo ? { background: 'none' } : {}}>
            {userProfile.photo ? (
              <img src={userProfile.photo} alt="Profil" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : "👤"}
          </div>
          <div className="user-info">
            <span className="user-name">{userProfile.displayName}</span>
            <span className="user-email">{userProfile.mail}</span>
          </div>
        </div>

        <h2>Menu</h2>
        <ul className="menu-list">
          <li onClick={() => navigate('/')}>🏠 Domov</li>
          <li onClick={() => navigate('/EditPage')}>➕ Nový výkaz</li>
          <li style={{ backgroundColor: 'var(--bg-navy)', color: 'white' }}>📊 Dashboard</li>
          <li onClick={() => window.open('https://apps.powerapps.com/play/e/86485853-792a-e67b-9761-e3ce683ba850/a/188b2b48-acfb-4a15-8142-75561b73805d?tenantId=1bc48a9d-3e02-4c94-a104-04b1960c5b3b&hint=2a9daae8-78d7-4372-b087-fbb3235e38c1&sourcetime=1774618589242&source=portal', '_blank')}>📅 Dochádzka</li>
        </ul>

        <div style={{ marginTop: 'auto', paddingTop: '20px', fontSize: '0.8em', color: 'var(--bg-smoke)', textAlign: 'center', opacity: 0.7 }}>
          Verzia: {typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : 'Dev'}
        </div>
      </div>

      {/* HLAVNÉ OKNO */}
      <div className="content-container">
        <div className="header">
          <h1>Grafický Dashboard</h1>
          <a href="https://www.claslovakia.sk" target="_blank" className="logo-container">
            <img src={claLogo} className="logo cla" alt="CLA Slovakia logo" />
          </a>
        </div>

        <div className="card" style={{ backgroundColor: 'var(--bg-white)', color: 'var(--bg-black)' }}>
            <h2 style={{ marginTop: '0', borderBottom: '2px solid var(--bg-smoke)', paddingBottom: '10px' }}>
                Prehľad odpracovaného času ({totalHours.toFixed(2)} h)
            </h2>

            {isLoading ? (
                <div style={{ color: 'var(--bg-navy)', marginTop: '20px' }}>Načítavam dáta pre dashboard...</div>
            ) : errorMsg ? (
                <div style={{ color: 'red', fontWeight: 'bold', marginTop: '20px' }}>Chyba: {errorMsg}</div>
            ) : chartData.byCustomer.length === 0 ? (
                <div style={{ marginTop: '20px' }}>Žiadne dáta pre zobrazenie grafov.</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', marginTop: '20px' }}>
                    
                    {isAdmin && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            <div style={{ border: '1px solid var(--bg-smoke)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
                                <h3 style={{ textAlign: 'center', marginTop: 0 }}>Zamestnanci (Koláčový graf)</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={chartData.byEmployee}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                                nameKey="name"
                                                label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                            >
                                                {chartData.byEmployee.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip formatter={(value: number) => `${value} h`} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            
                            <div style={{ border: '1px solid var(--bg-smoke)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
                                <h3 style={{ textAlign: 'center', marginTop: 0 }}>Zamestnanci (Hodiny)</h3>
                                <div style={{ height: '300px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData.byEmployee} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                                            <RechartsTooltip formatter={(value: number) => `${value} h`} />
                                            <Bar dataKey="value" fill="var(--bg-navy)" name="Hodiny" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    )}

                    <div style={{ border: '1px solid var(--bg-smoke)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
                        <h3 style={{ textAlign: 'center', marginTop: 0 }}>Top 15 najčastejších zákaziek</h3>
                        <div style={{ height: '400px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData.byOrder} margin={{ top: 20, right: 30, left: 20, bottom: 70 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="name" angle={-45} textAnchor="end" tick={{fontSize: 11}} height={80} />
                                    <YAxis />
                                    <RechartsTooltip formatter={(value: number) => `${value} h`} />
                                    <Bar dataKey="value" fill="#00C49F" name="Odpracované hodiny" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>
                        <div style={{ border: '1px solid var(--bg-smoke)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ textAlign: 'center', marginTop: 0 }}>Hodiny podľa zákazníkov</h3>
                            <div style={{ height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.byCustomer}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            outerRadius={120}
                                            fill="#8884d8"
                                            dataKey="value"
                                            label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                        >
                                            {chartData.byCustomer.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <RechartsTooltip formatter={(value: number) => `${value} h`} />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div style={{ border: '1px solid var(--bg-smoke)', borderRadius: '8px', padding: '15px', backgroundColor: '#f8fafc' }}>
                            <h3 style={{ textAlign: 'center', marginTop: 0 }}>Top 10 aktivít (Podľa popisu)</h3>
                            <div style={{ height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData.byActivity} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis type="number" />
                                        <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10}} />
                                        <RechartsTooltip formatter={(value: number) => `${value} h`} />
                                        <Bar dataKey="value" fill="#FFBB28" name="Hodiny" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  )
}
