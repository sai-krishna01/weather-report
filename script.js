document.addEventListener('DOMContentLoaded', () => {
    const weatherInfo = document.getElementById('weatherInfo');
    const searchForm = document.getElementById('searchForm');

    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cityName = document.getElementById('cityName').value.trim();

        if (cityName) {
            try {
                const weatherData = await fetchWeatherData(cityName);
                displayWeatherData(weatherData);
            } catch (error) {
                console.error('Error fetching weather data:', error);
            }
        } else {
            alert('Please enter a city name.');
        }
    });

    async function fetchWeatherData(cityName) {
        const apiKey = 'db4419c39a0faf706dc6c98a21a6170f'; // Replace with your actual API key
        const apiUrl = `https://api.openweathermap.org/data/2.5/weather?q=${cityName}&units=metric&appid=${apiKey}&units=metric`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    }

    function displayWeatherData(weatherData) {
        if (weatherData.cod === 200) {
            const location = `${weatherData.name}, ${weatherData.sys.country}`;
            const temperature = `${weatherData.main.temp}°C`;
            const description = weatherData.weather[0].description;
            const humidity = `${weatherData.main.humidity}%`;
            const windSpeed = `${weatherData.wind.speed} m/s`;
            const sunrise = new Date(weatherData.sys.sunrise * 1000).toLocaleTimeString();
            const sunset = new Date(weatherData.sys.sunset * 1000).toLocaleTimeString();

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
                    </div>
                </div>
            `;
            weatherInfo.innerHTML = weatherHtml;
        } else {
            alert('City not found. Please enter a valid city name.');
        }
    }
});
