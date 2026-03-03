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

  client.subscribe("sawah/#");
  client.subscribe("tambak/#");
  client.subscribe("sistem/#");
  client.subscribe("manual/#");
});

// ================= MESSAGE HANDLER =================
client.on("message", function (topic, message) {
  let rawValue = message.toString();
  let value = parseFloat(rawValue);

  console.log("Data masuk:", topic, rawValue);

  // ================= SENSOR DATA =================
  if (topic === "sawah/soil_moisture" && !isNaN(value)) {
    document.getElementById("soil").innerText = value + " %";

    const timeNow = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    soilChart.data.labels.push(timeNow);
    soilChart.data.datasets[0].data.push(value);

    if (soilChart.data.labels.length > 15) {
      soilChart.data.labels.shift();
      soilChart.data.datasets[0].data.shift();
    }

    soilChart.update();
  }

  if (topic === "sawah/tinggi_air" && !isNaN(value)) {
    document.getElementById("sawah").innerText = value + " cm";
  }

  if (topic === "tambak/tinggi_air" && !isNaN(value)) {
    document.getElementById("tambak").innerText = value + " cm";
  }

  if (topic === "sistem/battery_percent" && !isNaN(value)) {
    document.getElementById("battery").innerText = value + " %";
  }

  // ================= MODE UPDATE =================
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
function setMode(mode) {
  client.publish("sistem/mode", mode);
}

function sendManual(device, state) {
  client.publish("manual/" + device, state);
}

function setSetting() {
  let value = document.getElementById("settingInput").value;
  if (value >= 5 && value <= 30) {
    client.publish("sistem/setting_tinggi", value);
  } else {
    alert("Setting harus antara 5 - 30 cm");
  }
}
