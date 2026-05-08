const storage = require('../../utils/storage');

Page({
  data: {
    whispers: [],
    inputText: '',
    currentSender: 'boy'  // 简化为当前发送者
  },

  onLoad() {
    this.loadWhispers();
  },

  onShow() {
    this.loadWhispers();
    this.syncFromCloud();
  },

  loadWhispers() {
    this.setData({
      whispers: storage.getWhispers().map(w => ({ ...w })).reverse()
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  sendWhisper() {
    const text = this.data.inputText.trim();
    if (!text) return;

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const senderName = storage.getBoyName();
    const newWhisper = {
      id: Date.now(),
      sender: senderName,
      avatar: storage.getBoyAvatar(),
      content: text,
      time: timeStr,
      color: '#FF6B8A',
      isBoy: true
    };

    const whispers = storage.getWhispers();
    whispers.push(newWhisper);
    storage.setWhispers(whispers);

    this.setData({ inputText: '' });
    this.loadWhispers();
    wx.showToast({ title: '已发送 💌', icon: 'none', duration: 1500 });
  },

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.loadWhispers();
  }
});
