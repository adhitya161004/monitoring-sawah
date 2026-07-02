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
document.addEventListener("DOMContentLoaded", () => {
  let localTarget = localStorage.getItem("targetSawahTerakhir");
  if(localTarget) {
    document.getElementById("settingSlider").value = localTarget;
    document.getElementById("sliderValue").innerText = localTarget;
    document.getElementById("target-status").innerText = localTarget;
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
    const resConfig = await fetch(configURL);
    const configData = await resConfig.json();
    if (configData) {
      if (configData.mode) updateButtonUI('mode', configData.mode === "AUTO" ? 'btn-auto' : 'btn-manual');
      if (configData.target) {
        targetSawahAktif = parseFloat(configData.target);
        document.getElementById("target-status").innerText = configData.target;
        document.getElementById("settingSlider").value = configData.target;
        document.getElementById("sliderValue").innerText = configData.target;
        localStorage.setItem("targetSawahTerakhir", configData.target);
      }
    }

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
// PENTING - SINKRONISASI DENGAN ESP32:
// - MIN_AIR_TAMBAK & MAX_AIR_TAMBAK -> sudah sama persis dgn ESP32 (20 & 125). Jangan diubah
//   sepihak di sini tanpa mengubah juga di kode ESP32 (.ino).
// - SAWAH_MAX_CM (5 cm, batas mutlak MAKSIMAL tinggi air sawah) & MIN_AIR_SAWAH (2 cm, batas
//   aman minimum, sudah ada di ESP32) -> BUKAN toleransi dari target slider, melainkan batas
//   mutlak. CATATAN: slider target di dashboard saat ini masih bisa diset 0-30cm dan dikirim
//   ke ESP32 untuk logika AUTO (settingSawah ± 3cm). Jika target diset di atas 5cm, alat akan
//   mempertahankan air di angka itu sementara dashboard terus menotifikasi "Kelebihan Air"
//   karena sudah lewat batas mutlak 5cm. Sesuaikan slider (max="5") atau logika AUTO di ESP32
//   jika target memang seharusnya dibatasi sama dengan SAWAH_MAX_CM ini.
// - SOIL_KERING_BATAS (80%) & SOIL_BASAH_BATAS (90%) -> sudah sesuai logika ESP32
//   (valSoil < 80 memicu pompa 1, valSoil >= 90 dianggap sudah basah/jenuh).
// - BATTERY_LOW_VOLT -> BELUM ada proteksi baterai di ESP32. Nilai 11.5V adalah ASUMSI awal
//   untuk baterai LiFePO4 12V, sesuaikan dengan spesifikasi baterai Anda.

const MIN_AIR_TAMBAK    = 20.0;  // cm - tandon "tinggal sedikit" pada/di bawah nilai ini
const MAX_AIR_TAMBAK    = 125.0; // cm - tandon "kelebihan air" pada/di atas nilai ini
const MIN_AIR_SAWAH     = 2.0;   // cm - sawah "kekurangan air" di bawah nilai ini
const SAWAH_MAX_CM      = 5.0;   // cm - BATAS MUTLAK: sawah "kelebihan air" di atas nilai ini
const SOIL_KERING_BATAS = 80;    // %  - di bawah ini = tanah kering, pompa 1 otomatis aktif
const SOIL_BASAH_BATAS  = 90;    // %  - pada/di atas ini = tanah sudah basah (jenuh)
const BATTERY_LOW_VOLT  = 11.5;  // V  - ASUMSI awal baterai LiFePO4 12V, sesuaikan bila perlu

let targetSawahAktif = 14.0; // tetap disinkronkan dari slider/Firebase/MQTT (dipakai utk kontrol ESP32, TIDAK dipakai lagi utk notifikasi sawah)

let statusTerakhir = {
  sawahKondisi: null,    // "sesuai" | "kurang" | "lebih"
  tambakKondisi: null,   // "rendah" | "penuh" | "normal"
  soilKondisi: null,     // "kering" | "cukup" | "basah"
  batteryKondisi: null,  // "rendah" | "normal"
  aktuatorKondisi: null  // "BUKA" | "TUTUP" | "STOP"
};

// --- IZIN NOTIFIKASI BROWSER (Muncul di status bar HP) ---
function updateBadgeNotifikasi() {
  const btn = document.getElementById("btn-notif-permission");
  if (!btn || !("Notification" in window)) return;
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    btn.style.display = "none";
  } else {
    btn.style.display = "flex";
  }
}

window.mintaIzinNotifikasi = function() {
  if (!("Notification" in window)) {
    alert("Browser ini tidak mendukung notifikasi.");
    return;
  }
  Notification.requestPermission().then(() => updateBadgeNotifikasi());
};

document.addEventListener("DOMContentLoaded", updateBadgeNotifikasi);

function showNativeNotification(title, body, tag) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { 
        body: body, 
        tag: tag,
        renotify: true,
        icon: "https://cdn-icons-png.flaticon.com/512/2911/2911771.png"
      });
    } catch (e) { console.error("Gagal munculkan notifikasi native:", e); }
  }
}

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

  setTimeout(() => {
    toast.style.animation = "fadeOut 0.4s ease-in forwards";
    setTimeout(() => toast.remove(), 400);
  }, 6000);

  showNativeNotification(title, message, "sawah-" + type);
}

function cekNotifikasiThreshold(d) {

  // ---------------------------------------------
  // A. KETINGGIAN SAWAH (batas mutlak, BUKAN relatif ke target)
  // ---------------------------------------------
  if (d.sawah !== undefined) {
    let sawahKondisi;
    if (d.sawah < MIN_AIR_SAWAH) sawahKondisi = "kurang";
    else if (d.sawah > SAWAH_MAX_CM) sawahKondisi = "lebih";
    else sawahKondisi = "sesuai";

    if (sawahKondisi !== statusTerakhir.sawahKondisi) {
      if (sawahKondisi === "sesuai") {
        showToast("Sawah Sesuai/Normal", `Tinggi air sawah ${d.sawah.toFixed(1)} cm berada pada rentang aman (${MIN_AIR_SAWAH}-${SAWAH_MAX_CM} cm).`, "success", "fa-circle-check");
      } else if (sawahKondisi === "kurang") {
        showToast("Sawah Kekurangan Air", `Tinggi air ${d.sawah.toFixed(1)} cm di bawah batas minimum (${MIN_AIR_SAWAH} cm). Pompa 1 akan aktif.`, "warning", "fa-droplet-slash");
      } else if (sawahKondisi === "lebih") {
        showToast("Sawah Kelebihan Air", `Tinggi air ${d.sawah.toFixed(1)} cm melebihi batas maksimum (${SAWAH_MAX_CM} cm). Air dialirkan ke tandon.`, "warning", "fa-water");
      }
      statusTerakhir.sawahKondisi = sawahKondisi;
    }
  }

  // ---------------------------------------------
  // B. KETINGGIAN TANDON
  // ---------------------------------------------
  if (d.tambak !== undefined) {
    let tambakKondisi;
    if (d.tambak <= MIN_AIR_TAMBAK) tambakKondisi = "rendah";
    else if (d.tambak >= MAX_AIR_TAMBAK) tambakKondisi = "penuh";
    else tambakKondisi = "normal";

    if (tambakKondisi !== statusTerakhir.tambakKondisi) {
      if (tambakKondisi === "rendah") {
        showToast("Air Tandon Tinggal Sedikit", `Ketinggian tandon ${d.tambak.toFixed(1)} cm di bawah batas minimum (${MIN_AIR_TAMBAK} cm). Pompa 1 dinonaktifkan (safety interlock).`, "danger", "fa-circle-exclamation");
      } else if (tambakKondisi === "penuh") {
        showToast("Tandon Kelebihan Air", `Ketinggian tandon ${d.tambak.toFixed(1)} cm mencapai batas maksimum (${MAX_AIR_TAMBAK} cm). Saluran pembuangan dibuka.`, "warning", "fa-door-open");
      } else if (statusTerakhir.tambakKondisi !== null) {
        showToast("Tandon Normal", `Ketinggian tandon ${d.tambak.toFixed(1)} cm kembali pada kondisi normal.`, "success", "fa-circle-check");
      }
      statusTerakhir.tambakKondisi = tambakKondisi;
    }
  }

  // ---------------------------------------------
  // C. KELEMBABAN TANAH (kering / cukup / basah)
  // ---------------------------------------------
  if (d.soil !== undefined) {
    let soilKondisi;
    if (d.soil < SOIL_KERING_BATAS) soilKondisi = "kering";
    else if (d.soil >= SOIL_BASAH_BATAS) soilKondisi = "basah";
    else soilKondisi = "cukup";

    if (soilKondisi !== statusTerakhir.soilKondisi) {
      if (soilKondisi === "kering") {
        showToast("Tanah Kering", `Kelembaban tanah ${d.soil}% di bawah ambang ${SOIL_KERING_BATAS}%. Pompa 1 (irigasi) aktif.`, "warning", "fa-seedling");
      } else if (soilKondisi === "basah") {
        showToast("Tanah Sudah Basah", `Kelembaban tanah ${d.soil}% mencapai/melebihi ${SOIL_BASAH_BATAS}%. Penyiraman dihentikan.`, "success", "fa-droplet");
      } else {
        showToast("Kelembaban Tanah Cukup", `Kelembaban tanah ${d.soil}% berada di antara ${SOIL_KERING_BATAS}%-${SOIL_BASAH_BATAS}% (normal).`, "success", "fa-circle-check");
      }
      statusTerakhir.soilKondisi = soilKondisi;
    }
  }

  // ---------------------------------------------
  // D. TEGANGAN BATERAI
  // ---------------------------------------------
  if (d.voltage !== undefined) {
    let batteryKondisi = d.voltage <= BATTERY_LOW_VOLT ? "rendah" : "normal";

    if (batteryKondisi !== statusTerakhir.batteryKondisi) {
      if (batteryKondisi === "rendah") {
        showToast("Baterai Akan Habis", `Tegangan sistem ${d.voltage.toFixed(1)} V di bawah ambang aman (${BATTERY_LOW_VOLT} V). Segera lakukan pengisian.`, "danger", "fa-battery-quarter");
      } else if (statusTerakhir.batteryKondisi !== null) {
        showToast("Baterai Normal", `Tegangan sistem ${d.voltage.toFixed(1)} V sudah kembali normal.`, "success", "fa-battery-full");
      }
      statusTerakhir.batteryKondisi = batteryKondisi;
    }
  }

  // ---------------------------------------------
  // E. STATUS AKTUATOR (SALURAN) - diambil langsung dari status asli alat
  // ---------------------------------------------
  if (d.aktuator !== undefined) {
    const aktuatorKondisi = d.aktuator;

    if (aktuatorKondisi !== statusTerakhir.aktuatorKondisi) {
      if (aktuatorKondisi === "BUKA") {
        showToast("Saluran Terbuka", "Aktuator membuka saluran pembuangan air.", "warning", "fa-door-open");
      } else if (aktuatorKondisi === "TUTUP" && statusTerakhir.aktuatorKondisi !== null) {
        showToast("Saluran Tertutup", "Aktuator menutup kembali saluran pembuangan air.", "success", "fa-door-closed");
      }
      statusTerakhir.aktuatorKondisi = aktuatorKondisi;
    }
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
  client.subscribe("sawah/tes_notifikasi");
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
    document.getElementById("settingSlider").value = msg;
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

  if (topic === "sawah/tes_notifikasi") {
    try {
      let d = JSON.parse(msg);
      cekNotifikasiThreshold(d);
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
  
  document.getElementById("target-status").innerText = sliderValue;
  document.getElementById("settingSlider").value = sliderValue;
  
  localStorage.setItem("targetSawahTerakhir", sliderValue);
};

// ==========================================
// 7. FUNGSI TES / SIMULASI NOTIFIKASI
// ==========================================
// Dikirim lewat MQTT topic terpisah (sawah/tes_notifikasi) supaya:
// 1) Semua user yang online ikut menerima notifikasi simulasi (bukan cuma yang menekan tombol)
// 2) Tidak mengubah data sensor asli / grafik / status pompa-aktuator di layar
// 3) Nilai simulasi mengikuti batas mutlak (MIN_AIR_SAWAH, SAWAH_MAX_CM, dst), bukan target slider
window.kirimTesNotifikasi = function(jenis) {
  let data;

  switch (jenis) {
    case "normal":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: 60, soil: 85, voltage: 13.0, aktuator: "TUTUP" };
      break;
    case "kurang":
      data = { sawah: Math.max(0, MIN_AIR_SAWAH - 1), tambak: 60, soil: 85 };
      break;
    case "lebih":
      data = { sawah: SAWAH_MAX_CM + 3, tambak: 60, soil: 85 };
      break;
    case "tandon_rendah":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: MIN_AIR_TAMBAK - 5, soil: 85 };
      break;
    case "tandon_penuh":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: MAX_AIR_TAMBAK + 5, soil: 85 };
      break;
    case "tanah_kering":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: 60, soil: SOIL_KERING_BATAS - 10 };
      break;
    case "tanah_basah":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: 60, soil: SOIL_BASAH_BATAS + 5 };
      break;
    case "baterai_habis":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: 60, soil: 85, voltage: BATTERY_LOW_VOLT - 1 };
      break;
    case "aktuator_buka":
      data = { sawah: (MIN_AIR_SAWAH + SAWAH_MAX_CM) / 2, tambak: 60, soil: 85, aktuator: "BUKA" };
      break;
    default:
      return;
  }

  client.publish("sawah/tes_notifikasi", JSON.stringify(data));
};

ambilDataAwalDariFirebase();
