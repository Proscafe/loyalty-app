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
  submitted_by_phone?: string | null;
  answers?: Record<string,string> | null; created_at?: string | null;
};
type EmailRecipientRule = { email: string; report_types: string[] };
type Settings = {
  email_enabled: boolean;
  email_recipients: string[];
  email_report_types: string[];
  email_recipient_rules?: EmailRecipientRule[];
};
type TimeFilter = "week"|"month"|"date_range"|"all";
const PAGE_BG="radial-gradient(circle at top left, rgba(255,214,107,0.24), transparent 28%), linear-gradient(135deg, #365665 0%, #263f49 48%, #798673 100%)";
const TIMES:[TimeFilter,string][]=[["week","This Week"],["month","This Month"],["date_range","Date Range"],["all","Show All"]];
const KINDS:{value:ReportQuestionKind;label:string}[]=[
  {value:"yes_no",label:"Yes / No"},
  {value:"short",label:"Short Answer"},{value:"paragraph",label:"Paragraph"}
];
function dt(v?:string|null){if(!v)return"—";const d=new Date(v);return Number.isNaN(d.getTime())?"—":d.toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});}
function dateMatch(v:string|null|undefined,f:TimeFilter,a:string,b:string){if(f==="all")return true;if(!v)return false;const d=new Date(v),n=new Date(),today=new Date(n.getFullYear(),n.getMonth(),n.getDate());if(f==="week"){const s=new Date(today);s.setDate(s.getDate()-((s.getDay()+6)%7));return d>=s;}if(f==="month")return d>=new Date(n.getFullYear(),n.getMonth(),1);const s=a?new Date(a+"T00:00:00"):new Date(0),e=b?new Date(b+"T23:59:59"):new Date(8640000000000000);return d>=s&&d<=e;}
function checklistMetrics(r:ReportRow,forms:ReportDefinition[]){
  const definition=getReportDefinition(r.report_type,forms);

  if(!definition){
    return {
      eightySixItems:false,
      score:null as number|null,
      issues:null as number|null,
      status:null as null|"good"|"attention"|"poor",
    };
  }

  const answers=r.answers??{};
  const questions=definition.sections.flatMap(section=>section.questions);

  // Find the field whose visible label is "86 ITEMS".
  // Any non-empty submitted value means YES.
  const eightySixQuestion=questions.find(question=>{
    const label=String(question.label??"")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g," ")
      .replace(/\s+/g," ");
    return label==="86 items"||label.includes("86 items");
  });

  const eightySixValue=eightySixQuestion
    ? String(answers[eightySixQuestion.key]??"").trim()
    : "";

  const eightySixItems=eightySixValue.length>0;

  const isChecklist=
    r.report_type==="floor_checklist"||
    r.report_type==="kitchen_checklist";

  // Regular reports never receive a checklist score.
  if(!isChecklist){
    return {
      eightySixItems,
      score:null as number|null,
      issues:null as number|null,
      status:null as null|"good"|"attention"|"poor",
    };
  }

  const yesNoQuestions=questions.filter(
    question=>question.kind==="yes_no"||question.kind==="yes_no_na"
  );

  let yes=0;
  let no=0;

  yesNoQuestions.forEach(question=>{
    const value=String(answers[question.key]??"").trim().toLowerCase();

    if(value==="yes")yes+=1;
    if(value==="no")no+=1;
    // N/A and unanswered values are ignored.
  });

  const answered=yes+no;

  if(answered===0){
    return {
      eightySixItems,
      score:null as number|null,
      issues:0,
      status:null as null|"good"|"attention"|"poor",
    };
  }

  const score=Math.round((yes/answered)*100);
  const status=score>=90?"good":score>=70?"attention":"poor";

  return {
    eightySixItems,
    score,
    issues:no,
    status,
  };
}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value));}
function whatsappUrl(phone?:string|null){
  const digits=String(phone??"").replace(/\D/g,"");
  if(!digits)return null;
  return `https://wa.me/${digits}`;
}

export default function ReportsPageClient({reports,initialForms,initialSettings}:{reports:ReportRow[];initialForms:ReportDefinition[];initialSettings:Settings|null}) {
  const [tab,setTab]=useState<"reports"|"settings">("reports");
  const [forms,setForms]=useState<ReportDefinition[]>(initialForms.length?initialForms:REPORT_DEFINITIONS);
  const [editing,setEditing]=useState<ReportDefinition|null>(null);
  const [settings,setSettings]=useState<Settings>(()=>{
    const base=initialSettings??{email_enabled:true,email_recipients:[],email_report_types:[...REPORT_TYPES]};
    const rules=Array.isArray(base.email_recipient_rules)&&base.email_recipient_rules.length
      ? base.email_recipient_rules
      : (base.email_recipients??[]).map(email=>({email,report_types:[...(base.email_report_types??REPORT_TYPES)]}));
    return {...base,email_recipient_rules:rules};
  });
  const [newEmail,setNewEmail]=useState("");
  const [newEmailTypes,setNewEmailTypes]=useState<string[]>([...REPORT_TYPES]);
  const [emailOpen,setEmailOpen]=useState(false);
  const [notice,setNotice]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [selected,setSelected]=useState<ReportRow|null>(null);
  const [reportRows,setReportRows]=useState<ReportRow[]>(reports);
  const [time,setTime]=useState<TimeFilter>("week");
  const [from,setFrom]=useState(""); const [to,setTo]=useState(""); const [type,setType]=useState("all");
  const [department,setDepartment]=useState<"all"|"kitchen"|"floor">("all");
  const [submitter,setSubmitter]=useState("all");
  const [deletingId,setDeletingId]=useState<string|null>(null);

  const submitters=useMemo(()=>{
    const map=new Map<string,string>();
    reportRows.forEach(r=>{
      if(!r.submitted_by)return;
      map.set(r.submitted_by,(r.submitted_by_name||"Unknown").trim()||"Unknown");
    });
    return Array.from(map.entries()).sort((a,b)=>a[1].localeCompare(b[1]));
  },[reportRows]);

  const visible=useMemo(()=>reportRows.filter(r=>{
    const departmentMatch=
      department==="all"||
      (department==="kitchen"&&(r.report_type==="kitchen_report"||r.report_type==="kitchen_checklist"))||
      (department==="floor"&&(r.report_type==="floor_report"||r.report_type==="floor_checklist"));

    return departmentMatch&&
      (type==="all"||r.report_type===type)&&
      (submitter==="all"||r.submitted_by===submitter)&&
      dateMatch(r.created_at,time,from,to);
  }),[reportRows,department,type,submitter,time,from,to]);

  async function deleteReport(row:ReportRow){
    if(!window.confirm(`Delete ${reportTypeLabel(row.report_type,forms)} submitted by ${row.submitted_by_name||"this user"}?`))return;
    setDeletingId(row.id);
    setNotice(null);
    const res=await fetch(`/api/reports/${encodeURIComponent(row.id)}`,{method:"DELETE"});
    const data=await res.json().catch(()=>({}));
    setDeletingId(null);
    if(!res.ok){setNotice(data.error||"Could not delete report.");return;}
    setReportRows(current=>current.filter(item=>item.id!==row.id));
    if(selected?.id===row.id)setSelected(null);
    setNotice("Report deleted.");
  }

  async function saveForm(){
    if(!editing)return; setSaving(true);setNotice(null);
    const res=await fetch("/api/reports/forms",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({form:editing})});
    const data=await res.json().catch(()=>({}));setSaving(false);
    if(!res.ok){setNotice(data.error||"Could not save form.");return;}
    setForms(c=>c.map(f=>f.type===editing.type?clone(editing):f));setNotice("Form saved. Staff will see the new questions immediately.");
  }
  async function saveSettings(){
    setSaving(true);setNotice(null);

    const pendingEmail=newEmail.trim().toLowerCase();
    const currentRules=settings.email_recipient_rules??[];
    let rulesToSave=currentRules;

    if(pendingEmail&&newEmailTypes.length){
      const existing=currentRules.find(rule=>rule.email===pendingEmail);
      rulesToSave=existing
        ? currentRules.map(rule=>rule.email===pendingEmail
            ? {...rule,report_types:Array.from(new Set([...rule.report_types,...newEmailTypes]))}
            : rule)
        : [...currentRules,{email:pendingEmail,report_types:[...newEmailTypes]}];
    }

    const payload:Settings={
      ...settings,
      email_recipient_rules:rulesToSave,
      email_recipients:rulesToSave.map(rule=>rule.email),
      email_report_types:Array.from(new Set(rulesToSave.flatMap(rule=>rule.report_types))),
    };

    const res=await fetch("/api/reports/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    const data=await res.json().catch(()=>({}));
    setSaving(false);

    if(!res.ok){
      setNotice(data.error||"Could not save settings.");
      return;
    }

    if(data.settings){
      const saved=data.settings as Settings;
      const rules=Array.isArray(saved.email_recipient_rules)?saved.email_recipient_rules:[];
      setSettings({
        ...saved,
        email_recipient_rules:rules,
        email_recipients:rules.map(rule=>rule.email),
        email_report_types:Array.from(new Set(rules.flatMap(rule=>rule.report_types))),
      });
    }

    if(pendingEmail){
      setNewEmail("");
      setNewEmailTypes([...REPORT_TYPES]);
    }

    setNotice("Email settings saved.");
  }
  function addEmail(){
    const email=newEmail.trim().toLowerCase();
    if(!email||!newEmailTypes.length)return;
    setSettings(s=>{
      const current=s.email_recipient_rules??[];
      const existing=current.find(rule=>rule.email===email);
      const rules=existing
        ? current.map(rule=>rule.email===email?{...rule,report_types:Array.from(new Set([...rule.report_types,...newEmailTypes]))}:rule)
        : [...current,{email,report_types:[...newEmailTypes]}];
      return {
        ...s,
        email_recipient_rules:rules,
        email_recipients:rules.map(rule=>rule.email),
        email_report_types:Array.from(new Set(rules.flatMap(rule=>rule.report_types))),
      };
    });
    setNewEmail("");
    setNewEmailTypes([...REPORT_TYPES]);
  }
  function toggleRecipientType(email:string,reportType:string){
    setSettings(s=>{
      const rules=(s.email_recipient_rules??[]).map(rule=>rule.email===email
        ? {...rule,report_types:rule.report_types.includes(reportType)?rule.report_types.filter(type=>type!==reportType):[...rule.report_types,reportType]}
        : rule
      );
      return {...s,email_recipient_rules:rules,email_recipients:rules.map(rule=>rule.email),email_report_types:Array.from(new Set(rules.flatMap(rule=>rule.report_types)))};
    });
  }
  async function removeRecipient(email:string){
    const rules=(settings.email_recipient_rules??[]).filter(rule=>rule.email!==email);
    const nextSettings:Settings={
      ...settings,
      email_recipient_rules:rules,
      email_recipients:rules.map(rule=>rule.email),
      email_report_types:Array.from(new Set(rules.flatMap(rule=>rule.report_types))),
    };

    setSettings(nextSettings);
    setSaving(true);
    setNotice(null);

    const res=await fetch("/api/reports/settings",{
      method:"PUT",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(nextSettings),
    });
    const data=await res.json().catch(()=>({}));
    setSaving(false);

    if(!res.ok){
      setNotice(data.error||"Could not remove recipient.");
      return;
    }

    if(data.settings){
      const saved=data.settings as Settings;
      const savedRules=Array.isArray(saved.email_recipient_rules)?saved.email_recipient_rules:[];
      setSettings({
        ...saved,
        email_recipient_rules:savedRules,
        email_recipients:savedRules.map(rule=>rule.email),
        email_report_types:Array.from(new Set(savedRules.flatMap(rule=>rule.report_types))),
      });
    }

    setNotice("Recipient removed.");
  }

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
        <details className="group mb-4 lg:hidden">
          <summary className="flex h-11 cursor-pointer list-none items-center justify-between rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665] [&::-webkit-details-marker]:hidden">
            <span>Filters</span>
            <span className="text-[14px] transition group-open:rotate-180">⌄</span>
          </summary>
          <div className="mt-2 space-y-2 rounded-[18px] bg-white/10 p-3 backdrop-blur-xl">
            <select value={submitter} onChange={e=>setSubmitter(e.target.value)} className="h-11 w-full rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
              <option value="all">All users</option>
              {submitters.map(([id,name])=><option key={id} value={id}>{name}</option>)}
            </select>
            <select value={department} onChange={e=>setDepartment(e.target.value as "all"|"kitchen"|"floor")} className="h-11 w-full rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
              <option value="all">All Departments</option>
              <option value="kitchen">Kitchen</option>
              <option value="floor">Floor</option>
            </select>
            <select value={type} onChange={e=>setType(e.target.value)} className="h-11 w-full rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
              <option value="all">All report types</option>
              {forms.map(f=><option key={f.type} value={f.type}>{f.title}</option>)}
            </select>
            <select value={time} onChange={e=>setTime(e.target.value as TimeFilter)} className="h-11 w-full rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
              {TIMES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            {time==="date_range"?<div className="grid grid-cols-2 gap-2">
              <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-11 min-w-0 rounded-[14px] bg-white px-3 text-[11px] font-bold text-[#365665]"/>
              <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-11 min-w-0 rounded-[14px] bg-white px-3 text-[11px] font-bold text-[#365665]"/>
            </div>:null}
          </div>
        </details>

        <section className="mb-4 hidden gap-2 lg:grid lg:grid-cols-4">
          <select value={submitter} onChange={e=>setSubmitter(e.target.value)} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
            <option value="all">All users</option>
            {submitters.map(([id,name])=><option key={id} value={id}>{name}</option>)}
          </select>
          <select value={department} onChange={e=>setDepartment(e.target.value as "all"|"kitchen"|"floor")} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
            <option value="all">All Departments</option>
            <option value="kitchen">Kitchen</option>
            <option value="floor">Floor</option>
          </select>
          <select value={type} onChange={e=>setType(e.target.value)} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
            <option value="all">All report types</option>
            {forms.map(f=><option key={f.type} value={f.type}>{f.title}</option>)}
          </select>
          <select value={time} onChange={e=>setTime(e.target.value as TimeFilter)} className="h-11 rounded-[14px] bg-white px-4 text-[12px] font-black text-[#365665]">
            {TIMES.map(([v,l])=><option key={v} value={v}>{l}</option>)}
          </select>
        </section>

        {time==="date_range"?<section className="mb-4 hidden grid-cols-2 gap-2 lg:grid">
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="h-11 min-w-0 rounded-[14px] bg-white px-3 text-[11px] font-bold text-[#365665]"/>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="h-11 min-w-0 rounded-[14px] bg-white px-3 text-[11px] font-bold text-[#365665]"/>
        </section>:null}

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/10 backdrop-blur-2xl">
          <div className="hidden lg:block">
            <div className="grid grid-cols-[1.35fr_1.1fr_1.05fr_.62fr_.72fr_.62fr_.78fr] border-b border-white/25 px-6 py-4 text-[11px] font-black uppercase tracking-[0.14em] text-white">
              <div>Report</div>
              <div>Submitted By</div>
              <div>Submitted</div>
              <div>86 Items</div>
              <div>Score</div>
              <div>Issues</div>
              <div>Actions</div>
            </div>
            {visible.length?visible.map(r=>{
              const wa=whatsappUrl(r.submitted_by_phone);
              const metrics=checklistMetrics(r,forms);
              return <div key={r.id} className="grid grid-cols-[1.35fr_1.1fr_1.05fr_.62fr_.72fr_.62fr_.78fr] items-center border-b border-white/10 px-6 py-4 text-white last:border-0">
                <button type="button" onClick={()=>setSelected(r)} className="pr-3 text-left text-[13px] font-black hover:text-[#ffd66b]">{reportTypeLabel(r.report_type,forms)}</button>
                <div className="truncate pr-3 text-[12px] font-bold">{r.submitted_by_name||"—"}</div>
                <div className="text-[11px] font-bold text-white/70">{dt(r.created_at)}</div>
                <div className={`text-[12px] font-black ${metrics.eightySixItems?"text-[#9cffc9]":"text-white/45"}`}>
                  {metrics.eightySixItems?"YES":"—"}
                </div>
                <div>
                  {metrics.score===null
                    ?<span className="text-[12px] font-black text-white/45">—</span>
                    :<span className={`text-[13px] font-black ${metrics.status==="good"?"text-[#9cffc9]":metrics.status==="attention"?"text-[#ffd66b]":"text-[#ff9b93]"}`}>{metrics.score}%</span>}
                </div>
                <div className={`text-[12px] font-black ${metrics.issues===null?"text-white/45":metrics.issues>0?"text-[#ff9b93]":"text-[#9cffc9]"}`}>
                  {metrics.issues===null?"—":metrics.issues}
                </div>
                <div className="flex items-center gap-3">
                  {wa?<a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${r.submitted_by_name||"user"}`} title="WhatsApp" className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-[10px] font-black text-white">WA</a>:<span title="No phone number" className="flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-white/10 text-[10px] font-black text-white/35">WA</span>}
                  <button type="button" aria-label="Delete report" title="Delete" disabled={deletingId===r.id} onClick={()=>void deleteReport(r)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#ffd1d1] text-[#ef4444] disabled:opacity-50">
                    {deletingId===r.id?<span className="text-[10px] font-black">...</span>:<svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>}
                  </button>
                </div>
              </div>
            }):<div className="px-6 py-10 text-center text-sm font-bold text-white/65">No reports found.</div>}
          </div>

          <div className="lg:hidden">
            {visible.length?visible.map(r=>{
              const metrics=checklistMetrics(r,forms);
              return <div key={r.id} className="border-b border-white/10 p-4 text-white last:border-0">
                <button type="button" onClick={()=>setSelected(r)} className="block w-full text-left">
                  <div className="text-[13px] font-black">{reportTypeLabel(r.report_type,forms)}</div>
                  <div className="mt-1 text-[11px] font-bold text-white/75">{r.submitted_by_name||"—"}</div>
                  <div className="mt-1 text-[10px] font-bold text-white/55">{dt(r.created_at)}</div>
                </button>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-[12px] bg-white/[0.07] p-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.08em] text-white/45">86 Items</div>
                    <div className={`mt-1 text-[13px] font-black ${metrics.eightySixItems?"text-[#9cffc9]":"text-white/45"}`}>{metrics.eightySixItems?"YES":"—"}</div>
                  </div>
                  <div className="rounded-[12px] bg-white/[0.07] p-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.08em] text-white/45">Score</div>
                    <div className={`mt-1 text-[13px] font-black ${metrics.score===null?"text-white/45":metrics.status==="good"?"text-[#9cffc9]":metrics.status==="attention"?"text-[#ffd66b]":"text-[#ff9b93]"}`}>{metrics.score===null?"—":`${metrics.score}%`}</div>
                  </div>
                  <div className="rounded-[12px] bg-white/[0.07] p-2">
                    <div className="text-[8px] font-black uppercase tracking-[0.08em] text-white/45">Issues</div>
                    <div className={`mt-1 text-[13px] font-black ${metrics.issues===null?"text-white/45":metrics.issues>0?"text-[#ff9b93]":"text-[#9cffc9]"}`}>{metrics.issues===null?"—":metrics.issues}</div>
                  </div>
                </div>

              </div>
            }):<div className="p-8 text-center text-sm font-bold text-white/65">No reports found.</div>}
          </div>
        </section>
      </>:<>
        {!editing?<>
          <section className="mb-5 rounded-[26px] border border-white/10 bg-white/10 p-5 text-white backdrop-blur-xl">
            <h2 className="text-[20px] font-black">Edit Forms</h2><p className="mt-1 text-[12px] font-bold text-white/60">Edit questions, types, required fields, order, and active forms.</p>
            <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{forms.map(f=><button key={f.type} onClick={()=>setEditing(clone(f))} className="rounded-[18px] bg-white/10 p-4 text-left"><div className="font-black">{f.title}</div><div className="mt-1 text-[11px] font-bold text-[#ffd66b]">Edit form →</div></button>)}</div>
          </section>
          <section className="rounded-[26px] border border-white/10 bg-white/10 text-white backdrop-blur-xl">
            <button
              type="button"
              onClick={()=>setEmailOpen(open=>!open)}
              className="flex w-full items-center justify-between gap-4 p-5 text-left"
              aria-expanded={emailOpen}
            >
              <div>
                <h2 className="text-[20px] font-black">Email Notifications</h2>
                <p className="mt-1 text-[12px] font-bold text-white/60">Choose exactly which reports each recipient receives.</p>
              </div>
              <span className={`text-[18px] font-black text-white/75 transition ${emailOpen?"rotate-180":""}`}>⌄</span>
            </button>

            {emailOpen?<div className="border-t border-white/10 px-5 pb-5 pt-4">
            <div className="flex gap-2">
              <input value={newEmail} onChange={e=>setNewEmail(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addEmail();}}} placeholder="name@example.com" className="h-11 min-w-0 flex-1 rounded-[14px] bg-white px-4 text-[12px] font-bold text-[#365665] outline-none"/>
              <button onClick={addEmail} className="rounded-[14px] bg-[#ffd66b] px-5 text-[11px] font-black text-[#365665]">ADD</button>
            </div>

            <div className="mt-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[.14em] text-white/60">Send new recipient</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {forms.map(f=>{const on=newEmailTypes.includes(f.type);return <button key={f.type} type="button" onClick={()=>setNewEmailTypes(current=>on?current.filter(type=>type!==f.type):[...current,f.type])} className={`rounded-[14px] px-4 py-3 text-left text-[11px] font-black ${on?"bg-[#ffd66b] text-[#365665]":"bg-white/10 text-white"}`}>{on?"✓ ":""}{f.title}</button>})}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {(settings.email_recipient_rules??[]).length?(settings.email_recipient_rules??[]).map(rule=><div key={rule.email} className="rounded-[18px] bg-white/[0.08] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="truncate text-[12px] font-black">{rule.email}</div>
                  <button type="button" disabled={saving} onClick={()=>void removeRecipient(rule.email)} className="rounded-full bg-[#ffd1d1] px-3 py-2 text-[10px] font-black text-[#ef4444] disabled:opacity-50">REMOVE</button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {forms.map(f=>{const on=rule.report_types.includes(f.type);return <button key={f.type} type="button" onClick={()=>toggleRecipientType(rule.email,f.type)} className={`rounded-[12px] px-3 py-2 text-left text-[10px] font-black ${on?"bg-[#ffd66b] text-[#365665]":"bg-white/10 text-white"}`}>{on?"✓ ":""}{f.title}</button>})}
                </div>
              </div>):<div className="rounded-[16px] bg-white/[0.06] px-4 py-4 text-[11px] font-bold text-white/55">No email recipients added yet.</div>}
            </div>

            <div className="mt-5 flex justify-end">
              <button disabled={saving} onClick={saveSettings} className="h-11 rounded-[14px] bg-[#ffd66b] px-7 text-[10px] font-black uppercase tracking-[.1em] text-[#365665]">{saving?"Saving...":"Save Email Settings"}</button>
            </div>
            </div>:null}
          </section>
        </>:<FormEditor form={editing} setForm={setEditing} onBack={()=>setEditing(null)} onSave={saveForm} saving={saving}/>}
      </>}

      {selected?<ReportModal row={selected} forms={forms} onClose={()=>setSelected(null)}/>:null}
    </div>
  </AdminPageShell>;
}
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
