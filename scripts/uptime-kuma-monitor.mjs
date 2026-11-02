import https from "node:https";

const MONITORS = [
  {
    name: "Production Storefront",
    url: "https://delish-bakes-order.aboodterawi3.workers.dev/",
    expectedKeyword: "delish",
  },
  {
    name: "Staff Authentication Portal",
    url: "https://delish-bakes-order.aboodterawi3.workers.dev/auth",
    expectedKeyword: "delish",
  },
  {
    name: "Supabase GoTrue Auth & Health API",
    url: "https://dmvwdkxcltnomigoqtue.supabase.co/auth/v1/health?apikey=sb_publishable_4o-FrhbFZSg-sCqYdA9s6g_qBDFmxNj",
    expectedKeyword: "GoTrue",
  },
];

function checkEndpoint(monitor) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = https.get(monitor.url, { timeout: 8000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const duration = Math.round(performance.now() - start);
        const statusOk = res.statusCode >= 200 && res.statusCode < 400;
        const keywordOk = monitor.expectedKeyword
          ? data.toLowerCase().includes(monitor.expectedKeyword.toLowerCase())
          : true;

        resolve({
          name: monitor.name,
          url: monitor.url,
          status: res.statusCode,
          duration,
          up: statusOk && keywordOk,
          keywordMatched: keywordOk,
        });
      });
    });

    req.on("error", (err) => {
      resolve({
        name: monitor.name,
        url: monitor.url,
        status: 0,
        duration: Math.round(performance.now() - start),
        up: false,
        error: err.message,
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({
        name: monitor.name,
        url: monitor.url,
        status: 408,
        duration: Math.round(performance.now() - start),
        up: false,
        error: "Connection Timed Out",
      });
    });
  });
}

async function runSyntheticUptimeAudit() {
  console.log("================================================================================");
  console.log("🐻 UPTIME KUMA SYNTHETIC HEALTH AUDIT — DELISH CAKE & BAKE");
  console.log("================================================================================");

  let allUp = true;
  for (const monitor of MONITORS) {
    const res = await checkEndpoint(monitor);
    const badge = res.up ? "🟢 UP" : "🔴 DOWN";
    console.log(`${badge} | [HTTP ${res.status}] ${monitor.name.padEnd(35)} | Latency: ${res.duration}ms`);
    if (!res.up) allUp = false;
  }

  console.log("================================================================================");
  if (allUp) {
    console.log("🏆 OVERALL STATUS: ALL SERVICES OPERATIONAL (100% Uptime Healthy)");
  } else {
    console.error("⚠️ OVERALL STATUS: DEGRADED PERFORMANCE DETECTED");
  }
  console.log("================================================================================");
}

runSyntheticUptimeAudit();
