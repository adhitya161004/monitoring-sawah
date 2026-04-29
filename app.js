// ==========================================
// 1. KONFIGURASI MQTT & FIREBASE
// ==========================================
const options = { 
  username: "monitoringsawahbyarnf", 
  password: "Gakkenek1", 
  protocol: "wss" 
};

// Koneksi ke HiveMQ Cloud
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

// Endpoint Firebase
const firebaseREST = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/riwayat_data.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU&orderBy="$key"&limitToLast=2000';
const configURL = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/konfigurasi.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU';

const MAX_DATA_MEMORY = 2000; 
const TAMPILAN_DILAYAR = 30;  

// ==========================================
// 2. FUNGSI PENDUKUNG UI & FORMATTING
// ==========================================

// Konversi detik ke format HH:MM:SS
function formatKeWaktu(totalDetik) {
  if (totalDetik === undefined || totalDetik === null) return "00:00:00";
  const jam = Math.floor(totalDetik / 3600);
  const menit = Math.floor((totalDetik % 3600) / 60);
  const detik = totalDetik % 60;
  return [jam, menit, detik].map(v => v < 10 ? "0" + v : v).join(":");
}

// Update status warna tombol (Hijau = ON/OPEN/AUTO, Merah = OFF/CLOSE/MANUAL)
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
      elOn.className = 'active-on';   
      elOff.className = '';
    } else if (activeBtnId === cfg.off) {
      elOn.className = '';
      elOff.className = 'active-off'; 
    }
  }
}

// Update nilai angka di sebelah slider target
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

const ctxSoil = document.getElementById("soilChart").getContext("2d");
const soilChart = new Chart(ctxSoil, { type: "line", data: { labels: [], datasets: [{ label: "Kelembapan Tanah (%)", data: [], borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

const ctxSawah = document.getElementById("sawahChart").getContext("2d");
const sawahChart = new Chart(ctxSawah, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Sawah (cm)", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

const ctxTambak = document.getElementById("tambakChart").getContext("2d");
const tambakChart = new Chart(ctxTambak, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Tambak (cm)", data: [], borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

function updateChartData(chart, newData, timeStr) {
  chart.data.labels.push(timeStr);
  chart.data.datasets[0].data.push(newData);
  if (chart.data.labels.length > MAX_DATA_MEMORY) { 
    chart.data.labels.shift(); 
    chart.data.datasets[0].data.shift(); 
  }
  let total = chart.data.labels.length;
  chart.options.scales.x.min = total > TAMPILAN_DILAYAR ? total - TAMPILAN_DILAYAR : 0;
  chart.options.scales.x.max = total - 1;
  chart.update();
}

// ==========================================
// 4. LOAD PERSISTENCE DARI FIREBASE (SAAT REFRESH)
// ==========================================
async function ambilDataAwalDariFirebase() {
  try {
    // A. Ambil Konfigurasi Mode & Target
    const resConfig = await fetch(configURL);
    const configData = await resConfig.json();
    if (configData) {
      if (configData.mode) updateButtonUI('mode', configData.mode === "AUTO" ? 'btn-auto' : 'btn-manual');
      if (configData.target) {
        document.getElementById("target-status").innerText = configData.target;
        document.getElementById("settingSlider").value = configData.target;
        document.getElementById("sliderValue").innerText = configData.target;
      }
    }

    // B. Ambil Riwayat Data Sensor & Durasi Harian
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

      // Ambil Baris Data Terakhir untuk Tampilan Dashboard
      const last = records[records.length - 1];
      if (last) {
        // Sensor
        document.getElementById("soil").innerText = (last.soil !== undefined ? last.soil : 0) + " %";
        document.getElementById("sawah").innerText = (last.sawah !== undefined ? last.sawah.toFixed(1) : 0) + " cm";
        document.getElementById("tambak").innerText = (last.tambak !== undefined ? last.tambak.toFixed(1) : 0) + " cm";
        document.getElementById("battery").innerText = (last.voltage !== undefined ? last.voltage.toFixed(1) : 0) + " V";
        
        // Durasi & Counter Harian
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
// 5. KONEKSI & PENANGANAN PESAN MQTT (REAL-TIME)
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
    document.getElementById("target-status").innerText = msg;
    document.getElementById("settingSlider").value = msg;
    document.getElementById("sliderValue").innerText = msg;
  }
  
  if (topic === "sawah/data") {
    try {
      let d = JSON.parse(msg);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      // Update Angka Sensor
      if (d.soil !== undefined) document.getElementById("soil").innerText = d.soil + " %";
      if (d.sawah !== undefined) document.getElementById("sawah").innerText = d.sawah.toFixed(1) + " cm";
      if (d.tambak !== undefined) document.getElementById("tambak").innerText = d.tambak.toFixed(1) + " cm";
      if (d.voltage !== undefined) document.getElementById("battery").innerText = d.voltage.toFixed(1) + " V";

      // Update Status Tombol Manual dari ESP32
      updateButtonUI('p1', d.pompa1 === "ON" ? 'btn-p1-on' : 'btn-p1-off');
      updateButtonUI('p2', d.pompa2 === "ON" ? 'btn-p2-on' : 'btn-p2-off');
      updateButtonUI('akt', d.aktuator === "BUKA" ? 'btn-akt-buka' : 'btn-akt-tutup');

      // Update Durasi Realtime (Data dari MQTT)
      if (d.durP1 !== undefined) document.getElementById("durasi-p1").innerText = formatKeWaktu(d.durP1);
      if (d.durP2 !== undefined) document.getElementById("durasi-p2").innerText = formatKeWaktu(d.durP2);
      if (d.durAkt !== undefined) document.getElementById("durasi-akt").innerText = formatKeWaktu(d.durAkt); 

      // Update Grafik
      if (d.soil !== undefined) updateChartData(soilChart, d.soil, timeNow);
      if (d.sawah !== undefined) updateChartData(sawahChart, d.sawah, timeNow);
      if (d.tambak !== undefined) updateChartData(tambakChart, d.tambak, timeNow);
    } catch (e) {
      console.error("Gagal parse MQTT:", e);
    }
  }
});

// ==========================================
// 6. FUNGSI PENGIRIMAN PERINTAH KE ESP32
// ==========================================
window.setMode = (m) => client.publish("sistem/mode", m);
window.sendManual = (d, s) => client.publish("manual/" + d, s);

window.setSetting = () => {
  const sliderValue = document.getElementById("settingSlider").value;
  client.publish("sistem/setting_tinggi", sliderValue);
  document.getElementById("target-status").innerText = sliderValue;
};

// Jalankan fetch saat halaman pertama kali dibuka
ambilDataAwalDariFirebase();
