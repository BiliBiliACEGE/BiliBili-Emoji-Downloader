// 先引入 JSZip
const loadJSZip = () => {
  if (window.JSZip) return Promise.resolve();
  return new Promise((res, rej) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/2.6.1/jszip.min.js';
    sc.onload = res; sc.onerror = rej;
    document.head.appendChild(sc);
  });
};

// 采集函数（与原脚本相同，此处省略以节省篇幅，直接复用即可）
  function getCommentEmojis() {
    return Array.from(
      document
        .querySelector('bili-comments')
        .shadowRoot.querySelectorAll('#contents #feed bili-comment-thread-renderer')
    ).flatMap(item =>
      Array.from(
        item.shadowRoot
          .querySelector('#comment')
          .shadowRoot.querySelector('#body #main #content bili-rich-text')
          .shadowRoot.querySelectorAll('#contents>img')
      ).concat(
        Array.from(
          item.shadowRoot
            .querySelector('#replies bili-comment-replies-renderer')
            .shadowRoot.querySelectorAll('#expander #expander-contents bili-comment-reply-renderer')
        ).flatMap(item2 =>
          Array.from(
            item2.shadowRoot
              .querySelector('#body #main bili-rich-text')
              .shadowRoot.querySelectorAll('#contents>img')
          )
        )
      )
    );
  }
function getMessageEmojis(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
function getBlackboardEmojis() {
    return Array.from(
      document
        .querySelector('#mall-iframe')
        .contentDocument.querySelectorAll(
          '#app .digital-card .digital-card-content .drawer .content .v-switcher .v-switcher__content .v-switcher__content__wrap .v-switcher__content__item .dlc-detail .dlc-cards .scarcity-block'
        )
    ).flatMap(item => Array.from(item.querySelectorAll('.card-block .card-item')));
  }
function getUrl(item, type) {
    let url, idx;
    switch (type) {
      case 0: case 1: case 2: case 3:
        url = item.src; idx = url.indexOf('@'); return idx > 0 ? url.slice(0, idx) : url;
      case 4:
        url = item.querySelector('.card-container .card .card-img img').src;
        idx = url.indexOf('@'); return idx > 0 ? url.slice(0, idx) : url;
    }
  }
  function getImgName(item, type) {
    switch (type) {
      case 0: case 1: case 2: case 3:
        return item.alt.slice(1, -1) || item.alt;
      case 4:
        return item.querySelector('.name').innerText;
    }
  }
 function getZipName(item, type) {
    switch (type) {
      case 0:
        return item.alt.slice(1, -1).match(/^(.*?)_/)?.[1] || item.alt;
      default:
        return getImgName(item, type) + '等';
    }
  }
const blobToBinary = async blob => new Uint8Array(await new Response(blob).arrayBuffer());

async function downloadEmojis(emojis, type) {
  await loadJSZip();
  const seen = new Set();
  const list = emojis.filter(it => {
    const name = getImgName(it, type);
    if (type !== 0 && type !== 4 && !name.includes('_')) return false;
    if (seen.has(name)) return false;
    seen.add(name); return true;
  });
  if (list.length === 0) return { ok: false, msg: '未找到可下载表情' };

  const zip = new JSZip();
  let zipName = '';
  const tasks = list.map(async (it, idx) => {
    if (idx === 0) zipName = getZipName(it, type);
    const url = getUrl(it, type);
    const ext = url.split('.').pop();
    zip.file(getImgName(it, type) + '.' + ext,
      await blobToBinary(await (await fetch(url)).blob()));
  });
  await Promise.all(tasks);

  const blob = zip.generate({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipName + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
  return { ok: true };
}

// 监听 popup 指令
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.cmd !== 'download') return;
  (async () => {
    try {
      let emojis = [];
      const type = msg.type;
      const isMsg = location.href.startsWith('https://message.bilibili.com');
      const isComment = /^https:\/\/www\.bilibili\.com\/(video|bangumi|opus)/.test(location.href);
      const isBoard = location.href.startsWith('https://www.bilibili.com/blackboard');

      if (isComment && type === 3) emojis = getCommentEmojis();
      else if (isMsg && type === 0) emojis = getMessageEmojis(buttons[0].selector);
      else if (isMsg && type === 1) emojis = getMessageEmojis(buttons[1].selector);
      else if (isMsg && type === 2) emojis = getMessageEmojis(buttons[2].selector);
      else if (isBoard && type === 4) emojis = getBlackboardEmojis();
      else return sendResponse({ ok: false, msg: '当前页面不支持该场景' });

      const ret = await downloadEmojis(emojis, type);
      sendResponse(ret);
    } catch (e) {
      sendResponse({ ok: false, msg: e.message });
    }
  })();
  return true; // 异步
});