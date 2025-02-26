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
        tokens: {},

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

            socket.on('template_list_changed', async () => {
                console.log('Template file added or deleted, refreshing file list');
                await this.loadTemplateFiles();

                // If we're in the file list view, no further action needed
                // If current file was deleted, go back to file list
                if (this.navigation.currentView === 'template' &&
                    !this.fileList.includes(this.navigation.currentFile)) {
                    console.log('Current file no longer exists, returning to file list');
                    this.navigateToFileList();
                }
            });

            socket.on('ui_changed', () => {
                console.log('UI changed');
                window.location.reload();
            });

            socket.on('test_data_changed', async () => {
                console.log('Test data changed');
                await this.loadTokens();
                await this.loadTestCases()
                if (this.navigation.currentView === 'template') {
                    await this.renderTemplate();
                }
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

                // Token markers from test_data.toml
                if (this.tokens &&
                    (match = remaining.match(new RegExp(`^(${Object.values(this.tokens).map(t => this.escapeRegExp(t)).join('|')})`)))) {
                    result += `<span class="token-marker">${escapeHtml(match[0])}</span>`;
                }
                // Angle brackets and their contents
                else if (match = remaining.match(/^(?:<[^>]*>)/)) {
                    result += `<span class="markers">${escapeHtml(match[0])}</span>`;
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
                this.loadTemplateFiles(),
                this.loadTokens(),
                this.checkActiveTemplate()
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

        async loadTokens() {
            const response = await fetch('/api/tokens');
            this.tokens = await response.json();
        },

        async checkActiveTemplate() {
            try {
                const response = await fetch('/api/active-template');
                const data = await response.json();

                // If there's an active template and no file is selected yet, use it
                if (data.active_template) {
                    console.log('Using extracted template as default:', data.active_template);
                    this.navigation.currentFile = data.active_template;
                    this.navigation.currentView = 'template';
                    localStorage.setItem('currentFile', data.active_template);
                }
            } catch (error) {
                console.error('Error checking active template:', error);
            }
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
        },

        /**
         * Escapes special characters in a string for use in RegExp
         * @param {string} string
         * @returns {string}
         */
        escapeRegExp(string) {
            return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
    }));
});
