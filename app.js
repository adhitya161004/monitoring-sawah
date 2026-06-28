// ==========================================
// 1. KONFIGURASI MQTT & FIREBASE
// ==========================================
const options = { 
  username: "monitoringsawahbyarnf", 
  password: "Gakkenek1", 
  protocol: "wss" 
};

const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);
const firebaseREST = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/riwayat_data.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU&orderBy="$key"&limitToLast=2000';
const configURL = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/konfigurasi.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU';

const MAX_DATA_MEMORY = 2000; 
const TAMPILAN_DILAYAR = 30;  

// ==========================================
// FITUR INSTAN MEMORI BROWSER (LOCAL STORAGE)
// ==========================================
// Memastikan posisi Slider dan Angka langsung sinkron saat web dibuka
document.addEventListener("DOMContentLoaded", () => {
  let localTarget = localStorage.getItem("targetSawahTerakhir");
  if(localTarget) {
    document.getElementById("settingSlider").value = localTarget; // Menggeser bulatan slider
    document.getElementById("sliderValue").innerText = localTarget; // Mengubah angka besar
    document.getElementById("target-status").innerText = localTarget; // Mengubah angka kecil
    targetSawahAktif = parseFloat(localTarget);
  }
});

// ==========================================
// 2. FUNGSI PENDUKUNG UI & FORMATTING
// ==========================================
function formatKeWaktu(totalDetik) {
  if (totalDetik === undefined || totalDetik === null) return "00:00:00";
  const jam = Math.floor(totalDetik / 3600);
  const menit = Math.floor((totalDetik % 3600) / 60);
  const detik = totalDetik % 60;
  return [jam, menit, detik].map(v => v < 10 ? "0" + v : v).join(":");
}

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
    if(activeBtnId === cfg.on) { elOn.className = 'active-on'; elOff.className = ''; } 
    else if (activeBtnId === cfg.off) { elOn.className = ''; elOff.className = 'active-off'; }
  }
}

window.updateSliderValue = function(val) {
  const sliderVal = document.getElementById("sliderValue");
  if(sliderVal) sliderVal.innerText = val;
};

// ==========================================
// 3. INISIALISASI GRAFIK (CHART.JS)
// ==========================================
function getChartOptions() {
  return { 
    responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, 
    plugins: { legend: { labels: { color: "#e2e8f0", font: { family: "'Poppins', sans-serif" } } }, zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' } } }, 
    scales: { y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, x: { grid: { display: false }, ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 45 }, min: 0, max: TAMPILAN_DILAYAR } } 
  };
}

const ctxSoil = document.getElementById("soilChart").getContext("2d");
const soilChart = new Chart(ctxSoil, { type: "line", data: { labels: [], datasets: [{ label: "Kelembapan Tanah (%)", data: [], borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });
const ctxSawah = document.getElementById("sawahChart").getContext("2d");
const sawahChart = new Chart(ctxSawah, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Sawah (cm)", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });
const ctxTambak = document.getElementById("tambakChart").getContext("2d");
const tambakChart = new Chart(ctxTambak, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Tandon (cm)", data: [], borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

function updateChartData(chart, newData, timeStr) {
  chart.data.labels.push(timeStr);
  chart.data.datasets[0].data.push(newData);
  if (chart.data.labels.length > MAX_DATA_MEMORY) { chart.data.labels.shift(); chart.data.datasets[0].data.shift(); }
  let total = chart.data.labels.length;
  chart.options.scales.x.min = total > TAMPILAN_DILAYAR ? total - TAMPILAN_DILAYAR : 0;
  chart.options.scales.x.max = total - 1;
  chart.update();
}

// ==========================================
// 4. LOAD PERSISTENCE DARI FIREBASE
// ==========================================
async function ambilDataAwalDariFirebase() {
  try {
    // A. Ambil Konfigurasi dari server
    const resConfig = await fetch(configURL);
    const configData = await resConfig.json();
    if (configData) {
      if (configData.mode) updateButtonUI('mode', configData.mode === "AUTO" ? 'btn-auto' : 'btn-manual');
      if (configData.target) {
        targetSawahAktif = parseFloat(configData.target);
        document.getElementById("target-status").innerText = configData.target;
        document.getElementById("settingSlider").value = configData.target; // Sinkronisasi posisi slider dari server
        document.getElementById("sliderValue").innerText = configData.target;
        localStorage.setItem("targetSawahTerakhir", configData.target);
      }
    }

    // B. Ambil Riwayat Data
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
        document.getElementById("soil").innerText = (last.soil !== undefined ? last.soil : 0) + " %";
        document.getElementById("sawah").innerText = (last.sawah !== undefined ? last.sawah.toFixed(1) : 0) + " cm";
        document.getElementById("tambak").innerText = (last.tambak !== undefined ? last.tambak.toFixed(1) : 0) + " cm";
        document.getElementById("battery").innerText = (last.voltage !== undefined ? last.voltage.toFixed(1) : 0) + " V";
        
        if (last.durP1 !== undefined) document.getElementById("durasi-p1").innerText = formatKeWaktu(last.durP1);
        if (last.durP2 !== undefined) document.getElementById("durasi-p2").innerText = formatKeWaktu(last.durP2);
        if (last.durAktBuka !== undefined) document.getElementById("durasi-akt").innerText = formatKeWaktu(last.durAktBuka);
        if (last.cntBuka !== undefined) document.getElementById("cnt-buka").innerText = last.cntBuka + " Kali";
        if (last.cntTutup !== undefined) document.getElementById("cnt-tutup").innerText = last.cntTutup + " Kali";
      }
    }
  } catch(err) { console.error("Error Persistence:", err); }
}

// ==========================================
// 4B. SISTEM NOTIFIKASI THRESHOLD
// ==========================================
// Nilai ini sengaja disamakan dengan threshold safety di kode ESP32 (MIN_AIR_TAMBAK, MAX_AIR_TAMBAK, MIN_AIR_SAWAH)
const MIN_AIR_TAMBAK = 20.0;
const MAX_AIR_TAMBAK = 125.0;
const MIN_AIR_SAWAH  = 2.0;
let targetSawahAktif = 14.0; // otomatis disinkronkan dari slider/konfigurasi Firebase/MQTT

let statusTerakhir = {
  sawahKondisi: null,   // "sesuai" | "kurang" | "lebih"
  tambakKondisi: null,  // "rendah" | "penuh" | "normal"
  soilKondisi: null     // "kering" | "cukup"
};

function showToast(title, message, type = "warning", icon = "fa-triangle-exclamation") {
  const container = document.getElementById("notif-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <div class="toast-text"><strong>${title}</strong>${message}</div>
  `;
  container.appendChild(toast);

  // Auto hilang setelah 6 detik
  setTimeout(() => {
    toast.style.animation = "fadeOut 0.4s ease-in forwards";
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

function cekNotifikasiThreshold(d) {
  if (d.sawah === undefined || d.tambak === undefined || d.soil === undefined) return;

  const ambangBawah = Math.max(0, targetSawahAktif - 3.0);
  const ambangAtas = targetSawahAktif + 3.0;

  // --- CEK KETINGGIAN SAWAH vs TARGET ---
  let sawahKondisi;
  if (d.sawah < ambangBawah) sawahKondisi = "kurang";
  else if (d.sawah > ambangAtas) sawahKondisi = "lebih";
  else sawahKondisi = "sesuai";

  if (sawahKondisi !== statusTerakhir.sawahKondisi) {
    if (sawahKondisi === "sesuai") {
      showToast("Ketinggian Sawah Sesuai", `Air sawah ${d.sawah.toFixed(1)} cm sudah sesuai target (${targetSawahAktif} cm).`, "success", "fa-circle-check");
    } else if (sawahKondisi === "kurang") {
      showToast("Air Sawah Kurang", `Tinggi air ${d.sawah.toFixed(1)} cm di bawah ambang (${ambangBawah.toFixed(1)} cm). Pompa 1 akan aktif.`, "warning", "fa-droplet-slash");
    } else if (sawahKondisi === "lebih") {
      showToast("Air Sawah Berlebih", `Tinggi air ${d.sawah.toFixed(1)} cm melebihi ambang (${ambangAtas.toFixed(1)} cm). Air dialirkan ke tandon.`, "warning", "fa-water");
    }
    statusTerakhir.sawahKondisi = sawahKondisi;
  }

  // --- CEK KETINGGIAN TAMBAK ---
  let tambakKondisi;
  if (d.tambak <= MIN_AIR_TAMBAK) tambakKondisi = "rendah";
  else if (d.tambak >= MAX_AIR_TAMBAK) tambakKondisi = "penuh";
  else tambakKondisi = "normal";

  if (tambakKondisi !== statusTerakhir.tambakKondisi) {
    if (tambakKondisi === "rendah") {
      showToast("Air Tandon Rendah", `Ketinggian tandon ${d.tambak.toFixed(1)} cm di bawah batas minimum (${MIN_AIR_TAMBAK} cm). Pompa 1 dinonaktifkan (safety interlock).`, "danger", "fa-circle-exclamation");
    } else if (tambakKondisi === "penuh") {
      showToast("Tandon Penuh", `Ketinggian tandon ${d.tambak.toFixed(1)} cm mencapai batas maksimum (${MAX_AIR_TAMBAK} cm). Saluran pembuangan dibuka.`, "warning", "fa-door-open");
    } else if (statusTerakhir.tambakKondisi !== null) {
      showToast("Tandon Normal", `Ketinggian tandon ${d.tambak.toFixed(1)} cm kembali pada kondisi normal.`, "success", "fa-circle-check");
    }
    statusTerakhir.tambakKondisi = tambakKondisi;
  }

  // --- CEK KELEMBABAN TANAH ---
  let soilKondisi = d.soil < 80 ? "kering" : "cukup";
  if (soilKondisi !== statusTerakhir.soilKondisi) {
    if (soilKondisi === "kering") {
      showToast("Tanah Belum Lembab", `Kelembaban tanah ${d.soil}% di bawah ambang 80%. Pompa irigasi aktif.`, "warning", "fa-seedling");
    } else {
      showToast("Kelembaban Tanah Cukup", `Kelembaban tanah ${d.soil}% sudah memenuhi ambang kebutuhan.`, "success", "fa-circle-check");
    }
    statusTerakhir.soilKondisi = soilKondisi;
  }
}

// ==========================================
// 5. KONEKSI & PENANGANAN PESAN MQTT
// ==========================================
client.on("connect", () => {
  document.getElementById("conn-status").className = "status-badge";
  document.getElementById("status-text").innerText = "TERHUBUNG";
  client.subscribe("sawah/data"); 
  client.subscribe("sistem/mode"); 
  client.subscribe("sistem/setting_tinggi");
});

client.on("error", () => {
  document.getElementById("conn-status").className = "status-badge offline";
  document.getElementById("status-text").innerText = "KONEKSI TERPUTUS";
});

client.on("message", (topic, message) => {
  let msg = message.toString();
  
  if (topic === "sistem/mode") updateButtonUI('mode', msg === "AUTO" ? 'btn-auto' : 'btn-manual');
  
  if (topic === "sistem/setting_tinggi") {
    targetSawahAktif = parseFloat(msg);
    document.getElementById("target-status").innerText = msg;
    document.getElementById("settingSlider").value = msg; // Sinkronisasi posisi slider via MQTT
    document.getElementById("sliderValue").innerText = msg;
    localStorage.setItem("targetSawahTerakhir", msg);
  }
  
  if (topic === "sawah/data") {
    try {
      let d = JSON.parse(msg);
      cekNotifikasiThreshold(d);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (d.soil !== undefined) document.getElementById("soil").innerText = d.soil + " %";
      if (d.sawah !== undefined) document.getElementById("sawah").innerText = d.sawah.toFixed(1) + " cm";
      if (d.tambak !== undefined) document.getElementById("tambak").innerText = d.tambak.toFixed(1) + " cm";
      if (d.voltage !== undefined) document.getElementById("battery").innerText = d.voltage.toFixed(1) + " V";

      updateButtonUI('p1', d.pompa1 === "ON" ? 'btn-p1-on' : 'btn-p1-off');
      updateButtonUI('p2', d.pompa2 === "ON" ? 'btn-p2-on' : 'btn-p2-off');
      updateButtonUI('akt', d.aktuator === "BUKA" ? 'btn-akt-buka' : 'btn-akt-tutup');

      if (d.durP1 !== undefined) document.getElementById("durasi-p1").innerText = formatKeWaktu(d.durP1);
      if (d.durP2 !== undefined) document.getElementById("durasi-p2").innerText = formatKeWaktu(d.durP2);
      if (d.durAkt !== undefined) document.getElementById("durasi-akt").innerText = formatKeWaktu(d.durAkt); 

      if (d.soil !== undefined) updateChartData(soilChart, d.soil, timeNow);
      if (d.sawah !== undefined) updateChartData(sawahChart, d.sawah, timeNow);
      if (d.tambak !== undefined) updateChartData(tambakChart, d.tambak, timeNow);
    } catch (e) {}
  }
});

// ==========================================
// 6. FUNGSI PENGIRIMAN PERINTAH KE ESP32
// ==========================================
window.setMode = (m) => client.publish("sistem/mode", m);
window.sendManual = (d, s) => client.publish("manual/" + d, s);

window.setSetting = () => {
  const sliderValue = document.getElementById("settingSlider").value;
  targetSawahAktif = parseFloat(sliderValue);
  client.publish("sistem/setting_tinggi", sliderValue);
  
  // Tampilkan Instan di Layar
  document.getElementById("target-status").innerText = sliderValue;
  document.getElementById("settingSlider").value = sliderValue; // Pastikan posisi terkunci
  
  // Simpan secara permanen ke memori lokal
  localStorage.setItem("targetSawahTerakhir", sliderValue);
};

ambilDataAwalDariFirebase();
