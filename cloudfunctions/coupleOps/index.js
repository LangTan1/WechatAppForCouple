const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const couples = db.collection('couples');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  try {
    switch (action) {
      case 'createCouple':
        return await createCouple(event, openid);
      case 'bindCouple':
        return await bindCouple(event, openid);
      case 'loadCouple':
        return await loadCouple(event);
      case 'saveField':
        return await saveField(event);
      case 'saveBatch':
        return await saveBatch(event);
      case 'findCoupleByOpenid':
        return await findCoupleByOpenid(openid);
      case 'unbindCouple':
        return await unbindCouple(event);
      default:
        return { success: false, error: '未知操作: ' + action };
    }
  } catch (e) {
    console.error('coupleOps error:', action, e);
    return { success: false, error: e.message || '服务器错误' };
  }
};

// 创建情侣文档
async function createCouple(event, openid) {
  const { docData, inviteCode } = event;
  docData.devOpenid = openid;
  docData.inviteCode = inviteCode;
  docData.createdAt = db.serverDate();
  docData.updatedAt = db.serverDate();

  const res = await couples.add({ data: docData });
  return { success: true, docId: res._id, inviteCode: inviteCode };
}

// 绑定使用者到情侣文档
async function bindCouple(event, openid) {
  const { inviteCode, userName, userGender } = event;

  const res = await couples.where({ inviteCode: inviteCode }).get();
  if (res.data.length === 0) {
    return { success: false, error: '邀请码不存在' };
  }

  const couple = res.data[0];
  if (couple.userOpenid && couple.userOpenid !== openid) {
    return { success: false, error: '该邀请码已被其他人绑定' };
  }

  const updateData = { userOpenid: openid, updatedAt: db.serverDate() };
  if (userName) updateData.userName = userName;
  if (userGender) updateData.userGender = userGender;

  await couples.doc(couple._id).update({ data: updateData });

  // 返回更新后的完整文档
  couple.userOpenid = openid;
  if (userName) couple.userName = userName;
  if (userGender) couple.userGender = userGender;

  return { success: true, docId: couple._id, couple: couple };
}

// 加载情侣文档
async function loadCouple(event) {
  const { docId } = event;
  const res = await couples.doc(docId).get();
  return { success: true, data: res.data };
}

// 保存单个字段
async function saveField(event) {
  const { docId, cloudField, value } = event;
  const updateData = { updatedAt: db.serverDate() };
  updateData[cloudField] = value;
  await couples.doc(docId).update({ data: updateData });
  return { success: true };
}

// 批量保存字段
async function saveBatch(event) {
  const { docId, updates } = event;
  const updateData = { updatedAt: db.serverDate() };
  for (const key in updates) {
    updateData[key] = updates[key];
  }
  await couples.doc(docId).update({ data: updateData });
  return { success: true };
}

// 按开发者openid查找情侣文档
async function findCoupleByOpenid(openid) {
  const res = await couples.where({ devOpenid: openid }).get();
  if (res.data.length > 0) {
    return { success: true, couple: res.data[0] };
  }
  return { success: false, error: '未找到情侣文档' };
}

// 解绑（删除文档）
async function unbindCouple(event) {
  const { docId } = event;
  await couples.doc(docId).remove();
  return { success: true };
}
