const options = { username: "monitoringsawahbyarnf", password: "Gakkenek1", protocol: "wss" };
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

const firebaseREST = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/riwayat_data.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU&orderBy="$key"&limitToLast=2000';
const MAX_DATA_MEMORY = 2000; 
const TAMPILAN_DILAYAR = 30;  

function formatKeWaktu(totalDetik) {
  const jam = Math.floor(totalDetik / 3600);
  const menit = Math.floor((totalDetik % 3600) / 60);
  const detik = totalDetik % 60;
  return [jam, menit, detik].map(v => v < 10 ? "0" + v : v).join(":");
}

function getChartOptions() {
  return { 
    responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, 
    plugins: { 
      legend: { labels: { color: "#e2e8f0", font: { family: "'Poppins', sans-serif" } } },
      zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } }
    }, 
    scales: { 
      y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, 
      x: { grid: { display: false }, ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 45 }, min: 0, max: TAMPILAN_DILAYAR } 
    } 
  };
}

// Inisialisasi Grafik
const ctxSoil = document.getElementById("soilChart").getContext("2d");
const soilChart = new Chart(ctxSoil, { type: "line", data: { labels: [], datasets: [{ label: "Kelembapan Tanah (%)", data: [], borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });
const ctxSawah = document.getElementById("sawahChart").getContext("2d");
const sawahChart = new Chart(ctxSawah, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Sawah (cm)", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });
const ctxTambak = document.getElementById("tambakChart").getContext("2d");
const tambakChart = new Chart(ctxTambak, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Tambak (cm)", data: [], borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

// FUNGSI UTAMA WARNA TOMBOL
function updateButtonUI(groupId, activeBtnId) {
  const config = {
    'mode': { on: 'btn-auto', off: 'btn-manual' },
    'p1': { on: 'btn-p1-on', off: 'btn-p1-off' },
    'p2': { on: 'btn-p2-on', off: 'btn-p2-off' },
    'akt': { on: 'btn-akt-buka', off: 'btn-akt-tutup' }
  };

  const cfg = config[groupId];
  if(!cfg) return;

  const elOn = document.getElementById(cfg.on);
  const elOff = document.getElementById(cfg.off);

  if(elOn && elOff) {
    if(activeBtnId === cfg.on) {
      elOn.className = 'active-on';  // Menjadi Hijau
      elOff.className = '';
    } else if(activeBtnId === cfg.off) {
      elOn.className = '';
      elOff.className = 'active-off'; // Menjadi Merah
    }
  }
}

function updateChartData(chart, newData, timeStr) {
  chart.data.labels.push(timeStr);
  chart.data.datasets[0].data.push(newData);
  if (chart.data.labels.length > MAX_DATA_MEMORY) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  let total = chart.data.labels.length;
  chart.options.scales.x.min = total > TAMPILAN_DILAYAR ? total - TAMPILAN_DILAYAR : 0;
  chart.options.scales.x.max = total - 1;
  chart.update();
}

async function ambilDataAwalDariFirebase() {
  try {
    const response = await fetch(firebaseREST);
    const data = await response.json();
    if (data) {
      const records = Object.values(data);
      records.forEach(row => {
        let timeOnly = row.waktu ? row.waktu.split(" ")[1] : "";
        if (row.soil !== undefined) { soilChart.data.labels.push(timeOnly); soilChart.data.datasets[0].data.push(row.soil); }
        if (row.sawah !== undefined) { sawahChart.data.labels.push(timeOnly); sawahChart.data.datasets[0].data.push(row.sawah); }
        if (row.tambak !== undefined) { tambakChart.data.labels.push(timeOnly); tambakChart.data.datasets[0].data.push(row.tambak); }
      });
      [soilChart, sawahChart, tambakChart].forEach(ch => ch.update());
      const last = records[records.length - 1];
      if (last) {
        document.getElementById("soil").innerText = last.soil + " %";
        document.getElementById("sawah").innerText = last.sawah.toFixed(1) + " cm";
        document.getElementById("tambak").innerText = last.tambak.toFixed(1) + " cm";
        document.getElementById("battery").innerText = last.voltage.toFixed(1) + " V";
      }
    }
  } catch(err) { console.error("Firebase Gagal:", err); }
}

client.on("connect", () => {
  document.getElementById("conn-status").className = "status-badge"; 
  document.getElementById("status-text").innerText = "TERHUBUNG";
  client.subscribe("sawah/data"); client.subscribe("sistem/mode"); client.subscribe("sistem/setting_tinggi");
});

client.on("message", (topic, message) => {
  let msg = message.toString();
  if (topic === "sistem/mode") {
    updateButtonUI('mode', msg === "AUTO" ? 'btn-auto' : 'btn-manual');
  }
  if (topic === "sawah/data") {
    try {
      let d = JSON.parse(msg);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      document.getElementById("soil").innerText = d.soil + " %";
      document.getElementById("sawah").innerText = d.sawah.toFixed(1) + " cm";
      document.getElementById("tambak").innerText = d.tambak.toFixed(1) + " cm";
      document.getElementById("battery").innerText = d.voltage.toFixed(1) + " V";

      updateButtonUI('p1', d.pompa1 === "ON" ? 'btn-p1-on' : 'btn-p1-off');
      updateButtonUI('p2', d.pompa2 === "ON" ? 'btn-p2-on' : 'btn-p2-off');
      updateButtonUI('akt', (d.aktuator === "BUKA" || d.aktuator === "OPEN") ? 'btn-akt-buka' : 'btn-akt-tutup');

      document.getElementById("durasi-p1").innerText = formatKeWaktu(d.durP1 || 0);
      document.getElementById("durasi-p2").innerText = formatKeWaktu(d.durP2 || 0);
      document.getElementById("durasi-akt").innerText = formatKeWaktu(d.durAkt || 0);

      updateChartData(soilChart, d.soil, timeNow);
      updateChartData(sawahChart, d.sawah, timeNow);
      updateChartData(tambakChart, d.tambak, timeNow);
    } catch (e) { console.log("JSON Error"); }
  }
});

window.setMode = (m) => client.publish("sistem/mode", m);
window.sendManual = (d, s) => client.publish("manual/" + d, s);
window.updateSliderValue = (v) => { document.getElementById("sliderValue").innerText = v; };
window.setSetting = () => client.publish("sistem/setting_tinggi", document.getElementById("settingSlider").value);

ambilDataAwalDariFirebase();
