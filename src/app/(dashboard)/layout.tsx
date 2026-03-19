import { Sidebar } from "@/components/layout/Sidebar";
import { TaskBadge } from "@/components/layout/TaskBadge";
import { TaskProvider } from "@/contexts/TaskContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TaskProvider>
      <div className="flex h-screen overflow-hidden bg-background flex-col">
        {/* Global top bar with task badge */}
        <div className="h-9 border-b border-border bg-white flex items-center justify-end px-4 shrink-0">
          <TaskBadge />
        </div>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </TaskProvider>
  );
}
