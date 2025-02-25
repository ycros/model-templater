const socket = io();

/**
 * @param {string} text
 * @returns {string}
 */
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
        navigation: {
            currentView: localStorage.getItem('currentFile') ? 'template' : 'fileList',
            currentFile: localStorage.getItem('currentFile') || null,
        },
        renderOptions: {
            addGenerationPrompt: localStorage.getItem('addGenerationPrompt') !== 'false',
            addSystemPrompt: localStorage.getItem('addSystemPrompt') === 'true',
        },
        testCases: {
            available: [],
            active: localStorage.getItem('currentTestCase') || 'basic',
        },
        fileList: [],
        output: '',

        init() {
            this.loadInitialData();
            this.setupSocketListeners();
        },

        setupSocketListeners() {
            socket.on('render_update', (data) => {
                if (data.error) {
                    this.output = data.error;
                    return;
                }

                this.output = this.formatOutput(data.content);
            });

            socket.on('template_changed', (data) => {
                console.log('Template changed:', data.path);
                if (this.navigation.currentFile === data.path) {
                    this.renderTemplate();
                }
            });

            socket.on('ui_changed', () => {
                console.log('UI changed');
                window.location.reload();
            });
        },

        /**
         * @param {string} content
         * @returns {string}
         */
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

        async loadInitialData() {
            await Promise.all([
                this.loadTestCases(),
                this.loadTemplateFiles()
            ]);

            if (this.navigation.currentFile) {
                this.renderTemplate();
            }
        },

        async loadTestCases() {
            const response = await fetch('/api/test-cases');
            this.testCases.available = await response.json();

            // Ensure we have a valid active case
            if (!this.testCases.available.includes(this.testCases.active)) {
                this.testCases.active = this.testCases.available[0] || 'basic';
            }
        },

        async loadTemplateFiles() {
            const response = await fetch('/api/files');
            this.fileList = await response.json();
        },

        /**
         * @param {string} testCase
         */
        selectTestCase(testCase) {
            this.testCases.active = testCase;
            localStorage.setItem('currentTestCase', testCase);
            this.renderTemplate();
        },

        navigateToFileList() {
            this.navigation.currentView = 'fileList';
        },

        /**
         * @param {string} file
         */
        openTemplateFile(file) {
            this.navigation.currentFile = file;
            localStorage.setItem('currentFile', file);
            this.navigation.currentView = 'template';
            this.renderTemplate();
        },

        updateRenderOptions() {
            localStorage.setItem('addGenerationPrompt', this.renderOptions.addGenerationPrompt);
            localStorage.setItem('addSystemPrompt', this.renderOptions.addSystemPrompt);
            this.renderTemplate();
        },

        renderTemplate() {
            if (!this.navigation.currentFile) return;

            socket.emit('request_render', {
                filepath: this.navigation.currentFile,
                test_case: this.testCases.active,
                add_generation_prompt: this.renderOptions.addGenerationPrompt,
                add_system_prompt: this.renderOptions.addSystemPrompt
            });
        }
    }));
});
