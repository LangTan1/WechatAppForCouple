const storage = require('../../utils/storage');

// 徽章等级: bronze(铜) / silver(银) / gold(金) / platinum(铂金)
const ACHIEVEMENT_DEFS = [
  // ===== 铜牌成就 =====
  { id: 'first_diary',    title: '初心萌动',    desc: '写下第一篇恋爱日记',      emoji: '📝', tier: 'bronze' },
  { id: 'first_whisper',  title: '悄悄话新手',  desc: '发送第一条悄悄话',        emoji: '💌', tier: 'bronze' },
  { id: 'first_photo',    title: '时光记忆',    desc: '上传第一张照片',          emoji: '📸', tier: 'bronze' },
  { id: 'first_wish',     title: '许愿精灵',    desc: '许下第一个心愿',          emoji: '💫', tier: 'bronze' },
  { id: 'first_order',    title: '美食家',      desc: '第一次点餐',              emoji: '🍽️', tier: 'bronze' },
  { id: 'wish_done',      title: '愿望成真',    desc: '完成第一个心愿',          emoji: '🎉', tier: 'bronze' },
  { id: 'order_done_1',   title: '第一口满足',  desc: '第一个订单被完成',        emoji: '✅', tier: 'bronze' },

  // ===== 银牌成就 =====
  { id: 'diary_10',       title: '日记达人',    desc: '写下10篇恋爱日记',        emoji: '📚', tier: 'silver' },
  { id: 'whisper_10',     title: '甜言蜜语',    desc: '发送10条悄悄话',          emoji: '💬', tier: 'silver' },
  { id: 'photo_20',       title: '珍藏瞬间',    desc: '上传20张照片',            emoji: '🖼️', tier: 'silver' },
  { id: 'wish_5',         title: '梦想家',      desc: '许下5个心愿',             emoji: '🌟', tier: 'silver' },
  { id: 'wish_10',        title: '愿望收割者',  desc: '许下10个心愿',            emoji: '🌈', tier: 'silver' },
  { id: 'wish_done_5',    title: '心愿达成者',  desc: '完成5个心愿',             emoji: '✨', tier: 'silver' },
  { id: 'anniversary_3',  title: '纪念日达人',  desc: '创建3个纪念日',           emoji: '💝', tier: 'silver' },
  { id: 'anniversary_5',  title: '纪念日狂热',  desc: '创建5个纪念日',           emoji: '💖', tier: 'silver' },
  { id: 'order_10',       title: '吃货本色',    desc: '点餐10次',                emoji: '🍜', tier: 'silver' },
  { id: 'together_100',   title: '在一起100天', desc: '在一起满100天',           emoji: '💯', tier: 'silver' },
  { id: 'mood_sync',      title: '心有灵犀',    desc: '同一天两人都打卡心情',    emoji: '💘', tier: 'silver' },

  // ===== 金牌成就 =====
  { id: 'diary_50',       title: '日记大师',    desc: '写下50篇恋爱日记',        emoji: '📖', tier: 'gold' },
  { id: 'whisper_50',     title: '甜言达人',    desc: '发送50条悄悄话',          emoji: '🌹', tier: 'gold' },
  { id: 'photo_50',       title: '时光收藏家',  desc: '上传50张照片',            emoji: '🎞️', tier: 'gold' },
  { id: 'order_100',      title: '美食狂人',    desc: '累计点餐100次',           emoji: '👑', tier: 'gold' },
  { id: 'mood_streak_7',  title: '心情达人',    desc: '连续7天打卡心情',         emoji: '🔥', tier: 'gold' },
  { id: 'together_365',   title: '在一起365天', desc: '在一起满一周年',          emoji: '🎂', tier: 'gold' },

  // ===== 铂金成就 =====
  { id: 'all_features',   title: '全能恋人',    desc: '同一天使用所有功能',      emoji: '💎', tier: 'platinum' }
];

const TIER_INFO = {
  bronze:   { label: '铜牌', icon: '🥉', color: '#CD7F32' },
  silver:   { label: '银牌', icon: '🥈', color: '#C0C0C0' },
  gold:     { label: '金牌', icon: '🥇', color: '#FFD700' },
  platinum: { label: '铂金', icon: '💎', color: '#E5E4E2' }
};

Page({
  data: {
    achievements: [],
    unlockedCount: 0,
    totalCount: ACHIEVEMENT_DEFS.length,
    progressPercent: 0,
    tierStats: {},
    activeFilter: 'all'
  },

  onLoad() { this.checkAndLoad(); },
  onShow() { this.checkAndLoad(); this.syncFromCloud(); },

  async syncFromCloud() {
    await storage.loadFromCloud();
    this.checkAndLoad();
  },

  checkAndLoad() {
    this.checkAchievements();
    this.loadAchievements();
  },

  checkAchievements() {
    // 日记
    const diaryCount = storage.getDiaries().length;
    if (diaryCount >= 1) storage.unlockAchievement('first_diary');
    if (diaryCount >= 10) storage.unlockAchievement('diary_10');
    if (diaryCount >= 50) storage.unlockAchievement('diary_50');

    // 悄悄话
    const whisperCount = storage.getWhispers().length;
    if (whisperCount >= 1) storage.unlockAchievement('first_whisper');
    if (whisperCount >= 10) storage.unlockAchievement('whisper_10');
    if (whisperCount >= 50) storage.unlockAchievement('whisper_50');

    // 相册
    const photoCount = storage.getAlbumPhotos().length;
    if (photoCount >= 1) storage.unlockAchievement('first_photo');
    if (photoCount >= 20) storage.unlockAchievement('photo_20');
    if (photoCount >= 50) storage.unlockAchievement('photo_50');

    // 愿望
    const wishes = storage.getWishes();
    if (wishes.length >= 1) storage.unlockAchievement('first_wish');
    if (wishes.length >= 5) storage.unlockAchievement('wish_5');
    if (wishes.length >= 10) storage.unlockAchievement('wish_10');
    let doneWishCount = 0;
    for (let i = 0; i < wishes.length; i++) {
      if (wishes[i].done) doneWishCount++;
    }
    if (doneWishCount >= 1) storage.unlockAchievement('wish_done');
    if (doneWishCount >= 5) storage.unlockAchievement('wish_done_5');

    // 纪念日
    const annCount = storage.getAnniversaries().length;
    if (annCount >= 3) storage.unlockAchievement('anniversary_3');
    if (annCount >= 5) storage.unlockAchievement('anniversary_5');

    // 订单（累计计数）
    const orderCount = storage.getOrderTotalCount();
    if (orderCount >= 1) storage.unlockAchievement('first_order');
    if (orderCount >= 10) storage.unlockAchievement('order_10');
    if (orderCount >= 100) storage.unlockAchievement('order_100');

    // 订单完成（检查是否有done状态的订单）
    const orders = storage.getOrderQueue();
    let hasDoneOrder = false;
    for (let o = 0; o < orders.length; o++) {
      if (orders[o].status === 'done') { hasDoneOrder = true; break; }
    }
    if (hasDoneOrder) storage.unlockAchievement('order_done_1');

    // 在一起天数
    const days = storage.getTogetherDays();
    if (days >= 100) storage.unlockAchievement('together_100');
    if (days >= 365) storage.unlockAchievement('together_365');

    // 心情联动
    const todayMood = storage.getTodayMood();
    const partnerMood = storage.getPartnerTodayMood();
    if (todayMood && partnerMood) storage.unlockAchievement('mood_sync');

    // 连续7天心情打卡
    const recentMoods = storage.getRecentMoods(7);
    let streak = 0;
    const currentRole = storage.getCurrentRole();
    for (let d = 0; d < recentMoods.length; d++) {
      let hasMyMood = false;
      for (let m = 0; m < recentMoods[d].moods.length; m++) {
        if (recentMoods[d].moods[m].role === currentRole) { hasMyMood = true; break; }
      }
      if (hasMyMood) streak++; else break;
    }
    if (streak >= 7) storage.unlockAchievement('mood_streak_7');

    // 全能恋人：同一天使用所有功能
    const today = storage._todayStr();
    const todayDiaries = storage.getDiaries().filter(function(d) { return d.date === today; });
    const todayWhispers = storage.getWhispers().filter(function(w) { return w.time && w.time.indexOf(today) === 0; });
    const todayMoods = storage.getMoods().filter(function(m) { return m.date === today; });
    const todayOrders = orders.filter(function(o) { return o.time && o.time.indexOf(today) === 0; });
    const allAlbums = storage.getAlbums();
    let hasPhotoToday = false;
    for (let a = 0; a < allAlbums.length; a++) {
      if (allAlbums[a].photos) {
        for (let p = 0; p < allAlbums[a].photos.length; p++) {
          if (allAlbums[a].photos[p].time && allAlbums[a].photos[p].time.indexOf(today) === 0) {
            hasPhotoToday = true; break;
          }
        }
      }
      if (hasPhotoToday) break;
    }
    if (todayDiaries.length > 0 && todayWhispers.length > 0 && todayMoods.length > 0 && hasPhotoToday) {
      storage.unlockAchievement('all_features');
    }
  },

  loadAchievements() {
    const runtimeData = storage.getAchievements();
    const runtimeMap = {};
    for (let i = 0; i < runtimeData.length; i++) {
      runtimeMap[runtimeData[i].id] = runtimeData[i];
    }

    const achievements = ACHIEVEMENT_DEFS.map(function(def) {
      const runtime = runtimeMap[def.id];
      return {
        id: def.id,
        title: def.title,
        desc: def.desc,
        emoji: def.emoji,
        tier: def.tier,
        tierLabel: TIER_INFO[def.tier].label,
        tierIcon: TIER_INFO[def.tier].icon,
        unlocked: runtime ? runtime.unlocked : false,
        unlockedAt: runtime ? runtime.unlockedAt : 0
      };
    });

    let unlockedCount = 0;
    const tierStats = { bronze: {total:0,unlocked:0}, silver: {total:0,unlocked:0}, gold: {total:0,unlocked:0}, platinum: {total:0,unlocked:0} };
    for (let j = 0; j < achievements.length; j++) {
      tierStats[achievements[j].tier].total++;
      if (achievements[j].unlocked) {
        unlockedCount++;
        tierStats[achievements[j].tier].unlocked++;
      }
    }

    const totalCount = achievements.length;
    const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    this.setData({
      achievements: achievements,
      unlockedCount: unlockedCount,
      totalCount: totalCount,
      progressPercent: progressPercent,
      tierStats: tierStats
    });
  },

  filterByTier(e) {
    const tier = e.currentTarget.dataset.tier;
    this.setData({ activeFilter: tier });
  },

  noop() {}
});
