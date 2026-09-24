"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AiAssistResult } from "@/lib/types";

export type CoupleMember = { id: string; name: string };

export type MaintenanceEntryView = {
  id: string;
  authorId: string;
  authorName: string;
  entryType: "opening" | "reply" | "pause" | "summary" | "decision";
  body: string;
  createdAt: string;
};

export type MaintenanceThreadView = {
  id: string;
  createdBy: string;
  title: string;
  status: "open" | "paused" | "understood" | "disagree" | "decided" | "closed";
  createdAt: string;
  entries: MaintenanceEntryView[];
};

export type FamilyTask = {
  id: string;
  createdBy: string;
  title: string;
  area: "home" | "outside" | "children" | "administration" | "other";
  assigneeId: string;
  shared: boolean;
  frequency: "once" | "daily" | "weekly" | "monthly" | "as_needed";
  dueDate: string;
  status: "pending" | "in_progress" | "done";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type FamilyExpense = {
  id: string;
  createdBy: string;
  description: string;
  category: "house" | "children" | "bills" | "food" | "transport" | "health" | "leisure" | "other";
  totalAmount: number;
  paidById: string;
  memberAId: string;
  memberBId: string;
  memberAAmount: number;
  memberBAmount: number;
  dueDate: string;
  status: "planned" | "paid" | "settled";
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type TaskDraft = Omit<FamilyTask, "id" | "createdBy" | "createdAt" | "updatedAt">;
type ExpenseDraft = Omit<FamilyExpense, "id" | "createdBy" | "createdAt" | "updatedAt">;

type Tab = "mediator" | "tasks" | "expenses";

const AREA_LABELS: Record<FamilyTask["area"], string> = {
  home: "Casa",
  outside: "Fuori casa",
  children: "Bambine",
  administration: "Pratiche",
  other: "Altro",
};
const FREQUENCY_LABELS: Record<FamilyTask["frequency"], string> = {
  once: "Una volta",
  daily: "Ogni giorno",
  weekly: "Ogni settimana",
  monthly: "Ogni mese",
  as_needed: "Quando serve",
};
const TASK_STATUS_LABELS: Record<FamilyTask["status"], string> = {
  pending: "Da fare",
  in_progress: "In corso",
  done: "Fatto",
};
const EXPENSE_CATEGORY_LABELS: Record<FamilyExpense["category"], string> = {
  house: "Casa",
  children: "Bambine",
  bills: "Bollette",
  food: "Spesa e cibo",
  transport: "Trasporti",
  health: "Salute",
  leisure: "Tempo libero",
  other: "Altro",
};
const EXPENSE_STATUS_LABELS: Record<FamilyExpense["status"], string> = {
  planned: "Prevista",
  paid: "Pagata",
  settled: "Regolata",
};

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyTask(memberId: string): TaskDraft {
  return { title: "", area: "home", assigneeId: memberId, shared: false, frequency: "weekly", dueDate: "", status: "pending", notes: "" };
}

function emptyExpense(memberA: CoupleMember, memberB: CoupleMember): ExpenseDraft {
  return {
    description: "",
    category: "house",
    totalAmount: 0,
    paidById: "",
    memberAId: memberA.id,
    memberBId: memberB.id,
    memberAAmount: 0,
    memberBAmount: 0,
    dueDate: today(),
    status: "planned",
    notes: "",
  };
}

function parseMoney(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100) / 100;
  const compact = value.trim().replace(/\s/g, "");
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value || 0);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusLabel(status: MaintenanceThreadView["status"]) {
  return ({ open: "Aperto", paused: "In pausa", understood: "Compreso", disagree: "Disaccordo", decided: "Decisione presa", closed: "Chiuso" } as const)[status];
}

export function MaintenanceSpace({
  coupleId,
  userId,
  userName,
  members,
  initialThreads,
  initialTasks,
  initialExpenses,
}: {
  coupleId: string;
  userId: string;
  userName: string;
  members: CoupleMember[];
  initialThreads: MaintenanceThreadView[];
  initialTasks: FamilyTask[];
  initialExpenses: FamilyExpense[];
}) {
  const memberA = members[0] || { id: userId, name: userName };
  const memberB = members[1] || { id: userId, name: "L’altra persona" };
  const [tab, setTab] = useState<Tab>("mediator");
  const [threads, setThreads] = useState(initialThreads);
  const [tasks, setTasks] = useState(initialTasks);
  const [expenses, setExpenses] = useState(initialExpenses);
  const [threadTitle, setThreadTitle] = useState("");
  const [opening, setOpening] = useState("");
  const [mediation, setMediation] = useState<AiAssistResult | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => emptyTask(userId));
  const [taskEdits, setTaskEdits] = useState<Record<string, TaskDraft>>(() => Object.fromEntries(initialTasks.map((task) => [task.id, { title: task.title, area: task.area, assigneeId: task.assigneeId, shared: task.shared, frequency: task.frequency, dueDate: task.dueDate, status: task.status, notes: task.notes }])));
  const [expenseDraft, setExpenseDraft] = useState<ExpenseDraft>(() => emptyExpense(memberA, memberB));
  const [expenseEdits, setExpenseEdits] = useState<Record<string, ExpenseDraft>>(() => Object.fromEntries(initialExpenses.map((expense) => [expense.id, { description: expense.description, category: expense.category, totalAmount: expense.totalAmount, paidById: expense.paidById, memberAId: expense.memberAId, memberBId: expense.memberBId, memberAAmount: expense.memberAAmount, memberBAmount: expense.memberBAmount, dueDate: expense.dueDate, status: expense.status, notes: expense.notes }])));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const activeTasks = useMemo(() => tasks.filter((task) => task.status !== "done").length, [tasks]);
  const plannedExpenses = useMemo(() => expenses.filter((expense) => expense.status !== "settled").reduce((sum, expense) => sum + expense.totalAmount, 0), [expenses]);
  const taskLoad = useMemo(() => {
    const result = new Map<string, number>();
    for (const member of members) result.set(member.id, 0);
    let shared = 0;
    for (const task of tasks) {
      if (task.status === "done") continue;
      if (task.shared) shared += 1;
      else if (task.assigneeId) result.set(task.assigneeId, (result.get(task.assigneeId) || 0) + 1);
    }
    return { result, shared };
  }, [tasks, members]);

  const currentMonth = today().slice(0, 7);
  const monthExpenses = useMemo(() => expenses.filter((expense) => {
    const date = expense.dueDate || expense.createdAt.slice(0, 10);
    return date.slice(0, 7) === currentMonth;
  }), [expenses, currentMonth]);
  const monthTotal = useMemo(() => monthExpenses.reduce((sum, expense) => sum + expense.totalAmount, 0), [monthExpenses]);
  const netBalance = useMemo(() => {
    let aOwesB = 0;
    for (const expense of expenses) {
      if (expense.status === "settled" || !expense.paidById) continue;
      if (expense.paidById === memberA.id) aOwesB -= expense.memberBAmount;
      if (expense.paidById === memberB.id) aOwesB += expense.memberAAmount;
    }
    return aOwesB;
  }, [expenses, memberA.id, memberB.id]);


  async function mediateOpening() {
    const clean = opening.trim();
    if (clean.length < 2) return setMessage("Scrivi il tema da affrontare.");
    setBusy(true);
    setMessage("");
    setMediation(null);
    try {
      const response = await fetch("/api/ai/mediate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: "maintenance", text: clean }),
      });
      const result = await response.json() as AiAssistResult & { error?: string };
      if (!response.ok || !result.proposta) throw new Error(result.error || "Mediazione non disponibile");
      setMediation(result);
      setMessage("L’IA ha preparato un’apertura più ascoltabile. Nulla è stato ancora condiviso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Mediazione non disponibile");
    } finally {
      setBusy(false);
    }
  }

  async function openThread(useProposal: boolean) {
    const body = String(useProposal ? mediation?.proposta || "" : opening).trim();
    if (!body) return;
    const title = threadTitle.trim() || "Questione da affrontare";
    setBusy(true);
    setMessage("");
    const supabase = createClient();
    const { data: thread, error: threadError } = await supabase
      .from("maintenance_threads")
      .insert({ couple_id: coupleId, created_by: userId, title, status: "open" })
      .select("id,created_by,title,status,created_at")
      .single();
    if (threadError || !thread) {
      setBusy(false);
      return setMessage(`Confronto non aperto: ${threadError?.message || "errore sconosciuto"}`);
    }

    const originalBody = opening.trim();
    const entries = [{ thread_id: thread.id, author_id: userId, entry_type: "opening", body }];
    if (mediation && useProposal) {
      entries.push({
        thread_id: thread.id,
        author_id: userId,
        entry_type: "summary",
        body: [mediation.lettura ? `Lettura del mediatore: ${mediation.lettura}` : "Apertura preparata dal Mediatore IA.", mediation.nota ? `Nota: ${mediation.nota}` : "", originalBody !== mediation.proposta ? "Il testo di partenza è rimasto nella fase privata di preparazione." : ""].filter(Boolean).join("\n\n"),
      });
    }
    const { data: insertedEntries, error: entriesError } = await supabase
      .from("maintenance_entries")
      .insert(entries)
      .select("id,author_id,entry_type,body,created_at");
    setBusy(false);
    if (entriesError) return setMessage(`Confronto aperto, ma contenuto non completo: ${entriesError.message}`);

    const mappedEntries: MaintenanceEntryView[] = (insertedEntries || []).map((entry: { id: string; author_id: string; entry_type: MaintenanceEntryView["entryType"]; body: string; created_at: string }) => ({
      id: entry.id,
      authorId: entry.author_id,
      authorName: entry.entry_type === "summary" ? "Mediatore IA" : userName,
      entryType: entry.entry_type,
      body: entry.body,
      createdAt: entry.created_at,
    }));
    setThreads((current) => [{ id: thread.id, createdBy: thread.created_by, title: thread.title, status: thread.status, createdAt: thread.created_at, entries: mappedEntries }, ...current]);
    setThreadTitle("");
    setOpening("");
    setMediation(null);
    setMessage("Confronto aperto nello Spazio per noi.");
  }

  async function addReply(threadId: string) {
    const body = (replyDrafts[threadId] || "").trim();
    if (!body) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("maintenance_entries")
      .insert({ thread_id: threadId, author_id: userId, entry_type: "reply", body })
      .select("id,author_id,entry_type,body,created_at")
      .single();
    setBusy(false);
    if (error || !data) return setMessage(`Risposta non aggiunta: ${error?.message || "errore sconosciuto"}`);
    setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, entries: [...thread.entries, { id: data.id, authorId: data.author_id, authorName: userName, entryType: data.entry_type, body: data.body, createdAt: data.created_at }] } : thread));
    setReplyDrafts((current) => ({ ...current, [threadId]: "" }));
    setMessage("Risposta aggiunta.");
  }

  async function updateThreadStatus(threadId: string, status: MaintenanceThreadView["status"]) {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("maintenance_threads").update({ status }).eq("id", threadId).eq("couple_id", coupleId);
    setBusy(false);
    if (error) return setMessage(`Stato non aggiornato: ${error.message}`);
    setThreads((current) => current.map((thread) => thread.id === threadId ? { ...thread, status } : thread));
  }

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskDraft.title.trim()) return setMessage("Scrivi il compito da dividere.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("family_tasks").insert({
      couple_id: coupleId,
      created_by: userId,
      title: taskDraft.title.trim(),
      area: taskDraft.area,
      assignee_id: taskDraft.shared ? null : taskDraft.assigneeId,
      shared: taskDraft.shared,
      frequency: taskDraft.frequency,
      due_date: taskDraft.dueDate || null,
      status: taskDraft.status,
      notes: taskDraft.notes.trim() || null,
    }).select("id,created_by,title,area,assignee_id,shared,frequency,due_date,status,notes,created_at,updated_at").single();
    setBusy(false);
    if (error || !data) return setMessage(`Compito non aggiunto: ${error?.message || "errore sconosciuto"}`);
    const task: FamilyTask = { id: data.id, createdBy: data.created_by, title: data.title, area: data.area, assigneeId: data.assignee_id || "", shared: data.shared, frequency: data.frequency, dueDate: data.due_date || "", status: data.status, notes: data.notes || "", createdAt: data.created_at, updatedAt: data.updated_at };
    setTasks((current) => [...current, task]);
    setTaskEdits((current) => ({ ...current, [task.id]: { title: task.title, area: task.area, assigneeId: task.assigneeId, shared: task.shared, frequency: task.frequency, dueDate: task.dueDate, status: task.status, notes: task.notes } }));
    setTaskDraft(emptyTask(userId));
    setMessage("Riga aggiunta alla divisione dei compiti.");
  }

  async function saveTask(taskId: string) {
    const draft = taskEdits[taskId];
    if (!draft?.title.trim()) return setMessage("Il compito non può essere vuoto.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("family_tasks").update({
      title: draft.title.trim(), area: draft.area, assignee_id: draft.shared ? null : draft.assigneeId,
      shared: draft.shared, frequency: draft.frequency, due_date: draft.dueDate || null,
      status: draft.status, notes: draft.notes.trim() || null, updated_at: new Date().toISOString(),
    }).eq("id", taskId).eq("couple_id", coupleId).select("title,area,assignee_id,shared,frequency,due_date,status,notes,updated_at").single();
    setBusy(false);
    if (error || !data) return setMessage(`Compito non aggiornato: ${error?.message || "errore sconosciuto"}`);
    setTasks((current) => current.map((task) => task.id === taskId ? { ...task, title: data.title, area: data.area, assigneeId: data.assignee_id || "", shared: data.shared, frequency: data.frequency, dueDate: data.due_date || "", status: data.status, notes: data.notes || "", updatedAt: data.updated_at } : task));
    setMessage("Compito aggiornato.");
  }

  async function deleteTask(taskId: string) {
    if (!window.confirm("Eliminare questa riga dei compiti?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("family_tasks").delete().eq("id", taskId).eq("couple_id", coupleId);
    setBusy(false);
    if (error) return setMessage(`Compito non eliminato: ${error.message}`);
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setMessage("Riga eliminata.");
  }

  function balanceExpense(total: number) {
    const first = Math.round((total / 2) * 100) / 100;
    const second = Math.round((total - first) * 100) / 100;
    return [first, second] as const;
  }

  async function createExpense(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const total = parseMoney(expenseDraft.totalAmount);
    const a = parseMoney(expenseDraft.memberAAmount);
    const b = parseMoney(expenseDraft.memberBAmount);
    if (!expenseDraft.description.trim()) return setMessage("Scrivi la spesa da dividere.");
    if (total <= 0) return setMessage("Il totale deve essere maggiore di zero.");
    if (Math.round((a + b) * 100) !== Math.round(total * 100)) return setMessage("Le due quote devono sommare esattamente al totale.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("family_expenses").insert({
      couple_id: coupleId, created_by: userId, description: expenseDraft.description.trim(), category: expenseDraft.category,
      total_amount: total, paid_by_id: expenseDraft.paidById || null, member_a_id: expenseDraft.memberAId,
      member_b_id: expenseDraft.memberBId, member_a_amount: a, member_b_amount: b,
      due_date: expenseDraft.dueDate || null, status: expenseDraft.status, notes: expenseDraft.notes.trim() || null,
    }).select("id,created_by,description,category,total_amount,paid_by_id,member_a_id,member_b_id,member_a_amount,member_b_amount,due_date,status,notes,created_at,updated_at").single();
    setBusy(false);
    if (error || !data) return setMessage(`Spesa non aggiunta: ${error?.message || "errore sconosciuto"}`);
    const expense: FamilyExpense = { id: data.id, createdBy: data.created_by, description: data.description, category: data.category, totalAmount: Number(data.total_amount), paidById: data.paid_by_id || "", memberAId: data.member_a_id, memberBId: data.member_b_id, memberAAmount: Number(data.member_a_amount), memberBAmount: Number(data.member_b_amount), dueDate: data.due_date || "", status: data.status, notes: data.notes || "", createdAt: data.created_at, updatedAt: data.updated_at };
    setExpenses((current) => [...current, expense]);
    setExpenseEdits((current) => ({ ...current, [expense.id]: { description: expense.description, category: expense.category, totalAmount: expense.totalAmount, paidById: expense.paidById, memberAId: expense.memberAId, memberBId: expense.memberBId, memberAAmount: expense.memberAAmount, memberBAmount: expense.memberBAmount, dueDate: expense.dueDate, status: expense.status, notes: expense.notes } }));
    setExpenseDraft(emptyExpense(memberA, memberB));
    setMessage("Riga aggiunta alla divisione delle spese.");
  }

  async function saveExpense(expenseId: string) {
    const draft = expenseEdits[expenseId];
    if (!draft?.description.trim()) return setMessage("La spesa non può essere vuota.");
    const total = parseMoney(draft.totalAmount);
    const a = parseMoney(draft.memberAAmount);
    const b = parseMoney(draft.memberBAmount);
    if (total <= 0) return setMessage("Il totale deve essere maggiore di zero.");
    if (Math.round((a + b) * 100) !== Math.round(total * 100)) return setMessage("Le quote devono sommare esattamente al totale.");
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase.from("family_expenses").update({
      description: draft.description.trim(), category: draft.category, total_amount: total,
      paid_by_id: draft.paidById || null, member_a_amount: a, member_b_amount: b,
      due_date: draft.dueDate || null, status: draft.status, notes: draft.notes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", expenseId).eq("couple_id", coupleId).select("description,category,total_amount,paid_by_id,member_a_amount,member_b_amount,due_date,status,notes,updated_at").single();
    setBusy(false);
    if (error || !data) return setMessage(`Spesa non aggiornata: ${error?.message || "errore sconosciuto"}`);
    setExpenses((current) => current.map((expense) => expense.id === expenseId ? { ...expense, description: data.description, category: data.category, totalAmount: Number(data.total_amount), paidById: data.paid_by_id || "", memberAAmount: Number(data.member_a_amount), memberBAmount: Number(data.member_b_amount), dueDate: data.due_date || "", status: data.status, notes: data.notes || "", updatedAt: data.updated_at } : expense));
    setMessage("Spesa aggiornata.");
  }

  async function deleteExpense(expenseId: string) {
    if (!window.confirm("Eliminare questa riga delle spese?")) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("family_expenses").delete().eq("id", expenseId).eq("couple_id", coupleId);
    setBusy(false);
    if (error) return setMessage(`Spesa non eliminata: ${error.message}`);
    setExpenses((current) => current.filter((expense) => expense.id !== expenseId));
    setMessage("Riga eliminata.");
  }

  function memberName(id: string) {
    return members.find((member) => member.id === id)?.name || "—";
  }

  function assignmentValue(draft: TaskDraft) {
    return draft.shared ? "both" : draft.assigneeId;
  }

  function setAssignment(draft: TaskDraft, value: string): TaskDraft {
    return value === "both" ? { ...draft, shared: true, assigneeId: "" } : { ...draft, shared: false, assigneeId: value };
  }

  return <div className="maintenance-space-stack">
    <section className="card maintenance-open-hero">
      <p className="eyebrow">Da usare da subito</p>
      <h1>Compiti, soldi e questioni pratiche</h1>
      <p className="journey-lead">Qui tenete insieme le cose concrete: chi fa cosa, quanto state spendendo e i temi che meritano un confronto più calmo.</p>
      <div className="home-summary-block">
        <div className="home-summary-head">
          <div>
            <span className="home-summary-kicker">Riepilogo</span>
            <h2>Situazione di oggi</h2>
          </div>
        </div>

        <div className="maintenance-summary-grid">
          <div className="summary-card">
            <span className="summary-label">Compiti attivi</span>
            <strong>{activeTasks}</strong>
            <span className="summary-caption">ancora da fare</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Spese del mese</span>
            <strong>{euro(monthTotal)}</strong>
            <span className="summary-caption">registrate questo mese</span>
          </div>
          <div className="summary-card">
            <span className="summary-label">Da regolare</span>
            <strong>{euro(plannedExpenses)}</strong>
            <span className="summary-caption">spese ancora aperte</span>
          </div>
        </div>

        <div className="task-balance-section">
          <span className="home-summary-kicker">Divisione dei compiti</span>
          <div className="home-balance-grid">
            <div>
              <strong>{memberA.name}</strong>
              <span>{taskLoad.result.get(memberA.id) || 0} assegnati</span>
            </div>
            <div className="shared-balance-card">
              <strong>Insieme</strong>
              <span>{taskLoad.shared} condivisi</span>
            </div>
            <div>
              <strong>{memberB.name}</strong>
              <span>{taskLoad.result.get(memberB.id) || 0} assegnati</span>
            </div>
          </div>
        </div>

        {Math.abs(netBalance) >= 0.01 ? <div className="balance-note">
          <span className="balance-note-label">Saldo tra voi</span>
          <strong>
            {netBalance > 0
              ? `${memberA.name} deve ${euro(netBalance)} a ${memberB.name}`
              : `${memberB.name} deve ${euro(Math.abs(netBalance))} a ${memberA.name}`}
          </strong>
        </div> : <div className="balance-note balanced">
          <span className="balance-note-label">Saldo tra voi</span>
          <strong>Al momento siete pari</strong>
        </div>}
      </div>
    </section>

    <nav className="maintenance-tabs" aria-label="Strumenti dello Spazio per noi">
      <button className={tab === "mediator" ? "active" : ""} type="button" onClick={() => setTab("mediator")}>Mediatore IA</button>
      <button className={tab === "tasks" ? "active" : ""} type="button" onClick={() => setTab("tasks")}>Divisione compiti</button>
      <button className={tab === "expenses" ? "active" : ""} type="button" onClick={() => setTab("expenses")}>Divisione spese</button>
    </nav>

    {message ? <div className="form-message" aria-live="polite">{message}</div> : null}

    {tab === "mediator" ? <>
      <section className="card maintenance-mediator-card">
        <p className="eyebrow">Preparare il confronto</p><h2>Mediatore di coppia con IA</h2>
        <p className="muted">L’IA non decide chi ha ragione. Trasforma un’apertura difficile in un tema concreto, un vissuto personale e una richiesta comprensibile.</p>
        <div className="field"><label htmlFor="maintenance-title">Titolo del tema</label><input id="maintenance-title" value={threadTitle} maxLength={180} onChange={(event) => setThreadTitle(event.target.value)} placeholder="Es. Organizzazione delle prossime settimane" /></div>
        <div className="field"><label htmlFor="maintenance-opening">Che cosa vuoi affrontare?</label><textarea id="maintenance-opening" value={opening} maxLength={6000} onChange={(event) => { setOpening(event.target.value); setMediation(null); }} placeholder="Scrivi liberamente. Prima di condividere, il mediatore rileggerà il testo." /></div>
        <div className="row-actions"><button className="button" type="button" disabled={busy || !opening.trim()} onClick={() => void mediateOpening()}>{busy ? "Elaboro…" : "Chiedi al mediatore"}</button><button className="button ghost" type="button" disabled={busy || !opening.trim()} onClick={() => void openThread(false)}>Apri senza mediazione</button></div>
        {mediation ? <div className="maintenance-ai-result">
          {mediation.lettura ? <div><span className="mediation-label">Lettura del nodo</span><p>{mediation.lettura}</p></div> : null}
          <div><span className="mediation-label">Apertura proposta</span><p className="maintenance-proposal">{mediation.proposta}</p></div>
          {mediation.nota ? <div className="journey-note">{mediation.nota}</div> : null}
          {mediation.avviso ? <div className="notice">{mediation.avviso}</div> : null}
          <div className="row-actions"><button className="button" type="button" disabled={busy} onClick={() => void openThread(true)}>Apri il confronto con questa proposta</button><button className="button secondary" type="button" onClick={() => { setOpening(mediation.proposta); setMediation(null); }}>Modifica prima</button></div>
        </div> : null}
      </section>

      <section className="card maintenance-threads-card">
        <div className="section-heading-row"><div><p className="eyebrow">Conversazioni protette</p><h2>Temi aperti</h2></div><span className="collection-count">{threads.length}</span></div>
        <div className="maintenance-thread-list">{threads.length ? threads.map((thread) => <article className="maintenance-thread" key={thread.id}>
          <div className="maintenance-thread-head"><div><p className="eyebrow">{dateTime(thread.createdAt)}</p><h3>{thread.title}</h3></div><select value={thread.status} onChange={(event) => void updateThreadStatus(thread.id, event.target.value as MaintenanceThreadView["status"])} disabled={busy}>{(["open","paused","understood","disagree","decided","closed"] as MaintenanceThreadView["status"][]).map((status) => <option value={status} key={status}>{statusLabel(status)}</option>)}</select></div>
          <div className="maintenance-entry-list">{thread.entries.map((entry) => <div className={`maintenance-entry type-${entry.entryType}`} key={entry.id}><div className="maintenance-entry-meta"><strong>{entry.entryType === "summary" ? "Mediatore IA" : entry.authorName}</strong><span>{dateTime(entry.createdAt)}</span></div><p>{entry.body}</p></div>)}</div>
          {thread.status !== "closed" ? <div className="maintenance-reply"><textarea value={replyDrafts[thread.id] || ""} onChange={(event) => setReplyDrafts((current) => ({ ...current, [thread.id]: event.target.value }))} placeholder="Aggiungi la tua risposta…" maxLength={6000} /><button className="button secondary small-button" type="button" disabled={busy || !(replyDrafts[thread.id] || "").trim()} onClick={() => void addReply(thread.id)}>Aggiungi</button></div> : null}
        </article>) : <div className="empty-state">Nessun confronto ancora aperto.</div>}</div>
      </section>
    </> : null}

    {tab === "tasks" ? <section className="card planner-table-card">
      <div className="section-heading-row"><div><p className="eyebrow">Carico visibile</p><h2>Divisione compiti</h2></div><span className="collection-count">{tasks.length}</span></div>
      <p className="muted">Ogni riga è condivisa e modificabile da entrambi. “Insieme” indica una responsabilità realmente comune, non assegnata genericamente all’altro.</p>
      <div className="spreadsheet-wrap"><table className="planner-table"><thead><tr><th>Compito</th><th>Area</th><th>A chi</th><th>Frequenza</th><th>Scadenza</th><th>Stato</th><th>Note</th><th /></tr></thead><tbody>
        {tasks.map((task) => { const draft = taskEdits[task.id] || emptyTask(userId); return <tr key={task.id} className={draft.status === "done" ? "row-done" : ""}><td><input value={draft.title} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, title: event.target.value } }))} /></td><td><select value={draft.area} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, area: event.target.value as TaskDraft["area"] } }))}>{Object.entries(AREA_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><select value={assignmentValue(draft)} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: setAssignment(draft, event.target.value) }))}><option value="both">Insieme</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></td><td><select value={draft.frequency} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, frequency: event.target.value as TaskDraft["frequency"] } }))}>{Object.entries(FREQUENCY_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><input type="date" value={draft.dueDate} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, dueDate: event.target.value } }))} /></td><td><select value={draft.status} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, status: event.target.value as TaskDraft["status"] } }))}>{Object.entries(TASK_STATUS_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><input value={draft.notes} onChange={(event) => setTaskEdits((current) => ({ ...current, [task.id]: { ...draft, notes: event.target.value } }))} /></td><td><div className="table-actions"><button type="button" className="button ghost tiny-button" disabled={busy} onClick={() => void saveTask(task.id)}>Salva</button><button type="button" className="button ghost tiny-button danger-button" disabled={busy} onClick={() => void deleteTask(task.id)}>×</button></div></td></tr>; })}
      </tbody></table></div>
      <form className="planner-add-row" onSubmit={createTask}><input value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Nuovo compito" required /><select value={taskDraft.area} onChange={(event) => setTaskDraft((current) => ({ ...current, area: event.target.value as TaskDraft["area"] }))}>{Object.entries(AREA_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><select value={assignmentValue(taskDraft)} onChange={(event) => setTaskDraft((current) => setAssignment(current, event.target.value))}><option value="both">Insieme</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><select value={taskDraft.frequency} onChange={(event) => setTaskDraft((current) => ({ ...current, frequency: event.target.value as TaskDraft["frequency"] }))}>{Object.entries(FREQUENCY_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><input type="date" value={taskDraft.dueDate} onChange={(event) => setTaskDraft((current) => ({ ...current, dueDate: event.target.value }))} /><input value={taskDraft.notes} onChange={(event) => setTaskDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Nota" /><button className="button small-button" type="submit" disabled={busy}>Aggiungi riga</button></form>
    </section> : null}

    {tab === "expenses" ? <section className="card planner-table-card">
      <div className="section-heading-row"><div><p className="eyebrow">Conti trasparenti</p><h2>Divisione spese</h2></div><span className="collection-count">{expenses.length}</span></div>
      <p className="muted">Il totale deve corrispondere esattamente alla somma delle due quote. Le righe sono modificabili da entrambi.</p>
      <div className="spreadsheet-wrap"><table className="planner-table expense-table"><thead><tr><th>Spesa</th><th>Categoria</th><th>Totale</th><th>Pagata da</th><th>Quota {memberName(memberA.id)}</th><th>Quota {memberName(memberB.id)}</th><th>Scadenza</th><th>Stato</th><th>Note</th><th /></tr></thead><tbody>
        {expenses.map((expense) => { const draft = expenseEdits[expense.id] || emptyExpense(memberA, memberB); return <tr key={expense.id}><td><input value={draft.description} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, description: event.target.value } }))} /></td><td><select value={draft.category} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, category: event.target.value as ExpenseDraft["category"] } }))}>{Object.entries(EXPENSE_CATEGORY_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><input inputMode="decimal" value={draft.totalAmount} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, totalAmount: parseMoney(event.target.value) } }))} /></td><td><select value={draft.paidById} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, paidById: event.target.value } }))}><option value="">Da definire</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select></td><td><input inputMode="decimal" value={draft.memberAAmount} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, memberAAmount: parseMoney(event.target.value) } }))} /></td><td><input inputMode="decimal" value={draft.memberBAmount} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, memberBAmount: parseMoney(event.target.value) } }))} /></td><td><input type="date" value={draft.dueDate} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, dueDate: event.target.value } }))} /></td><td><select value={draft.status} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, status: event.target.value as ExpenseDraft["status"] } }))}>{Object.entries(EXPENSE_STATUS_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select></td><td><input value={draft.notes} onChange={(event) => setExpenseEdits((current) => ({ ...current, [expense.id]: { ...draft, notes: event.target.value } }))} /></td><td><div className="table-actions"><button type="button" className="button ghost tiny-button" disabled={busy} onClick={() => void saveExpense(expense.id)}>Salva</button><button type="button" className="button ghost tiny-button danger-button" disabled={busy} onClick={() => void deleteExpense(expense.id)}>×</button></div></td></tr>; })}
      </tbody></table></div>
      <form className="planner-add-row expense-add-row" onSubmit={createExpense}><input value={expenseDraft.description} onChange={(event) => setExpenseDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Nuova spesa" required /><select value={expenseDraft.category} onChange={(event) => setExpenseDraft((current) => ({ ...current, category: event.target.value as ExpenseDraft["category"] }))}>{Object.entries(EXPENSE_CATEGORY_LABELS).map(([value,label]) => <option value={value} key={value}>{label}</option>)}</select><input inputMode="decimal" value={expenseDraft.totalAmount || ""} placeholder="Totale" onChange={(event) => { const total = parseMoney(event.target.value); const [a,b] = balanceExpense(total); setExpenseDraft((current) => ({ ...current, totalAmount: total, memberAAmount: a, memberBAmount: b })); }} /><select value={expenseDraft.paidById} onChange={(event) => setExpenseDraft((current) => ({ ...current, paidById: event.target.value }))}><option value="">Pagata da…</option>{members.map((member) => <option value={member.id} key={member.id}>{member.name}</option>)}</select><input inputMode="decimal" value={expenseDraft.memberAAmount || ""} placeholder={`Quota ${memberA.name}`} onChange={(event) => setExpenseDraft((current) => ({ ...current, memberAAmount: parseMoney(event.target.value) }))} /><input inputMode="decimal" value={expenseDraft.memberBAmount || ""} placeholder={`Quota ${memberB.name}`} onChange={(event) => setExpenseDraft((current) => ({ ...current, memberBAmount: parseMoney(event.target.value) }))} /><input type="date" value={expenseDraft.dueDate} onChange={(event) => setExpenseDraft((current) => ({ ...current, dueDate: event.target.value }))} /><input value={expenseDraft.notes} onChange={(event) => setExpenseDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Nota" /><button className="button small-button" type="submit" disabled={busy}>Aggiungi riga</button></form>
    </section> : null}
  </div>;
}
