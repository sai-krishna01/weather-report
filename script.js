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

        const lastCity = cityInput.value.trim() || getRecentSearches()[0];
        if (lastCity) {
            await loadAndRenderByCity(lastCity, false);
        }
    });

    currentLocationBtn.addEventListener('click', () => {
        if (!navigator.geolocation) {
            setStatus('Geolocation is not supported in this browser.', 'error');
            return;
        }

        setStatus('Detecting your location...');
        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                await loadAndRenderByCoords(coords.latitude, coords.longitude);
            },
            () => setStatus('Unable to access location. Please search manually.', 'error'),
            { timeout: 8000 }
        );
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

            if (weatherData.cod !== 200) {
                setStatus('City not found. Please enter a valid city name.', 'error');
                return;
            }

            const forecastData = await fetchForecastData(weatherData.coord.lat, weatherData.coord.lon);
            displayWeatherData(weatherData, forecastData);
            cityInput.value = weatherData.name;

            if (persistCity) {
                saveRecentSearch(weatherData.name);
            }

            if (!searchedOnce) {
                searchedOnce = true;
                showPopup();
            }

            setStatus('Weather updated successfully.', 'success');
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setStatus('Something went wrong while fetching weather data.', 'error');
        }
    }

    async function loadAndRenderByCoords(lat, lon) {
        setStatus('Loading weather data for your location...');
        weatherInfo.innerHTML = '';

        try {
            const weatherData = await fetchWeatherByCoords(lat, lon);
            const forecastData = await fetchForecastData(lat, lon);
            displayWeatherData(weatherData, forecastData);
            cityInput.value = weatherData.name;
            saveRecentSearch(weatherData.name);

            if (!searchedOnce) {
                searchedOnce = true;
                showPopup();
            }

            setStatus('Showing weather for your location.', 'success');
        } catch (error) {
            console.error('Error fetching weather data:', error);
            setStatus('Could not fetch weather for your location.', 'error');
        }
    }

    async function fetchWeatherData(cityName) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(cityName)}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    async function fetchWeatherByCoords(lat, lon) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    async function fetchForecastData(lat, lon) {
        const units = isMetric ? 'metric' : 'imperial';
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${units}&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        return response.json();
    }

    function displayWeatherData(weatherData, forecastData) {
        const location = `${weatherData.name}, ${weatherData.sys.country}`;
        const temperature = `${Math.round(weatherData.main.temp)}°${isMetric ? 'C' : 'F'}`;
        const feelsLike = `${Math.round(weatherData.main.feels_like)}°${isMetric ? 'C' : 'F'}`;
        const description = weatherData.weather[0].description;
        const humidity = `${weatherData.main.humidity}%`;
        const windSpeedUnit = isMetric ? 'm/s' : 'mph';
        const windSpeed = `${weatherData.wind.speed} ${windSpeedUnit}`;
        const sunrise = new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString();
        const sunset = new Date(weatherData.sys.sunset * 1000).toLocaleTimeString();
        const visibilityKm = (weatherData.visibility / 1000).toFixed(1);
        const rainPercent = forecastData.list?.[0]?.pop ? `${Math.round(forecastData.list[0].pop * 100)}%` : '0%';

        const nextRainEvent = forecastData.list?.find((forecast) => forecast.pop > 0.4);
        const nextRainTime = nextRainEvent ? new Date(nextRainEvent.dt * 1000).toLocaleString() : 'No strong rain expected soon';

        const dailyForecast = getDailyForecast(forecastData.list || []);

        weatherInfo.innerHTML = `
            <article class="card current-card">
                <div>
                    <h2>${location}</h2>
                    <div class="icon-row">
                        <img src="https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png" alt="${description}" class="weather-icon">
                        <div>
                            <p class="temp">${temperature}</p>
                            <p>${description}</p>
                        </div>
                    </div>
                </div>
                <div class="metrics">
                    <div class="metric">Feels like: <strong>${feelsLike}</strong></div>
                    <div class="metric">Humidity: <strong>${humidity}</strong></div>
                    <div class="metric">Wind: <strong>${windSpeed}</strong></div>
                    <div class="metric">Visibility: <strong>${visibilityKm} km</strong></div>
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
                            <img src="https://openweathermap.org/img/wn/${item.icon}.png" alt="${item.description}" class="weather-icon">
                            <div>${Math.round(item.temp)}°${isMetric ? 'C' : 'F'}</div>
                            <small>${item.description}</small>
                        </div>
                    `).join('')}
                </div>
            </article>
        `;
    }

    function getDailyForecast(list) {
        const byDay = new Map();

        list.forEach((item) => {
            const date = new Date(item.dt * 1000);
            const key = date.toDateString();
            if (!byDay.has(key) && date.getHours() >= 11 && date.getHours() <= 15) {
                byDay.set(key, item);
            }
        });

        return [...byDay.values()].slice(0, 5).map((item) => ({
            day: new Date(item.dt * 1000).toLocaleDateString(undefined, { weekday: 'short' }),
            temp: item.main.temp,
            icon: item.weather[0].icon,
            description: item.weather[0].main
        }));
    }

    function setStatus(message, type = '') {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`.trim();
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
            .map((city) => `<button type="button" class="recent-chip" data-city="${city}">${city}</button>`)
            .join('');
    }
});
