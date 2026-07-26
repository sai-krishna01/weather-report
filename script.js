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

    const apiKey = 'c5baa769dadb4913b4735621262607';
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
            await loadAndRenderByCoords(lastQuery.lat, lastQuery.lon, { persistCity: false });
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
            const weatherData = await fetchWeatherData(cityName);
            validateWeatherResponse(weatherData, 'City not found. Please enter a valid city name.');

            const forecastData = await fetchForecastData(weatherData.coord.lat, weatherData.coord.lon);
            validateForecastResponse(forecastData);

            displayWeatherData(weatherData, forecastData);
            cityInput.value = weatherData.name;
            lastQuery = { type: 'city', city: weatherData.name };

            if (persistCity) {
                saveRecentSearch(weatherData.name);
            }

            showFirstSearchPopup();
            setStatus('Weather updated successfully.', 'success');
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setStatus(error.message || 'Something went wrong while fetching weather data.', 'error');
        }
    }

    async function loadAndRenderByCoords(lat, lon, { persistCity = true } = {}) {
        setStatus('Loading weather data for your current location...');
        weatherInfo.innerHTML = '';

        try {
            const weatherData = await fetchWeatherByCoords(lat, lon);
            validateWeatherResponse(weatherData, 'Could not find weather for your current location.');

            const forecastData = await fetchForecastData(weatherData.coord.lat, weatherData.coord.lon);
            validateForecastResponse(forecastData);

            displayWeatherData(weatherData, forecastData);
            cityInput.value = weatherData.name;
            lastQuery = { type: 'coords', lat, lon, city: weatherData.name };

            if (persistCity && weatherData.name) {
                saveRecentSearch(weatherData.name);
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

    async function fetchWeatherData(cityName) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    async function fetchWeatherByCoords(lat, lon) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    async function fetchForecastData(lat, lon) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    function validateWeatherResponse(data, fallbackMessage) {
        if (Number(data.cod) !== 200) {
            throw new Error(data.message ? `${fallbackMessage} (${data.message})` : fallbackMessage);
        }
    }

    function validateForecastResponse(data) {
        if (data.cod && Number(data.cod) !== 200) {
            throw new Error(data.message ? `Forecast unavailable: ${data.message}` : 'Forecast unavailable.');
        }
    }

    function displayWeatherData(weatherData, forecastData) {
        const location = [weatherData.name, weatherData.sys.country].filter(Boolean).join(', ');
        const temperature = `${Math.round(weatherData.main.temp)}°${isMetric ? 'C' : 'F'}`;
        const feelsLike = `${Math.round(weatherData.main.feels_like)}°${isMetric ? 'C' : 'F'}`;
        const description = weatherData.weather[0].description;
        const humidity = `${weatherData.main.humidity}%`;
        const windSpeedUnit = isMetric ? 'm/s' : 'mph';
        const windSpeed = `${weatherData.wind.speed} ${windSpeedUnit}`;
        const timezoneOffset = weatherData.timezone || 0;
        const sunrise = formatLocationTime(weatherData.sys.sunrise, timezoneOffset);
        const sunset = formatLocationTime(weatherData.sys.sunset, timezoneOffset);
        const visibility = isMetric
            ? `${(weatherData.visibility / 1000).toFixed(1)} km`
            : `${(weatherData.visibility / 1609.344).toFixed(1)} mi`;
        const rainPercent = forecastData.list?.[0]?.pop ? `${Math.round(forecastData.list[0].pop * 100)}%` : '0%';

        const nextRainEvent = forecastData.list?.find((forecast) => forecast.pop > 0.4);
        const nextRainTime = nextRainEvent ? formatLocationDateTime(nextRainEvent.dt, timezoneOffset) : 'No strong rain expected soon';

        const dailyForecast = getDailyForecast(forecastData.list || [], timezoneOffset);

        weatherInfo.innerHTML = `
            <article class="card current-card">
                <div>
                    <h2>${escapeHtml(location)}</h2>
                    <div class="icon-row">
                        <img src="https://openweathermap.org/img/wn/${encodeURIComponent(weatherData.weather[0].icon)}@2x.png" alt="${escapeHtml(description)}" class="weather-icon">
                        <div>
                            <p class="temp">${temperature}</p>
                            <p>${escapeHtml(description)}</p>
                        </div>
                    </div>
                </div>
                <div class="metrics">
                    <div class="metric">Feels like: <strong>${feelsLike}</strong></div>
                    <div class="metric">Humidity: <strong>${humidity}</strong></div>
                    <div class="metric">Wind: <strong>${windSpeed}</strong></div>
                    <div class="metric">Visibility: <strong>${visibility}</strong></div>
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
                            <img src="https://openweathermap.org/img/wn/${encodeURIComponent(item.icon)}.png" alt="${escapeHtml(item.description)}" class="weather-icon">
                            <div>${Math.round(item.temp)}°${isMetric ? 'C' : 'F'}</div>
                            <small>${escapeHtml(item.description)}</small>
                        </div>
                    `).join('')}
                </div>
            </article>
        `;
    }

    function getDailyForecast(list, timezoneOffset) {
        const byDay = new Map();

        list.forEach((item) => {
            const date = getLocationDate(item.dt, timezoneOffset);
            const key = date.toDateString();
            if (!byDay.has(key) && date.getHours() >= 11 && date.getHours() <= 15) {
                byDay.set(key, item);
            }
        });

        return [...byDay.values()].slice(0, 5).map((item) => ({
            day: getLocationDate(item.dt, timezoneOffset).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' }),
            temp: item.main.temp,
            icon: item.weather[0].icon,
            description: item.weather[0].main
        }));
    }

    function getLocationDate(unixSeconds, timezoneOffset) {
        return new Date((unixSeconds + timezoneOffset) * 1000);
    }

    function formatLocationTime(unixSeconds, timezoneOffset) {
        return getLocationDate(unixSeconds, timezoneOffset).toLocaleTimeString(undefined, {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC'
        });
    }

    function formatLocationDateTime(unixSeconds, timezoneOffset) {
        return getLocationDate(unixSeconds, timezoneOffset).toLocaleString(undefined, {
            weekday: 'short',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC'
        });
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
