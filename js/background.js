// 1. 创建右键菜单
const SCENES = [
  { id: '3', title: '💬 下载评论区表情包' },
  { id: '0', title: '😊 下载当前选中系列表情' },
  { id: '1', title: '✏️ 下载输入框表情' },
  { id: '2', title: '💌 下载对话框表情' },
  { id: '4', title: '🎴 下载收藏集图片' }
];
chrome.runtime.onInstalled.addListener(() => {
  SCENES.forEach(s => chrome.contextMenus.create({ id: s.id, title: s.title, contexts: ['all'] }));
});

// 2. 点击菜单 → 先注入 JSZip → 再注入 content.js
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab.url.includes('bilibili.com')) return;
  const tabId = tab.id;

  // 1. 注入 JSZip
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['jszip.min.js']
  }).catch(() => {});

  // 2. 注入 content.js
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  }).catch(() => {});

  // 3. 稍等一会儿再发指令
  setTimeout(() => {
    chrome.tabs.sendMessage(tabId, { cmd: 'download', type: Number(info.menuItemId) });
  }, 100);
});