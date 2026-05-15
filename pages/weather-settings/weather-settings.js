const storage = require('../../utils/storage');
const weather = require('../../utils/weather');

Page({
  data: {
    weatherModeLabel: '',
    weatherLocationLabel: '',
    weatherUpdatedAtLabel: '',
    manualRegion: ['北京市', '北京市', '朝阳区']
  },

  onLoad() {
    this.refreshData();
  },

  onShow() {
    this.syncFromCloud();
  },

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.refreshData();
  },

  refreshData() {
    const myWeatherProfile = storage.getMyWeatherProfile();
    const manualRegion = myWeatherProfile
      ? [
          myWeatherProfile.province || '北京市',
          myWeatherProfile.city || myWeatherProfile.province || '北京市',
          myWeatherProfile.district || myWeatherProfile.city || '朝阳区'
        ]
      : this.data.manualRegion;

    this.setData({
      weatherModeLabel: !myWeatherProfile ? '未设置' : (myWeatherProfile.mode === 'manual' ? '手动位置' : '自动定位'),
      weatherLocationLabel: myWeatherProfile && myWeatherProfile.displayName ? myWeatherProfile.displayName : '暂未设置',
      weatherUpdatedAtLabel: myWeatherProfile && myWeatherProfile.updatedAt
        ? new Date(myWeatherProfile.updatedAt).toLocaleString('zh-CN')
        : '暂无记录',
      manualRegion
    });
  },

  async useCurrentWeatherLocation() {
    wx.showLoading({ title: '更新天气中...' });
    try {
      await weather.refreshMyWeather({ forceAuto: true });
      this.refreshData();
      wx.showToast({ title: '已更新当前位置', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '定位失败，请检查授权', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async onManualRegionChange(e) {
    const region = e.detail.value;
    this.setData({ manualRegion: region });
    wx.showLoading({ title: '保存位置中...' });
    try {
      await weather.saveManualWeatherLocation({
        province: region[0],
        city: region[1],
        district: region[2]
      });
      this.refreshData();
      wx.showToast({ title: '手动位置已更新', icon: 'none' });
    } catch (error) {
      wx.showToast({ title: '位置解析失败，请重试', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
