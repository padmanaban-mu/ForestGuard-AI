import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, Leaf, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { readLocal } from '../utils/storage.js';

const defaultNotifications = { inAppAlerts: true, newAlertBadge: true, sound: false };
export default function Navbar({ onMenu }) {
  const { isDark, toggleTheme } = useTheme(); const { user, role, logout } = useAuth(); const { newCount, earlyWarningsNew = 0 } = useAlerts();
  const totalNew = newCount + earlyWarningsNew;
  const [search, setSearch] = useState(''); const [menuOpen, setMenuOpen] = useState(false); const [preferences, setPreferences] = useState(() => readLocal('forestguard:notifications', defaultNotifications));
  const navigate = useNavigate(); const previousCount = useRef(totalNew);
  useEffect(() => {
    const sync = () => setPreferences(readLocal('forestguard:notifications', defaultNotifications));
    window.addEventListener('forestguard:preferences', sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener('forestguard:preferences', sync); window.removeEventListener('storage', sync); };
  }, []);
  useEffect(() => {
    const increasedBy = totalNew - previousCount.current;
    previousCount.current = totalNew;
    if (increasedBy > 0 && preferences.inAppAlerts) window.dispatchEvent(new CustomEvent('forestguard:in-app-alert', { detail: `${increasedBy} new alert${increasedBy === 1 ? '' : 's'} available.` }));
  }, [totalNew, preferences.inAppAlerts]);
  const badgeVisible = Boolean(preferences.inAppAlerts && preferences.newAlertBadge && totalNew > 0);
  const submit = (event) => { event.preventDefault(); const query = search.trim(); navigate(query ? `/history?search=${encodeURIComponent(query)}` : '/history'); };
  return <header className="sticky top-0 z-30 flex h-[74px] items-center gap-3 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/90 sm:px-6">
    <button onClick={onMenu} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden" aria-label="Open navigation"><Menu size={20} /></button>
    <form onSubmit={submit} className="relative hidden w-full max-w-md md:block"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} className="control h-10 w-full pl-9 pr-3" placeholder="Search detections, zones…" aria-label="Search fire detection history" /></form>
    <button className="ml-auto relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => navigate('/alerts')} aria-label={`${totalNew} new alerts (${newCount} active fires, ${earlyWarningsNew} early warnings)`}><Bell size={18} />{badgeVisible && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{totalNew > 99 ? '99+' : totalNew}</span>}</button>
    <button onClick={toggleTheme} className="rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}>{isDark ? <Sun size={18} /> : <Moon size={18} />}</button>
    <div className="relative"><button onClick={() => setMenuOpen((value) => !value)} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900" aria-expanded={menuOpen}><span className="grid h-8 w-8 place-items-center rounded-full bg-forest-100 text-forest-800 dark:bg-forest-900 dark:text-emerald-200"><Leaf size={15} /></span><span className="hidden text-left sm:block"><span className="block max-w-28 truncate text-xs font-bold text-slate-800 dark:text-slate-100">{user}</span><span className="block text-[10px] text-slate-400">{role ? 'Demo role' : 'Choose role'}</span></span><ChevronDown size={14} className="hidden text-slate-400 sm:block" /></button>
      {menuOpen && <div className="absolute right-0 top-12 z-50 w-52 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"><div className="px-3 py-2 text-xs text-slate-500">{role || 'No demo role selected'}</div>{role && <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800" onClick={() => { logout(); setMenuOpen(false); navigate('/login'); }}><LogOut size={14} />Sign out</button>}{!role && <button className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-forest-700 hover:bg-forest-50 dark:text-emerald-300 dark:hover:bg-slate-800" onClick={() => { setMenuOpen(false); navigate('/login'); }}>Select demo role</button>}</div>}
    </div>
  </header>;
}
