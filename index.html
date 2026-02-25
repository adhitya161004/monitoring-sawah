// ================= MQTT CONFIG =================
const options = {
    username: "monitoringsawahbyarnf",
    password: "Gakkenek1",
    protocol: "wss",
};

const client = mqtt.connect("wss://3bf57b9ff69e4d24ac2161a9955cac2d.s1.eu.hivemq.cloud:8884/mqtt", options);

// ================= CHART SETUP =================
// Menghubungkan ke ID 'soilChart' di HTML
const ctx = document.getElementById("soilChart").getContext("2d");

const soilChart = new Chart(ctx, {
    type: "line",
    data: {
        labels: [],
        datasets: [{
            label: "Soil Moisture (%)",
            data: [],
            borderColor: "#27ae60",
            backgroundColor: "rgba(39, 174, 96, 0.1)",
            borderWidth: 2,
            fill: true,
            tension: 0.3
        }],
    },
    options: {
        responsive: true,
        animation: false,
        scales: {
            y: { min: 0, max: 100 },
        },
    },
});

// ================= CONNECT =================
client.on("connect", function () {
    console.log("Terhubung ke HiveMQ ✅");
    client.subscribe("sawah/#");
    client.subscribe("tambak/#");
    client.subscribe("sistem/#");
});

client.on("message", function (topic, message) {
    let value = parseFloat(message.toString());
    if (isNaN(value)) return; // Abaikan jika data bukan angka

    console.log("Data masuk:", topic, value);

    if (topic === "sawah/soil_moisture") {
        document.getElementById("soil").innerText = value + " %";

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        soilChart.data.labels.push(timeNow);
        soilChart.data.datasets[0].data.push(value);

        if (soilChart.data.labels.length > 15) {
            soilChart.data.labels.shift();
            soilChart.data.datasets[0].data.shift();
        }
        soilChart.update();
    }

    if (topic === "sawah/tinggi_air") document.getElementById("sawah").innerText = value + " cm";
    if (topic === "tambak/tinggi_air") document.getElementById("tambak").innerText = value + " m";
    if (topic === "sistem/battery_percent") document.getElementById("battery").innerText = value + " %";
});

client.on("error", (err) => console.log("MQTT Error:", err));
