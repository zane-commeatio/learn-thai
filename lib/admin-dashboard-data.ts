import { listClips } from "../src/admin/services/list-clips";
import { listRunningJobs } from "../src/admin/services/list-running-jobs";
import { getDb } from "./db";

export async function loadDashboardData() {
  const db = getDb();

  const [{ clips }, { jobs: runningJobs }] = await Promise.all([
    listClips({ db }),
    listRunningJobs({ db }),
  ]);

  return {
    clips,
    runningJobs,
  };
}
