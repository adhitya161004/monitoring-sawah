const options = { username: "monitoringsawahbyarnf", password: "Gakkenek1", protocol: "wss" };
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

// FUNGSI BARU: Agar setiap grafik punya pengaturan sendiri dan tidak berebut
function getChartOptions() {
  return { 
    responsive: true, 
    animation: false, 
    plugins: { legend: { labels: { color: "white" } } }, 
    scales: { y: { ticks: { color: "white" } }, x: { ticks: { color: "white" } } } 
  };
}

const ctxSoil = document.getElementById("soilChart").getContext("2d");
const soilChart = new Chart(ctxSoil, { type: "line", data: { labels: [], datasets: [{ label: "Soil Moisture (%)", data: [], borderColor: "#2ecc71", backgroundColor: "rgba(46, 204, 113, 0.1)", borderWidth: 2, fill: true, tension: 0.3 }] }, options: getChartOptions() });

const ctxSawah = document.getElementById("sawahChart").getContext("2d");
const sawahChart = new Chart(ctxSawah, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Sawah (cm)", data: [], borderColor: "#3498db", backgroundColor: "rgba(52, 152, 219, 0.1)", borderWidth: 2, fill: true, tension: 0.3 }] }, options: getChartOptions() });

const ctxTambak = document.getElementById("tambakChart").getContext("2d");
const tambakChart = new Chart(ctxTambak, { type: "line", data: { labels: [], datasets: [{ label: "Tinggi Tambak (cm)", data: [], borderColor: "#9b59b6", backgroundColor: "rgba(155, 89, 182, 0.1)", borderWidth: 2, fill: true, tension: 0.3 }] }, options: getChartOptions() });

client.on("connect", function () {
  document.getElementById("status-text").innerText = "Terhubung";
  document.getElementById("led").className = "status-led green";
  client.subscribe("sawah/data");
  client.subscribe("sistem/mode");
  client.subscribe("sistem/setting_tinggi");
});

client.on("message", function (topic, message) {
  let rawValue = message.toString();
  
  if (topic === "sawah/data") {
    try {
      let data = JSON.parse(rawValue);
      const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (data.soil !== undefined) document.getElementById("soil").innerText = data.soil + " %";
      if (data.sawah !== undefined) document.getElementById("sawah").innerText = data.sawah.toFixed(1) + " cm";
      if (data.tambak !== undefined) document.getElementById("tambak").innerText = data.tambak.toFixed(1) + " cm";
      if (data.battery !== undefined) document.getElementById("battery").innerText = data.battery + " %";

      // Tangkap status Relay
      if (data.pompa1 !== undefined) document.getElementById("status-p1").innerText = data.pompa1;
      if (data.pompa2 !== undefined) document.getElementById("status-p2").innerText = data.pompa2;
      if (data.aktuator !== undefined) document.getElementById("status-akt").innerText = data.aktuator;

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

    } catch (error) { console.log("Gagal memproses JSON", error); }
  }
  
  if (topic === "sistem/mode") document.getElementById("mode-status").innerText = "Mode: " + rawValue;
  if (topic === "sistem/setting_tinggi") document.getElementById("target-status").innerText = rawValue;
});

client.on("error", function () {
  document.getElementById("status-text").innerText = "Koneksi Terputus";
  document.getElementById("led").className = "status-led red";
});

window.setMode = function(mode) { client.publish("sistem/mode", mode); };
window.sendManual = function(device, state) { client.publish("manual/" + device, state); };
window.setSetting = function() {
  let value = document.getElementById("settingInput").value;
  if (value >= 5 && value <= 30) client.publish("sistem/setting_tinggi", value);
  else alert("Setting tinggi sawah harus di antara 5 - 30 cm");
};
