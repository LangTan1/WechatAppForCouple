const storage = require('../../utils/storage');

const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😊', label: '开心' },
  { key: 'sweet', emoji: '🥰', label: '甜蜜' },
  { key: 'calm',  emoji: '😌', label: '平静' },
  { key: 'sad',   emoji: '😢', label: '难过' },
  { key: 'angry', emoji: '😤', label: '生气' }
];

const MOOD_MAP = {};
MOOD_OPTIONS.forEach(function(m) { MOOD_MAP[m.key] = m; });

Page({
  data: {
    moodOptions: MOOD_OPTIONS,
    selectedMood: '',
    noteText: '',
    todayMood: null,
    partnerMood: null,
    recentMoods: [],
    boyName: '浪',
    girlName: '琳琳',
    isDev: false
  },

  onLoad() { this.loadData(); },
  onShow() { this.loadData(); },

  loadData() {
    const isDev = storage.isDeveloper();
    const recentMoods = storage.getRecentMoods(7);
    // 给7天数据附加格式化日期
    recentMoods.forEach(function(item) {
      const parts = item.date.split('-');
      item.displayDate = parts[1] + '/' + parts[2];
    });

    this.setData({
      isDev: isDev,
      boyName: storage.getBoyName(),
      girlName: storage.getGirlName(),
      todayMood: storage.getTodayMood(),
      partnerMood: storage.getPartnerTodayMood(),
      recentMoods: recentMoods,
      selectedMood: '',
      noteText: ''
    });
  },

  getMoodEmoji(moodKey) {
    return MOOD_MAP[moodKey] ? MOOD_MAP[moodKey].emoji : '😶';
  },

  selectMood(e) {
    this.setData({ selectedMood: e.currentTarget.dataset.key });
  },

  onNoteInput(e) {
    this.setData({ noteText: e.detail.value });
  },

  submitMood() {
    if (!this.data.selectedMood) {
      wx.showToast({ title: '选一个心情吧～', icon: 'none' });
      return;
    }
    if (this.data.todayMood) {
      wx.showToast({ title: '今天已经打过卡啦', icon: 'none' });
      return;
    }

    const now = new Date();
    const dateStr = storage._todayStr();
    const timeStr = dateStr + ' ' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    const entry = {
      id: Date.now(),
      role: storage.getCurrentRole(),
      date: dateStr,
      mood: this.data.selectedMood,
      note: this.data.noteText.trim(),
      time: timeStr
    };

    const moods = storage.getMoods();
    moods.push(entry);
    storage.setMoods(moods);

    wx.showToast({ title: '打卡成功 💕', icon: 'none' });
    this.loadData();
  },

  noop() {}
});
