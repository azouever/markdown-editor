var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

var STORAGE_KEYS = {
    content: 'content',
    prefNight: 'dt.pref.night',
    prefRead: 'dt.pref.read',
    prefTocHidden: 'dt.pref.tocHidden',
    prefWidth: 'dt.pref.width'
};

function storageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        return null;
    }
}

function storageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        // ignore
    }
}

// Because highlight.js is a bit awkward at times
var languageOverrides = {
    js: 'javascript',
    html: 'xml'
};

var livestyles;

emojify.setConfig({
    img_dir: 'emoji'
});

var md = markdownit({
        html: true,
        highlight: function(code, lang) {
            if (languageOverrides[lang]) lang = languageOverrides[lang];
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(lang, code).value;
                } catch (e) {}
            }
            return '';
        }
    })
    .use(markdownitFootnote)
    .use(function(mdInstance) {
        function escapeHtml(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        var defaultFence = mdInstance.renderer.rules.fence;
        mdInstance.renderer.rules.fence = function(tokens, idx, options, env, self) {
            var token = tokens[idx];
            var info = token.info ? token.info.trim().split(' ')[0] : '';
            if (info === 'mermaid' || info === 'gantt') {
                var code = token.content;
                if (info === 'gantt' && !/^\s*gantt\s*(\r?\n|$)/i.test(code)) {
                    code = 'gantt\n' + code;
                }
                return '<div class="mermaid">' + escapeHtml(code) + '</div>';
            }
            if (defaultFence) {
                return defaultFence(tokens, idx, options, env, self);
            }
            return self.renderToken(tokens, idx, options);
        };
    });

var mermaidInited = false;

function isNightMode() {
    var toplevel = document.getElementById('toplevel');
    return toplevel && toplevel.classList.contains('nightmode');
}

function renderMermaid(container) {
    if (!window.mermaid || !container) return;

    var targetTheme = isNightMode() ? 'dark' : 'default';

    try {
        mermaid.initialize({
            startOnLoad: false,
            theme: targetTheme
        });
        mermaidInited = true;
    } catch (e) {
        return;
    }

    var nodeList = container.querySelectorAll('.mermaid');
    if (!nodeList || nodeList.length === 0) return;

    // 过滤掉已经渲染过的节点
    var nodes = [];
    for (var i = 0; i < nodeList.length; i++) {
        var node = nodeList[i];
        if (!node.getAttribute('data-source')) {
            node.setAttribute('data-source', node.textContent || '');
        }
        if (node.getAttribute('data-processed') !== 'true') {
            nodes.push(node);
        }
    }

    if (nodes.length === 0) return;

    try {
        if (typeof mermaid.run === 'function') {
            var runResult = mermaid.run({ nodes: nodes });
            if (runResult && typeof runResult.catch === 'function') {
                runResult.catch(function(e) {
                    console.error('渲染 mermaid 图表失败', e);
                });
            }
            return;
        }
        if (typeof mermaid.init === 'function') {
            mermaid.init(undefined, nodes);
        }
    } catch (e) {
        console.error('渲染 mermaid 图表失败', e);
    }
}

function rerenderMermaid(container) {
    if (!container) return;
    var nodes = container.querySelectorAll('.mermaid');
    if (!nodes || nodes.length === 0) return;
    for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        var source = node.getAttribute('data-source');
        if (source) {
            node.innerHTML = source;
            node.removeAttribute('data-processed');
        }
    }
    renderMermaid(container);
}

var hashto;

var previewNavInited = false;

// ============ TOC 相关函数 ============
function normalizeText(text) {
    return String(text || '')
        .trim()
        .replace(/\s+/g, ' ');
}

function findHeadingById(container, id) {
    if (!container || !id) return null;
    var headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < headings.length; i++) {
        if (headings[i].id === id) return headings[i];
    }
    return null;
}

function findExplicitTocList(container) {
    if (!container) return null;

    var headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < headings.length; i++) {
        var heading = headings[i];
        var text = normalizeText(heading.textContent || '');
        if (!text) continue;

        var pure = text.replace(/[：:]/g, '');
        if (pure !== '目录') continue;

        var sibling = heading.nextElementSibling;
        while (sibling) {
            if (sibling.tagName === 'UL' || sibling.tagName === 'OL') {
                return sibling;
            }
            if (/^H[1-6]$/.test(sibling.tagName)) {
                break;
            }
            sibling = sibling.nextElementSibling;
        }
    }

    return null;
}

function buildTocFromHeadings(container) {
    var headings = container.querySelectorAll('h1, h2, h3');
    var items = [];
    for (var i = 0; i < headings.length; i++) {
        var heading = headings[i];
        var text = normalizeText(heading.textContent || '');
        if (!text) continue;
        if (text.replace(/[：:]/g, '') === '目录') continue;
        if (!heading.id) continue;
        items.push({
            level: Number(heading.tagName.slice(1)),
            id: heading.id,
            text: text
        });
    }
    if (items.length < 2) return null;

    var root = document.createElement('ul');
    root.className = 'dt-toc-list';
    var stack = [{ level: 0, ul: root }];

    for (var j = 0; j < items.length; j++) {
        var item = items[j];
        while (stack.length > 1 && item.level <= stack[stack.length - 1].level) {
            stack.pop();
        }
        if (item.level > stack[stack.length - 1].level + 1) {
            item.level = stack[stack.length - 1].level + 1;
        }

        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + encodeURIComponent(item.id);
        a.textContent = item.text;
        li.appendChild(a);
        stack[stack.length - 1].ul.appendChild(li);

        var nextLevel = (j + 1 < items.length) ? items[j + 1].level : item.level;
        if (nextLevel > item.level) {
            var childUl = document.createElement('ul');
            li.appendChild(childUl);
            stack.push({ level: item.level, ul: childUl });
        }
    }

    return root;
}

var tocState = {
    headings: [],
    linksById: Object.create(null),
    rafPending: false,
    bound: false
};

function clearActiveToc() {
    var links = tocState.linksById;
    for (var id in links) {
        if (!Object.prototype.hasOwnProperty.call(links, id)) continue;
        links[id].classList.remove('dt-active');
    }
}

function setActiveToc(id) {
    clearActiveToc();
    var link = tocState.linksById[id];
    if (link) link.classList.add('dt-active');
}

function refreshActiveToc() {
    tocState.rafPending = false;
    var out = document.getElementById('out');
    if (!out) return;

    var headings = tocState.headings;
    if (!headings || headings.length === 0) return;

    var scrollTop = out.scrollTop || 0;
    var current = null;
    for (var i = 0; i < headings.length; i++) {
        if (!headings[i].id) continue;
        if (headings[i].offsetTop <= scrollTop + 24) {
            current = headings[i];
        } else {
            break;
        }
    }
    if (current && current.id) {
        setActiveToc(current.id);
    }
}

function scheduleActiveTocRefresh() {
    if (tocState.rafPending) return;
    tocState.rafPending = true;
    window.requestAnimationFrame(refreshActiveToc);
}

function initTocEvents() {
    if (tocState.bound) return;
    tocState.bound = true;

    var toc = document.getElementById('toc');
    var out = document.getElementById('out');
    if (!toc || !out) return;

    toc.addEventListener('click', function (e) {
        var target = e.target;
        if (!target || !target.closest) return;

        var link = target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href[0] !== '#') return;

        e.preventDefault();

        var rawId = href.slice(1);
        var decodedId;
        try {
            decodedId = decodeURIComponent(rawId);
        } catch (err) {
            decodedId = rawId;
        }

        var heading = findHeadingById(out, decodedId);
        if (!heading) return;

        try {
            heading.scrollIntoView({ block: 'start' });
        } catch (err2) {
            heading.scrollIntoView(true);
        }

        try {
            history.replaceState(null, '', '#' + encodeURIComponent(decodedId));
        } catch (err3) {
            // ignore
        }
    });

    out.addEventListener('scroll', scheduleActiveTocRefresh, { passive: true });
}

function updateTocVisibility(hasToc) {
    var toplevel = document.getElementById('toplevel');
    var out = document.getElementById('out');
    var input = document.getElementById('in');
    if (!toplevel || !out || !input) return;
    var isReadMode = out.classList.contains('focused') && input.classList.contains('hidden');
    toplevel.classList.toggle('toc-on', Boolean(hasToc && isReadMode && !tocHidden));
}

function updateToc() {
    var toc = document.getElementById('toc');
    var out = document.getElementById('out');
    if (!toc || !out) return;

    toc.innerHTML = '';
    tocState.headings = [];
    tocState.linksById = Object.create(null);

    var list = null;

    var explicit = findExplicitTocList(out);
    if (explicit) {
        list = explicit.cloneNode(true);
        list.classList.add('dt-toc-list');
    } else {
        list = buildTocFromHeadings(out);
    }

    var hasToc = Boolean(list);
    updateTocVisibility(hasToc);
    if (!hasToc) return;

    var title = document.createElement('div');
    title.className = 'dt-toc-title';
    title.textContent = '目录';
    toc.appendChild(title);
    toc.appendChild(list);

    var tocLinks = toc.querySelectorAll('a[href^="#"]');
    for (var i = 0; i < tocLinks.length; i++) {
        var a = tocLinks[i];
        var href = a.getAttribute('href') || '';
        var rawId = href.slice(1);
        if (!rawId) continue;
        var decodedId;
        try {
            decodedId = decodeURIComponent(rawId);
        } catch (err) {
            decodedId = rawId;
        }
        tocState.linksById[decodedId] = a;
    }

    tocState.headings = Array.prototype.slice.call(out.querySelectorAll('h1, h2, h3, h4, h5, h6'))
        .filter(function (h) { return Boolean(h && h.id && tocState.linksById[h.id]); });

    initTocEvents();
    refreshActiveToc();
}
// ============ TOC 相关函数结束 ============

function sanitizeHeadingId(text) {
    return String(text)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\u4e00-\u9fff\-]+/g, '');
}

function ensureHeadingIds(container) {
    if (!container) return;

    var headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    var used = Object.create(null);
    for (var i = 0; i < headings.length; i++) {
        var heading = headings[i];
        if (heading.id) {
            used[heading.id] = true;
            continue;
        }

        var base = sanitizeHeadingId(heading.textContent || '');
        if (!base) continue;

        var candidate = base;
        var suffix = 1;
        while (used[candidate] || document.getElementById(candidate)) {
            suffix += 1;
            candidate = base + '-' + suffix;
        }

        heading.id = candidate;
        used[candidate] = true;
    }
}

function initPreviewNavigation() {
    if (previewNavInited) return;
    previewNavInited = true;

    var out = document.getElementById('out');
    if (!out) return;

    out.addEventListener('click', function(e) {
        var target = e.target;
        if (!target || !target.closest) return;

        var link = target.closest('a');
        if (!link) return;

        var href = link.getAttribute('href');
        if (!href || href[0] !== '#') return;

        e.preventDefault();

        var rawId = href.slice(1);
        if (!rawId) return;

        var decodedId;
        try {
            decodedId = decodeURIComponent(rawId);
        } catch (err) {
            decodedId = rawId;
        }

        var heading = document.getElementById(decodedId);
        if (!heading || !out.contains(heading)) {
            return;
        }

        try {
            heading.scrollIntoView({ block: 'start' });
        } catch (err) {
            heading.scrollIntoView(true);
        }
    });
}

function update(e) {
    setOutput(e.getValue());

    //If a title is added to the document it will be the new document.title, otherwise use default
    var headerElements = document.querySelectorAll('h1');
    if (headerElements.length > 0 && headerElements[0].textContent.length > 0) {
        title = headerElements[0].textContent;
    } else {
        title = 'Markdown Editor'
    }

    //To avoid to much title changing we check if is not the same as before
    oldTitle = document.title;
    if (oldTitle != title) {
        oldTitle = title;
        document.title = title;
    }
    //clearTimeout(hashto);
    //hashto = setTimeout(updateHash, 1000);
}

/*
This function is used to check for task list notation.
If regex matches the string to task-list markdown format,
then the task-list is rendered to its correct form.
User: @austinmm
*/
var render_tasklist = function(str){
    // Checked task-list box match
	if(str.match(/<li>\[x\]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[x\]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
          checked style="list-style-type: none; 
          margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    // Unchecked task-list box match
    if (str.match(/<li>\[ \]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[ \]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
            style="list-style-type: none; 
            margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    return str
}

function renderTaskList(container) {
    if (!container) return;
    var listItems = container.querySelectorAll('li');
    if (!listItems || listItems.length === 0) return;

    for (var i = 0; i < listItems.length; i++) {
        var li = listItems[i];
        if (!li) continue;
        if (li.querySelector('input[type="checkbox"]')) continue;

        var target = li;
        if (li.firstElementChild && li.firstElementChild.tagName === 'P') {
            target = li.firstElementChild;
        }

        var first = target.firstChild;
        if (!first || first.nodeType !== 3) continue; // text node

        var raw = first.nodeValue || '';
        var match = raw.match(/^\s*\[(x|X| )\]\s+/);
        if (!match) continue;

        var checked = match[1].toLowerCase() === 'x';
        first.nodeValue = raw.replace(/^\s*\[(x|X| )\]\s+/, '');

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = checked;
        checkbox.disabled = true;
        checkbox.style.margin = '0 0.45em 0 0';
        checkbox.style.transform = 'translateY(1px)';

        li.style.listStyleType = 'none';
        target.insertBefore(checkbox, target.firstChild);
    }
}

function setOutput(val) {
    val = val.replace(/<equation>((.*?\n)*?.*?)<\/equation>/ig, function(a, b) {
        return '<img loading="lazy" alt="equation" referrerpolicy="no-referrer" src="https://latex.codecogs.com/png.latex?' + encodeURIComponent(b) + '" />';
    });

    var out = document.getElementById('out');
    var old = out.cloneNode(true);
    out.innerHTML = md.render(val);
    emojify.run(out);
    renderTaskList(out);

    ensureHeadingIds(out);
    renderMermaid(out);
    updateToc();

    var allold = old.getElementsByTagName("*");
    if (allold === undefined) return;

    var allnew = out.getElementsByTagName("*");
    if (allnew === undefined) return;

    for (var i = 0, max = Math.min(allold.length, allnew.length); i < max; i++) {
        if (!allold[i].isEqualNode(allnew[i])) {
            out.scrollTop = allnew[i].offsetTop;
            return;
        }
    }
}

CodeMirrorSpellChecker({
    codeMirrorInstance: CodeMirror,
});

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    mode: "spell-checker",
    backdrop: "gfm",
    lineNumbers: false,
    matchBrackets: true,
    lineWrapping: true,
    theme: 'base16-light',
    extraKeys: {
        "Enter": "newlineAndIndentContinueMarkdownList"
    }
});

editor.on('change', update);

function selectionChanger(selection,operator,endoperator){
    if(selection == ""){
        return operator;
    }
    if(!endoperator){
        endoperator = operator
    }
    var isApplied = selection.slice(0, 2) === operator && selection.slice(-2) === endoperator;
    var finaltext = isApplied ? selection.slice(2, -2) : operator + selection + endoperator;
    return finaltext;
}

editor.addKeyMap({
    // bold
    'Ctrl-B': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'**'));
    },
    // italic
    'Ctrl-I': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'_'));
    },
    // code
    'Ctrl-K': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'`'));
    },
    // keyboard shortcut
    'Ctrl-L': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'<kbd>','</kbd>'));
    }
});

document.addEventListener('drop', function(e) {
    if (!e.dataTransfer || !e.dataTransfer.types) return;
    var hasFiles = false;
    for (var i = 0; i < e.dataTransfer.types.length; i++) {
        if (e.dataTransfer.types[i] === 'Files') {
            hasFiles = true;
            break;
        }
    }
    if (!hasFiles) return;

    e.preventDefault();
    e.stopPropagation();

    var file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    loadFileIntoEditor(file);
}, false);

document.addEventListener('dragover', function(e) {
    if (!e.dataTransfer || !e.dataTransfer.types) return;
    for (var i = 0; i < e.dataTransfer.types.length; i++) {
        if (e.dataTransfer.types[i] === 'Files') {
            e.preventDefault();
            return;
        }
    }
}, false);

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsMarkdown() {
    save(editor.getValue(), document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '') + ".md");
}

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsHtml() {
    save(document.getElementById('out').innerHTML, document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '') + ".html");
}

document.getElementById('saveas-markdown').addEventListener('click', function() {
    saveAsMarkdown();
    hideMenu();
});

document.getElementById('saveas-html').addEventListener('click', function() {
    saveAsHtml();
    hideMenu();
});

function save(code, name) {
    var blob = new Blob([code], {
        type: 'text/plain'
    });
    if (window.saveAs) {
        window.saveAs(blob, name);
    } else if (navigator.saveBlob) {
        navigator.saveBlob(blob, name);
    } else {
        url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", name);
        var event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(event);
    }
}

var menuVisible = false;
var menu = document.getElementById('menu');
var menuBackdrop = document.getElementById('menu-backdrop');

function showMenu() {
    menuVisible = true;
    menu.style.display = 'block';
    if (menuBackdrop) menuBackdrop.classList.add('show');
    window.setTimeout(function() {
        var first = document.getElementById('saveas-markdown');
        if (first && first.focus) first.focus();
    }, 0);
}

function hideMenu() {
    menuVisible = false;
    menu.style.display = 'none';
    if (menuBackdrop) menuBackdrop.classList.remove('show');
}

if (menuBackdrop) {
    menuBackdrop.addEventListener('click', function() {
        if (menuVisible) hideMenu();
    });
}

document.addEventListener('mousedown', function(e) {
    if (!menuVisible) return;
    if (!menu) return;
    if (menu.contains(e.target)) return;
    hideMenu();
});

function openFile(evt) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var files = evt.target.files;
        var file = files && files[0];
        if (!file) return;
        loadFileIntoEditor(file);
        evt.target.value = '';
    } else {
        swal("不支持", "当前浏览器不支持文件读取能力。", "error");
    }
}

document.getElementById('close-menu').addEventListener('click', function() {
    hideMenu();
});

document.addEventListener('keydown', function(e) {
    if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
        if (storageGet(STORAGE_KEYS.content) == editor.getValue()) {
            e.preventDefault();
            return false;
        }
        e.shiftKey ? showMenu() : saveInBrowser();

        e.preventDefault();
        return false;
    }

    if (e.keyCode === 27 && menuVisible) {
        hideMenu();

        e.preventDefault();
        return false;
    }
});

function clearEditor() {
    if (!editor.getValue()) return;
    swal({
        title: "清空内容",
        text: "确定要清空当前全部内容吗？此操作不可撤销。",
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#FF3B30",
        confirmButtonText: "清空",
        cancelButtonText: "取消",
        closeOnConfirm: true
    }, function() {
        editor.setValue("");
    });
}

function copyMarkdown(button) {
    var content = editor.getValue();
    if (!content) {
        swal("内容为空", "没有可复制的内容。", "info");
        return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(content).then(function() {
            showCopyFeedback(button);
        }).catch(function() {
            fallbackCopy(content, button);
        });
    } else {
        fallbackCopy(content, button);
    }
}

function fallbackCopy(text, button) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showCopyFeedback(button);
    } catch (e) {
        swal("复制失败", "浏览器不允许复制或复制失败，请手动复制。", "error");
    }
    document.body.removeChild(textarea);
}

function showCopyFeedback(button) {
    var icon = button.querySelector('i');
    var originalText = icon.textContent;
    icon.textContent = 'check';
    button.classList.add('success');

    // 显示轻量 toast 提示
    showToast('已复制');

    setTimeout(function() {
        icon.textContent = originalText;
        button.classList.remove('success');
    }, 1500);
}

function showToast(message) {
    var existing = document.getElementById('toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
        toast.classList.add('show');
    }, 10);

    setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
            toast.remove();
        }, 300);
    }, 2000);
}

function saveInBrowser() {
    var text = editor.getValue();
    if (storageGet(STORAGE_KEYS.content) === text) {
        showToast('已是最新，无需保存');
        return;
    }
    if (storageGet(STORAGE_KEYS.content)) {
        swal({
                title: "检测到已保存的数据",
                text: "继续保存将覆盖之前保存的内容。",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#FF9500",
                confirmButtonText: "覆盖保存",
                cancelButtonText: "取消",
                closeOnConfirm: false
            },
            function() {
                storageSet(STORAGE_KEYS.content, text);
                swal("已保存", "内容已保存到浏览器。", "success");
            });
    } else {
        storageSet(STORAGE_KEYS.content, text);
        swal("已保存", "内容已保存到浏览器。", "success");
    }
}

function setNightMode(enabled) {
    var toplevel = document.getElementById('toplevel');
    var nightButton = document.getElementById('nightbutton');
    if (nightButton) nightButton.classList.toggle('selected', Boolean(enabled));
    if (toplevel) toplevel.classList.toggle('nightmode', Boolean(enabled));
    storageSet(STORAGE_KEYS.prefNight, enabled ? '1' : '0');
    rerenderMermaid(document.getElementById('out'));
}

function toggleNightMode(button) {
    setNightMode(!isNightMode());
}

var tocHidden = false;

var currentWidth = window.innerWidth * 0.65;
var minWidth = 400;
var maxWidth = 1200;

function adjustWidth(delta) {
    currentWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth + delta));
    applyWidth();
}

function applyWidth() {
    var out = document.getElementById('out');
    var valueDisplay = document.getElementById('width-value');
    var percent = Math.round((currentWidth / window.innerWidth) * 100);

    out.style.width = currentWidth + 'px';
    out.style.maxWidth = '95vw';
    valueDisplay.textContent = percent + '%';
    storageSet(STORAGE_KEYS.prefWidth, String(Math.round(currentWidth)));
}

function setTocHidden(hidden) {
    tocHidden = Boolean(hidden);
    storageSet(STORAGE_KEYS.prefTocHidden, tocHidden ? '1' : '0');
    var button = document.getElementById('tocbutton');
    if (button) button.classList.toggle('selected', !tocHidden);
}

function toggleToc(button) {
    setTocHidden(!tocHidden);
    var toplevel = document.getElementById('toplevel');
    if (tocHidden) {
        toplevel.classList.remove('toc-on');
    } else {
        updateToc();
    }
}

function toggleReadMode(button) {
    var out = document.getElementById('out');
    var input = document.getElementById('in');
    var enabled = !(out.classList.contains('focused') && input.classList.contains('hidden'));
    setReadMode(enabled);
    updateToc();
}

function setReadMode(enabled) {
    var out = document.getElementById('out');
    var input = document.getElementById('in');
    var button = document.getElementById('readbutton');
    if (!out || !input) return;
    out.classList.toggle('focused', Boolean(enabled));
    input.classList.toggle('hidden', Boolean(enabled));
    if (button) button.classList.toggle('selected', Boolean(enabled));
    storageSet(STORAGE_KEYS.prefRead, enabled ? '1' : '0');
}

function toggleSpellCheck(button) {
    button.classList.toggle('selected');
    document.body.classList.toggle('no-spellcheck');
}

function toggleFullscreen(button) {
    var icon = button.querySelector('i');
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        var elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        }
        icon.textContent = 'fullscreen_exit';
        button.classList.add('selected');
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
        icon.textContent = 'fullscreen';
        button.classList.remove('selected');
    }
}

document.addEventListener('fullscreenchange', function() {
    var button = document.getElementById('fullscreenbutton');
    var icon = button.querySelector('i');
    if (!document.fullscreenElement) {
        icon.textContent = 'fullscreen';
        button.classList.remove('selected');
    }
});

document.addEventListener('webkitfullscreenchange', function() {
    var button = document.getElementById('fullscreenbutton');
    var icon = button.querySelector('i');
    if (!document.webkitFullscreenElement) {
        icon.textContent = 'fullscreen';
        button.classList.remove('selected');
    }
});

function updateHash() {
    window.location.hash = btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                editor.getValue()
            ))
        )
    );
}

function buildShareHash(mode, content) {
    var payload = btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                String(content || '')
            ))
        )
    );
    if (mode === 'view') return 'view:' + payload;
    return payload;
}

function generateShareUrl(mode) {
    var hash = buildShareHash(mode, editor.getValue());
    try {
        var url = new URL(window.location.href);
        url.hash = '#' + hash;
        return url.toString();
    } catch (e) {
        return window.location.origin + window.location.pathname + window.location.search + '#' + hash;
    }
}

function copyText(text, onSuccess, onFailure) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            if (onSuccess) onSuccess();
        }).catch(function() {
            fallbackCopyText(text, onSuccess, onFailure);
        });
        return;
    }
    fallbackCopyText(text, onSuccess, onFailure);
}

function fallbackCopyText(text, onSuccess, onFailure) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        var ok = document.execCommand('copy');
        if (ok) {
            if (onSuccess) onSuccess();
        } else {
            if (onFailure) onFailure();
        }
    } catch (e) {
        if (onFailure) onFailure();
    }
    document.body.removeChild(textarea);
}

function shareLink(button) {
    var url = generateShareUrl('view');
    try {
        history.replaceState(null, '', new URL(url).hash);
    } catch (e) {
        // ignore
    }
    copyText(url, function() {
        showToast('分享链接已复制');
        if (button) flashButtonSuccess(button);
    }, function() {
        swal("复制失败", "浏览器不允许复制链接，请手动从地址栏复制。", "error");
    });
}

function flashButtonSuccess(button) {
    if (!button) return;
    var icon = button.querySelector && button.querySelector('i');
    var originalText = icon ? icon.textContent : null;
    if (icon) icon.textContent = 'check';
    button.classList.add('success');
    window.setTimeout(function() {
        if (icon && originalText) icon.textContent = originalText;
        button.classList.remove('success');
    }, 1200);
}

function parseQueryParams() {
    var out = Object.create(null);
    var query = window.location.search || '';
    if (!query || query.length < 2) return out;
    query.slice(1).split('&').forEach(function(pair) {
        if (!pair) return;
        var idx = pair.indexOf('=');
        var k = idx >= 0 ? pair.slice(0, idx) : pair;
        var v = idx >= 0 ? pair.slice(idx + 1) : '';
        try {
            k = decodeURIComponent(k);
            v = decodeURIComponent(v);
        } catch (e) {
            // ignore
        }
        out[k] = v;
    });
    return out;
}

function parseBoolean(value) {
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
    return null;
}

function start() {
    initPreviewNavigation();
    var query = parseQueryParams();

    // 目录默认隐藏（可被偏好覆盖）
    var storedTocHidden = storageGet(STORAGE_KEYS.prefTocHidden);
    setTocHidden(storedTocHidden === null ? true : storedTocHidden === '1');

    // 夜间模式（参数优先，其次偏好）
    var queryDark = parseBoolean(query.dark);
    var storedDark = storageGet(STORAGE_KEYS.prefNight);
    var shouldDark = queryDark !== null ? queryDark : (storedDark === '1');
    setNightMode(shouldDark);

    // 阅读模式（参数优先，其次偏好；默认开启）
    var queryRead = parseBoolean(query.reading);
    var storedRead = storageGet(STORAGE_KEYS.prefRead);
    var shouldRead = queryRead !== null ? queryRead : (storedRead === null ? true : storedRead === '1');
    setReadMode(shouldRead);

    // 宽度偏好
    var storedWidth = parseInt(storageGet(STORAGE_KEYS.prefWidth), 10);
    if (!isNaN(storedWidth)) {
        currentWidth = Math.max(minWidth, Math.min(maxWidth, storedWidth));
    } else {
        currentWidth = Math.min(window.innerWidth * 0.65, maxWidth);
    }

    if (window.location.hash) {
        var h = window.location.hash.replace(/^#/, '');
        if (h.slice(0, 5) == 'view:') {
            setOutput(decodeURIComponent(escape(RawDeflate.inflate(atob(h.slice(5))))));
            document.body.className = 'view';
        } else {
            editor.setValue(
                decodeURIComponent(escape(
                    RawDeflate.inflate(
                        atob(
                            h
                        )
                    )
                ))
            );
        }
    } else if (storageGet(STORAGE_KEYS.content)) {
        editor.setValue(storageGet(STORAGE_KEYS.content));
    }
    update(editor);

    // 初始化宽度控制
    applyWidth();

    document.getElementById('fileInput').addEventListener('change', openFile, false);

    // 监听窗口大小变化，更新宽度百分比显示
    window.addEventListener('resize', function() {
        var valueDisplay = document.getElementById('width-value');
        if (valueDisplay && currentWidth) {
            currentWidth = Math.max(minWidth, Math.min(maxWidth, currentWidth));
            var percent = Math.round((currentWidth / window.innerWidth) * 100);
            valueDisplay.textContent = percent + '%';
        }
    });
}

window.addEventListener("beforeunload", function (e) {
    if (!editor.getValue() || editor.getValue() == storageGet(STORAGE_KEYS.content)) {
        return;
    }
    var confirmationMessage = '你有未保存的更改。离开页面后，这些更改将丢失。';
    (e || window.event).returnValue = confirmationMessage; //Gecko + IE
    return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

start();

function loadFileIntoEditor(file) {
    if (!file) return;
    var name = file.name || '';
    var isSupported = /\.(md|mdown|markdown|txt)$/i.test(name);
    if (!isSupported) {
        swal("不支持的文件类型", "仅支持 .md / .markdown / .mdown / .txt 文件。", "error");
        return;
    }
    if (file.size && file.size > 10 * 1024 * 1024) {
        swal("文件过大", "文件超过 10MB，可能会影响浏览器性能。", "warning");
        return;
    }

    var hasUnsaved = Boolean(editor.getValue()) && editor.getValue() !== storageGet(STORAGE_KEYS.content);
    var readFile = function() {
        var reader = new FileReader();
        reader.onload = function(e) {
            editor.setValue((e && e.target && e.target.result) ? e.target.result : '');
        };
        reader.readAsText(file);
    };

    if (!hasUnsaved) {
        readFile();
        return;
    }

    swal({
        title: "有未保存的更改",
        text: "继续打开文件将覆盖当前内容，是否继续？",
        type: "warning",
        showCancelButton: true,
        confirmButtonColor: "#FF9500",
        confirmButtonText: "继续打开",
        cancelButtonText: "取消",
        closeOnConfirm: true
    }, function() {
        readFile();
    });
}
