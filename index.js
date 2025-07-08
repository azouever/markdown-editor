var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

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
    .use(markdownitFootnote);

var hashto;

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

function setOutput(val) {
    val = val.replace(/<equation>((.*?\n)*?.*?)<\/equation>/ig, function(a, b) {
        return '<img src="http://latex.codecogs.com/png.latex?' + encodeURIComponent(b) + '" />';
    });

    var out = document.getElementById('out');
    var old = out.cloneNode(true);
    out.innerHTML = md.render(val);
    emojify.run(out);
    console.log(out.innerHTML);
    // Checks if there are any task-list present in out.innerHTML
    out.innerHTML = render_tasklist(out.innerHTML);

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
    e.preventDefault();
    e.stopPropagation();

    var reader = new FileReader();
    reader.onload = function(e) {
        editor.setValue(e.target.result);
    };

    reader.readAsText(e.dataTransfer.files[0]);
}, false);

//Print the document named as the document title encoded to avoid strange chars and spaces
async function saveAsMarkdown() {
    if (currentFileHandle && window.showSaveFilePicker) {
        try {
            const writable = await currentFileHandle.createWritable();
            await writable.write(editor.getValue());
            await writable.close();
            alert('File saved successfully!');
            return;
        } catch (err) {
            alert('Failed to save file: ' + err.message);
        }
    }
    // fallback: download
    save(editor.getValue(), document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'\",.<>\{\}\[\]\\\/\s]/gi, '') + ".md");
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

window.saveToSystem = async function() {
    if (!window.showSaveFilePicker && !currentFileHandle) {
        alert('Your browser does not support the File System Access API.');
        return;
    }
    if (currentFileHandle) {
        try {
            const writable = await currentFileHandle.createWritable();
            await writable.write(editor.getValue());
            await writable.close();
            alert('File saved to system successfully!');
        } catch (err) {
            alert('Failed to save file: ' + err.message);
        }
    } else {
        alert('请先用“打开”按钮打开一个本地文件，才能直接保存到系统目录。');
    }
}

var menuVisible = false;
var menu = document.getElementById('menu');

function showMenu() {
    menuVisible = true;
    menu.style.display = 'block';
}

function hideMenu() {
    menuVisible = false;
    menu.style.display = 'none';
}

function openFile(evt) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        var files = evt.target.files;
        console.log(files);
        var reader = new FileReader();
        reader.onload = function(file) {
            console.log(file.target.result);
            editor.setValue(file.target.result);
            return true;
        };
        reader.readAsText(files[0]);

    } else {
        alert('The File APIs are not fully supported in this browser.');
    }
}

document.getElementById('close-menu').addEventListener('click', function() {
    hideMenu();
});

document.addEventListener('keydown', function(e) {
    if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
        if ( localStorage.getItem('content') == editor.getValue() ) {
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
    editor.setValue("");
}

function saveInBrowser() {
    var text = editor.getValue();
    if (localStorage.getItem('content')) {
        swal({
                title: "Existing Data Detected",
                text: "You will overwrite the data previously saved!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Yes, overwrite!",
                closeOnConfirm: false
            },
            function() {
                localStorage.setItem('content', text);
                swal("Saved", "Your Document has been saved.", "success");
            });
    } else {
        localStorage.setItem('content', text);
        swal("Saved", "Your Document has been saved.", "success");
    }
    console.log("Saved");
}

function toggleNightMode(button) {
    button.classList.toggle('selected');
    document.getElementById('toplevel').classList.toggle('nightmode');
}

function toggleReadMode(button) {
    button.classList.toggle('selected');
    document.getElementById('out').classList.toggle('focused');
    document.getElementById('in').classList.toggle('hidden');
}

function toggleSpellCheck(button) {
    button.classList.toggle('selected');
    document.body.classList.toggle('no-spellcheck');
}

function updateHash() {
    window.location.hash = btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                editor.getValue()
            ))
        )
    );
}

function processQueryParams() {
    var params = window.location.search.split('?')[1];
    if (window.location.hash) {
        document.getElementById('readbutton').click(); // Show reading view
    }
    if (params) {
        var obj = {};
        params.split('&').forEach(function(elem) {
            obj[elem.split('=')[0]] = elem.split('=')[1];
        });
        if (obj.reading === 'false') {
            document.getElementById('readbutton').click(); // Hide reading view
        }
        if (obj.dark === 'true') {
            document.getElementById('nightbutton').click(); // Show night view
        }
    }
}

function start() {
    adjustMainLayout(); // 初始加载时调整��局
    processQueryParams();
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
    } else if (localStorage.getItem('content')) {
        editor.setValue(localStorage.getItem('content'));
    }
    update(editor);
    editor.focus();
    document.getElementById('fileInput').addEventListener('change', openFile, false);
}

// 文件夹选择与侧边栏渲染（支持折叠/展开）
function renderTree(node, parent, path = "") {
    for (const key in node) {
        if (node[key] instanceof File) {
            const fileDiv = document.createElement('div');
            fileDiv.textContent = key;
            fileDiv.className = 'sidebar-file';
            fileDiv.onclick = async function(e) {
                e.stopPropagation();
                // 尝试通过 showDirectoryPicker 获取 FileSystemFileHandle
                if (window.showDirectoryPicker) {
                    // 这里假设你已经用 showDirectoryPicker 选过目录，并且 node[key] 有 webkitRelativePath
                    // 但 input type="file"/webkitdirectory 方式拿到的 node[key] 只是 File，不能直接写回
                    // 只能读取内容，不能赋值 currentFileHandle
                    // 你可以在这里提示用户用“打开”按钮或 showDirectoryPicker 方式打开文件夹
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        editor.setValue(e.target.result);
                    };
                    reader.readAsText(node[key]);
                    currentFileHandle = null; // 明确不能写回
                } else {
                    // 兼容老浏览器
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        editor.setValue(e.target.result);
                    };
                    reader.readAsText(node[key]);
                    currentFileHandle = null;
                }
            };
            parent.appendChild(fileDiv);
        } else {
            const folderDiv = document.createElement('div');
            folderDiv.textContent = key;
            folderDiv.className = 'sidebar-folder collapsed';
            folderDiv.tabIndex = 0;
            folderDiv.style.outline = 'none';
            parent.appendChild(folderDiv);
            const sub = document.createElement('div');
            sub.style.marginLeft = '16px';
            folderDiv.appendChild(sub);
            // 只在第一次展开时渲染子树
            let rendered = false;
            folderDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                const expanded = folderDiv.classList.toggle('expanded');
                folderDiv.classList.toggle('collapsed', !expanded);
                if (expanded && !rendered) {
                    renderTree(node[key], sub, path + key + '/');
                    rendered = true;
                } else if (!expanded) {
                    sub.innerHTML = '';
                    rendered = false;
                }
            });
        }
    }
}

// 侧边栏拖���功能
(function() {
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    let dragging = false;
    resizer.addEventListener('mousedown', function(e) {
        dragging = true;
        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        let newWidth = e.clientX;
        newWidth = Math.max(120, Math.min(400, newWidth));
        sidebar.style.width = newWidth + 'px';
        document.getElementById('in').style.left = newWidth + 'px';
        document.getElementById('in').style.width = `calc(50% - ${newWidth/2}px)`;
        document.getElementById('out').style.left = `calc(50% + ${newWidth/2}px)`;
    });
    document.addEventListener('mouseup', function() {
        if (dragging) {
            dragging = false;
            document.body.style.cursor = '';
        }
    });
})();

document.getElementById('folderInput').addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    console.log('选择的文件:', files);
    const tree = buildFileTree(files);
    const sidebarTree = document.getElementById('sidebar-tree');
    sidebarTree.innerHTML = '';
    renderTree(tree, sidebarTree);
    console.log('渲染的文件树:', tree);
});

// 构建文件树结构
function buildFileTree(files) {
    const tree = {};
    for (const file of files) {
        const parts = file.webkitRelativePath.split('/');
        let current = tree;
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            if (i === parts.length - 1) {
                // 只处理md文件
                if (part.endsWith('.md')) {
                    current[part] = file;
                }
            } else {
                current[part] = current[part] || {};
                current = current[part];
            }
        }
    }
    return tree;
}

window.addEventListener("beforeunload", function (e) {
    if (!editor.getValue() || editor.getValue() == localStorage.getItem('content')) {
        return;
    }
    var confirmationMessage = 'It looks like you have been editing something. '
                            + 'If you leave before saving, your changes will be lost.';
    (e || window.event).returnValue = confirmationMessage; //Gecko + IE
    return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        // 可选：自动调整编辑区宽度
        if (sidebar.classList.contains('collapsed')) {
            document.getElementById('in').style.left = '0px';
            document.getElementById('in').style.width = '50%';
            document.getElementById('out').style.left = '50%';
        } else {
            document.getElementById('in').style.left = sidebar.offsetWidth + 'px';
            document.getElementById('in').style.width = `calc(50% - ${sidebar.offsetWidth/2}px)`;
            document.getElementById('out').style.left = `calc(50% + ${sidebar.offsetWidth/2}px)`;
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle-navbar');
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        setTimeout(adjustMainLayout, 210); // 动画后再调整，避免初始未移动
    });
    // 页面加载时自动调整一次
    setTimeout(adjustMainLayout, 0);
});

function adjustMainLayout() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('collapsed')) {
        document.getElementById('in').style.left = '0px';
        document.getElementById('in').style.width = '50%';
        document.getElementById('out').style.left = '50%';
    } else {
        // 取 sidebar 的宽度（未隐藏时）
        let width = sidebar.offsetWidth;
        if (width < 40) width = 220; // 默认宽度
        document.getElementById('in').style.left = width + 'px';
        document.getElementById('in').style.width = `calc(50% - ${width/2}px)`;
        document.getElementById('out').style.left = `calc(50% + ${width/2}px)`;
    }
}

let currentFileHandle = null;

window.openFileWithPicker = async function() {
    if (!window.showOpenFilePicker) {
        alert('Your browser不支持 File System Access API');
        return;
    }
    try {
        const [fileHandle] = await window.showOpenFilePicker({
            types: [
                {
                    description: 'Markdown Files',
                    accept: {'text/markdown': ['.md', '.markdown', '.txt']}
                }
            ]
        });
        currentFileHandle = fileHandle;
        const file = await fileHandle.getFile();
        const contents = await file.text();
        editor.setValue(contents);
        document.title = file.name;
    } catch (err) {
        if (err.name !== 'AbortError') {
            alert('Failed to open file: ' + err.message);
        }
    }
}

window.openFolderWithSystemPicker = async function() {
    if (!window.showDirectoryPicker) {
        alert('Your browser does not support the File System Access API.');
        return;
    }
    try {
        const dirHandle = await window.showDirectoryPicker();
        const tree = {};
        async function readDir(handle, treeNode) {
            for await (const entry of handle.values()) {
                if (entry.kind === 'file' && /\.(md|markdown|txt)$/i.test(entry.name)) {
                    treeNode[entry.name] = entry;
                } else if (entry.kind === 'directory') {
                    treeNode[entry.name] = {};
                    await readDir(entry, treeNode[entry.name]);
                }
            }
        }
        await readDir(dirHandle, tree);
        const sidebarTree = document.getElementById('sidebar-tree');
        sidebarTree.innerHTML = '';
        renderSystemTree(tree, sidebarTree);
    } catch (err) {
        if (err.name !== 'AbortError') {
            alert('Failed to open folder: ' + err.message);
        }
    }
}

function renderSystemTree(node, parent) {
    for (const key in node) {
        if (typeof node[key] === 'object' && node[key].kind === 'file') {
            const fileDiv = document.createElement('div');
            fileDiv.textContent = key;
            fileDiv.className = 'sidebar-file';
            fileDiv.onclick = async function(e) {
                e.stopPropagation();
                const fileHandle = node[key];
                const file = await fileHandle.getFile();
                const contents = await file.text();
                editor.setValue(contents);
                document.title = file.name;
                currentFileHandle = fileHandle;
            };
            parent.appendChild(fileDiv);
        } else if (typeof node[key] === 'object') {
            const folderDiv = document.createElement('div');
            folderDiv.textContent = key;
            folderDiv.className = 'sidebar-folder collapsed';
            folderDiv.tabIndex = 0;
            folderDiv.style.outline = 'none';
            parent.appendChild(folderDiv);
            const sub = document.createElement('div');
            sub.style.marginLeft = '16px';
            folderDiv.appendChild(sub);
            let rendered = false;
            folderDiv.addEventListener('click', function(e) {
                e.stopPropagation();
                const expanded = folderDiv.classList.toggle('expanded');
                folderDiv.classList.toggle('collapsed', !expanded);
                if (expanded && !rendered) {
                    renderSystemTree(node[key], sub);
                    rendered = true;
                } else if (!expanded) {
                    sub.innerHTML = '';
                    rendered = false;
                }
            });
        }
    }
}

start();
