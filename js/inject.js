(() => {
  'use strict';
  /* ===================== 以下代码与原 userscript 完全一致 ===================== */
  const buttons = [
    {
      selector: '.bili-emoji-picker--visible .bili-emoji-picker__body .bili-emoji-picker__content .bili-emoji-picker__emoji img',
      textContent: '下载选中系列表情包',
      alertMessage: '请先点击表情选项并选中需要下载的表情包'
    },
    {
      selector: '.message-layout .message-main .whisper .message-content .message-content__wrapper .message-content__inner .im-container .msb-textarea .brt-root .brt-editor img',
      textContent: '下载输入框表情包',
      alertMessage: '输入框没有表情包'
    },
    {
      selector: '.message-layout .message-main .whisper .message-content .message-content__wrapper .message-content__inner .im-container .im-scroll div[class^="_RichText_"] img',
      textContent: '下载对话框表情包',
      alertMessage: '对话框没有表情包'
    },
    {
      textContent: '下载评论区表情包',
      alertMessage: '评论区没有表情包'
    },
    {
      textContent: '下载收藏集图片',
      alertMessage: '请参照教程打开收藏集卡池详情'
    }
  ];

  const buttonStyle = {
    width: '130px',
    marginBottom: '25px',
    cursor: 'pointer',
    padding: '2px',
    border: '1px solid #767676',
    backgroundColor: '#efefef',
    fontSize: '12px'
  };

  const isMessage = location.href.startsWith('https://message.bilibili.com');
  const isComment = /^https:\/\/www\.bilibili\.com\/(video|bangumi|opus)/.test(location.href);
  const isBlackboard = location.href.startsWith('https://www.bilibili.com/blackboard');

  // 动态引入 JSZip（cdnjs）
  const loadJSZip = () => {
    if (window.JSZip) return Promise.resolve();
    return new Promise((res, rej) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/2.6.1/jszip.min.js';
      sc.onload = () => res();
      sc.onerror = rej;
      document.head.appendChild(sc);
    });
  };

  const div = document.createElement('div');
  Object.assign(div.style, {
    position: 'fixed',
    top: '250px',
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    zIndex: 9999
  });

  for (let i = 0; i < 5; i++) {
    if (isMessage) { if (i !== 0 && i !== 1 && i !== 2) continue; }
    else if (isComment) { if (i !== 3) continue; }
    else if (isBlackboard) { if (i !== 4) continue; }
    else return;

    const { selector, textContent } = buttons[i];
    const btn = document.createElement('button');
    btn.textContent = textContent;
    Object.assign(btn.style, buttonStyle);
    btn.onclick = () => {
      loadJSZip().then(() => {
        let emojis = [];
        if (isMessage) emojis = getMessageEmojis(selector);
        else if (isComment) emojis = getCommentEmojis();
        else if (isBlackboard) emojis = getBlackboardEmojis();
        downloadEmojis(emojis, i);
      }).catch(console.error);
    };
    div.appendChild(btn);
  }

  // 评论区单条评论附加按钮
  if (isComment) {
    const btn = document.createElement('button');
    btn.textContent = '单条评论表情下载';
    Object.assign(btn.style, buttonStyle);
    btn.onclick = () => {
      loadJSZip().then(() => {
        const emojis = getCommentEmojis();
        const parents = new Set();
        emojis.forEach(item => {
          if (getImgName(item, 3).includes('_')) parents.add(item.parentNode);
        });
        parents.forEach(p => {
          if (p.lastElementChild?.tagName === 'BUTTON') return;
          const b = document.createElement('button');
          b.textContent = '下载';
          b.onclick = () => downloadEmojis(Array.from(p.querySelectorAll('img')), 3);
          p.appendChild(b);
        });
      });
    };
    div.appendChild(btn);
  }

  document.body.appendChild(div);

  /* -------------------------------- 下面函数与 userscript 完全一致 -------------------------------- */
  function getMessageEmojis(selector) {
    return Array.from(document.querySelectorAll(selector));
  }
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
  async function blobToBinary(blob) {
    return new Uint8Array(await new Response(blob).arrayBuffer());
  }
  async function downloadEmojis(emojis, i) {
    await loadJSZip();
    const seen = new Set();
    const filtered = emojis.filter(item => {
      const name = getImgName(item, i);
      if (i !== 0 && i !== 4 && !name.includes('_')) return false;
      if (seen.has(name)) return false;
      seen.add(name); return true;
    });
    if (filtered.length === 0) return alert(buttons[i].alertMessage);

    const zip = new JSZip();
    let zipName = '';
    const tasks = filtered.map(async (it, idx) => {
      if (idx === 0) zipName = getZipName(it, i);
      const url = getUrl(it, i);
      const ext = url.split('.').pop();
      const fileName = getImgName(it, i) + '.' + ext;
      zip.file(fileName, await blobToBinary(await (await fetch(url)).blob()));
    });
    await Promise.all(tasks);

    const blob = zip.generate({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = zipName + '.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }
})();