const options = { username: "monitoringsawahbyarnf", password: "Gakkenek1", protocol: "wss" };
const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);
const ctx = document.getElementById("soilChart").getContext("2d");

const soilChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [{ label: "Soil Moisture (%)", data: [], borderColor: "#2ecc71", backgroundColor: "rgba(46, 204, 113, 0.1)", borderWidth: 2, fill: true, tension: 0.3 }]
  },
  options: { responsive: true, animation: false, plugins: { legend: { labels: { color: "white" } } }, scales: { y: { min: 0, max: 100, ticks: { color: "white" } }, x: { ticks: { color: "white" } } } }
});

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
      if (data.soil !== undefined) document.getElementById("soil").innerText = data.soil + " %";
      if (data.sawah !== undefined) document.getElementById("sawah").innerText = data.sawah.toFixed(1) + " cm";
      if (data.tambak !== undefined) document.getElementById("tambak").innerText = data.tambak.toFixed(1) + " cm";
      if (data.battery !== undefined) document.getElementById("battery").innerText = data.battery + " %";

      if (data.soil !== undefined) {
        const timeNow = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        soilChart.data.labels.push(timeNow);
        soilChart.data.datasets[0].data.push(data.soil);
        if (soilChart.data.labels.length > 15) {
          soilChart.data.labels.shift();
          soilChart.data.datasets[0].data.shift();
        }
        soilChart.update();
      }
    } catch (error) {}
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
