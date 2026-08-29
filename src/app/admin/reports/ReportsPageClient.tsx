"use client";

import { useMemo, useState } from "react";
import { AdminPageShell } from "@/components/AdminPageShell";
import { AdminMobileHeader } from "@/components/AdminMobileHeader";
import {
  REPORT_DEFINITIONS,
  REPORT_TYPES,
  getReportDefinition,
  reportRoleLabel,
  reportTypeLabel,
  type ReportDefinition,
  type ReportQuestionKind,
} from "@/lib/internal-reports";

type ReportRow = {
  id: string; report_type: string; submitted_by: string;
  submitted_by_name?: string | null; submitted_by_role?: string | null;
  answers?: Record<string,string> | null; created_at?: string | null;
};
type Settings = { email_enabled: boolean; email_recipients: string[]; email_report_types: string[] };
type TimeFilter = "today"|"week"|"month"|"date_range"|"all";
const PAGE_BG="radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const TIMES:[TimeFilter,string][]=[["today","Today"],["week","This Week"],["month","This Month"],["date_range","Date Range"],["all","Show All"]];
const KINDS:{value:ReportQuestionKind;label:string}[]=[
  {value:"yes_no",label:"Yes / No"},{value:"yes_no_na",label:"Yes / No / N/A"},
  {value:"short",label:"Short Answer"},{value:"paragraph",label:"Paragraph"}
];
function dt(v?:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function dateMatch(v:string|null|undefined,f:TimeFilter,a:string,b:string){if(f==="all")return true;if(!v)return false;const d=new Date(v),n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate());if(f==="today")return d>=today;if(f==="week"){const s=new Date(today);s.setDate(s.getDate()-((s.getDay()+6)%7));return d>=s;}if(f==="month")return d>=new Date(n.getFullYear(),n.getMonth(),1);const s=a?new Date(a+"T00:00:00"):new Date(0),e=b?new Date(b+"T23:59:59"):new Date(8640000000000000);return d>=s&&d<=e;}
function noCount(r:ReportRow){return Object.values(r.answers??{}).filter(v=>v==="No").length;}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value));}

export default function ReportsPageClient({reports,initialForms,initialSettings}:{reports:ReportRow[];initialForms:ReportDefinition[];initialSettings:Settings|null}) {
  const [tab,setTab]=useState<"reports"|"settings">("reports");
  const [forms,setForms]=useState<ReportDefinition[]>(initialForms.length?initialForms:REPORT_DEFINITIONS);
  const [editing,setEditing]=useState<ReportDefinition|null>(null);
  const [settings,setSettings]=useState<Settings>(initialSettings??{email_enabled:true,email_recipients:[],email_report_types:[...REPORT_TYPES]});
  const [newEmail,setNewEmail]=useState("");
  const [notice,setNotice]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [selected,setSelected]=useState<ReportRow|null>(null);
  const [query,setQuery]=useState(""); const [time,setTime]=useState<TimeFilter>("today");
  const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [type,setType]=useState("all");

  const visible=useMemo(()=>reports.filter(r=>(!query||`${r.submitted_by_name??""} ${reportTypeLabel(r.report_type,forms)}`.toLowerCase().includes(query.toLowerCase()))&&(type==="all"||r.report_type===type)&&dateMatch(r.created_at,time,from,to)),[reports,query,type,time,from,to,forms]);

  async function saveForm(){
    if(!editing)return; setSaving(true);setNotice(null);
    const res=await fetch("/api/reports/forms",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({form:editing})});
    const data=await res.json().catch(()=>({}));setSaving(false);
    if(!res.ok){setNotice(data.error||"Could not save form.");return;}
    setForms(c=>c.map(f=>f.type===editing.type?clone(editing):f));setNotice("Form saved. Staff will see the new questions immediately.");
  }
  async function saveSettings(){
    setSaving(true);setNotice(null);
    const res=await fetch("/api/reports/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});
    const data=await res.json().catch(()=>({}));setSaving(false);
    setNotice(res.ok?"Email settings saved.":data.error||"Could not save settings.");
  }
  function addEmail(){const e=newEmail.trim().toLowerCase();if(!e||settings.email_recipients.includes(e))return;setSettings(s=>({...s,email_recipients:[...s.email_recipients,e]}));setNewEmail("");}

  return <AdminPageShell active="reports">
    <style>{`@media (min-width:1024px){html,body,main,[data-nextjs-scroll-focus-boundary]{background:${PAGE_BG}!important}}`}</style>
    <div className="min-h-screen px-4 py-5 lg:-m-6 lg:px-10 lg:py-10" style={{background:PAGE_BG}}>
      <div className="mb-5 lg:hidden"><AdminMobileHeader/></div>
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><h1 className="text-[32px] font-black tracking-[-.05em] text-white">Reports</h1><p className="mt-1 text-[12px] font-bold text-white/65">Review submissions and manage operational forms.</p></div>
        <div className="flex rounded-full bg-white/10 p-1">
          <button onClick={()=>setTab("reports")} className={`h-10 rounded-full px-5 text-[11px] font-black uppercase ${tab==="reports"?"bg-[#ffd66b] text-[#365665]":"text-white"}`}>Reports</button>
          <button onClick={()=>setTab("settings")} className={`h-10 rounded-full px-5 text-[11px] font-black uppercase ${tab==="settings"?"bg-[#ffd66b] text-[#365665]":"text-white"}`}>Settings</button>
        </div>
      </header>

      {notice?<div className="mb-4 rounded-[16px] bg-white px-4 py-3 text-[12px] font-black text-[#365665]">{notice}</div>:null}

      {tab==="reports"?<>
        <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card label="Total" value={visible.length}/><Card label="Checklists" value={visible.filter(r=>r.report_type.includes("checklist")).length}/><Card label="Reports" value={visible.filter(r=>r.report_type.endsWith("_report")).length}/><Card label="No Answers" value={visible.reduce((s,r)=>s+noCount(r),0)}/>
        </section>
        <section className="mb-4 grid gap-2 lg:grid-cols-4">
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search submitted by..." className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-bold text-[#365665] outline-none"/>
          <select value={type} onChange={e=>setType(e.target.value)} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]"><option value="all">All report types</option>{forms.map(f=><option key={f.type} value={f.type}>{f.title}</option>)}</select>
          <select value={time} onChange={e=>setTime(e.target.value as TimeFilter)} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">{TIMES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
          {time==="date_range"?<div className="flex gap-2"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="min-w-0 flex-1 rounded-[14px] bg-white px-2 text-[11px]"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="min-w-0 flex-1 rounded-[14px] bg-white px-2 text-[11px]"/></div>:null}
        </section>
        <section className="overflow-hidden rounded-[26px] border border-white/10 bg-white/10 backdrop-blur-xl">
          {visible.length?visible.map(r=><button key={r.id} onClick={()=>setSelected(r)} className="grid w-full gap-1 border-b border-white/10 px-5 py-4 text-left text-white last:border-0 lg:grid-cols-[1.2fr_1fr_.8fr_1fr_.5fr] lg:items-center">
            <b className="text-[13px]">{reportTypeLabel(r.report_type,forms)}</b><span className="text-[12px] font-bold">{r.submitted_by_name||"—"}</span><span className="text-[11px] font-black text-[#ffd66b]">{reportRoleLabel(r.submitted_by_role)}</span><span className="text-[11px] text-white/65">{dt(r.created_at)}</span><span className={noCount(r)?"font-black text-[#ffd0ca]":"font-black text-[#9cffc9]"}>{noCount(r)}</span>
          </button>):<div className="p-8 text-center text-sm font-bold text-white/65">No reports found.</div>}
        </section>
      </>:<>
        {!editing?<>
          <section className="mb-5 rounded-[26px] border border-white/10 bg-white/10 p-5 text-white backdrop-blur-xl">
            <h2 className="text-[20px] font-black">Forms</h2><p className="mt-1 text-[12px] font-bold text-white/60">Edit questions, types, required fields, order, and active forms.</p>
            <div className="mt-4 grid gap-2 lg:grid-cols-2">{forms.map(f=><button key={f.type} onClick={()=>setEditing(clone(f))} className="rounded-[18px] bg-white/10 p-4 text-left"><div className="font-black">{f.title}</div><div className="mt-1 text-[11px] font-bold text-[#ffd66b]">Edit form →</div></button>)}</div>
          </section>
          <section className="rounded-[26px] border border-white/10 bg-white/10 p-5 text-white backdrop-blur-xl">
            <div className="flex items-center justify-between"><div><h2 className="text-[20px] font-black">Email Notifications</h2><p className="mt-1 text-[12px] font-bold text-white/60">Email submitted reports to multiple recipients.</p></div><button onClick={()=>setSettings(s=>({...s,email_enabled:!s.email_enabled}))} className={`rounded-full px-4 py-2 text-[10px] font-black ${settings.email_enabled?"bg-[#9cffc9] text-[#365665]":"bg-white/10 text-white"}`}>{settings.email_enabled?"ENABLED":"DISABLED"}</button></div>
            <div className="mt-4 flex gap-2"><input value={newEmail} onChange={e=>setNewEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addEmail();}}} placeholder="name@example.com" className="h-11 min-w-0 flex-1 rounded-[14px] bg-white px-4 text-[12px] font-bold text-[#365665] outline-none"/><button onClick={addEmail} className="rounded-[14px] bg-[#ffd66b] px-5 text-[11px] font-black text-[#365665]">ADD</button></div>
            <div className="mt-3 flex flex-wrap gap-2">{settings.email_recipients.map(e=><button key={e} onClick={()=>setSettings(s=>({...s,email_recipients:s.email_recipients.filter(x=>x!==e)}))} className="rounded-full bg-white/10 px-3 py-2 text-[11px] font-black">{e} ×</button>)}</div>
            <div className="mt-5"><div className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-white/60">Send for</div><div className="grid gap-2 sm:grid-cols-2">{forms.map(f=>{const on=settings.email_report_types.includes(f.type);return <button key={f.type} onClick={()=>setSettings(s=>({...s,email_report_types:on?s.email_report_types.filter(x=>x!==f.type):[...s.email_report_types,f.type]}))} className={`rounded-[14px] px-4 py-3 text-left text-[11px] font-black ${on?"bg-[#ffd66b] text-[#365665]":"bg-white/10 text-white"}`}>{on?"✓ ":""}{f.title}</button>})}</div></div>
            <button disabled={saving} onClick={saveSettings} className="mt-5 h-12 w-full rounded-[14px] bg-[#ffd66b] text-[11px] font-black uppercase tracking-[.1em] text-[#365665]">{saving?"Saving...":"Save Email Settings"}</button>
          </section>
        </>:<FormEditor form={editing} setForm={setEditing} onBack={()=>setEditing(null)} onSave={saveForm} saving={saving}/>}
      </>}

      {selected?<ReportModal row={selected} forms={forms} onClose={()=>setSelected(null)}/>:null}
    </div>
  </AdminPageShell>;
}
function Card({label,value}:{label:string;value:string|number}){return <div className="rounded-[18px] bg-white/10 p-4 text-white"><div className="text-[11px] font-black">{label}</div><div className="mt-2 text-[22px] font-black">{value}</div></div>}
function FormEditor({form,setForm,onBack,onSave,saving}:{form:ReportDefinition;setForm:(f:ReportDefinition)=>void;onBack:()=>void;onSave:()=>void;saving:boolean}){
  function updateSection(si:number,patch:any){const n=clone(form);n.sections[si]={...n.sections[si],...patch};setForm(n)}
  function updateQ(si:number,qi:number,patch:any){const n=clone(form);n.sections[si].questions[qi]={...n.sections[si].questions[qi],...patch};setForm(n)}
  function move(si:number,qi:number,d:number){const n=clone(form),a=n.sections[si].questions,j=qi+d;if(j<0||j>=a.length)return;[a[qi],a[j]]=[a[j],a[qi]];setForm(n)}
  function remove(si:number,qi:number){const n=clone(form);n.sections[si].questions.splice(qi,1);setForm(n)}
  function add(si:number){const n=clone(form);n.sections[si].questions.push({key:`${form.type}_${Date.now()}`,label:"New question",kind:"yes_no",required:true});setForm(n)}
  return <section className="rounded-[26px] border border-white/10 bg-white/10 p-5 text-white">
    <div className="mb-5 flex items-center justify-between"><div><button onClick={onBack} className="mb-2 text-[11px] font-black text-[#ffd66b]">← SETTINGS</button><h2 className="text-[24px] font-black">{form.title}</h2></div><button onClick={()=>setForm({...form,is_active:form.is_active===false})} className={`rounded-full px-4 py-2 text-[10px] font-black ${form.is_active===false?"bg-white/10":"bg-[#9cffc9] text-[#365665]"}`}>{form.is_active===false?"INACTIVE":"ACTIVE"}</button></div>
    {form.sections.map((s,si)=><div key={si} className="mb-5 rounded-[20px] bg-white/8 p-4">
      <input value={s.title} onChange={e=>updateSection(si,{title:e.target.value})} className="mb-3 h-11 w-full rounded-[12px] bg-white px-4 text-[13px] font-black text-[#365665]"/>
      <div className="space-y-3">{s.questions.map((q,qi)=><div key={q.key} className="rounded-[16px] bg-black/10 p-3">
        <input value={q.label} onChange={e=>updateQ(si,qi,{label:e.target.value})} className="h-11 w-full rounded-[12px] bg-white px-4 text-[12px] font-bold text-[#365665]"/>
        <div className="mt-2 grid grid-cols-2 gap-2"><select value={q.kind} onChange={e=>updateQ(si,qi,{kind:e.target.value as ReportQuestionKind})} className="h-10 rounded-[10px] bg-white px-2 text-[11px] font-black text-[#365665]">{KINDS.map(k=><option key={k.value} value={k.value}>{k.label}</option>)}</select><button onClick={()=>updateQ(si,qi,{required:!q.required})} className={`rounded-[10px] text-[10px] font-black ${q.required?"bg-[#ffd66b] text-[#365665]":"bg-white/10"}`}>{q.required?"REQUIRED":"OPTIONAL"}</button></div>
        <div className="mt-2 flex gap-2"><button onClick={()=>move(si,qi,-1)} className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black">↑</button><button onClick={()=>move(si,qi,1)} className="rounded-full bg-white/10 px-3 py-2 text-[10px] font-black">↓</button><button onClick={()=>remove(si,qi)} className="ml-auto rounded-full bg-[#7b3434] px-3 py-2 text-[10px] font-black">DELETE</button></div>
      </div>)}</div>
      <button onClick={()=>add(si)} className="mt-3 h-10 w-full rounded-[12px] border border-dashed border-white/30 text-[10px] font-black">+ ADD QUESTION</button>
    </div>)}
    <button disabled={saving} onClick={onSave} className="h-12 w-full rounded-[14px] bg-[#ffd66b] text-[11px] font-black uppercase tracking-[.1em] text-[#365665]">{saving?"Saving...":"Save Form"}</button>
  </section>
}
function ReportModal({row,forms,onClose}:{row:ReportRow;forms:ReportDefinition[];onClose:()=>void}){const d=getReportDefinition(row.report_type,forms),a=row.answers??{};return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-5" onClick={onClose}><div className="max-h-[86vh] w-full max-w-2xl overflow-y-auto rounded-[30px] bg-[#365665] p-5 text-white" onClick={e=>e.stopPropagation()}><button onClick={onClose} className="float-right text-xl">×</button><div className="text-[10px] font-black text-[#ffd66b]">{reportRoleLabel(row.submitted_by_role)} · {dt(row.created_at)}</div><h2 className="mt-2 text-[25px] font-black">{reportTypeLabel(row.report_type,forms)}</h2><div className="mt-1 text-[12px] font-bold">{row.submitted_by_name||"—"}</div>{d?.sections.map((s,si)=><section key={si} className="mt-5"><h3 className="mb-2 text-[11px] font-black uppercase tracking-[.14em] text-[#ffd66b]">{s.title}</h3><div className="grid gap-2 md:grid-cols-2">{s.questions.map(q=>{const v=String(a[q.key]??"").trim()||"—";return <div key={q.key} className={`rounded-[16px] p-3 ${v==="No"?"bg-[#7b3434]":"bg-white/10"} ${q.kind==="paragraph"?"md:col-span-2":""}`}><div className="text-[9px] font-black uppercase text-white/50">{q.label}</div><div className="mt-1 whitespace-pre-wrap text-[12px] font-black">{v}</div></div>})}</div></section>)}</div></div>}
