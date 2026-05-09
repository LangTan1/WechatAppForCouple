/**
 * 天气服务 - 本地季节模拟 + 定位信息
 */
const storage = require('./storage');

function getClothingAdvice(maxTemp) {
  if (maxTemp >= 35) return { text: '超级热！出门注意防晒，穿得越凉快越好 🧴', icon: '🥵' };
  if (maxTemp >= 30) return { text: '天气较热，建议穿短袖短裤，带上遮阳伞 ☂️', icon: '☀️' };
  if (maxTemp >= 25) return { text: '温度舒适，穿件薄T恤或裙子就很好～', icon: '👕' };
  if (maxTemp >= 20) return { text: '温暖宜人，薄长袖或衬衫刚好合适', icon: '👔' };
  if (maxTemp >= 15) return { text: '微凉，建议穿薄外套或针织衫出门', icon: '🧥' };
  if (maxTemp >= 10) return { text: '有点冷哦，穿件厚外套或卫衣吧', icon: '🧣' };
  if (maxTemp >= 5)  return { text: '天气冷，羽绒服、围巾都安排上！', icon: '🧤' };
  if (maxTemp >= 0)  return { text: '很冷！厚羽绒服 + 手套 + 帽子不能少', icon: '🥶' };
  return { text: '超级冷！能不出门就不出门，裹紧小被子～', icon: '☃️' };
}

function getSeasonalWeather() {
  const now = new Date();
  const month = now.getMonth();
  const day = now.getDate();
  const hour = now.getHours();

  const seasonData = [
    { maxAvg: 7,  minAvg: -3, icons: ['☁️','🌫️','☀️','❄️'], texts: ['阴天','薄雾','晴天','小雪'] },
    { maxAvg: 11, minAvg: 0,  icons: ['☁️','🌤️','☀️','🌧️'], texts: ['多云','少云','晴天','小雨'] },
    { maxAvg: 17, minAvg: 5,  icons: ['🌤️','☀️','🌧️','☁️'], texts: ['少云','晴天','小雨','多云'] },
    { maxAvg: 23, minAvg: 11, icons: ['☀️','🌤️','🌧️','⛅'], texts: ['晴天','少云','小雨','多云'] },
    { maxAvg: 28, minAvg: 16, icons: ['☀️','🌤️','⛈️','🌧️'], texts: ['晴天','少云','雷阵雨','小雨'] },
    { maxAvg: 32, minAvg: 21, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','小雨'] },
    { maxAvg: 34, minAvg: 24, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','阵雨'] },
    { maxAvg: 33, minAvg: 23, icons: ['☀️','⛈️','🌤️','🌧️'], texts: ['晴天','雷阵雨','少云','阵雨'] },
    { maxAvg: 28, minAvg: 17, icons: ['☀️','🌤️','☁️','🌧️'], texts: ['晴天','少云','多云','小雨'] },
    { maxAvg: 22, minAvg: 11, icons: ['🌤️','☀️','☁️','🌧️'], texts: ['少云','晴天','多云','小雨'] },
    { maxAvg: 15, minAvg: 4,  icons: ['☁️','🌤️','🌧️','🌫️'], texts: ['多云','少云','小雨','薄雾'] },
    { maxAvg: 9,  minAvg: -1, icons: ['☁️','🌫️','☀️','❄️'], texts: ['阴天','多云','晴天','小雪'] },
  ];

  const s = seasonData[month];
  const seed = (month * 37 + day * 13 + Math.floor(hour / 3)) % 4;
  const tempVariation = (seed - 1.5) * 2;

  const maxTemp = s.maxAvg + Math.round(tempVariation);
  const minTemp = s.minAvg + Math.round(tempVariation * 0.6);
  const midTemp = Math.round((maxTemp + minTemp) / 2);
  const temp = hour > 14 ? Math.round(maxTemp - (hour - 14) * 0.5) : hour > 10 ? maxTemp : midTemp;

  const clothing = getClothingAdvice(maxTemp);

  return {
    temp, maxTemp, minTemp,
    icon: s.icons[seed],
    text: s.texts[seed],
    clothing: clothing.text,
    clothingIcon: clothing.icon,
    location: ''
  };
}

function fetchWeather() {
  return new Promise((resolve) => {
    const cached = storage.getWeatherCache();
    if (cached && Date.now() - cached.time < 30 * 60 * 1000) {
      // 缓存有效，但名字始终读最新值
      cached.data.myName = storage.getMyName() || '我';
      cached.data.partnerName = storage.getPartnerName() || 'TA';
      resolve(cached.data);
      return;
    }

    const data = getSeasonalWeather();
    data.myName = storage.getMyName() || '我';
    data.partnerName = storage.getPartnerName() || 'TA';
    data.location = '📍 和你在一起的地方';
    storage.setWeatherCache({ time: Date.now(), data });
    resolve(data);
  });
}

module.exports = { fetchWeather, getClothingAdvice };
