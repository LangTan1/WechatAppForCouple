const storage = require('../../utils/storage');

Page({
  data: {
    items: [],
    showModal: false,
    newEvent: '',
    newEventDate: '',
    newContent: ''
  },

  onLoad() {
    this.loadItems();
    // 设置默认日期为今天
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ newEventDate: today });
  },

  onShow() {
    this.loadItems();
    this.syncFromCloud();
  },

  loadItems() {
    this.setData({
      items: storage.getReflection().map(d => ({ ...d })).reverse()
    });
  },

  showAdd() {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    this.setData({ showModal: true, newEvent: '', newEventDate: today, newContent: '' });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onEventInput(e) {
    this.setData({ newEvent: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ newEventDate: e.detail.value });
  },

  onContentInput(e) {
    this.setData({ newContent: e.detail.value });
  },

  addItem() {
    const { newEvent, newEventDate, newContent } = this.data;
    if (!newEvent.trim()) {
      wx.showToast({ title: '写一下什么事情～', icon: 'none' });
      return;
    }
    if (!newContent.trim()) {
      wx.showToast({ title: '写写你的反省吧～', icon: 'none' });
      return;
    }

    const now = new Date();
    const recordTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newItem = {
      id: Date.now(),
      role: storage.getCurrentRole(),
      name: storage.getMyName() || '我',
      event: newEvent.trim(),
      eventDate: newEventDate,
      content: newContent.trim(),
      recordTime: recordTime,
      createdAt: Date.now()
    };

    const items = storage.getReflection();
    items.push(newItem);
    storage.setReflection(items);

    this.setData({ showModal: false, newEvent: '', newContent: '' });
    this.loadItems();
    wx.showToast({ title: '认识到错误就好 💕', icon: 'none' });
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条反省吗？',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          let items = storage.getReflection();
          items = items.filter(item => item.id !== id);
          storage.setReflection(items);
          this.loadItems();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  noop() {},

  async syncFromCloud() {
    try { await storage.loadFromCloud(); } catch (e) { console.error('[reflection] loadFromCloud failed:', e); }
    this.loadItems();
  }
});
