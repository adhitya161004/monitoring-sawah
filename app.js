// ================= MQTT CONFIG =================
const options = {
  username: "monitoringsawahbyarnf",
  password: "Gakkenek1",
  protocol: "wss",
};

const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

// ================= CHART SETUP =================
const ctx = document.getElementById("soilChart").getContext("2d");

const soilChart = new Chart(ctx, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Soil Moisture (%)",
        data: [],
        borderColor: "#2ecc71",
        backgroundColor: "rgba(46, 204, 113, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.3,
      },
    ],
  },
  options: {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        labels: { color: "white" },
      },
    },
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: "white" },
      },
      x: {
        ticks: { color: "white" },
      },
    },
  },
});

// ================= CONNECT =================
client.on("connect", function () {
  console.log("Terhubung ke HiveMQ ✅");

  document.getElementById("status-text").innerText = "Terhubung";
  document.getElementById("led").className = "status-led green";

  // Subscribe ke topik utama yang dikirim oleh ESP32
  client.subscribe("sawah/data");
  
  // Subscribe ke topik kontrol lainnya
  client.subscribe("sistem/#");
  client.subscribe("manual/#");
});

// ================= MESSAGE HANDLER =================
client.on("message", function (topic, message) {
  let rawValue = message.toString();
  console.log("Data masuk:", topic, rawValue);

  // Jika data masuk dari ESP32 (Format JSON)
  if (topic === "sawah/data") {
    try {
      // Parsing JSON (mengubah string JSON menjadi object)
      let data = JSON.parse(rawValue);

      // 1. Update Kelembaban Tanah (Soil Moisture)
      if (data.soil !== undefined) {
        document.getElementById("soil").innerText = data.soil + " %";

        const timeNow = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        soilChart.data.labels.push(timeNow);
        soilChart.data.datasets[0].data.push(data.soil);

        // Maksimal 15 titik data di grafik
        if (soilChart.data.labels.length > 15) {
          soilChart.data.labels.shift();
          soilChart.data.datasets[0].data.shift();
        }

        soilChart.update();
      }

      // 2. Update Tinggi Sawah atau Tambak tergantung identitas "sensor"
      if (data.sensor === "sawah" && data.tinggi !== undefined) {
        document.getElementById("sawah").innerText = data.tinggi.toFixed(1) + " cm";
      } else if (data.sensor === "tambak" && data.tinggi !== undefined) {
        document.getElementById("tambak").innerText = data.tinggi.toFixed(1) + " cm";
      }

    } catch (error) {
      console.error("Gagal membaca JSON dari ESP32:", error);
    }
  }

  // ================= DATA STATUS LAINNYA =================
  if (topic === "sistem/battery_percent") {
    let batValue = parseFloat(rawValue);
    if(!isNaN(batValue)){
        document.getElementById("battery").innerText = batValue + " %";
    }
  }

  if (topic === "sistem/mode") {
    document.getElementById("mode-status").innerText = "Mode: " + rawValue;
  }
});

// ================= ERROR =================
client.on("error", function (err) {
  console.log("MQTT Error:", err);
  document.getElementById("status-text").innerText = "Koneksi Gagal";
  document.getElementById("led").className = "status-led red";
});

// ================= CONTROL FUNCTIONS =================
// Disematkan pada 'window' agar bisa dipanggil oleh event onclick dari HTML
window.setMode = function(mode) {
  client.publish("sistem/mode", mode);
};

window.sendManual = function(device, state) {
  client.publish("manual/" + device, state);
};

window.setSetting = function() {
  let value = document.getElementById("settingInput").value;
  if (value >= 5 && value <= 30) {
    client.publish("sistem/setting_tinggi", value);
  } else {
    alert("Setting harus antara 5 - 30 cm");
  }
};
