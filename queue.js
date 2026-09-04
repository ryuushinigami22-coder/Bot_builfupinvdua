// queue.js - Job queue management

const jobs = new Map(); // userId -> job

function getUserJob(userId) {
  return jobs.get(Number(userId)) || null;
}

function setUserJob(userId, data) {
  jobs.set(Number(userId), { ...data, userId: Number(userId), updatedAt: Date.now() });
}

function removeUserJob(userId) {
  jobs.delete(Number(userId));
}

function isUserBuilding(userId) {
  return jobs.has(Number(userId));
}

function getActiveJobs() {
  return Array.from(jobs.values());
}

function getQueueStats() {
  const all = getActiveJobs();
  
  // Mengelompokkan semua status waiting baik dari alur Build biasa maupun Web to APK
  const waitingStatuses = ["waiting_zip", "waiting_url", "waiting_appname", "waiting_icon", "waiting_zip_rename_api", "waiting_old_text", "waiting_new_text"];

  return {
    waiting: all.filter((j) => waitingStatuses.includes(j.status)).length,
    uploading: all.filter((j) => j.status === "uploading").length,
    building: all.filter((j) => j.status === "building").length,
    total: all.length,
  };
}

function cleanupStaleJobs() {
  const now = Date.now();
  const staleTimeout = 30 * 60 * 1000; // 30 menit
  
  for (const [userId, job] of jobs) {
    if (now - job.updatedAt > staleTimeout) {
      jobs.delete(userId);
      console.log(`🧹 Cleanup stale job for user ${userId}`);
    }
  }
}

// Jalankan cleanup setiap 5 menit
setInterval(cleanupStaleJobs, 5 * 60 * 1000);

module.exports = {
  getUserJob,
  setUserJob,
  removeUserJob,
  isUserBuilding,
  getActiveJobs,
  getQueueStats,
  cleanupStaleJobs,
};