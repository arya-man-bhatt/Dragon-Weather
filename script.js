let chartInstance = null;
let requestSequence = 0;
let loadingHideTimeout = null;
let loadingVisibleUntil = 0;
let suggestionSequence = 0;
let suggestionTimer = null;
let suggestionController = null;
let suggestionLocations = [];
let activeSuggestionIndex = -1;
let currentWeatherLocation = null;
let dragonReportSnapshot = null;
let dragonReportLoadingTimer = null;
let mapInstance = null;
let mapMarker = null;
let mapSelectedLocation = null;
let mapOpen = false;
let mapSelectionSequence = 0;
let mapSessionSequence = 0;

const RECENT_LOCATIONS_KEY = "weather-dashboard-recent-locations";
const MAX_RECENT_LOCATIONS = 6;
const LOCATION_NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: "base" });
const FEATURED_LOCATIONS = [
    { name: "Amsterdam", country: "Netherlands", country_code: "NL", admin1: "North Holland", latitude: 52.3676, longitude: 4.9041, timezone: "Europe/Amsterdam" },
    { name: "Athens", country: "Greece", country_code: "GR", admin1: "Attica", latitude: 37.9838, longitude: 23.7275, timezone: "Europe/Athens" },
    { name: "Auckland", country: "New Zealand", country_code: "NZ", admin1: "Auckland", latitude: -36.8509, longitude: 174.7645, timezone: "Pacific/Auckland" },
    { name: "Bangkok", country: "Thailand", country_code: "TH", admin1: "Bangkok", latitude: 13.7563, longitude: 100.5018, timezone: "Asia/Bangkok" },
    { name: "Cairo", country: "Egypt", country_code: "EG", admin1: "Cairo", latitude: 30.0444, longitude: 31.2357, timezone: "Africa/Cairo" },
    { name: "Dubai", country: "United Arab Emirates", country_code: "AE", admin1: "Dubai", latitude: 25.2048, longitude: 55.2708, timezone: "Asia/Dubai" },
    { name: "Helsinki", country: "Finland", country_code: "FI", admin1: "Uusimaa", latitude: 60.1699, longitude: 24.9384, timezone: "Europe/Helsinki" },
    { name: "Istanbul", country: "Türkiye", country_code: "TR", admin1: "Istanbul", latitude: 41.0082, longitude: 28.9784, timezone: "Europe/Istanbul" },
    { name: "Jakarta", country: "Indonesia", country_code: "ID", admin1: "Jakarta", latitude: -6.2088, longitude: 106.8456, timezone: "Asia/Jakarta" },
    { name: "Lisbon", country: "Portugal", country_code: "PT", admin1: "Lisbon", latitude: 38.7223, longitude: -9.1393, timezone: "Europe/Lisbon" },
    { name: "London", country: "United Kingdom", country_code: "GB", admin1: "England", latitude: 51.5072, longitude: -0.1276, timezone: "Europe/London" },
    { name: "Mexico City", country: "Mexico", country_code: "MX", admin1: "Mexico City", latitude: 19.4326, longitude: -99.1332, timezone: "America/Mexico_City" },
    { name: "New York", country: "United States", country_code: "US", admin1: "New York", latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" },
    { name: "Oslo", country: "Norway", country_code: "NO", admin1: "Oslo", latitude: 59.9139, longitude: 10.7522, timezone: "Europe/Oslo" },
    { name: "Paris", country: "France", country_code: "FR", admin1: "Île-de-France", latitude: 48.8566, longitude: 2.3522, timezone: "Europe/Paris" },
    { name: "Quebec City", country: "Canada", country_code: "CA", admin1: "Quebec", latitude: 46.8139, longitude: -71.208, timezone: "America/Toronto" },
    { name: "Rome", country: "Italy", country_code: "IT", admin1: "Lazio", latitude: 41.9028, longitude: 12.4964, timezone: "Europe/Rome" },
    { name: "Singapore", country: "Singapore", country_code: "SG", admin1: "Singapore", latitude: 1.3521, longitude: 103.8198, timezone: "Asia/Singapore" },
    { name: "Tokyo", country: "Japan", country_code: "JP", admin1: "Tokyo", latitude: 35.6762, longitude: 139.6503, timezone: "Asia/Tokyo" },
    { name: "Vancouver", country: "Canada", country_code: "CA", admin1: "British Columbia", latitude: 49.2827, longitude: -123.1207, timezone: "America/Vancouver" },
    { name: "Warsaw", country: "Poland", country_code: "PL", admin1: "Masovian", latitude: 52.2297, longitude: 21.0122, timezone: "Europe/Warsaw" },
    { name: "Zurich", country: "Switzerland", country_code: "CH", admin1: "Zurich", latitude: 47.3769, longitude: 8.5417, timezone: "Europe/Zurich" }
];

function hideLoadingScreen() {
    const loadingScreen = document.getElementById("loading-screen");
    if (!loadingScreen) return;

    const remainingTime = loadingVisibleUntil - performance.now();
    if (remainingTime > 0) {
        window.clearTimeout(loadingHideTimeout);
        loadingHideTimeout = window.setTimeout(hideLoadingScreen, remainingTime);
        return;
    }

    loadingHideTimeout = null;
    loadingScreen.classList.add("loading-screen-hidden");
    loadingScreen.classList.remove("loading-screen-active");
    loadingScreen.setAttribute("aria-hidden", "true");
}

function showLoadingScreen(city) {
    const loadingScreen = document.getElementById("loading-screen");
    const loadingMessage = document.getElementById("loading-message");
    if (!loadingScreen || !loadingMessage) return;

    window.clearTimeout(loadingHideTimeout);
    loadingHideTimeout = null;
    loadingVisibleUntil = performance.now() + 2000;
    loadingMessage.textContent = `Scanning ${city} // acquiring telemetry`;
    loadingScreen.classList.remove("loading-screen-hidden");
    loadingScreen.classList.remove("loading-screen-active");
    void loadingScreen.offsetWidth;
    loadingScreen.classList.add("loading-screen-active");
    loadingScreen.setAttribute("aria-hidden", "false");
}

function readRecentLocations() {
    try {
        const savedLocations = JSON.parse(localStorage.getItem(RECENT_LOCATIONS_KEY) || "[]");
        return Array.isArray(savedLocations)
            ? savedLocations.filter(location =>
                location
                && typeof location.name === "string"
                && Number.isFinite(location.latitude)
                && Number.isFinite(location.longitude)
            )
            : [];
    } catch (error) {
        console.warn("Recent places could not be loaded.", error);
        return [];
    }
}

function saveRecentLocation(location) {
    const recentLocations = readRecentLocations().filter(savedLocation =>
        savedLocation.name.toLocaleLowerCase() !== location.name.toLocaleLowerCase()
        || savedLocation.country_code !== location.country_code
    );
    recentLocations.unshift({
        name: location.name,
        country: location.country,
        country_code: location.country_code,
        admin1: location.admin1,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone,
        timezone_abbreviation: location.timezone_abbreviation
    });

    try {
        localStorage.setItem(RECENT_LOCATIONS_KEY, JSON.stringify(recentLocations.slice(0, MAX_RECENT_LOCATIONS)));
    } catch (error) {
        console.warn("Recent place could not be saved.", error);
    }
}

function normalizeLocationName(name) {
    return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function sortLocationSuggestions(locations) {
    const uniqueLocations = new Map();
    for (const location of locations) {
        const key = [
            normalizeLocationName(location.name),
            location.country_code || ""
        ].join("|");
        if (!uniqueLocations.has(key)) uniqueLocations.set(key, location);
    }

    return [...uniqueLocations.values()].sort((first, second) =>
        LOCATION_NAME_COLLATOR.compare(first.name, second.name)
        || LOCATION_NAME_COLLATOR.compare(first.country || "", second.country || "")
    );
}

function getQuickLocationSuggestions(query, recentLocations) {
    const normalizedQuery = normalizeLocationName(query.trim());
    const matches = [
        ...recentLocations.filter(location =>
            normalizeLocationName(location.name).startsWith(normalizedQuery)
        ),
        ...FEATURED_LOCATIONS.filter(location =>
            normalizeLocationName(location.name).startsWith(normalizedQuery) && !recentLocations.some(recent =>
                normalizeLocationName(recent.name) === normalizeLocationName(location.name)
                && recent.country_code === location.country_code
            )
        )
    ];

    return sortLocationSuggestions(matches);
}

function getBlankLocationSuggestions(recentLocations) {
    const recentPlaces = recentLocations.slice(0, 6);
    const featuredPlaces = FEATURED_LOCATIONS.filter(location =>
        !recentPlaces.some(recent =>
            recent.name.toLocaleLowerCase() === location.name.toLocaleLowerCase()
            && recent.country_code === location.country_code
        )
    );

    return [...recentPlaces, ...featuredPlaces].slice(0, 6);
}

function hideLocationSuggestions(inputId = "city-input", listId = "location-suggestions") {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(listId);
    if (!input || !suggestions) return;

    window.clearTimeout(suggestionTimer);
    suggestionController?.abort();
    suggestionSequence += 1;
    suggestionController = null;
    suggestions.hidden = true;
    suggestions.replaceChildren();
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    suggestionLocations = [];
    activeSuggestionIndex = -1;
}

function showLocationSuggestions(locations, {
    recent = false,
    recentCount = 0,
    query = "",
    attribution = false,
    inputId = "city-input",
    listId = "location-suggestions",
    onSelect = null
} = {}) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(listId);
    if (!input || !suggestions) return;

    suggestionLocations = locations;
    activeSuggestionIndex = -1;
    suggestions.replaceChildren();

    if (!locations.length) {
        const emptyState = document.createElement("p");
        emptyState.className = "location-suggestions-empty";
        emptyState.textContent = query ? "No matching locations found" : "Search for a city to see suggestions";
        suggestions.append(emptyState);
    } else {
        const appendHeading = text => {
            const heading = document.createElement("p");
            heading.className = "location-suggestions-heading";
            heading.textContent = text;
            suggestions.append(heading);
        };
        const appendOptions = (places, offset = 0) => {
            places.forEach((location, placeIndex) => {
                const index = offset + placeIndex;
                const option = document.createElement("button");
                option.type = "button";
                option.id = `location-suggestion-${inputId}-${index}`;
                option.className = "location-suggestion";
                option.setAttribute("role", "option");
                option.setAttribute("aria-selected", "false");

                const name = document.createElement("span");
                name.className = "location-suggestion-name";
                name.textContent = location.name;

                option.append(name);
                option.addEventListener("mousedown", event => event.preventDefault());
                option.addEventListener("click", () => selectLocationSuggestion(index, inputId, listId, onSelect));
                suggestions.append(option);
            });
        };

        if (recent && recentCount > 0) {
            appendHeading("RECENT PLACES");
            appendOptions(locations.slice(0, recentCount));
            if (locations.length > recentCount) {
                appendHeading("SUGGESTED PLACES");
                appendOptions(locations.slice(recentCount), recentCount);
            }
        } else {
            appendHeading(query ? "MATCHING PLACES" : "PLACES TO EXPLORE");
            appendOptions(locations);
        }

        if (attribution) {
            const credit = document.createElement("p");
            credit.className = "location-suggestions-credit";
            credit.textContent = "Place data © OpenStreetMap contributors";
            suggestions.append(credit);
        }
    }

    suggestions.hidden = false;
    input.setAttribute("aria-expanded", "true");
}

function selectLocationSuggestion(index, inputId, listId, onSelect) {
    const location = suggestionLocations[index];
    const input = document.getElementById(inputId);
    if (!location || !input) return;

    input.value = location.name;
    hideLocationSuggestions(inputId, listId);
    if (onSelect) onSelect(location);
    else fetchWeather(location.name, true, location);
}

function setActiveSuggestion(index, inputId, listId) {
    const input = document.getElementById(inputId);
    const options = [...document.querySelectorAll(`#${listId} [role='option']`)];
    if (!input || !options.length) return;

    activeSuggestionIndex = (index + options.length) % options.length;
    options.forEach((option, optionIndex) => {
        const isActive = optionIndex === activeSuggestionIndex;
        option.setAttribute("aria-selected", String(isActive));
        if (isActive) {
            input.setAttribute("aria-activedescendant", option.id);
            option.scrollIntoView({ block: "nearest" });
        }
    });
}

async function loadLocationSuggestions(query, inputId = "city-input", listId = "location-suggestions", onSelect = null) {
    const sequence = ++suggestionSequence;
    const normalizedQuery = query.trim();
    const recentLocations = readRecentLocations();
    suggestionController?.abort();
    suggestionController = null;

    if (!normalizedQuery) {
        const places = getBlankLocationSuggestions(recentLocations);
        showLocationSuggestions(places, {
            recent: recentLocations.length > 0,
            recentCount: Math.min(recentLocations.length, places.length),
            inputId,
            listId,
            onSelect
        });
        return places;
    }

    let quickSuggestions = getQuickLocationSuggestions(normalizedQuery, recentLocations);
    showLocationSuggestions(quickSuggestions, { query: normalizedQuery, inputId, listId, onSelect });

    try {
        const controller = new AbortController();
        suggestionController = controller;
        const response = await fetch(
            `https://photon.komoot.io/api/?q=${encodeURIComponent(normalizedQuery)}&limit=100&lang=en`,
            { signal: controller.signal }
        );
        if (!response.ok) throw new Error("Location suggestions are unavailable.");

        const data = await response.json();
        if (sequence !== suggestionSequence || document.activeElement !== document.getElementById(inputId)) return [];

        const normalizedQueryKey = normalizeLocationName(normalizedQuery);
        const results = (data.features || []).flatMap(feature => {
            const properties = feature.properties;
            const coordinates = feature.geometry?.coordinates;
            if (
                properties?.osm_key !== "place"
                || !["city", "town", "village"].includes(properties.osm_value)
                || typeof properties.name !== "string"
                || !normalizeLocationName(properties.name).startsWith(normalizedQueryKey)
                || !Array.isArray(coordinates)
                || !Number.isFinite(coordinates[0])
                || !Number.isFinite(coordinates[1])
            ) return [];

            return [{
                name: properties.name,
                country: properties.country,
                country_code: properties.countrycode?.toUpperCase(),
                admin1: properties.state,
                latitude: coordinates[1],
                longitude: coordinates[0]
            }];
        });
        quickSuggestions = quickSuggestions.filter(location =>
            !results.some(result =>
                normalizeLocationName(result.name) === normalizeLocationName(location.name)
                && result.country_code === location.country_code
                && result.latitude === location.latitude
                && result.longitude === location.longitude
            )
        );

        const suggestions = sortLocationSuggestions([...results, ...quickSuggestions]);
        showLocationSuggestions(
            suggestions,
            { query: normalizedQuery, attribution: true, inputId, listId, onSelect }
        );
        return suggestions;
    } catch (error) {
        if (sequence !== suggestionSequence) return [];
        if (error.name === "AbortError") return [];
        console.error(error);
        showLocationSuggestions(quickSuggestions, { query: normalizedQuery, inputId, listId, onSelect });
        return quickSuggestions;
    } finally {
        if (sequence === suggestionSequence) suggestionController = null;
    }
}

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

function reportCondition(code) {
    const descriptions = {
        0: "Clear sky",
        1: "Mainly clear",
        2: "Partly cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Depositing rime fog",
        51: "Light drizzle",
        53: "Moderate drizzle",
        55: "Dense drizzle",
        56: "Light freezing drizzle",
        57: "Dense freezing drizzle",
        61: "Light rain",
        63: "Moderate rain",
        65: "Heavy rain",
        66: "Light freezing rain",
        67: "Heavy freezing rain",
        71: "Light snow",
        73: "Moderate snow",
        75: "Heavy snow",
        77: "Snow grains",
        80: "Light rain showers",
        81: "Moderate rain showers",
        82: "Violent rain showers",
        85: "Light snow showers",
        86: "Heavy snow showers",
        95: "Thunderstorm",
        96: "Thunderstorm with light hail",
        99: "Thunderstorm with heavy hail"
    };
    return descriptions[code] || "Conditions unavailable";
}

function reportNumber(value, digits = 0, suffix = "") {
    return Number.isFinite(value) ? `${value.toFixed(digits)}${suffix}` : "Not available";
}

function reportCardinalDirection(degrees) {
    if (!Number.isFinite(degrees)) return "Not available";
    return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}

function reportEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function reportInsight(snapshot) {
    const { current, daily } = snapshot.weather;
    const high = daily.temperature_2m_max[0];
    const low = daily.temperature_2m_min[0];
    const wind = current.wind_speed_10m;
    const rainChance = daily.precipitation_probability_max?.[0];
    const uv = daily.uv_index_max?.[0];
    const notes = [];

    if (Number.isFinite(rainChance) && rainChance >= 50) {
        notes.push("Rain is a meaningful possibility today; keep a light rain layer handy.");
    } else if ((current.precipitation || 0) > 0) {
        notes.push("Precipitation is being recorded now; allow extra time for outdoor plans.");
    }
    if (Number.isFinite(uv) && uv >= 6) {
        notes.push("The forecast UV index is high; shade and sun protection are sensible outdoors.");
    }
    if (Number.isFinite(wind) && wind >= 30) {
        notes.push("Breezy conditions may affect exposed or lightweight items.");
    }
    if (Number.isFinite(high) && high >= 30) {
        notes.push("The forecast high is hot; plan water breaks and shaded pauses.");
    } else if (Number.isFinite(low) && low <= 0) {
        notes.push("Freezing temperatures are possible today; dress in warm layers.");
    }
    if (!notes.length) {
        notes.push("No strong rain, heat, or wind signal stands out in the available readings. Check the hourly outlook before heading out.");
    }
    return notes;
}

function buildDragonReport(snapshot) {
    const { location, weather } = snapshot;
    const { current, hourly, daily } = weather;
    const currentCondition = reportCondition(current.weather_code);
    const high = daily.temperature_2m_max[0];
    const low = daily.temperature_2m_min[0];
    const currentTemperature = reportNumber(current.temperature_2m, 1, "°C");
    const feelsLike = reportNumber(current.apparent_temperature, 1, "°C");
    const dayHigh = reportNumber(high, 1, "°C");
    const dayLow = reportNumber(low, 1, "°C");
    const currentIndex = Math.max(0, hourly.time.findIndex(time => time >= current.time));
    const hourlyRows = hourly.time.slice(currentIndex, currentIndex + 6).map((time, index) => {
        const hour = currentIndex + index;
        return `<tr>
            <th scope="row">${reportEscape(time.split("T")[1]?.slice(0, 5) || "—")}</th>
            <td>${reportNumber(hourly.temperature_2m[hour], 1, "°C")}</td>
            <td>${reportEscape(reportCondition(hourly.weather_code?.[hour]))}</td>
            <td>${reportNumber(hourly.precipitation_probability?.[hour], 0, "%")}</td>
            <td>${reportNumber(hourly.wind_speed_10m?.[hour], 0, " km/h")}</td>
        </tr>`;
    }).join("");
    const generatedAt = new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium", timeStyle: "short",
        ...(location.timezone ? { timeZone: location.timezone } : {})
    }).format(snapshot.generatedAt);
    const localDate = current.time?.replace("T", " ") || "Local time unavailable";
    const sunrise = daily.sunrise?.[0]?.split("T")[1] || "Not available";
    const sunset = daily.sunset?.[0]?.split("T")[1] || "Not available";
    const humidity = current.relative_humidity_2m;
    let humidityMeaning = "Humidity measures moisture in the air; individual comfort varies.";
    if (Number.isFinite(humidity) && humidity < 30) humidityMeaning = "The air is relatively dry, which can feel drying for skin and eyes.";
    else if (Number.isFinite(humidity) && humidity <= 60) humidityMeaning = "This is a moderate humidity range for many people.";
    else if (Number.isFinite(humidity)) humidityMeaning = "The air is humid; it can feel warmer and slow sweat evaporation.";

    let windMeaning = "Wind is a measure of air movement near the surface.";
    if (Number.isFinite(current.wind_speed_10m)) {
        if (current.wind_speed_10m < 12) windMeaning = "Light winds; outdoor movement should generally feel calm.";
        else if (current.wind_speed_10m < 30) windMeaning = "Noticeable breeze; loose items may move around.";
        else if (current.wind_speed_10m < 50) windMeaning = "Strong breeze; consider this for cycling and exposed outdoor plans.";
        else windMeaning = "Very strong winds; take care in exposed areas and secure loose items.";
    }
    const pressureMeaning = Number.isFinite(current.pressure_msl)
        ? `Sea-level pressure is ${reportNumber(current.pressure_msl, 0, " hPa")}. A single reading is context, not a stand-alone forecast; changes over time are more informative.`
        : "Pressure reading is not available.";
    const visibilityMeaning = Number.isFinite(current.visibility)
        ? current.visibility < 1000 ? "Visibility is reduced; take extra care on roads and paths."
            : current.visibility < 5000 ? "Visibility is somewhat limited; be alert while travelling."
                : "Visibility is currently good based on this reading."
        : "Visibility reading is not available.";
    const rainAmount = Number.isFinite(current.precipitation) ? `${current.precipitation.toFixed(1)} mm now` : "Not available";
    const rainChance = reportNumber(daily.precipitation_probability_max?.[0], 0, "%");
    const rainTotal = reportNumber(daily.precipitation_sum?.[0], 1, " mm");
    const uvIndex = reportNumber(current.uv_index, 1);
    const uvMax = reportNumber(daily.uv_index_max?.[0], 1);
    const uvMeaning = Number.isFinite(current.uv_index)
        ? current.uv_index >= 6 ? "High at this reading; shade and sun protection are sensible outdoors."
            : current.uv_index >= 3 ? "Moderate at this reading; consider sun protection during extended time outdoors."
                : "Low at this reading."
        : "UV reading is not available.";
    const notes = reportInsight(snapshot);
    const locationName = `${location.name}${location.admin1 ? `, ${location.admin1}` : ""}${location.country ? `, ${location.country}` : ""}`;
    const vectorDragon = `<svg class="dragon-vector-icon" viewBox="0 0 160 120" aria-hidden="true">
        <path class="dragon-vector-tail" d="M58 79c-14 2-24-12-35-10-10 2-12 14-3 19 8 4 16-2 17-10"></path>
        <path class="dragon-vector-wing" d="M72 65C51 54 45 36 49 15c12 11 24 13 37 2 5 18 17 29 37 34-16 4-28 14-36 31z"></path>
        <path class="dragon-vector-wing-detail" d="M56 37c10 9 20 14 32 15L86 20M88 52c12 0 23 2 35 0-15 8-26 17-36 30"></path>
        <path class="dragon-vector-body" d="M43 77c14-13 28-19 43-18 12-14 27-20 45-17l12 8 13 2-9 8-13 1c-5 12-18 20-35 22l-22-1c-12 8-24 9-37 3"></path>
        <path class="dragon-vector-neck" d="M91 58c10-10 22-15 37-16l-5 14c-7 13-20 21-38 24l-13-6z"></path>
        <path class="dragon-vector-horn" d="M125 44l5-17 7 13 10-10-2 17M137 47l8-13 2 14"></path>
        <path class="dragon-vector-leg" d="M77 81l10 2-2 14-7 5-6-3 4-6M103 79l11-4 5 12-4 7-7-2 2-6"></path>
        <path class="dragon-vector-scale" d="M103 62l4 3 4-4 4 3 4-4"></path>
        <circle class="dragon-vector-eye" cx="137" cy="48" r="2.5"></circle>
        <circle class="dragon-vector-nostril" cx="153" cy="54" r="1.5"></circle>
    </svg>`;

    return `
        <div class="dragon-report-hero">
            <div class="dragon-report-hero-copy">
                <p class="dragon-report-kicker">FIELD REPORT // ${reportEscape(location.country_code || "LOCAL")}</p>
                <h1 id="dragon-report-title">${reportEscape(location.name)} <span>Weather Report</span></h1>
                <p class="dragon-report-location">${reportEscape(locationName)}</p>
                <p class="dragon-report-summary">The sky is reporting <strong>${reportEscape(currentCondition.toLowerCase())}</strong> at <strong>${currentTemperature}</strong>. It feels like <strong>${feelsLike}</strong>. Today is forecast to range from <strong>${dayLow}</strong> to <strong>${dayHigh}</strong>.</p>
                <p class="dragon-report-timestamp">OBSERVED ${reportEscape(localDate)} LOCAL · GENERATED ${reportEscape(generatedAt)}</p>
            </div>
            <div class="dragon-report-crest" aria-hidden="true"><span>DR</span>${vectorDragon}<small>WINDWARD<br>ARCHIVE</small></div>
        </div>
        <section class="dragon-report-section" aria-labelledby="dragon-current-heading">
            <div class="dragon-report-section-heading"><span>01</span><div><p>LIVE TELEMETRY</p><h2 id="dragon-current-heading">At a glance</h2></div></div>
            <div class="dragon-report-metrics">
                <div class="dragon-report-metric dragon-report-metric-feature"><span>NOW</span><strong>${currentTemperature}</strong><small>${reportEscape(currentCondition)}</small></div>
                <div class="dragon-report-metric"><span>FEELS LIKE</span><strong>${feelsLike}</strong><small>Perceived temperature</small></div>
                <div class="dragon-report-metric"><span>TODAY'S RANGE</span><strong>${dayLow} <i>—</i> ${dayHigh}</strong><small>Forecast low to high</small></div>
                <div class="dragon-report-metric"><span>HUMIDITY</span><strong>${reportNumber(humidity, 0, "%")}</strong><small>${reportEscape(humidityMeaning)}</small></div>
                <div class="dragon-report-metric"><span>WIND</span><strong>${reportNumber(current.wind_speed_10m, 1, " km/h")}</strong><small>${reportEscape(reportCardinalDirection(current.wind_direction_10m))} · gusts ${reportNumber(current.wind_gusts_10m, 1, " km/h")} · forecast peak ${reportNumber(daily.wind_speed_10m_max?.[0], 1, " km/h")}</small></div>
                <div class="dragon-report-metric"><span>PRECIPITATION</span><strong>${reportEscape(rainChance)}</strong><small>${reportEscape(rainAmount)} · ${reportEscape(rainTotal)} forecast today</small></div>
            </div>
        </section>
        <section class="dragon-report-section" aria-labelledby="dragon-reading-heading">
            <div class="dragon-report-section-heading"><span>02</span><div><p>THE READ OF THE SKY</p><h2 id="dragon-reading-heading">What these numbers mean</h2></div></div>
            <div class="dragon-report-reading-grid">
                <article><h3>Wind &amp; gusts</h3><p>${reportEscape(windMeaning)} Gusts are brief stronger bursts, so they can feel sharper than the sustained wind.</p></article>
                <article><h3>Moisture &amp; rain</h3><p>${reportEscape(humidityMeaning)} The rain chance is the forecast likelihood of measurable precipitation at a point during today; it is not the percentage of the day that will be rainy.</p></article>
                <article><h3>Pressure &amp; visibility</h3><p>${reportEscape(pressureMeaning)} ${reportEscape(visibilityMeaning)}</p></article>
                <article><h3>Clouds, dew point &amp; UV</h3><p>Cloud cover: ${reportNumber(current.cloud_cover, 0, "%")}. Dew point: ${reportNumber(current.dew_point_2m, 1, "°C")}. UV index: ${uvIndex} now, ${uvMax} forecast maximum. ${reportEscape(uvMeaning)}</p></article>
            </div>
        </section>
        <section class="dragon-report-section" aria-labelledby="dragon-outlook-heading">
            <div class="dragon-report-section-heading"><span>03</span><div><p>THE NEXT LEG</p><h2 id="dragon-outlook-heading">Hourly outlook</h2></div></div>
            <div class="dragon-report-table-wrap"><table class="dragon-report-table">
                <thead><tr><th scope="col">LOCAL TIME</th><th scope="col">TEMP</th><th scope="col">CONDITIONS</th><th scope="col">RAIN CHANCE</th><th scope="col">WIND</th></tr></thead>
                <tbody>${hourlyRows || '<tr><td colspan="5">Hourly outlook is not available.</td></tr>'}</tbody>
            </table></div>
            <div class="dragon-report-sunrise"><span>☼</span> Sunrise <strong>${reportEscape(sunrise)}</strong><span class="dragon-report-sunset-mark">◒</span> Sunset <strong>${reportEscape(sunset)}</strong><span class="dragon-report-local-label">${reportEscape(location.timezone_abbreviation || location.timezone || "LOCAL TIME")}</span></div>
        </section>
        <section class="dragon-report-section dragon-report-field-notes" aria-labelledby="dragon-notes-heading">
            <div class="dragon-report-section-heading"><span>04</span><div><p>THE DRAGON'S FIELD NOTES</p><h2 id="dragon-notes-heading">Plan for the day</h2></div></div>
            <ul>${notes.map(note => `<li>${reportEscape(note)}</li>`).join("")}</ul>
        </section>
        <footer class="dragon-report-footer">
            <span>DRAGON WEATHER // FIELD DOSSIER</span>
            <p>Weather can change. This report summarizes the latest available Open-Meteo readings and forecast for this location; it is general information, not an official warning.</p>
        </footer>`;
}

function renderDragonReport() {
    if (!dragonReportSnapshot) return;
    const modal = document.getElementById("dragon-report-modal");
    const content = document.getElementById("dragon-report-content");
    content.innerHTML = buildDragonReport(dragonReportSnapshot);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("dragon-report-open");
    lucide.createIcons();
    document.getElementById("close-dragon-report").focus();
}

function hideDragonReportLoading() {
    const loading = document.getElementById("dragon-report-loading");
    if (!loading || loading.hidden) return;
    window.clearTimeout(dragonReportLoadingTimer);
    dragonReportLoadingTimer = null;
    loading.hidden = true;
    loading.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dragon-report-loading-open");
    document.getElementById("open-dragon-report").disabled = !dragonReportSnapshot;
    document.getElementById("download-dragon-report").disabled = false;
}

function showDragonReportLoading(onComplete) {
    if (!dragonReportSnapshot) return;
    window.clearTimeout(dragonReportLoadingTimer);
    const loading = document.getElementById("dragon-report-loading");
    loading.hidden = false;
    loading.setAttribute("aria-hidden", "false");
    document.body.classList.add("dragon-report-loading-open");
    document.getElementById("open-dragon-report").disabled = true;
    document.getElementById("download-dragon-report").disabled = true;
    void loading.offsetWidth;
    loading.classList.remove("dragon-report-loading-active");
    void loading.offsetWidth;
    loading.classList.add("dragon-report-loading-active");
    dragonReportLoadingTimer = window.setTimeout(() => {
        hideDragonReportLoading();
        onComplete();
    }, 2000);
}

function openDragonReport() {
    if (!dragonReportSnapshot) return;
    renderDragonReport();
    showDragonReportLoading(() => {
        document.getElementById("close-dragon-report").focus();
    });
}

function closeDragonReport() {
    const modal = document.getElementById("dragon-report-modal");
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("dragon-report-open");
    document.getElementById("open-dragon-report").focus();
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

async function fetchWeather(city, showLoading = false, selectedLocation = null) {
    const requestId = ++requestSequence;
    const status = document.getElementById("system-status");

    if (showLoading) showLoadingScreen(city);

    try {
        if (status) status.innerText = `Acquiring telemetry for ${city}...`;
        let location = selectedLocation;
        if (!location) {
            const locationResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
            if (!locationResponse.ok) throw new Error("Target coordinates not found.");
            const locationData = await locationResponse.json();
            location = locationData.results?.[0];
        }
        if (!location) throw new Error(`Location not found: ${city}`);

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,dew_point_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,weather_code,cloud_cover,visibility,precipitation,rain,uv_index,is_day&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,relative_humidity_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=1`);
        if (!weatherResponse.ok) throw new Error("Telemetry link severed.");
        const weatherData = await weatherResponse.json();
        const current = weatherData.current;
        if (requestId !== requestSequence) return;
        location.timezone = location.timezone || weatherData.timezone;
        location.timezone_abbreviation = location.timezone_abbreviation || weatherData.timezone_abbreviation;
        currentWeatherLocation = location;
        dragonReportSnapshot = { location: { ...location }, weather: weatherData, generatedAt: new Date() };
        document.getElementById("open-dragon-report").disabled = false;

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
        if (status) status.innerText = `Telemetry nominal // ${location.timezone_abbreviation || location.timezone || "local time"}`;

        saveRecentLocation(location);
        updateDragonHologram(current.weather_code);
        lucide.createIcons();
        renderChart(hourlyLabels, hourlyTemps);
    } catch (err) {
        if (requestId !== requestSequence) return;
        if (status) status.innerText = `Telemetry error // ${err.message}`;
        console.error(err);
    } finally {
        if (showLoading && requestId === requestSequence) hideLoadingScreen();
    }
}

function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    if (chartInstance) chartInstance.destroy();
    const theme = getComputedStyle(document.documentElement);
    const chartText = theme.getPropertyValue('--chart-text').trim();
    const chartGrid = theme.getPropertyValue('--chart-grid').trim();

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
            scales: { x: { grid: { color: chartGrid, drawBorder: true, borderColor: chartGrid }, ticks: { color: chartText, font: { family: 'Orbitron', size: 10, weight: 'bold' } } }, y: { grid: { color: chartGrid, borderDash: [5, 5], drawBorder: false }, ticks: { color: chartText, font: { family: 'Orbitron', size: 12, weight: 'bold' }, padding: 10 } } },
            interaction: { intersect: false, mode: 'index' },
            animation: { duration: 1500, easing: 'easeOutQuart' }
        }
    });
}

function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const toggle = document.getElementById('theme-toggle');
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    if (toggle) {
        toggle.setAttribute('aria-label', `Switch to ${nextTheme} mode`);
        toggle.title = `Switch to ${nextTheme} mode`;
        toggle.innerHTML = `<i data-lucide="${theme === 'dark' ? 'sun' : 'moon'}" aria-hidden="true"></i>`;
        lucide.createIcons();
    }

    try {
        localStorage.setItem('weather-dashboard-theme', theme);
    } catch (error) {
        console.warn('Theme preference could not be saved.', error);
    }

    if (chartInstance) {
        const styles = getComputedStyle(document.documentElement);
        const textColor = styles.getPropertyValue('--chart-text').trim();
        const gridColor = styles.getPropertyValue('--chart-grid').trim();
        chartInstance.options.scales.x.ticks.color = textColor;
        chartInstance.options.scales.x.grid.color = gridColor;
        chartInstance.options.scales.x.grid.borderColor = gridColor;
        chartInstance.options.scales.y.ticks.color = textColor;
        chartInstance.options.scales.y.grid.color = gridColor;
        chartInstance.update('none');
    }
}

async function loadHeaderBar() {
    const mount = document.getElementById("header-bar");
    if (!mount) return false;

    const response = await fetch("header-bar.html");
    if (!response.ok) throw new Error("Header component could not be loaded");
    mount.innerHTML = await response.text();
    return true;
}

function bindLocationAutocomplete(inputId, listId, onSelect = null) {
    const input = document.getElementById(inputId);
    const field = input?.closest(".search-field");
    if (!input || !field) throw new Error(`Location search elements are missing for ${inputId}.`);

    const showBlankSuggestions = () => {
        if (input.value.trim()) return;
        const recentLocations = readRecentLocations();
        const places = getBlankLocationSuggestions(recentLocations);
        showLocationSuggestions(places, {
            recent: recentLocations.length > 0,
            recentCount: Math.min(recentLocations.length, places.length),
            inputId,
            listId,
            onSelect
        });
    };

    field.addEventListener("mouseenter", showBlankSuggestions);
    field.addEventListener("mouseleave", () => {
        if (document.activeElement !== input) hideLocationSuggestions(inputId, listId);
    });
    input.addEventListener("focus", () => {
        window.clearTimeout(suggestionTimer);
        suggestionTimer = null;
        if (input.value.trim()) loadLocationSuggestions(input.value, inputId, listId, onSelect);
        else showBlankSuggestions();
    });
    input.addEventListener("input", () => {
        window.clearTimeout(suggestionTimer);
        suggestionSequence += 1;
        suggestionController?.abort();
        suggestionController = null;

        const query = input.value.trim();
        if (!query) {
            showBlankSuggestions();
        } else {
            const quickSuggestions = getQuickLocationSuggestions(query, readRecentLocations());
            showLocationSuggestions(quickSuggestions, { query, inputId, listId, onSelect });
            suggestionTimer = window.setTimeout(
                () => loadLocationSuggestions(query, inputId, listId, onSelect),
                250
            );
        }
    });
    input.addEventListener("keydown", event => {
        if (event.key === "ArrowDown" && suggestionLocations.length) {
            event.preventDefault();
            setActiveSuggestion(activeSuggestionIndex + 1, inputId, listId);
        } else if (event.key === "ArrowUp" && suggestionLocations.length) {
            event.preventDefault();
            setActiveSuggestion(
                activeSuggestionIndex < 0 ? suggestionLocations.length - 1 : activeSuggestionIndex - 1,
                inputId,
                listId
            );
        } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
            event.preventDefault();
            selectLocationSuggestion(activeSuggestionIndex, inputId, listId, onSelect);
        } else if (event.key === "Escape") {
            hideLocationSuggestions(inputId, listId);
        }
    });
    input.addEventListener("blur", () => {
        window.clearTimeout(suggestionTimer);
        suggestionTimer = window.setTimeout(() => {
            if (field.matches(":hover") && !input.value.trim()) showBlankSuggestions();
            else hideLocationSuggestions(inputId, listId);
        }, 120);
    });
}

function setMapSelection(location, latitude, longitude, panToLocation = false) {
    mapSelectedLocation = { ...location, latitude, longitude };
    const label = document.getElementById("map-selected-place");
    const useButton = document.getElementById("map-use-location");
    if (label) label.textContent = `${mapSelectedLocation.name} · ${latitude.toFixed(4)}, ${longitude.toFixed(4)} — preview only`;
    if (useButton) useButton.disabled = false;
    const confirmationPlace = document.getElementById("map-confirmation-place");
    if (confirmationPlace) confirmationPlace.textContent = mapSelectedLocation.name;

    if (window.L && mapInstance) {
        const markerIcon = window.L.divIcon({
            className: "weather-map-marker",
            html: "<span></span>",
            iconSize: [26, 26],
            iconAnchor: [13, 13]
        });
        if (mapMarker) mapMarker.setLatLng([latitude, longitude]);
        else mapMarker = window.L.marker([latitude, longitude], { icon: markerIcon }).addTo(mapInstance);
        if (panToLocation) mapInstance.setView([latitude, longitude], Math.max(mapInstance.getZoom(), 10));
    }
}

async function reverseGeocodeLocation(latitude, longitude, fallbackName) {
    const response = await fetch(
        `https://photon.komoot.io/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&lang=en`
    );
    if (!response.ok) throw new Error("Place name lookup is unavailable.");

    const data = await response.json();
    const properties = data.features?.[0]?.properties;
    return {
        name: properties?.city || properties?.name || properties?.county || fallbackName,
        country: properties?.country,
        country_code: properties?.countrycode?.toUpperCase(),
        admin1: properties?.state,
        latitude,
        longitude
    };
}

function updateLocationMapStatus(message) {
    const status = document.getElementById("location-map-status");
    if (status) status.textContent = message;
}

function requestCurrentLocation() {
    const session = mapSessionSequence;
    const selection = mapSelectionSequence;
    if (!navigator.geolocation) {
        updateLocationMapStatus("Location detection is not available in this browser. Click the map to choose a place.");
        return;
    }

    updateLocationMapStatus("Requesting permission to locate you...");
    navigator.geolocation.getCurrentPosition(async position => {
        const { latitude, longitude } = position.coords;
        let location = {
            name: "Your location",
            latitude,
            longitude,
            timezone: "auto"
        };
        try {
            location = await reverseGeocodeLocation(latitude, longitude, "Your location");
        } catch (error) {
            console.warn("Your location was found, but its place name could not be loaded.", error);
        }

        if (!mapOpen || session !== mapSessionSequence || selection !== mapSelectionSequence) return;
        setMapSelection(location, latitude, longitude, true);
        updateLocationMapStatus(`Located ${location.name}. Preview only; apply weather when you're ready.`);
    }, error => {
        if (!mapOpen || session !== mapSessionSequence || selection !== mapSelectionSequence) return;
        const message = error.code === 1
            ? "Location permission was denied. Click the map to choose a place manually."
            : error.code === 3
                ? "Location detection timed out. Try again or click the map to choose a place."
                : "Your location could not be detected. Click the map to choose a place.";
        updateLocationMapStatus(message);
    }, { enableHighAccuracy: false, maximumAge: 60000, timeout: 12000 });
}

async function handleMapClick(event) {
    const sequence = ++mapSelectionSequence;
    const { lat, lng } = event.latlng;
    const fallbackName = `Selected location`;
    const initialLocation = { name: fallbackName, latitude: lat, longitude: lng };
    setMapSelection(initialLocation, lat, lng);
    updateLocationMapStatus("Looking up this place...");

    try {
        const location = await reverseGeocodeLocation(lat, lng, fallbackName);
        if (sequence !== mapSelectionSequence || !mapOpen) return;
        setMapSelection(location, lat, lng);
        updateLocationMapStatus(`${location.name} selected. This is only a preview until you apply the weather.`);
    } catch (error) {
        if (sequence !== mapSelectionSequence || !mapOpen) return;
        console.warn("Selected coordinates could not be reverse geocoded.", error);
        updateLocationMapStatus("Coordinates selected. This is only a preview until you apply the weather.");
    }
}

async function openLocationMap() {
    const modal = document.getElementById("location-map-modal");
    const transition = document.getElementById("map-transition-screen");
    if (!modal || !transition || mapOpen) return;

    hideLocationSuggestions("city-input", "location-suggestions");
    mapOpen = true;
    mapSessionSequence += 1;
    mapSelectedLocation = null;
    mapSelectionSequence += 1;
    document.getElementById("map-city-input").value = "";
    if (mapMarker) {
        mapMarker.remove();
        mapMarker = null;
    }
    document.getElementById("map-use-location").disabled = true;
    document.getElementById("map-selected-place").textContent = "Click anywhere on the map to set a location.";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("location-map-open");
    transition.hidden = false;
    transition.setAttribute("aria-hidden", "false");
    updateLocationMapStatus("Requesting location access and preparing the map...");
    requestCurrentLocation();

    const session = mapSessionSequence;
    try {
        if (!window.L) throw new Error("The interactive map library could not be loaded.");
        const mapElement = document.getElementById("location-map");
        if (!mapInstance) {
            mapInstance = window.L.map(mapElement, {
                zoomControl: true,
                worldCopyJump: true,
                scrollWheelZoom: false
            });
            window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>'
            }).addTo(mapInstance);
            mapInstance.on("click", handleMapClick);
            mapInstance.on("tileerror", () => updateLocationMapStatus("Some map tiles could not load. You can still search for places."));
        }
        const initialView = currentWeatherLocation
            ? [currentWeatherLocation.latitude, currentWeatherLocation.longitude]
            : [20, 0];
        mapInstance.setView(initialView, currentWeatherLocation ? 5 : 2);
        window.setTimeout(() => mapInstance?.invalidateSize(), 50);
        if (mapSelectedLocation) {
            setMapSelection(
                mapSelectedLocation,
                mapSelectedLocation.latitude,
                mapSelectedLocation.longitude,
                true
            );
        }
        lucide.createIcons();
    } catch (error) {
        updateLocationMapStatus(`${error.message} Use the search field to choose a place instead.`);
        console.error(error);
    }

    await new Promise(resolve => window.setTimeout(resolve, 2000));
    if (session !== mapSessionSequence) return;
    transition.hidden = true;
    transition.setAttribute("aria-hidden", "true");
    if (mapOpen) document.getElementById("map-city-input").focus();
}

function closeLocationMap() {
    const modal = document.getElementById("location-map-modal");
    if (!modal || modal.hidden) return;

    mapOpen = false;
    mapSessionSequence += 1;
    mapSelectionSequence += 1;
    const transition = document.getElementById("map-transition-screen");
    transition.hidden = true;
    transition.setAttribute("aria-hidden", "true");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("map-weather-confirmation").hidden = true;
    document.body.classList.remove("location-map-open");
    hideLocationSuggestions("map-city-input", "map-location-suggestions");
    document.getElementById("open-location-map").focus();
}

function showMapWeatherConfirmation() {
    if (!mapSelectedLocation) return;
    const confirmation = document.getElementById("map-weather-confirmation");
    document.getElementById("map-confirmation-place").textContent = mapSelectedLocation.name;
    confirmation.hidden = false;
    document.getElementById("map-confirm-cancel").focus();
}

function cancelMapWeatherConfirmation() {
    const confirmation = document.getElementById("map-weather-confirmation");
    confirmation.hidden = true;
    document.getElementById("map-use-location").focus();
}

function confirmMapWeather() {
    if (!mapSelectedLocation) return;
    const location = mapSelectedLocation;
    closeLocationMap();
    fetchWeather(location.name, true, location);
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        await loadHeaderBar();
    } catch (error) {
        console.error(error);
        hideLoadingScreen();
        return;
    }

    lucide.createIcons();
    bindInteractions();
    const themeToggle = document.getElementById('theme-toggle');
    let savedTheme = null;
    try {
        savedTheme = localStorage.getItem('weather-dashboard-theme');
    } catch (error) {
        console.warn('Theme preference could not be loaded.', error);
    }
    if (savedTheme === 'dark' || savedTheme === 'light') setTheme(savedTheme);
    else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
        try { localStorage.removeItem('weather-dashboard-theme'); } catch (error) { /* Storage is optional. */ }
    }
    themeToggle?.addEventListener('click', () => {
        const currentTheme = document.documentElement.dataset.theme;
        setTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
    fetchWeather("Tokyo");

    const searchForm = document.getElementById("search-form");
    const cityInput = document.getElementById("city-input");
    bindLocationAutocomplete("city-input", "location-suggestions");
    bindLocationAutocomplete("map-city-input", "map-location-suggestions", location => {
        ++mapSelectionSequence;
        setMapSelection(location, location.latitude, location.longitude, true);
        updateLocationMapStatus(`${location.name} selected. This is only a preview until you apply the weather.`);
    });

    document.getElementById("open-location-map").addEventListener("click", openLocationMap);
    document.getElementById("location-map-close").addEventListener("click", closeLocationMap);
    document.getElementById("map-detect-location").addEventListener("click", requestCurrentLocation);
    document.getElementById("map-use-location").addEventListener("click", () => {
        showMapWeatherConfirmation();
    });
    document.getElementById("map-confirm-cancel").addEventListener("click", cancelMapWeatherConfirmation);
    document.getElementById("map-confirm-apply").addEventListener("click", confirmMapWeather);
    document.getElementById("map-search-form").addEventListener("submit", async event => {
        event.preventDefault();
        const mapInput = document.getElementById("map-city-input");
        const query = mapInput.value.trim();
        if (!query) return;
        const onSelect = location => {
            ++mapSelectionSequence;
            setMapSelection(location, location.latitude, location.longitude, true);
            updateLocationMapStatus(`${location.name} selected. This is only a preview until you apply the weather.`);
        };
        const matches = await loadLocationSuggestions(
            query,
            "map-city-input",
            "map-location-suggestions",
            onSelect
        );
        if (!mapOpen || mapInput.value.trim() !== query) return;
        if (matches.length) {
            hideLocationSuggestions("map-city-input", "map-location-suggestions");
            onSelect(matches[0]);
        } else {
            updateLocationMapStatus(`No matching places found for “${query}”.`);
        }
    });
    document.getElementById("location-map-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeLocationMap();
    });
    document.addEventListener("keydown", event => {
        const confirmation = document.getElementById("map-weather-confirmation");
        const reportModal = document.getElementById("dragon-report-modal");
        const reportLoading = document.getElementById("dragon-report-loading");
        if (event.key === "Escape" && !reportLoading.hidden) {
            event.preventDefault();
        } else if (event.key === "Escape" && !reportModal.hidden) {
            closeDragonReport();
        } else if (event.key === "Escape" && !confirmation.hidden) {
            cancelMapWeatherConfirmation();
        } else if (event.key === "Escape" && mapOpen && document.getElementById("map-location-suggestions").hidden) {
            closeLocationMap();
        }
    });

    searchForm.addEventListener("submit", e => {
        e.preventDefault();
        const city = cityInput.value.trim();
        if (city) {
            hideLocationSuggestions();
            fetchWeather(city, true);
        }
    });

    document.getElementById("open-dragon-report").addEventListener("click", openDragonReport);
    document.getElementById("close-dragon-report").addEventListener("click", closeDragonReport);
    document.getElementById("download-dragon-report").addEventListener("click", () => {
        if (!dragonReportSnapshot) return;
        if (document.getElementById("dragon-report-modal").hidden) renderDragonReport();
        showDragonReportLoading(() => {
            const previousTitle = document.title;
            document.title = `${dragonReportSnapshot.location.name} - Dragon Weather Report`;
            window.addEventListener("afterprint", () => { document.title = previousTitle; }, { once: true });
            window.print();
        });
    });
    document.getElementById("dragon-report-modal").addEventListener("click", event => {
        if (event.target === event.currentTarget) closeDragonReport();
    });

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
