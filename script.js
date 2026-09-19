let chartInstance = null;
let requestSequence = 0;

function updateWindVelocity(speedKmh) {
    const windNode = document.getElementById("wind-node");
    const windDisplay = document.getElementById("wind-speed");

    if (windDisplay) windDisplay.innerText = `${speedKmh.toFixed(1)} km/h`;
    if (windNode) {
        const clampedSpeed = Math.max(2, Math.min(speedKmh, 100));
        const durationSeconds = (3.4 - (clampedSpeed / 100) * 3.05).toFixed(2);
        windNode.style.setProperty("--wind-duration", `${durationSeconds}s`);
    }
}

function weatherDescription(code) {
    if (code === 0) return "Optimal Clearance";
    if ([1, 2, 3].includes(code)) return "Cloud Cover Detected";
    if ([45, 48].includes(code)) return "Dense Vapor / Fog";
    if ([51, 53, 55, 56, 57].includes(code)) return "Light Precipitation";
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Heavy Rainfall";
    if ([95, 96, 99].includes(code)) return "Electrical Storm";
    return "Anomalous Conditions";
}

function updateDragonHologram(code) {
    const hologramLayer = document.getElementById("weather-hologram");
    const sun = `<g class="idle-spin"><circle cx="0" cy="0" r="12" fill="none" stroke="#FF2A42" stroke-width="3" stroke-dasharray="6 3"/><circle cx="0" cy="0" r="5" fill="#FF2A42"/></g>`;
    const cloud = `<g class="idle-float"><path d="M-15,-5 L5,-5 L12,8 L-8,8 Z" fill="#94A3B8" opacity="0.8"/><path d="M-2,-12 L18,-12 L25,0 L2,0 Z" fill="#64748B" opacity="0.9"/></g>`;
    const rain = `<g class="idle-pulse"><line x1="-8" y1="-8" x2="-15" y2="15" stroke="#00D2FF" stroke-width="2.5"/><line x1="4" y1="-12" x2="-3" y2="20" stroke="#00D2FF" stroke-width="2.5"/><line x1="15" y1="-5" x2="8" y2="15" stroke="#00D2FF" stroke-width="2.5"/></g>`;

    if (code === 0) hologramLayer.innerHTML = sun;
    else if ([1, 2, 3, 45, 48].includes(code)) hologramLayer.innerHTML = cloud;
    else hologramLayer.innerHTML = rain;
}

function bindInteractions() {
    document.querySelectorAll('.interactive-node').forEach(node => {
        node.removeEventListener('mousedown', addShockwave);
        node.addEventListener('mousedown', addShockwave);
    });
}

function addShockwave(e) {
    const el = e.currentTarget;
    el.classList.add('click-shockwave');
    setTimeout(() => el.classList.remove('click-shockwave'), 400);
}

async function runDiagnostics() {
    const button = document.getElementById("diagnostics-button");
    const status = document.getElementById("system-status");
    const requiredElements = ["city-name", "temperature", "wind-speed", "humidity", "pressure", "visibility", "forecastChart"];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (!button || !status) return;
    button.disabled = true;
    button.innerText = "Checking...";
    status.innerText = "Running system diagnostics...";

    try {
        if (missingElements.length) throw new Error(`Missing module: ${missingElements.join(", ")}`);
        if (!chartInstance) throw new Error("Thermal chart is not initialized");

        const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=35&longitude=139&current=temperature_2m&forecast_days=1", { method: "GET", cache: "no-store" });
        if (!response.ok) throw new Error("Open-Meteo uplink unavailable");
        status.innerText = "Diagnostics complete // all systems nominal";
    } catch (error) {
        status.innerText = `Diagnostics warning // ${error.message}`;
        console.error(error);
    } finally {
        button.disabled = false;
        button.innerText = "Run Diagnostics";
    }
}

async function fetchWeather(city) {
    const requestId = ++requestSequence;
    const status = document.getElementById("system-status");

    try {
        if (status) status.innerText = `Acquiring telemetry for ${city}...`;
        const locationResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
        if (!locationResponse.ok) throw new Error("Target coordinates not found.");
        const locationData = await locationResponse.json();
        const location = locationData.results?.[0];
        if (!location) throw new Error(`Location not found: ${city}`);

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,pressure_msl,wind_speed_10m,weather_code,visibility&hourly=temperature_2m&timezone=auto&forecast_days=1`);
        if (!weatherResponse.ok) throw new Error("Telemetry link severed.");
        const weatherData = await weatherResponse.json();
        const current = weatherData.current;
        if (requestId !== requestSequence) return;

        const hourlyTemps = weatherData.hourly.temperature_2m.slice(0, 24).map(Math.round);
        const hourlyLabels = weatherData.hourly.time.slice(0, 24).map(time => time.split("T")[1].slice(0, 5));

        document.getElementById("city-name").innerText = `${location.name}${location.country_code ? ' // ' + location.country_code : ''}`;
        document.getElementById("temperature").innerText = `${Math.round(current.temperature_2m)}°`;
        document.getElementById("weather-desc").innerText = weatherDescription(current.weather_code);
        document.getElementById("humidity").innerText = `${current.relative_humidity_2m}%`;
        updateWindVelocity(current.wind_speed_10m);
        document.getElementById("pressure").innerText = `${Math.round(current.pressure_msl)} hPa`;
        document.getElementById("visibility").innerText = current.visibility == null ? "-- km" : `${(current.visibility / 1000).toFixed(1)} km`;
        document.getElementById("current-date").innerText = `T-MINUS ${new Date().toLocaleTimeString('en-US', { hour12:false })} LOCAL`;
        if (status) status.innerText = `Telemetry nominal // ${location.timezone_abbreviation || location.timezone}`;

        updateDragonHologram(current.weather_code);
        lucide.createIcons();
        renderChart(hourlyLabels, hourlyTemps);
    } catch (err) {
        if (requestId !== requestSequence) return;
        if (status) status.innerText = `Telemetry error // ${err.message}`;
        console.error(err);
    }
}

function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{ label: 'Temp (°C)', data: dataPoints, borderColor: '#FF2A42', backgroundColor: 'rgba(255, 42, 66, 0.1)', borderWidth: 3, fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#0F1115', pointBorderColor: '#FF2A42', pointBorderWidth: 2, pointHoverRadius: 8, pointHoverBackgroundColor: '#FFF', pointHoverBorderColor: '#FF2A42' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(15, 17, 21, 0.9)', titleColor: '#F4F6F9', bodyColor: '#FF2A42', borderColor: '#FF2A42', borderWidth: 1, padding: 12, displayColors: false, cornerRadius: 0, titleFont: { family: 'Rajdhani', size: 14, weight: 'bold' }, bodyFont: { family: 'Orbitron', size: 18, weight: 'bold' } } },
            scales: { x: { grid: { color: 'rgba(15,17,21,0.05)', drawBorder: true, borderColor: '#0F1115' }, ticks: { color: '#0F1115', font: { family: 'Orbitron', size: 10, weight: 'bold' } } }, y: { grid: { color: 'rgba(15,17,21,0.05)', borderDash: [5, 5], drawBorder: false }, ticks: { color: '#0F1115', font: { family: 'Orbitron', size: 12, weight: 'bold' }, padding: 10 } } },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
    lucide.createIcons();
    bindInteractions();
    fetchWeather("Tokyo");

    document.getElementById("search-form").addEventListener("submit", e => {
        e.preventDefault();
        const city = document.getElementById("city-input").value.trim();
        if (city) fetchWeather(city);
    });

    document.getElementById("diagnostics-button").addEventListener("click", runDiagnostics);

    const node = document.getElementById("visibility-node");
    const pupilGroup = document.getElementById("eye-pupil-group");
    if (node && pupilGroup) {
        node.addEventListener("mousemove", e => {
            const rect = node.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
            const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
            pupilGroup.style.transform = `translate(${x * 3.5}px, ${y * 3.5}px)`;
        });
        node.addEventListener("mouseleave", () => { pupilGroup.style.transform = "translate(0px, 0px)"; });
    }
});
