const storage = require('../../utils/storage');

Page({
  data: {
    diaries: [],
    showModal: false,
    newTitle: '',
    newContent: ''
  },

  onLoad() {
    this.loadDiaries();
  },

  onShow() {
    this.loadDiaries();
    this.syncFromCloud();
  },

  loadDiaries() {
    this.setData({
      diaries: storage.getDiaries().map(d => ({ ...d })).reverse()
    });
  },

  showAdd() {
    this.setData({ showModal: true, newTitle: '', newContent: '' });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onTitleInput(e) { this.setData({ newTitle: e.detail.value }); },
  onContentInput(e) { this.setData({ newContent: e.detail.value }); },

  addDiary() {
    const { newTitle, newContent } = this.data;
    if (!newTitle.trim() || !newContent.trim()) {
      wx.showToast({ title: '请填写完整哦～', icon: 'none' });
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const newDiary = {
      id: Date.now(),
      date: dateStr,
      title: newTitle.trim(),
      content: newContent.trim(),
      mood: 'happy'
    };

    const diaries = storage.getDiaries();
    diaries.push(newDiary);
    storage.setDiaries(diaries);

    this.setData({ showModal: false, newTitle: '', newContent: '' });
    this.loadDiaries();
    wx.showToast({ title: '日记已记录 💕', icon: 'none' });
  },

  noop() {},

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.loadDiaries();
  }
});
