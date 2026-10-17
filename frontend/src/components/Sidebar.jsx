import { NavLink } from 'react-router-dom';
import { Activity, AlertTriangle, BarChart3, BookOpen, ChevronLeft, ClipboardList, Cpu, Flame, Gauge, Leaf, MapPinned, Shield, Siren, Trees } from 'lucide-react';
import { REGION } from '../data/region.js';

export const navItems = [
  { label: 'Project overview', to: '/login', icon: BookOpen },
  { label: 'Dashboard', to: '/dashboard', icon: Gauge },
  { label: 'Fire engine', to: '/fire-engine', icon: Siren },
  { label: 'Forest health', to: '/forest-health', icon: Trees },
  { label: 'Vulnerable areas', to: '/vulnerable-areas', icon: MapPinned },
  { label: 'Hotspot simulation', to: '/simulation', icon: Flame },
  { label: 'Risk change', to: '/change-detection', icon: Activity },
  { label: 'Alert center', to: '/alerts', icon: AlertTriangle },
  { label: 'Analytics', to: '/analytics', icon: BarChart3 },
  { label: 'Model', to: '/model', icon: Cpu },
  { label: 'History', to: '/history', icon: ClipboardList },
  { label: 'Audit & settings', to: '/audit-settings', icon: Shield },
];

export default function Sidebar({ open, onClose }) {
  return <>
    {open && <button className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden" aria-label="Close navigation" onClick={onClose} />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950 lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex h-[74px] items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
        <NavLink to="/dashboard" onClick={onClose} className="flex items-center gap-3"><img src="/forestguard-mark.svg" alt="" className="h-10 w-10" /><span><strong className="block text-[15px] tracking-tight text-slate-900 dark:text-white">ForestGuard</strong><span className="text-[10px] font-semibold text-slate-400">AI · FIELD INTELLIGENCE</span></span></NavLink>
        <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden" aria-label="Close navigation" onClick={onClose}><ChevronLeft size={18} /></button>
      </div>
      <div className="px-4 pb-2 pt-5"><p className="eyebrow px-3">Workspace</p></div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4" aria-label="Primary navigation">{navItems.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition ${isActive ? 'bg-forest-50 text-forest-700 dark:bg-forest-900/50 dark:text-emerald-300' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white'}`}><Icon size={17} strokeWidth={1.9} /><span>{label}</span></NavLink>)}</nav>
      <div className="m-3 rounded-2xl bg-forest-50 p-4 dark:bg-forest-900/30"><div className="flex items-center gap-2 text-forest-800 dark:text-emerald-300"><Leaf size={15} /><span className="text-xs font-bold">Monitoring region</span></div><p className="mt-2 text-xs font-semibold text-slate-700 dark:text-slate-200">{REGION.name}</p><p className="mt-1 text-[10px] leading-4 text-slate-500 dark:text-slate-400">Provisional demo bounds · replace with your study area.</p></div>
      <div className="px-5 pb-4 text-[10px] text-slate-400">Frontend demo · Data sources in Settings</div>
    </aside>
  </>;
}
