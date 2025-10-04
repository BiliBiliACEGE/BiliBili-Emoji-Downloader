(() => {
  // ====== 只在 B 站跑 ======
  if (!location.hostname.endsWith('.bilibili.com')) return;

  // ====== 等 JSZip 就位 ======
  const awaitZip = () => new Promise(res => {
    if (window.JSZip) return res();
    const t = setInterval(() => { if (window.JSZip) { clearInterval(t); res(); } }, 50);
    setTimeout(res, 500); // 兜底
  });

  // ====== 采集/打包/Toast 全不变 ======
  function getMessageEmojis(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
  function getCommentEmojis() {
    return Array.from(
      document.querySelector('bili-comments')?.shadowRoot.querySelectorAll('#contents #feed bili-comment-thread-renderer') || []
    ).flatMap(item =>
      Array.from(
        item.shadowRoot.querySelector('#comment').shadowRoot.querySelector('#body #main #content bili-rich-text')
          .shadowRoot.querySelectorAll('#contents>img')
      ).concat(
        Array.from(item.shadowRoot.querySelectorAll('#replies bili-comment-replies-renderer'))
          .flatMap(r => Array.from(r.shadowRoot.querySelectorAll('#expander #expander-contents bili-comment-reply-renderer'))
            .flatMap(r2 =>
              Array.from(r2.shadowRoot.querySelector('#body #main bili-rich-text').shadowRoot.querySelectorAll('#contents>img'))
            ))
      )
    );
  }
  function getBlackboardEmojis() {
    return Array.from(
      document.querySelector('#mall-iframe')?.contentDocument.querySelectorAll(
        '#app .digital-card .digital-card-content .drawer .content .v-switcher .v-switcher__content .v-switcher__content__wrap .v-switcher__content__item .dlc-detail .dlc-cards .scarcity-block'
      ) || []
    ).flatMap(b => Array.from(b.querySelectorAll('.card-block .card-item')));
  }

  function getUrl(item, type) {
    const url = type === 4 ? item.querySelector('.card-container .card .card-img img').src : item.src;
    const idx = url.indexOf('@');
    return idx > 0 ? url.slice(0, idx) : url;
  }
  function getImgName(item, type) {
    if (type === 4) return item.querySelector('.name').innerText.trim();
    return item.alt.slice(1, -1) || item.alt;
  }
  function getZipName(item, type) {
    if (type === 0) return item.alt.slice(1, -1).match(/^(.*?)_/)?.[1] || item.alt;
    return getImgName(item, type) + '等';
  }
  const blobToBinary = async blob => new Uint8Array(await new Response(blob).arrayBuffer());

  async function downloadEmojis(emojis, type) {
    await awaitZip();
    const seen = new Set();
    const list = emojis.filter(it => {
      const name = getImgName(it, type);
      if (type !== 0 && type !== 4 && !name.includes('_')) return false;
      if (seen.has(name)) return false;
      seen.add(name); return true;
    });
    if (list.length === 0) return { ok: false, msg: '未找到可下载的表情' };

    const zip = new JSZip();
    let zipName = '';
    await Promise.all(list.map(async (it, idx) => {
      if (idx === 0) zipName = getZipName(it, type);
      const url = getUrl(it, type);
      const ext = url.split('.').pop();
      zip.file(getImgName(it, type) + '.' + ext, await blobToBinary(await (await fetch(url)).blob()));
    }));
    const blob = zip.generate({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = zipName + '.zip';
    a.click();
    URL.revokeObjectURL(a.href);
    return { ok: true };
  }

  function toast(txt) {
    const d = document.createElement('div');
    Object.assign(d.style, {
      position: 'fixed', left: '50%', top: '20px',
      transform: 'translateX(-50%)',
      background: '#00a2ff', color: '#fff',
      padding: '8px 16px', borderRadius: '4px',
      zIndex: 10000, fontSize: '14px'
    });
    d.textContent = txt;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2000);
  }

  // ====== 监听 background 消息 ======
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.cmd !== 'download') return;
    (async () => {
      try {
        const type = msg.type;
        const isMsg = location.href.startsWith('https://message.bilibili.com');
        const isComment = /^https:\/\/www\.bilibili\.com\/(video|bangumi|opus)/.test(location.href);
        const isBoard = location.href.startsWith('https://www.bilibili.com/blackboard');

        let emojis = [];
        if (isComment && type === 3) emojis = getCommentEmojis();
        else if (isMsg && type === 0) emojis = getMessageEmojis('.bili-emoji-picker--visible .bili-emoji-picker__body .bili-emoji-picker__content .bili-emoji-picker__emoji img');
        else if (isMsg && type === 1) emojis = getMessageEmojis('.message-layout .message-main .whisper .message-content .message-content__wrapper .message-content__inner .im-container .msb-textarea .brt-root .brt-editor img');
        else if (isMsg && type === 2) emojis = getMessageEmojis('.message-layout .message-main .whisper .message-content .message-content__wrapper .message-content__inner .im-container .im-scroll div[class^="_RichText_"] img');
        else if (isBoard && type === 4) emojis = getBlackboardEmojis();
        else { toast('当前页面不支持该场景'); return; }

        const ret = await downloadEmojis(emojis, type);
        toast(ret.ok ? '✅ 已打包并下载' : '⚠️ ' + ret.msg);
      } catch (e) {
        toast('❌ 出错：' + e.message);
      }
    })();
  });
})();