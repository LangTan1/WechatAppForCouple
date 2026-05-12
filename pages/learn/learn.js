const storage = require('../../utils/storage');

Page({
  data: {
    items: [],
    showModal: false,
    newContent: ''
  },

  onLoad() {
    this.loadItems();
  },

  onShow() {
    this.loadItems();
    this.syncFromCloud();
  },

  loadItems() {
    this.setData({
      items: storage.getLearn().map(d => ({ ...d })).reverse()
    });
  },

  showAdd() {
    this.setData({ showModal: true, newContent: '' });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onContentInput(e) {
    this.setData({ newContent: e.detail.value });
  },

  addItem() {
    const { newContent } = this.data;
    if (!newContent.trim()) {
      wx.showToast({ title: '写点什么吧～', icon: 'none' });
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newItem = {
      id: Date.now(),
      role: storage.getCurrentRole(),
      name: storage.getMyName() || '我',
      content: newContent.trim(),
      date: dateStr,
      time: timeStr,
      createdAt: Date.now()
    };

    const items = storage.getLearn();
    items.push(newItem);
    storage.setLearn(items);

    this.setData({ showModal: false, newContent: '' });
    this.loadItems();
    wx.showToast({ title: '好习惯记下来 ✨', icon: 'none' });
  },

  deleteItem(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？',
      confirmColor: '#FF6B8A',
      success: (res) => {
        if (res.confirm) {
          let items = storage.getLearn();
          items = items.filter(item => item.id !== id);
          storage.setLearn(items);
          this.loadItems();
          wx.showToast({ title: '已删除', icon: 'none' });
        }
      }
    });
  },

  noop() {},

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.loadItems();
  }
});
