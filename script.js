document.addEventListener('DOMContentLoaded', () => {
    const weatherInfo = document.getElementById('weatherInfo');
    const searchForm = document.getElementById('searchForm');
    const popup = document.getElementById('popup');
    const closeBtn = document.querySelector('.close-btn');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cityName = document.getElementById('cityName').value.trim();

        if (cityName) {
            try {
                const weatherData = await fetchWeatherData(cityName);
                const forecastData = await fetchForecastData(cityName);
                displayWeatherData(weatherData, forecastData);
                showPopup();
            } catch (error) {
                console.error('Error fetching weather data:', error);
            }
        } else {
            alert('Please enter a city name.');
        }
    });

    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
    });

    async function fetchWeatherData(cityName) {
        const apiKey = 'db4419c39a0faf706dc6c98a21a6170f'; // Replace with your actual API key
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&units=metric&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    }

    async function fetchForecastData(cityName) {
        const apiKey = 'db4419c39a0faf706dc6c98a21a6170f'; // Replace with your actual API key
        const apiUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&units=metric&appid=${apiKey}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    }

    function displayWeatherData(weatherData, forecastData) {
        if (weatherData.cod === 200) {
            const location = `${weatherData.name}, ${weatherData.sys.country}`;
            const temperature = `${weatherData.main.temp}°C`;
            const description = weatherData.weather[0].description;
            const humidity = `${weatherData.main.humidity}%`;
            const windSpeed = `${weatherData.wind.speed} m/s`;
            const sunrise = new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString();
            const sunset = new Date(weatherData.sys.sunset * 1000).toLocaleTimeString();
            const rain = weatherData.rain ? `${weatherData.rain['1h']} mm` : 'No rain last hour';
            const rainPercent = forecastData.list[0].pop ? `${forecastData.list[0].pop * 100}%` : 'N/A';

            // Find the next rain event
            const nextRainEvent = forecastData.list.find(forecast => forecast.pop > 0);
            const nextRainTime = nextRainEvent ? new Date(nextRainEvent.dt * 1000).toLocaleString() : 'No upcoming rain';

            const weatherHtml = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title">${location}</h5>
                        <p class="card-text">${temperature}</p>
                        <img src="http://openweathermap.org/img/wn/${weatherData.weather[0].icon}.png" alt="Weather Icon" class="weather-icon">
                        <p class="card-text">${description}</p>
                        <p class="card-text">Humidity: ${humidity}</p>
                        <p class="card-text">Wind Speed: ${windSpeed}</p>
                        <p class="card-text">Sunrise: ${sunrise}</p>
                        <p class="card-text">Sunset: ${sunset}</p>
                        ${weatherData.rain ? `<p class="card-text">Rainfall (last hour): ${rain}</p>` : ''}
                        <p class="card-text">Rain Percentage: ${rainPercent}</p>
                        <p class="card-text">Next Rain: ${nextRainTime}</p>
                    </div>
                </div>
            `;
            weatherInfo.innerHTML = weatherHtml;
        } else {
            alert('City not found. Please enter a valid city name.');
        }
    }

    function showPopup() {
        popup.style.display = 'block';
    }
});
