document.addEventListener('DOMContentLoaded', () => {
    const weatherInfo = document.getElementById('weatherInfo');
    const searchForm = document.getElementById('searchForm');
    const cityInput = document.getElementById('cityName');
    const popup = document.getElementById('popup');
    const closeBtn = document.querySelector('.close-btn');
    const statusMessage = document.getElementById('statusMessage');
    const recentSearchesEl = document.getElementById('recentSearches');
    const unitToggleBtn = document.getElementById('unitToggleBtn');
    const currentLocationBtn = document.getElementById('currentLocationBtn');

    const storageKey = 'weather-app-recent-cities';

    let isMetric = true;
    let searchedOnce = false;
    let lastQuery = null;

    renderRecentSearches();

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cityName = cityInput.value.trim();

        if (!cityName) {
            setStatus('Please enter a city name.', 'error');
            return;
        }

        await loadAndRenderByCity(cityName);
    });

    unitToggleBtn.addEventListener('click', async () => {
        isMetric = !isMetric;
        unitToggleBtn.textContent = isMetric ? 'Switch to °F' : 'Switch to °C';
        unitToggleBtn.setAttribute('aria-pressed', String(!isMetric));

        if (lastQuery?.type === 'coords') {
            await loadAndRenderByCoords(lastQuery.lat, lastQuery.lon, {
                persistCity: false,
                savedLocationName: lastQuery.locationName
            });
            return;
        }

        const lastCity = lastQuery?.city || cityInput.value.trim() || getRecentSearches()[0];
        if (lastCity) {
            await loadAndRenderByCity(lastCity, false);
        }
    });

    currentLocationBtn.addEventListener('click', async () => {
        if (!window.isSecureContext) {
            setStatus('Current location requires HTTPS or localhost. Search by city instead.', 'error');
            return;
        }

        if (!navigator.geolocation) {
            setStatus('Geolocation is not supported in this browser. Search by city instead.', 'error');
            return;
        }

        setStatus('Detecting your current location...');
        currentLocationBtn.disabled = true;

        try {
            const { coords } = await getCurrentPosition();
            await loadAndRenderByCoords(coords.latitude, coords.longitude);
        } catch (error) {
            console.error('Geolocation error:', error);
            setStatus(getGeolocationErrorMessage(error), 'error');
        } finally {
            currentLocationBtn.disabled = false;
        }
    });

    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    popup.addEventListener('click', (event) => {
        if (event.target === popup) {
            popup.style.display = 'none';
        }
    });

    recentSearchesEl.addEventListener('click', async (event) => {
        const chip = event.target.closest('.recent-chip');
        if (!chip) {
            return;
        }

        const city = chip.dataset.city;
        cityInput.value = city;
        await loadAndRenderByCity(city);
    });

    async function loadAndRenderByCity(cityName, persistCity = true) {
        setStatus('Loading weather data...');
        weatherInfo.innerHTML = '';

        try {
            const location = await fetchLocationByCity(cityName);
            const weatherData = await fetchWeatherByCoords(location.latitude, location.longitude);
            displayWeatherData(weatherData, location);
            cityInput.value = location.name;
            lastQuery = { type: 'city', city: location.name };

            if (persistCity) {
                saveRecentSearch(location.name);
            }

            showFirstSearchPopup();
            setStatus('Weather updated successfully.', 'success');
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setStatus(error.message || 'Something went wrong while fetching weather data.', 'error');
        }
    }

    async function loadAndRenderByCoords(lat, lon, { persistCity = true, savedLocationName = '' } = {}) {
        setStatus('Loading weather data for your current location...');
        weatherInfo.innerHTML = '';

        try {
            const [weatherData, reverseLocation] = await Promise.all([
                fetchWeatherByCoords(lat, lon),
                savedLocationName ? Promise.resolve(null) : fetchLocationByCoords(lat, lon)
            ]);
            const location = reverseLocation || createCoordinateLocation(lat, lon, savedLocationName);

            displayWeatherData(weatherData, location);
            cityInput.value = location.name;
            lastQuery = { type: 'coords', lat, lon, locationName: location.name };

            if (persistCity && location.name) {
                saveRecentSearch(location.name);
            }

            showFirstSearchPopup();
            setStatus('Showing weather for your current location.', 'success');
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setStatus(error.message || 'Could not fetch weather for your current location.', 'error');
        }
    }

    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                maximumAge: 5 * 60 * 1000,
                timeout: 15000
            });
        });
    }

    async function fetchLocationByCity(cityName) {
        const apiUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en&format=json`;
        const response = await fetch(apiUrl);
        const data = await parseApiResponse(response, 'Could not search for that city.');

        if (!data.results?.length) {
            throw new Error('City not found. Please enter a valid city name.');
        }

        return normalizeLocation(data.results[0]);
    }

    async function fetchLocationByCoords(lat, lon) {
        const apiUrl = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&count=1&language=en&format=json`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            return createCoordinateLocation(lat, lon);
        }

        const data = await response.json();
        return data.results?.length ? normalizeLocation(data.results[0]) : createCoordinateLocation(lat, lon);
    }

    async function fetchWeatherByCoords(lat, lon) {
        const params = new URLSearchParams({
            latitude: lat,
            longitude: lon,
            current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
            hourly: 'temperature_2m,precipitation_probability,weather_code',
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset',
            timezone: 'auto',
            forecast_days: '5'
        });

        if (!isMetric) {
            params.set('temperature_unit', 'fahrenheit');
            params.set('wind_speed_unit', 'mph');
        }

        const apiUrl = `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
        const response = await fetch(apiUrl);
        return parseApiResponse(response, 'Weather data is currently unavailable.');
    }

    async function parseApiResponse(response, fallbackMessage) {
        let data = null;

        try {
            data = await response.json();
        } catch {
            throw new Error(fallbackMessage);
        }

        if (!response.ok || data.error) {
            throw new Error(data.reason || data.message || fallbackMessage);
        }

        return data;
    }

    function displayWeatherData(weatherData, location) {
        const current = weatherData.current;
        const currentUnits = weatherData.current_units;
        const daily = weatherData.daily;
        const weather = getWeatherCodeInfo(current.weather_code);
        const locationLabel = formatLocationLabel(location);
        const temperature = `${Math.round(current.temperature_2m)}°${isMetric ? 'C' : 'F'}`;
        const feelsLike = `${Math.round(current.apparent_temperature)}°${isMetric ? 'C' : 'F'}`;
        const humidity = `${current.relative_humidity_2m}%`;
        const windSpeed = `${Math.round(current.wind_speed_10m)} ${currentUnits.wind_speed_10m}`;
        const sunrise = formatApiDateTime(daily.sunrise[0]);
        const sunset = formatApiDateTime(daily.sunset[0]);
        const rainPercent = getCurrentRainChance(weatherData.hourly);
        const nextRainTime = getNextRainTime(weatherData.hourly);
        const dailyForecast = getDailyForecast(daily);

        weatherInfo.innerHTML = `
            <article class="card current-card">
                <div>
                    <h2>${escapeHtml(locationLabel)}</h2>
                    <div class="icon-row">
                        <div class="weather-emoji" role="img" aria-label="${escapeHtml(weather.description)}">${weather.icon}</div>
                        <div>
                            <p class="temp">${temperature}</p>
                            <p>${escapeHtml(weather.description)}</p>
                        </div>
                    </div>
                </div>
                <div class="metrics">
                    <div class="metric">Feels like: <strong>${feelsLike}</strong></div>
                    <div class="metric">Humidity: <strong>${humidity}</strong></div>
                    <div class="metric">Wind: <strong>${windSpeed}</strong></div>
                    <div class="metric">Timezone: <strong>${escapeHtml(weatherData.timezone_abbreviation || weatherData.timezone)}</strong></div>
                    <div class="metric">Sunrise: <strong>${sunrise}</strong></div>
                    <div class="metric">Sunset: <strong>${sunset}</strong></div>
                    <div class="metric">Rain chance: <strong>${rainPercent}</strong></div>
                    <div class="metric">Next rain: <strong>${nextRainTime}</strong></div>
                </div>
            </article>
            <article class="card">
                <h3>5-day at-a-glance</h3>
                <div class="forecast-list">
                    ${dailyForecast.map((item) => `
                        <div class="forecast-item">
                            <strong>${item.day}</strong>
                            <div class="weather-emoji small" role="img" aria-label="${escapeHtml(item.description)}">${item.icon}</div>
                            <div>${Math.round(item.high)}° / ${Math.round(item.low)}°${isMetric ? 'C' : 'F'}</div>
                            <small>${escapeHtml(item.description)}</small>
                        </div>
                    `).join('')}
                </div>
            </article>
        `;
    }

    function normalizeLocation(location) {
        return {
            name: location.name,
            country: location.country_code || location.country,
            admin: location.admin1,
            latitude: location.latitude,
            longitude: location.longitude
        };
    }

    function createCoordinateLocation(lat, lon, name = '') {
        return {
            name: name || `${Number(lat).toFixed(2)}, ${Number(lon).toFixed(2)}`,
            country: '',
            admin: '',
            latitude: lat,
            longitude: lon
        };
    }

    function formatLocationLabel(location) {
        return [location.name, location.admin, location.country].filter(Boolean).join(', ');
    }

    function getCurrentRainChance(hourly) {
        const currentHour = new Date().toISOString().slice(0, 13);
        const index = hourly.time.findIndex((time) => time.startsWith(currentHour));
        const probability = index >= 0 ? hourly.precipitation_probability[index] : hourly.precipitation_probability[0];
        return `${probability ?? 0}%`;
    }

    function getNextRainTime(hourly) {
        const now = Date.now();
        const index = hourly.time.findIndex((time, timeIndex) => {
            return new Date(time).getTime() >= now && hourly.precipitation_probability[timeIndex] > 40;
        });

        return index >= 0 ? formatApiDateTime(hourly.time[index]) : 'No strong rain expected soon';
    }

    function getDailyForecast(daily) {
        return daily.time.map((date, index) => {
            const weather = getWeatherCodeInfo(daily.weather_code[index]);
            return {
                day: new Date(`${date}T12:00`).toLocaleDateString(undefined, { weekday: 'short' }),
                high: daily.temperature_2m_max[index],
                low: daily.temperature_2m_min[index],
                icon: weather.icon,
                description: weather.description
            };
        });
    }

    function formatApiDateTime(value) {
        return new Date(value).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    function getWeatherCodeInfo(code) {
        const weatherCodes = {
            0: ['☀️', 'Clear sky'],
            1: ['🌤️', 'Mainly clear'],
            2: ['⛅', 'Partly cloudy'],
            3: ['☁️', 'Overcast'],
            45: ['🌫️', 'Fog'],
            48: ['🌫️', 'Depositing rime fog'],
            51: ['🌦️', 'Light drizzle'],
            53: ['🌦️', 'Moderate drizzle'],
            55: ['🌧️', 'Dense drizzle'],
            56: ['🌧️', 'Light freezing drizzle'],
            57: ['🌧️', 'Dense freezing drizzle'],
            61: ['🌧️', 'Slight rain'],
            63: ['🌧️', 'Moderate rain'],
            65: ['🌧️', 'Heavy rain'],
            66: ['🌧️', 'Light freezing rain'],
            67: ['🌧️', 'Heavy freezing rain'],
            71: ['🌨️', 'Slight snow'],
            73: ['🌨️', 'Moderate snow'],
            75: ['❄️', 'Heavy snow'],
            77: ['❄️', 'Snow grains'],
            80: ['🌦️', 'Slight rain showers'],
            81: ['🌧️', 'Moderate rain showers'],
            82: ['⛈️', 'Violent rain showers'],
            85: ['🌨️', 'Slight snow showers'],
            86: ['🌨️', 'Heavy snow showers'],
            95: ['⛈️', 'Thunderstorm'],
            96: ['⛈️', 'Thunderstorm with slight hail'],
            99: ['⛈️', 'Thunderstorm with heavy hail']
        };
        const [icon, description] = weatherCodes[code] || ['🌡️', 'Weather unavailable'];
        return { icon, description };
    }

    function getGeolocationErrorMessage(error) {
        if (error.code === 1) {
            return 'Location permission was denied. Allow location access or search by city.';
        }

        if (error.code === 2) {
            return 'Your current location is unavailable. Try again or search by city.';
        }

        if (error.code === 3) {
            return 'Current location lookup timed out. Try again or search by city.';
        }

        return 'Unable to access your current location. Please search by city.';
    }

    function setStatus(message, type = '') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`.trim();
    }

    function showFirstSearchPopup() {
        if (!searchedOnce) {
            searchedOnce = true;
            showPopup();
        }
    }

    function showPopup() {
        popup.style.display = 'flex';
    }

    function getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem(storageKey)) || [];
        } catch {
            return [];
        }
    }

    function saveRecentSearch(city) {
        const current = getRecentSearches().filter((item) => item.toLowerCase() !== city.toLowerCase());
        current.unshift(city);
        localStorage.setItem(storageKey, JSON.stringify(current.slice(0, 6)));
        renderRecentSearches();
    }

    function renderRecentSearches() {
        const searches = getRecentSearches();
        if (!searches.length) {
            recentSearchesEl.innerHTML = '';
            return;
        }

        recentSearchesEl.innerHTML = searches
            .map((city) => `<button type="button" class="recent-chip" data-city="${escapeHtml(city)}">${escapeHtml(city)}</button>`)
            .join('');
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>'"]/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[char]));
    }
});
