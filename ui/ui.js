const socket = io();
let currentFile = localStorage.getItem('currentFile') || null;

// Helper function to escape HTML special characters
function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Add functions to switch between views
function showFileListView() {
    document.getElementById('file-list-view').classList.remove('hidden');
    document.getElementById('content-view').classList.add('hidden');
}

function showContentView() {
    document.getElementById('file-list-view').classList.add('hidden');
    document.getElementById('content-view').classList.remove('hidden');
}

socket.on('render_update', function (data) {
    if (data.error) {
        output.textContent = data.error;
        return;
    }

    const content = data.content;
    let result = '';
    let remaining = content;

    while (remaining.length > 0) {
        // Try to match patterns in priority order
        let match;

        // Angle brackets and their contents
        if (match = remaining.match(/^(?:<[^>]*>)/)) {
            result += `<span class="markers">${escapeHtml(match[0])}</span>`;
        }
        // Token markers (BOS_ or _EOS)
        else if (match = remaining.match(/^(?:BOS_|_EOS)/)) {
            result += `<span class="token-marker">${escapeHtml(match[0])}</span>`;
        }
        // Square brackets and their contents
        else if (match = remaining.match(/^\[[^\]]*\]/)) {
            result += `<span class="markers">${escapeHtml(match[0])}</span>`;
        }
        // Markdown headers at start of line
        else if (match = remaining.match(/^(#+)/)) {
            result += `<span class="markers">${escapeHtml(match[0])}</span>`;
        }
        // Special characters
        else if (match = remaining.match(/^[ \t\n]/)) {
            switch (match[0]) {
                case ' ':
                    result += '<span class="space"> </span>';
                    break;
                case '\t':
                    result += '<span class="tab">\t</span>';
                    break;
                case '\n':
                    result += '<span class="newline">\n</span>';
                    break;
            }
        }
        // Any other single character
        else {
            result += escapeHtml(remaining[0]);
            remaining = remaining.slice(1);
            continue;
        }

        // Remove the matched portion from remaining
        remaining = remaining.slice(match[0].length);
    }

    output.innerHTML = result;
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
    tree.innerHTML = ''; // Clear existing items

    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.textContent = file;
        div.onclick = () => {
            fetchTemplate(file);
            showContentView();
            document.getElementById('current-file-name').textContent = file;
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
    const addGenerationPrompt = document.getElementById('add-generation-prompt').checked;
    const addSystemPrompt = document.getElementById('add-system-prompt').checked;

    // Save the preferences
    localStorage.setItem('addGenerationPrompt', addGenerationPrompt);
    localStorage.setItem('addSystemPrompt', addSystemPrompt);

    socket.emit('request_render', {
        filepath: filepath,
        test_case: activeTestCase,
        add_generation_prompt: addGenerationPrompt,
        add_system_prompt: addSystemPrompt
    });
}

window.onload = async () => {
    // Initialize views based on whether we have a current file
    if (currentFile) {
        document.getElementById('current-file-name').textContent = currentFile;
        showContentView();
    } else {
        showFileListView();
    }

    // Set up back button
    document.getElementById('back-button').addEventListener('click', () => {
        showFileListView();
    });

    await createTestCaseTabs();
    await loadFileTree();

    // Restore preferences
    const savedAddGenerationPrompt = localStorage.getItem('addGenerationPrompt');
    if (savedAddGenerationPrompt !== null) {
        document.getElementById('add-generation-prompt').checked = savedAddGenerationPrompt === 'true';
    }

    const savedAddSystemPrompt = localStorage.getItem('addSystemPrompt');
    if (savedAddSystemPrompt !== null) {
        document.getElementById('add-system-prompt').checked = savedAddSystemPrompt === 'true';
    }

    // Add event listeners for the checkboxes
    document.getElementById('add-generation-prompt').addEventListener('change', () => {
        if (currentFile) fetchTemplate(currentFile);
    });

    document.getElementById('add-system-prompt').addEventListener('change', () => {
        if (currentFile) fetchTemplate(currentFile);
    });

    // Render the template if we have a current file
    if (currentFile) {
        fetchTemplate(currentFile);
    }
};
