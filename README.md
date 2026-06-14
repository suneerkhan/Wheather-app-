# 🌤️ AuraWeather

A beautiful, feature-rich weather app built with vanilla HTML, CSS, and JavaScript — powered by the OpenWeatherMap API.

> Built as part of a 10-Day Web Development Workshop — Day 5 Task

---

## 🚀 Live Demo

[View Live →](https://suneerkhan.github.io/weather-app)

---

## ✨ Features

- 🔍 **City Search** with real-time autocomplete suggestions
- 📍 **GPS Detection** — get weather for your current location
- 🌡️ **Current Weather** — temperature, feels like, condition
- 📅 **5-Day Forecast** & **Hourly Forecast**
- 💧 Humidity · 💨 Wind Direction · 👁️ Visibility · 🌡️ Pressure · ☀️ UV Index
- 🌅 **Sunrise/Sunset Arc** with animated sun position
- 🌫️ **Air Quality Index** with visual indicator
- 🛰️ **Live Weather Radar** map
- 💡 **Lifestyle Tips** based on current conditions
- 🌧️ **Dynamic Particle Animations** — rain, snow, lightning, stars, shooting stars
- 🎨 **Weather-based themes** — background and UI change per condition
- 🌡️ **°C / °F Toggle**
- 📱 **Fully Responsive** — works on mobile, tablet, and desktop

---

## 🛠️ Tech Stack

| Technology | Usage |
|---|---|
| HTML5 Canvas | Particle animations (rain, snow, stars) |
| CSS3 | Glassmorphism, animations, responsive layout |
| JavaScript  | API calls, DOM manipulation, canvas rendering |
| OpenWeatherMap API | Weather, Forecast, AQI, UV Index, Geocoding |

---

## 📡 APIs Used

- `Current Weather` — temperature, wind, humidity, pressure
- `5-Day Forecast` — daily + hourly breakdown
- `Air Pollution` — AQI data
- `UV Index` — real-time UV level
- `Geocoding` — city search autocomplete

---

## 🗂️ Project Structure

```
weather-app/
├── index.html     # App structure and layout
├── style.css      # Styling, themes, animations
└── script.js      # Logic, API calls, canvas particles
```

---

## ⚙️ Setup

1. Clone the repo
   ```bash
   git clone https://github.com/suneerkhan/weather-app.git
   ```
2. Get a free API key from [openweathermap.org](https://openweathermap.org/api)
3. Open `script.js` and replace line 2:
   ```js
   const API_KEY = 'YOUR_API_KEY_HERE';
   ```
4. Open `index.html` in your browser

---

## 📸 Preview

> Search any city or click a popular city card to instantly load weather with dynamic backgrounds and animations.

---
