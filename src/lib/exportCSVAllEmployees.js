// src/lib/exportCSVAllEmployees.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

function fmtDate(d){ return d.toISOString().slice(0,10); }
function toLocal(dateStr, tz){ return new Date(new Date(dateStr).toLocaleString('en-US',{ timeZone: tz })); }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function hhmm(ts, tz){ const dt=toLocal(ts,tz); return `${String(dt.getHours()).padStart(2,'0')}${String(dt.getMinutes()).padStart(2,'0')}`; }

export async function exportCSVAllEmployees(fromISO, toISO, tz='Australia/Sydney'){
  const { data: emps, error: empErr } = await supabase
    .from('employees')
    .select('id,name')
    .eq('active', true)       // adjust if your column differs
    .is('deleted_at', null)   // adjust if your column differs
    .order('name', { ascending: true });
  if (empErr) throw empErr;

  const { data: evs, error: evErr } = await supabase
    .from('events')
    .select('employee_id,timestamp')
    .gte('timestamp', fromISO)
    .lt('timestamp', toISO)
    .order('timestamp', { ascending: true });
  if (evErr) throw evErr;

  const byEmpDay = new Map();
  for (const e of evs||[]){
    const dLocal = fmtDate(toLocal(e.timestamp, tz));
    if (!byEmpDay.has(e.employee_id)) byEmpDay.set(e.employee_id, new Map());
    const m = byEmpDay.get(e.employee_id);
    if (!m.has(dLocal)) m.set(dLocal, []);
    m.get(dLocal).push(hhmm(e.timestamp, tz));
  }

  const start = toLocal(fromISO, tz), end = toLocal(toISO, tz);
  const days=[]; for(let d=new Date(start); d<=end; d=addDays(d,1)) days.push(fmtDate(d));

  const lines=[['Name',...days].join(',')];
  for (const emp of emps){
    const m = byEmpDay.get(emp.id) || new Map();
    const row = [emp.name, ...days.map(day => (m.get(day)||[]).join(' '))];
    lines.push(row.map(s=>`"${String(s).replaceAll('"','""')}"`).join(','));
  }
  const blob=new Blob([lines.join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob); const a=document.createElement('a');
  a.href=url; a.download=`bundy-report_${days[0]}_to_${days.at(-1)}.csv`; document.body.appendChild(a); a.click();
  URL.revokeObjectURL(url); a.remove();
}
