/**
 * Mock 数据 - 琳的生活菜单
 */

// 在一起日期
const togetherDate = '2024-02-14';

// 计算在一起天数
function getTogetherDays() {
  const start = new Date(togetherDate);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// 菜单数据
const menuList = {
  meal: {
    name: '正餐',
    icon: '🍚',
    items: [
      { id: 1, name: '番茄牛腩饭', image: '', liked: true, emoji: '🍅' },
      { id: 2, name: '日式拉面', image: '', liked: true, emoji: '🍜' },
      { id: 3, name: '麻辣香锅', image: '', liked: false, emoji: '🌶️' },
      { id: 4, name: '韩式拌饭', image: '', liked: true, emoji: '🍳' },
      { id: 5, name: '酸菜鱼', image: '', liked: false, emoji: '🐟' },
      { id: 6, name: '黄焖鸡米饭', image: '', liked: false, emoji: '🍗' },
    ]
  },
  drink: {
    name: '奶茶甜品',
    icon: '🧋',
    items: [
      { id: 11, name: '珍珠奶茶', image: '', liked: true, emoji: '🫧' },
      { id: 12, name: '杨枝甘露', image: '', liked: true, emoji: '🥭' },
      { id: 13, name: '提拉米苏', image: '', liked: true, emoji: '🍰' },
      { id: 14, name: '抹茶拿铁', image: '', liked: false, emoji: '🍵' },
      { id: 15, name: '草莓奶昔', image: '', liked: true, emoji: '🍓' },
      { id: 16, name: '双皮奶', image: '', liked: false, emoji: '🥛' },
    ]
  },
  snack: {
    name: '夜宵',
    icon: '🌙',
    items: [
      { id: 21, name: '烤串拼盘', image: '', liked: true, emoji: '🍢' },
      { id: 22, name: '炸鸡翅', image: '', liked: true, emoji: '🍗' },
      { id: 23, name: '小龙虾', image: '', liked: false, emoji: '🦞' },
      { id: 24, name: '烤冷面', image: '', liked: true, emoji: '🫓' },
      { id: 25, name: '臭豆腐', image: '', liked: false, emoji: '🧈' },
      { id: 26, name: '花甲粉', image: '', liked: false, emoji: '🍲' },
    ]
  }
};

// 恋爱日记
const diaries = [
  {
    id: 1,
    date: '2024-12-25',
    title: '第一次一起看烟花',
    content: '圣诞节晚上，我们去了江边看烟花。焰火在天空绽放的时候，你转头对我说"以后的每一个圣诞节都要一起过"。那一刻我觉得自己是世界上最幸福的人。烟花很美，但不及你眼里的光。',
    mood: 'happy'
  },
  {
    id: 2,
    date: '2024-12-01',
    title: '一起做饭的周日',
    content: '今天我们一起做了番茄牛腩，你切的番茄，我炖的牛腩。厨房里飘着香气，你从背后抱住我的时候，我觉得这就是我想要的生活——平凡但温暖。虽然最后饭有点咸，但你说很好吃。',
    mood: 'love'
  },
  {
    id: 3,
    date: '2024-11-15',
    title: '琳琳感冒了',
    content: '琳琳今天感冒发烧，我请了假在家照顾她。给她煮了姜汤，买了药，一直守在她床边。看着她难受的样子，我的心都揪起来了。好在她吃了药之后好了很多，晚上还撒娇说想吃小馄饨。',
    mood: 'care'
  },
  {
    id: 4,
    date: '2024-10-06',
    title: '我们的第一次旅行',
    content: '国庆节去了大理，骑着小电驴环洱海。风吹过耳边，你坐在后座紧紧抱着我，一路唱着《简单爱》。在大理的云朵下，我们约定每年都要一起去一个地方。',
    mood: 'happy'
  },
];

// 悄悄话
const whispers = [
  {
    id: 1,
    sender: '林先生',
    avatar: '',
    content: '今天工作辛苦了，晚上给你做好吃的～',
    time: '2024-12-26 18:30',
    color: '#FF6B8A'
  },
  {
    id: 2,
    sender: '琳小姐',
    avatar: '',
    content: '超级想吃火锅！！我们这周末去吧！',
    time: '2024-12-26 15:20',
    color: '#FFB6C1'
  },
  {
    id: 3,
    sender: '林先生',
    avatar: '',
    content: '今天路过花店买了一束玫瑰，放在你桌上了，希望你看到会开心 ❤️',
    time: '2024-12-25 10:00',
    color: '#FF6B8A'
  },
  {
    id: 4,
    sender: '琳小姐',
    avatar: '',
    content: '偷偷在你的外套口袋里放了一颗糖，记得吃哦～',
    time: '2024-12-24 08:15',
    color: '#FFB6C1'
  },
  {
    id: 5,
    sender: '林先生',
    avatar: '',
    content: '今晚一起看电影吧，我买了投影仪！',
    time: '2024-12-23 20:00',
    color: '#FF6B8A'
  },
];

// 时光相册（占位图）
const albumPhotos = [
  { id: 1, url: '', desc: '第一次见面', date: '2024-02-14', emoji: '💕' },
  { id: 2, url: '', desc: '大理洱海边', date: '2024-10-03', emoji: '🌊' },
  { id: 3, url: '', desc: '一起做饭', date: '2024-12-01', emoji: '🍳' },
  { id: 4, url: '', desc: '圣诞烟花', date: '2024-12-25', emoji: '🎆' },
  { id: 5, url: '', desc: '周末郊游', date: '2024-11-20', emoji: '🌿' },
  { id: 6, url: '', desc: '生日惊喜', date: '2024-09-18', emoji: '🎂' },
  { id: 7, url: '', desc: '一起逛街', date: '2024-08-14', emoji: '🛍️' },
  { id: 8, url: '', desc: '看日落', date: '2024-07-30', emoji: '🌅' },
];

// 纪念日
const anniversaries = [
  { id: 1, title: '恋爱纪念日', date: '2024-02-14', icon: '💝', type: 'annual' },
  { id: 2, title: '第一次牵手', date: '2024-02-18', icon: '🤝', type: 'annual' },
  { id: 3, title: '琳琳生日', date: '2024-09-18', icon: '🎂', type: 'annual' },
  { id: 4, title: '林先生生日', date: '2024-06-22', icon: '🎉', type: 'annual' },
  { id: 5, title: '第一次旅行', date: '2024-10-03', icon: '✈️', type: 'annual' },
  { id: 6, title: '一周年纪念', date: '2025-02-14', icon: '💍', type: 'once' },
];

// 愿望清单
const wishes = [
  { id: 1, title: '一起去迪士尼看烟花', done: false, emoji: '🏰' },
  { id: 2, title: '一起去看周杰伦演唱会', done: false, emoji: '🎵' },
  { id: 3, title: '养一只猫咪', done: false, emoji: '🐱' },
  { id: 4, title: '一起坐摩天轮', done: true, emoji: '🎡' },
  { id: 5, title: '一起看一次日出', done: true, emoji: '🌄' },
  { id: 6, title: '给琳琳织一条围巾', done: false, emoji: '🧣' },
  { id: 7, title: '一起去海边露营', done: false, emoji: '🏕️' },
  { id: 8, title: '做一本恋爱相册书', done: false, emoji: '📖' },
];

// 首页动态
const activities = [
  { id: 1, type: 'diary', text: '记录了新的恋爱日记「第一次一起看烟花」', time: '3小时前' },
  { id: 2, type: 'whisper', text: '琳小姐发来一条悄悄话 💌', time: '5小时前' },
  { id: 3, type: 'album', text: '上传了3张新照片到时光相册', time: '昨天' },
  { id: 4, type: 'menu', text: '琳小姐选择了今天的晚餐：番茄牛腩饭', time: '昨天' },
  { id: 5, type: 'diary', text: '记录了新的恋爱日记「一起做饭的周日」', time: '2天前' },
  { id: 6, type: 'wish', text: '完成了一个心愿：一起坐摩天轮 🎡', time: '3天前' },
];

// 随机选择食物
function randomPick(categoryKey) {
  if (categoryKey && menuList[categoryKey]) {
    const items = menuList[categoryKey].items;
    return items[Math.floor(Math.random() * items.length)];
  }
  const allItems = [];
  Object.values(menuList).forEach(cat => {
    allItems.push(...cat.items);
  });
  return allItems[Math.floor(Math.random() * allItems.length)];
}

module.exports = {
  togetherDate,
  getTogetherDays,
  menuList,
  diaries,
  whispers,
  albumPhotos,
  anniversaries,
  wishes,
  activities,
  randomPick
};
