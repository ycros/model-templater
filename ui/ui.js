const socket = io();
let currentFile = localStorage.getItem('currentFile') || null;

socket.on('render_update', function (data) {
    if (data.error) {
        output.textContent = data.error;
        return;
    }

    const processed = data.content
        .replace(/ /g, '<span class="space"> </span>')
        .replace(/\t/g, '<span class="tab">\t</span>')
        .replace(/\n/g, '<span class="newline">\n</span>');

    output.innerHTML = processed;
});

socket.on('template_changed', (data) => {
    console.log('Template changed:', data.path);
    if (currentFile === data.path) {
        fetchTemplate(currentFile);
    }
});

async function loadFileTree() {
    const response = await fetch('/api/files');
    const files = await response.json();
    const tree = document.getElementById('file-tree');

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        if (file === currentFile) {
            div.classList.add('selected');
        }
        div.textContent = file;
        div.onclick = () => {
            document.querySelectorAll('.file-item').forEach(item => item.classList.remove('selected'));
            div.classList.add('selected');
            fetchTemplate(file);
        };
        tree.appendChild(div);
    });
}

async function createTestCaseTabs() {
    const tabs = document.getElementById('test-case-tabs');
    const response = await fetch('/api/test-cases');
    const testCases = await response.json();

    tabs.innerHTML = '';
    testCases.forEach(testCase => {
        const btn = document.createElement('button');
        btn.textContent = testCase;
        btn.onclick = () => {
            document.querySelectorAll('#test-case-tabs button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            localStorage.setItem('currentTestCase', testCase);
            if (currentFile) fetchTemplate(currentFile);
        };
        if (localStorage.getItem('currentTestCase') === testCase) {
            btn.classList.add('active');
        }
        tabs.appendChild(btn);
    });

    // Restore previously selected test case or default to first one
    const savedTestCase = localStorage.getItem('currentTestCase');
    const tabToActivate = savedTestCase && testCases.includes(savedTestCase)
        ? tabs.querySelector(`button[textContent="${savedTestCase}"]`)
        : tabs.firstChild;

    if (tabToActivate) {
        tabToActivate.classList.add('active');
    }
}

async function fetchTemplate(filepath) {
    currentFile = filepath;
    localStorage.setItem('currentFile', filepath);
    const activeTestCase = document.querySelector('#test-case-tabs button.active')?.textContent || 'basic';
    socket.emit('request_render', {
        filepath: filepath,
        test_case: activeTestCase
    });
}

window.onload = async () => {
    await createTestCaseTabs();
    await loadFileTree();

    // Restore previous file selection if it exists
    if (currentFile) {
        fetchTemplate(currentFile);
    }
};
