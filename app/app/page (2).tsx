import {
  MaintenanceSpace,
  type CoupleMember,
  type FamilyExpense,
  type FamilyTask,
  type MaintenanceEntryView,
  type MaintenanceThreadView,
} from "@/components/maintenance-space";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

type ThreadRow = {
  id: string; created_by: string; title: string;
  status: MaintenanceThreadView["status"]; created_at: string;
};
type EntryRow = {
  id: string; thread_id: string; author_id: string;
  entry_type: MaintenanceEntryView["entryType"]; body: string; created_at: string;
};
type TaskRow = {
  id: string; created_by: string; title: string; area: FamilyTask["area"];
  assignee_id: string | null; shared: boolean; frequency: FamilyTask["frequency"];
  due_date: string | null; status: FamilyTask["status"]; notes: string | null;
  created_at: string; updated_at: string;
};
type ExpenseRow = {
  id: string; created_by: string; description: string; category: FamilyExpense["category"];
  total_amount: number | string; paid_by_id: string | null; member_a_id: string;
  member_b_id: string; member_a_amount: number | string; member_b_amount: number | string;
  due_date: string | null; status: FamilyExpense["status"]; notes: string | null;
  created_at: string; updated_at: string;
};

export default async function HomeAppPage() {
  const workspace = await requireWorkspace();
  const supabase = await createClient();

  const [membersResult, threadsResult, entriesResult, tasksResult, expensesResult] = await Promise.all([
    supabase.from("couple_members").select("user_id").eq("couple_id", workspace.couple.id),
    supabase.from("maintenance_threads").select("id,created_by,title,status,created_at").eq("couple_id", workspace.couple.id).order("created_at", { ascending: false }),
    supabase.from("maintenance_entries").select("id,thread_id,author_id,entry_type,body,created_at").order("created_at", { ascending: true }),
    supabase.from("family_tasks").select("id,created_by,title,area,assignee_id,shared,frequency,due_date,status,notes,created_at,updated_at").eq("couple_id", workspace.couple.id).order("status", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("family_expenses").select("id,created_by,description,category,total_amount,paid_by_id,member_a_id,member_b_id,member_a_amount,member_b_amount,due_date,status,notes,created_at,updated_at").eq("couple_id", workspace.couple.id).order("status", { ascending: true }).order("due_date", { ascending: true, nullsFirst: false }),
  ]);

  for (const [label, result] of [
    ["Partecipanti", membersResult], ["Confronti", threadsResult], ["Conversazioni", entriesResult],
    ["Compiti", tasksResult], ["Spese", expensesResult],
  ] as const) {
    if (result.error) throw new Error(`${label} non disponibili: ${result.error.message}`);
  }

  const memberIds = (membersResult.data || []).map((row: { user_id: string }) => row.user_id);
  const profilesResult = memberIds.length
    ? await supabase.from("profiles").select("id,display_name").in("id", memberIds)
    : { data: [], error: null };

  if (profilesResult.error) throw new Error(`Profili non disponibili: ${profilesResult.error.message}`);

  const members: CoupleMember[] = (profilesResult.data || [])
    .map((profile: { id: string; display_name: string }) => ({ id: profile.id, name: profile.display_name }))
    .sort((a: CoupleMember, b: CoupleMember) => a.name.localeCompare(b.name, "it"));

  const names = new Map(members.map((member) => [member.id, member.name]));
  const entriesByThread = new Map<string, MaintenanceEntryView[]>();

  for (const row of (entriesResult.data || []) as EntryRow[]) {
    const entry: MaintenanceEntryView = {
      id: row.id,
      authorId: row.author_id,
      authorName: row.entry_type === "summary" ? "Mediatore IA" : names.get(row.author_id) || "Noi",
      entryType: row.entry_type,
      body: row.body,
      createdAt: row.created_at,
    };
    entriesByThread.set(row.thread_id, [...(entriesByThread.get(row.thread_id) || []), entry]);
  }

  const threads: MaintenanceThreadView[] = ((threadsResult.data || []) as ThreadRow[]).map((row) => ({
    id: row.id, createdBy: row.created_by, title: row.title,
    status: row.status, createdAt: row.created_at, entries: entriesByThread.get(row.id) || [],
  }));

  const tasks: FamilyTask[] = ((tasksResult.data || []) as TaskRow[]).map((row) => ({
    id: row.id, createdBy: row.created_by, title: row.title, area: row.area,
    assigneeId: row.assignee_id || "", shared: row.shared, frequency: row.frequency,
    dueDate: row.due_date || "", status: row.status, notes: row.notes || "",
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));

  const expenses: FamilyExpense[] = ((expensesResult.data || []) as ExpenseRow[]).map((row) => ({
    id: row.id, createdBy: row.created_by, description: row.description, category: row.category,
    totalAmount: Number(row.total_amount), paidById: row.paid_by_id || "",
    memberAId: row.member_a_id, memberBId: row.member_b_id,
    memberAAmount: Number(row.member_a_amount), memberBAmount: Number(row.member_b_amount),
    dueDate: row.due_date || "", status: row.status, notes: row.notes || "",
    createdAt: row.created_at, updatedAt: row.updated_at,
  }));

  return (
    <div className="container wide-container standalone-content">
      <MaintenanceSpace
        coupleId={workspace.couple.id}
        userId={workspace.user.id}
        userName={workspace.user.displayName}
        members={members}
        initialThreads={threads}
        initialTasks={tasks}
        initialExpenses={expenses}
      />
    </div>
  );
}
