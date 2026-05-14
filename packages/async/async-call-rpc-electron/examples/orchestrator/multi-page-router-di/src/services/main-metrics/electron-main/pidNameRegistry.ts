// Two parallel registries:
//   - processes: legacy API for callers that still hand us a UtilityProcess
//                (auto-cleans when pid becomes null on exit).
//   - byPid:     used by UtilityProcessSupervisor — it owns the live child
//                and only surfaces `pid` via callbacks. Older entries for
//                the same supervisor get overwritten on restart by passing
//                the same name; truly stale pids accumulate but this is a
//                metrics-tab example, not a long-running service.
const processes = new Map<Electron.UtilityProcess, string>();
const byPid = new Map<number, string>();

export const pidNameRegistry = {
  register(proc: Electron.UtilityProcess, name: string): void {
    processes.set(proc, name);
  },
  registerByPid(pid: number, name: string): void {
    byPid.set(pid, name);
  },
  unregisterPid(pid: number): void {
    byPid.delete(pid);
  },
  getAll(): Array<{ pid: number; name: string }> {
    const result: Array<{ pid: number; name: string }> = [];
    for (const [proc, name] of processes) {
      if (proc.pid != null) {
        result.push({ pid: proc.pid, name });
      }
    }
    for (const [pid, name] of byPid) {
      result.push({ pid, name });
    }
    return result;
  },
};
