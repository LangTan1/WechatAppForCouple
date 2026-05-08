const storage = require('../../utils/storage');
const weather = require('../../utils/weather');
const loveQuotes = require('../../utils/love-quotes');

Page({
  data: {
    dateStr: '',
    weekday: '',
    togetherDays: 0,
    weather: null,
    dailyQuote: '',
    albumCount: 0,
    nextAnniversary: '',
    upcomingAnniversaries: [],
    wishCount: 0,
    activities: [],
    todayMood: null,
    partnerMood: null
  },

  onLoad() {
    this.initData();
    this.loadWeather();
    this.loadDailyQuote();
  },

  onShow() {
    this.setData({
      togetherDays: storage.getTogetherDays()
    });
    this.refreshData();
  },

  initData() {
    const now = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const weekday = `星期${weekdays[now.getDay()]}`;

    this.setData({ dateStr, weekday, togetherDays: storage.getTogetherDays() });
    this.refreshData();
  },

  refreshData() {
    const anniversaries = storage.getAnniversaries();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 5 天内即将到来的纪念日
    const upcoming = [];
    let nextAnn = anniversaries[0] || { title: '暂无' };
    let minDiff = Infinity;
    anniversaries.forEach(a => {
      const d = new Date(a.date);
      const thisYear = new Date(d);
      thisYear.setFullYear(today.getFullYear());
      if (thisYear < today) thisYear.setFullYear(today.getFullYear() + 1);
      const diffDays = Math.ceil((thisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 5 && diffDays >= 0) {
        upcoming.push({ ...a, daysLeft: diffDays });
      }
      if (diffDays < minDiff) { minDiff = diffDays; nextAnn = a; }
    });
    upcoming.sort((a, b) => a.daysLeft - b.daysLeft);

    const wishes = storage.getWishes();
    const undoneWishes = wishes.filter(w => !w.done).length;
    const albumPhotos = storage.getAlbumPhotos();

    // 活动动态
    const diaries = storage.getDiaries();
    const whispers = storage.getWhispers();
    const activities = [];
    if (diaries.length > 0) {
      activities.push({
        id: 100, type: 'diary',
        text: `记录了${diaries.length}篇恋爱日记`,
        time: diaries[0].date
      });
    }
    if (whispers.length > 0) {
      activities.push({
        id: 101, type: 'whisper',
        text: `有${whispers.length}条未读悄悄话 💌`,
        time: whispers[0].time
      });
    }
    if (albumPhotos.length > 0) {
      activities.push({
        id: 102, type: 'album',
        text: `时光相册共有${albumPhotos.length}张回忆`,
        time: '最近更新'
      });
    }
    if (activities.length === 0) {
      activities.push(
        { id: 1, type: 'diary', text: '欢迎来到你们的小世界！开始记录吧 💕', time: '今天' },
        { id: 2, type: 'whisper', text: '给对方写一句悄悄话吧～', time: '今天' }
      );
    }

    this.setData({
      albumCount: albumPhotos.length,
      upcomingAnniversaries: upcoming,
      nextAnniversary: nextAnn.title,
      wishCount: undoneWishes,
      activities: activities.slice(0, 6),
      todayMood: storage.getTodayMood(),
      partnerMood: storage.getPartnerTodayMood()
    });
  },

  loadWeather() {
    weather.fetchWeather().then(data => {
      this.setData({ weather: data });
    }).catch(() => {});
  },

  loadDailyQuote() {
    this.setData({ dailyQuote: loveQuotes.getTodayQuote() });
  },

  // 导航
  goMenu() {
    wx.switchTab({ url: '/pages/menu/menu' });
  },
  goDiary() {
    wx.navigateTo({ url: '/pages/diary/diary' });
  },
  goWhisper() {
    wx.navigateTo({ url: '/pages/whisper/whisper' });
  },
  goAlbum() {
    wx.navigateTo({ url: '/pages/album/album' });
  },
  goAnniversary() {
    wx.navigateTo({ url: '/pages/anniversary/anniversary' });
  },
  goWishlist() {
    wx.navigateTo({ url: '/pages/wishlist/wishlist' });
  },
  goRecord() {
    wx.switchTab({ url: '/pages/record/record' });
  },
  goMood() {
    wx.navigateTo({ url: '/pages/mood/mood' });
  }
});
