const storage = require('../../utils/storage');

Page({
  data: {
    wishes: [],
    undoneItems: [],
    doneItems: [],
    totalCount: 0,
    doneCount: 0,
    progressPercent: 0,
    showModal: false,
    newWish: ''
  },

  onLoad() {
    this.loadWishes();
  },

  onShow() {
    this.loadWishes();
    this.syncFromCloud();
    storage.updateLastView('wish');
  },

  async syncFromCloud() {
    try { await storage.loadFromCloud(); } catch (e) { console.error('[wishlist] loadFromCloud failed:', e); }
    this.loadWishes();
  },

  loadWishes() {
    const wishes = storage.getWishes().map(w => ({ ...w }));
    this.updateList(wishes);
  },

  updateList(wishes) {
    const doneItems = wishes.filter(w => w.done);
    const undoneItems = wishes.filter(w => !w.done);
    const totalCount = wishes.length;
    const doneCount = doneItems.length;
    const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

    this.setData({
      wishes, undoneItems, doneItems, totalCount, doneCount, progressPercent
    });
  },

  toggleWish(e) {
    const id = e.currentTarget.dataset.id;
    const wishes = this.data.wishes.map(w => {
      if (w.id === id) return { ...w, done: !w.done };
      return w;
    });
    storage.setWishes(wishes);
    this.updateList(wishes);

    const toggled = wishes.find(w => w.id === id);
    if (toggled && toggled.done) {
      wx.showToast({ title: '心愿达成 🎉', icon: 'none' });
    }
  },

  showAdd() {
    this.setData({ showModal: true, newWish: '' });
  },

  hideModal() {
    this.setData({ showModal: false });
  },

  onInput(e) {
    this.setData({ newWish: e.detail.value });
  },

  addWish() {
    const text = this.data.newWish.trim();
    if (!text) {
      wx.showToast({ title: '写点什么吧～', icon: 'none' });
      return;
    }

    const wishes = storage.getWishes();
    const newWish = {
      id: Date.now(),
      role: storage.getCurrentRole(),
      title: text,
      done: false,
      emoji: '💫',
      createdAt: Date.now()
    };
    wishes.push(newWish);
    storage.setWishes(wishes);

    this.updateList(wishes);
    this.setData({ showModal: false, newWish: '' });
    wx.showToast({ title: '心愿已添加 ✨', icon: 'none' });
  },

  noop() {}
});
