// ==========================================
// KONFIGURASI MQTT & FIREBASE
// ==========================================
const options = { 
  username: "monitoringsawahbyarnf", 
  password: "Gakkenek1", 
  protocol: "wss" 
};
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

const firebaseREST = 'https://my-monitoringsawaharnf-default-rtdb.asia-southeast1.firebasedatabase.app/riwayat_data.json?auth=qvhTBUaXXmJpfFKgd8HMrgwIEwR5uK43QMC3k7FU&orderBy="$key"&limitToLast=2000';
const MAX_DATA_MEMORY = 2000; 
const TAMPILAN_DILAYAR = 30;  

// ==========================================
// FUNGSI PENDUKUNG (WAKTU & UI)
// ==========================================
function formatKeWaktu(totalDetik) {
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
    if(activeBtnId === cfg.on) {
      elOn.className = 'active-on';   // Warna Hijau
      elOff.className = '';
    } else if (activeBtnId === cfg.off) {
      elOn.className = '';
      elOff.className = 'active-off'; // Warna Merah
    } else {
      elOn.className = '';
      elOff.className = '';
    }
  }
}

window.updateSliderValue = function(val) {
  const sliderVal = document.getElementById("sliderValue");
  if(sliderVal) sliderVal.innerText = val;
};

// ==========================================
// INISIALISASI & KONFIGURASI GRAFIK (CHART.JS)
// ==========================================
function getChartOptions() {
  return { 
    responsive: true, 
    maintainAspectRatio: false, 
    animation: { duration: 0 }, 
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
// PENGAMBILAN DATA AWAL DARI FIREBASE
// ==========================================
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

      let total = soilChart.data.labels.length;
      let minView = total > TAMPILAN_DILAYAR ? total - TAMPILAN_DILAYAR : 0;
      let maxView = total - 1;

      [soilChart, sawahChart, tambakChart].forEach(ch => { 
        ch.options.scales.x.min = minView; 
        ch.options.scales.x.max = maxView; 
        ch.update(); 
      });

      const lastRecord = records[records.length - 1];
      if (lastRecord) {
        if (lastRecord.soil !== undefined) document.getElementById("soil").innerText = lastRecord.soil + " %";
        if (lastRecord.sawah !== undefined) document.getElementById("sawah").innerText = lastRecord.sawah.toFixed(1) + " cm";
        if (lastRecord.tambak !== undefined) document.getElementById("tambak").innerText = lastRecord.tambak.toFixed(1) + " cm";
        if (lastRecord.voltage !== undefined) document.getElementById("battery").innerText = lastRecord.voltage.toFixed(1) + " V";
      }
    }
  } catch(err) { 
    console.error("Gagal load history Firebase:", err); 
  }
}

ambilDataAwalDariFirebase();

// ==========================================
// KONEKSI & PENANGANAN PESAN MQTT
// ==========================================
client.on("connect", function () {
  const badge = document.getElementById("conn-status"); 
  if(badge) badge.className = "status-badge"; 
  
  const statusTxt = document.getElementById("status-text"); 
  if(statusTxt) statusTxt.innerText = "TERHUBUNG";
  
  client.subscribe("sawah/data"); 
  client.subscribe("sistem/mode"); 
  client.subscribe("sistem/setting_tinggi");
});

client.on("error", function () {
  const badge = document.getElementById("conn-status"); 
  if(badge) badge.className = "status-badge offline";
  
  const statusTxt = document.getElementById("status-text"); 
  if(statusTxt) statusTxt.innerText = "KONEKSI TERPUTUS";
});

client.on("message", function (topic, message) {
  let rawValue = message.toString();
  
  if (topic === "sistem/mode") {
    if(rawValue === "AUTO") updateButtonUI('mode', 'btn-auto'); 
    else updateButtonUI('mode', 'btn-manual');
  }
  
  if (topic === "sistem/setting_tinggi") {
    const targetStatus = document.getElementById("target-status"); 
    if(targetStatus) targetStatus.innerText = rawValue;
    
    const settingSlider = document.getElementById("settingSlider"); 
    if(settingSlider) settingSlider.value = rawValue;
    
    updateSliderValue(rawValue);
  }

  if (topic === "sawah/data") {
    try {
      let data = JSON.parse(rawValue);
      const timeNow = new Date().toLocaleTimeString('id-ID', { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      // Update Angka Sensor
      if (data.soil !== undefined) document.getElementById("soil").innerText = data.soil + " %";
      if (data.sawah !== undefined) document.getElementById("sawah").innerText = data.sawah.toFixed(1) + " cm";
      if (data.tambak !== undefined) document.getElementById("tambak").innerText = data.tambak.toFixed(1) + " cm";
      if (data.voltage !== undefined) document.getElementById("battery").innerText = data.voltage.toFixed(1) + " V";

      // Update Visual Tombol (Hijau/Merah)
      if (data.pompa1 === "ON") updateButtonUI('p1', 'btn-p1-on'); else updateButtonUI('p1', 'btn-p1-off');
      if (data.pompa2 === "ON") updateButtonUI('p2', 'btn-p2-on'); else updateButtonUI('p2', 'btn-p2-off');
      if (data.aktuator === "BUKA") updateButtonUI('akt', 'btn-akt-buka'); else updateButtonUI('akt', 'btn-akt-tutup');

      // Update Tampilan Durasi Runtime
      if (data.durP1 !== undefined) document.getElementById("durasi-p1").innerText = formatKeWaktu(data.durP1);
      if (data.durP2 !== undefined) document.getElementById("durasi-p2").innerText = formatKeWaktu(data.durP2);
      if (data.durAkt !== undefined) document.getElementById("durasi-akt").innerText = formatKeWaktu(data.durAkt);

      // Update Grafik
      if (data.soil !== undefined) updateChartData(soilChart, data.soil, timeNow);
      if (data.sawah !== undefined) updateChartData(sawahChart, data.sawah, timeNow);
      if (data.tambak !== undefined) updateChartData(tambakChart, data.tambak, timeNow);

    } catch (error) { 
      console.error("Gagal memproses JSON:", error); 
    }
  }
});

// ==========================================
// FUNGSI PENGIRIMAN PERINTAH (PUBLISH)
// ==========================================
window.setMode = function(mode) { 
  client.publish("sistem/mode", mode); 
};

window.sendManual = function(device, state) { 
  client.publish("manual/" + device, state); 
};

window.setSetting = function() {
  const slider = document.getElementById("settingSlider");
  if(slider) {
    const value = slider.value;
    client.publish("sistem/setting_tinggi", value);
    
    // Feedback Visual pada UI
    const targetStatus = document.getElementById("target-status");
    if(targetStatus) targetStatus.innerText = value;
    
    console.log("Kirim target ketinggian:", value);
  }
};
