const socket = io();

function escapeHtml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Alpine.js component for template debugger
document.addEventListener('alpine:init', () => {
    Alpine.data('templateDebugger', () => ({
        showContentView: !!localStorage.getItem('currentFile'),
        currentFile: localStorage.getItem('currentFile') || null,
        addGenerationPrompt: localStorage.getItem('addGenerationPrompt') === 'true' || true,
        addSystemPrompt: localStorage.getItem('addSystemPrompt') === 'true' || false,
        testCases: [],
        activeTestCase: localStorage.getItem('currentTestCase') || 'basic',
        files: [],
        outputHtml: '',

        init() {
            this.initializeApp();
            this.setupSocketListeners();
        },

        setupSocketListeners() {
            socket.on('render_update', (data) => {
                if (data.error) {
                    this.outputHtml = data.error;
                    return;
                }

                this.outputHtml = this.formatOutput(data.content);
            });

            socket.on('template_changed', (data) => {
                console.log('Template changed:', data.path);
                if (this.currentFile === data.path) {
                    this.fetchTemplate();
                }
            });

            socket.on('ui_changed', () => {
                console.log('UI changed');
                window.location.reload();
            });
        },

        formatOutput(content) {
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

            return result;
        },

        async initializeApp() {
            await this.loadTestCases();
            await this.loadFiles();

            if (this.currentFile) {
                this.fetchTemplate();
            }
        },

        async loadTestCases() {
            const response = await fetch('/api/test-cases');
            this.testCases = await response.json();

            // Ensure we have a valid active case
            if (!this.testCases.includes(this.activeTestCase)) {
                this.activeTestCase = this.testCases[0] || 'basic';
            }
        },

        async loadFiles() {
            const response = await fetch('/api/files');
            this.files = await response.json();
        },

        setActiveTestCase(testCase) {
            this.activeTestCase = testCase;
            localStorage.setItem('currentTestCase', testCase);
            if (this.currentFile) {
                this.fetchTemplate();
            }
        },

        goBackToFiles() {
            this.showContentView = false;
        },

        openFile(file) {
            this.currentFile = file;
            localStorage.setItem('currentFile', file);
            this.showContentView = true;
            this.fetchTemplate();
        },

        updateTemplate() {
            localStorage.setItem('addGenerationPrompt', this.addGenerationPrompt);
            localStorage.setItem('addSystemPrompt', this.addSystemPrompt);
            if (this.currentFile) {
                this.fetchTemplate();
            }
        },

        fetchTemplate() {
            socket.emit('request_render', {
                filepath: this.currentFile,
                test_case: this.activeTestCase,
                add_generation_prompt: this.addGenerationPrompt,
                add_system_prompt: this.addSystemPrompt
            });
        }
    }));
});

