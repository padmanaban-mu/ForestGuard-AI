import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CloudSun, Database, Flame, Leaf, MapPinned, Satellite, ShieldCheck, Trees } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader, DataNote, SourceLine, useToast } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useData } from '../context/DataContext.jsx';
import { REGION } from '../data/region.js';

const HERO = '/forestguard-hero.webp';
export default function LandingPage() {
  const reduceMotion = useReducedMotion();
  const { login } = useAuth(); const { sourceStatus } = useData(); const navigate = useNavigate(); const toast = useToast();
  const choose = (role) => { login(role); toast(`Demo session started as ${role}`); navigate('/dashboard'); };
  return <div className="space-y-7">
    <PageHeader eyebrow="Forest intelligence workspace" title="A clearer signal in a changing forest." subtitle="ForestGuard brings satellite fire detections, public weather and OpenStreetMap context into one transparent monitoring workspace." />
    <section className="relative min-h-[350px] overflow-hidden rounded-[28px] bg-forest-900 shadow-card sm:min-h-[400px]">
      <img src={HERO} alt="Layered green forested ridges in the Uttarakhand foothills" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      <div className="absolute inset-0 bg-gradient-to-r from-forest-950/95 via-forest-950/65 to-forest-950/10" />
      <motion.div initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={reduceMotion ? { duration: 0 } : undefined} className="relative z-10 flex min-h-[350px] max-w-2xl flex-col justify-center p-7 text-white sm:min-h-[400px] sm:p-11">
        <div className="mb-4 flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur"><Satellite size={14} /> Public-data forest fire monitoring</div>
        <h2 className="max-w-xl text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">Monitor the signal.<br /><span className="text-emerald-300">Focus the response.</span></h2>
        <p className="mt-4 max-w-lg text-sm leading-6 text-white/80">A student-built operations view for {REGION.name}. Satellite observations and live public context stay distinct from clearly labelled simulations.</p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button className="btn bg-white text-forest-900 hover:bg-emerald-50" onClick={() => choose('Forest Officer')}>Continue as Forest Officer <ArrowRight size={16} /></button>
          <button className="btn border border-white/35 bg-white/10 text-white hover:bg-white/20" onClick={() => choose('Admin')}>Continue as Admin</button>
        </div>
        <p className="mt-3 text-[10px] text-white/60">Mock role selection for project demonstration only; not secure authentication.</p>
      </motion.div>
      <div className="absolute bottom-4 right-4 z-10 hidden gap-2 sm:flex"><span className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-[10px] text-white/80 backdrop-blur">Uttarakhand · provisional region</span></div>
    </section>

    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
      <section className="card p-5 sm:p-6"><div className="flex items-center gap-2 text-forest-700 dark:text-emerald-300"><ShieldCheck size={18} /><p className="eyebrow !text-forest-700 dark:!text-emerald-300">How it works</p></div><div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[{ icon: Satellite, title: 'Observe', copy: 'NASA FIRMS fire detections and public weather where an API is available.' }, { icon: MapPinned, title: 'Locate', copy: 'OpenStreetMap stations and settlements provide real geographic context.' }, { icon: Leaf, title: 'Explain', copy: 'Risk and spread formulas are visible; missing evidence remains unavailable.' }].map(({ icon: Icon, title, copy }, i) => <div key={title} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/70"><div className="mb-3 grid h-9 w-9 place-items-center rounded-xl bg-forest-100 text-forest-700 dark:bg-forest-900 dark:text-emerald-300"><Icon size={17} /></div><p className="text-sm font-bold text-slate-900 dark:text-white">0{i + 1} · {title}</p><p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{copy}</p></div>)}
      </div></section>
      <section className="card flex flex-col justify-between p-5 sm:p-6"><div><div className="flex items-center gap-2"><Trees size={18} className="text-forest-600" /><p className="eyebrow">Study region</p></div><h2 className="mt-3 text-xl font-bold text-slate-900 dark:text-white">{REGION.name}</h2><p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">Provisional selection because the project brief did not specify a state. Replace the region and bounding box in the environment or region configuration.</p><p className="mt-3 break-all rounded-lg bg-slate-50 p-2 font-mono text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">[west, south, east, north] = {REGION.bbox.join(', ')}</p></div><div className="mt-4"><SourceLine source="Region configuration" status="Fallback" /></div></section>
    </div>

    <section className="card p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><Database size={17} className="text-forest-700 dark:text-emerald-300" /><h2 className="text-sm font-bold text-slate-900 dark:text-white">Data readiness</h2></div><div className="grid gap-3 sm:grid-cols-3">{[{ name: 'NASA FIRMS', item: sourceStatus.fires, icon: Flame }, { name: 'Open-Meteo', item: sourceStatus.weather, icon: CloudSun }, { name: 'OpenStreetMap', item: sourceStatus.osm, icon: MapPinned }].map(({ name, item, icon: Icon }) => <div key={name} className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"><div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200"><Icon size={15} />{name}</span><span className="text-[10px] text-slate-500">{item?.status || 'Fallback'}</span></div><p className="mt-2 text-[10px] leading-4 text-slate-400">{item?.error || 'Status will update when the source is refreshed.'}</p></div>)}</div><p className="mt-4 text-[10px] text-slate-400">Source: NASA FIRMS · Open-Meteo · OpenStreetMap / Overpass · Last updated from each source independently.</p></section>
    <DataNote><strong>Project limits:</strong> no custom backend, sensors, or secure account system. Response resources are simulated. No fire-history CSV, zone boundaries, or NDVI file was attached; empty fallbacks are included until you supply the real datasets.</DataNote>
  </div>;
}
