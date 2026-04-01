const options = { username: "monitoringsawahbyarnf", password: "Gakkenek1", protocol: "wss" };
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

console.log("Mencoba terhubung ke Broker MQTT...");

function getChartOptions() {
  return { 
    responsive: true, maintainAspectRatio: false, animation: { duration: 0 }, 
    plugins: { legend: { labels: { color: "#e2e8f0", font: { family: "'Poppins', sans-serif" } } } }, 
    scales: { 
      y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#94a3b8" } }, 
      x: { grid: { display: false }, ticks: { color: "#94a3b8", maxRotation: 45, minRotation: 45 } } 
    } 
  };
}

const ctxSoil = document.getElementById("soilChart").getContext("2d");
const soilChart = new Chart(ctxSoil, { type: "line", data: { labels: [], datasets: [{ label: "Kelembapan Tanah (%)", data: [], borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

const ctxSawah = document.getElementById("sawahChart").getContext("2d");
const sawahChart = new Chart(ctxSawah, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Sawah (cm)", data: [], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

const ctxTambak = document.getElementById("tambakChart").getContext("2d");
const tambakChart = new Chart(ctxTambak, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Tambak (cm)", data: [], borderColor: "#fbbf24", backgroundColor: "rgba(251, 191, 36, 0.1)", borderWidth: 2, fill: true, tension: 0.4 }] }, options: getChartOptions() });

function updateButtonUI(groupId, activeBtnId, activeClass) {
  const group = {
    'mode': ['btn-auto', 'btn-manual'],
    'p1': ['btn-p1-on', 'btn-p1-off'],
    'p2': ['btn-p2-on', 'btn-p2-off'],
    'akt': ['btn-akt-buka', 'btn-akt-tutup']
  };
  group[groupId].forEach(id => {
    let btn = document.getElementById(id);
    if(btn) btn.className = (id === activeBtnId) ? activeClass : '';
  });
}

window.updateSliderValue = function(val) {
  let sliderVal = document.getElementById("sliderValue");
  if(sliderVal) sliderVal.innerText = val;
};

// ==========================================
// KONEKSI MQTT (DENGAN PELACAK)
// ==========================================
client.on("connect", function () {
  console.log("✅ BERHASIL TERHUBUNG KE MQTT!");
  const badge = document.getElementById("conn-status");
  if(badge) badge.className = "status-badge"; 
  let statusTxt = document.getElementById("status-text");
  if(statusTxt) statusTxt.innerText = "TERHUBUNG";
  
  client.subscribe("sawah/data");
  client.subscribe("sistem/mode");
  client.subscribe("sistem/setting_tinggi");
});

client.on("error", function (err) {
  console.error("❌ KONEKSI MQTT GAGAL:", err);
  const badge = document.getElementById("conn-status");
  if(badge) badge.className = "status-badge offline";
  let statusTxt = document.getElementById("status-text");
  if(statusTxt) statusTxt.innerText = "KONEKSI TERPUTUS";
});

// ==========================================
// TERIMA DATA DARI ESP32
// ==========================================
client.on("message", function (topic, message) {
  let rawValue = message.toString();
  console.log(`📥 DATA MASUK [${topic}]:`, rawValue); // Pantau data di Console
  
  if (topic === "sistem/mode") {
    if(rawValue === "AUTO") updateButtonUI('mode', 'btn-auto', 'active-on');
    else updateButtonUI('mode', 'btn-manual', 'active-off');
  }
  
  if (topic === "sistem/setting_tinggi") {
    let targetStatus = document.getElementById("target-status");
    if(targetStatus) targetStatus.innerText = rawValue;
    let settingSlider = document.getElementById("settingSlider");
    if(settingSlider) settingSlider.value = rawValue;
    updateSliderValue(rawValue);
  }

  if (topic === "sawah/data") {
    try {
      let data = JSON.parse(rawValue);
      const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (data.soil !== undefined) document.getElementById("soil").innerText = data.soil + " %";
      if (data.sawah !== undefined) document.getElementById("sawah").innerText = data.sawah.toFixed(1) + " cm";
      if (data.tambak !== undefined) document.getElementById("tambak").innerText = data.tambak.toFixed(1) + " cm";
      if (data.battery !== undefined) document.getElementById("battery").innerText = data.battery + " %";

      if (data.pompa1 === "ON") updateButtonUI('p1', 'btn-p1-on', 'active-on'); else updateButtonUI('p1', 'btn-p1-off', 'active-off');
      if (data.pompa2 === "ON") updateButtonUI('p2', 'btn-p2-on', 'active-on'); else updateButtonUI('p2', 'btn-p2-off', 'active-off');
      if (data.aktuator === "BUKA") updateButtonUI('akt', 'btn-akt-buka', 'active-on'); else updateButtonUI('akt', 'btn-akt-tutup', 'active-off');

      if (data.soil !== undefined) {
        soilChart.data.labels.push(timeNow);
        soilChart.data.datasets[0].data.push(data.soil);
        if (soilChart.data.labels.length > 15) { soilChart.data.labels.shift(); soilChart.data.datasets[0].data.shift(); }
        soilChart.update();
      }

      if (data.sawah !== undefined) {
        sawahChart.data.labels.push(timeNow);
        sawahChart.data.datasets[0].data.push(data.sawah);
        if (sawahChart.data.labels.length > 15) { sawahChart.data.labels.shift(); sawahChart.data.datasets[0].data.shift(); }
        sawahChart.update();
      }

      if (data.tambak !== undefined) {
        tambakChart.data.labels.push(timeNow);
        tambakChart.data.datasets[0].data.push(data.tambak);
        if (tambakChart.data.labels.length > 15) { tambakChart.data.labels.shift(); tambakChart.data.datasets[0].data.shift(); }
        tambakChart.update();
      }

    } catch (error) { 
      console.error("❌ Gagal memproses JSON:", error); 
    }
  }
});

window.setMode = function(mode) { 
  console.log("Mengirim Mode:", mode);
  client.publish("sistem/mode", mode); 
};

window.sendManual = function(device, state) { 
  console.log(`Mengirim Perintah Manual [${device}]:`, state);
  client.publish("manual/" + device, state); 
};

window.setSetting = function() {
  let value = document.getElementById("settingSlider").value;
  console.log("Mengirim Target Tinggi:", value);
  client.publish("sistem/setting_tinggi", value);
  const btn = document.querySelector('.btn-kirim');
  if(btn) {
    btn.innerText = "BERHASIL DIKIRIM!";
    btn.style.background = "#10b981";
    setTimeout(() => {
      btn.innerText = "KIRIM PENGATURAN";
      btn.style.background = "#3b82f6";
    }, 2000);
  }
};
