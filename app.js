const ShadowApp = {
    config: {
        version: '2.0.0',
        apiVersion: 'v9',
        baseURL: 'https://discord.com/api',
        cdnURL: 'https://cdn.discordapp.com',
        wsURL: 'wss://gateway.discord.gg',
        defaultDelay: 1000,
        maxRetries: 3
    },
    state: {
        tokens: [],
        logs: [],
        isRunning: false,
        shouldStop: false,
        stats: {
            requests: 0,
            success: 0,
            failed: 0,
            rateLimited: 0
        },
        startTime: Date.now(),
        settings: {}
    },
    utils: {
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
        randomDelay: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        generateRandomString: (length) => {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        },
        parseToken: (tokenStr) => {
            const parts = tokenStr.split(':');
            if (parts.length >= 3) {
                return {
                    token: parts[parts.length - 1],
                    email: parts[0],
                    password: parts[1]
                };
            }
            return { token: tokenStr, email: null, password: null };
        },
        formatTime: (seconds) => {
            const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
            const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            return `${hrs}:${mins}:${secs}`;
        },
        debounce: (func, wait) => {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
    },
    logger: {
        log: (message, type = 'info') => {
            const timestamp = new Date().toLocaleTimeString();
            const entry = { time: timestamp, message, type };
            ShadowApp.state.logs.push(entry);
            const systemLog = document.getElementById('systemLog');
            if (systemLog) {
                const div = document.createElement('div');
                div.className = `log-entry log-${type}`;
                div.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
                systemLog.appendChild(div);
                systemLog.scrollTop = systemLog.scrollHeight;
            }
            console.log(`[${type.toUpperCase()}] ${message}`);
        },
        success: (message) => ShadowApp.logger.log(message, 'success'),
        error: (message) => ShadowApp.logger.log(message, 'error'),
        warning: (message) => ShadowApp.logger.log(message, 'warning'),
        info: (message) => ShadowApp.logger.log(message, 'info')
    },
    tokens: {
        load: () => {
            const textarea = document.getElementById('globalTokens');
            if (!textarea) return;
            const content = textarea.value.trim();
            const lines = content.split('\n').filter(line => line.trim());
            ShadowApp.state.tokens = lines.map(line => ShadowApp.utils.parseToken(line));
            ShadowApp.tokens.updateCount();
            localStorage.setItem('shadowtools_tokens', content);
            ShadowApp.logger.success(`${ShadowApp.state.tokens.length}個のトークンを読み込みました`);
        },
        updateCount: () => {
            const countEl = document.getElementById('tokenCount');
            if (countEl) {
                countEl.textContent = `${ShadowApp.state.tokens.length} tokens`;
            }
            const activeTokensEl = document.getElementById('activeTokens');
            if (activeTokensEl) {
                activeTokensEl.textContent = ShadowApp.state.tokens.length;
            }
        },
        validate: async () => {
            if (!ShadowApp.state.tokens.length) {
                ShadowApp.logger.error('トークンを入力してください');
                return;
            }
            ShadowApp.logger.info('トークン検証を開始...');
            let valid = 0, invalid = 0;
            for (const tokenData of ShadowApp.state.tokens) {
                try {
                    const response = await fetch(`${ShadowApp.config.baseURL}/${ShadowApp.config.apiVersion}/users/@me`, {
                        headers: { 'Authorization': tokenData.token }
                    });
                    if (response.ok) {
                        const user = await response.json();
                        ShadowApp.logger.success(`有効: ${user.username}#${user.discriminator || '0000'}`);
                        valid++;
                    } else {
                        ShadowApp.logger.error(`無効: ${tokenData.token.slice(0, 20)}... (${response.status})`);
                        invalid++;
                    }
                } catch (e) {
                    ShadowApp.logger.error(`エラー: ${e.message}`);
                    invalid++;
                }
                await ShadowApp.utils.sleep(500);
            }
            ShadowApp.logger.info(`検証完了: 有効=${valid}, 無効=${invalid}`);
        },
        import: () => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.txt';
            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                    const content = event.target.result;
                    const textarea = document.getElementById('globalTokens');
                    if (textarea) {
                        textarea.value = content;
                        ShadowApp.tokens.load();
                        ShadowApp.logger.success('トークンをインポートしました');
                    }
                };
                reader.readAsText(file);
            };
            input.click();
        },
        export: () => {
            const textarea = document.getElementById('globalTokens');
            if (!textarea || !textarea.value.trim()) {
                ShadowApp.logger.error('エクスポートするトークンがありません');
                return;
            }
            const blob = new Blob([textarea.value], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tokens_${new Date().toISOString().slice(0, 10)}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            ShadowApp.logger.success('トークンをエクスポートしました');
        },
        clear: () => {
            const textarea = document.getElementById('globalTokens');
            if (textarea) {
                textarea.value = '';
                ShadowApp.state.tokens = [];
                ShadowApp.tokens.updateCount();
                localStorage.removeItem('shadowtools_tokens');
                ShadowApp.logger.info('トークンをクリアしました');
            }
        }
    },
    // 欠落していたオブジェクトを追加
    stats: {
        update: () => {
            const elapsed = Math.floor((Date.now() - ShadowApp.state.startTime) / 1000);
            const uptimeEl = document.getElementById('uptime');
            if (uptimeEl) {
                uptimeEl.textContent = ShadowApp.utils.formatTime(elapsed);
            }
        }
    },
    navigation: {
        init: () => {
            const navLinks = document.querySelectorAll('.nav-link');
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const target = link.getAttribute('href').substring(1);
                    ShadowApp.navigation.showSection(target);
                    navLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                });
            });
        },
        showSection: (sectionId) => {
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });
            const target = document.getElementById(sectionId);
            if (target) {
                target.classList.add('active');
            }
        }
    },
    settings: {
        load: () => {
            const saved = localStorage.getItem('shadowtools_settings');
            if (saved) {
                ShadowApp.state.settings = JSON.parse(saved);
                const apiVersion = document.getElementById('apiVersion');
                if (apiVersion && ShadowApp.state.settings.apiVersion) {
                    apiVersion.value = ShadowApp.state.settings.apiVersion;
                }
            }
        },
        save: () => {
            const apiVersion = document.getElementById('apiVersion');
            const proxyList = document.getElementById('proxyList');
            ShadowApp.state.settings = {
                apiVersion: apiVersion ? apiVersion.value : '9',
                proxies: proxyList ? proxyList.value : ''
            };
            localStorage.setItem('shadowtools_settings', JSON.stringify(ShadowApp.state.settings));
            ShadowApp.config.apiVersion = ShadowApp.state.settings.apiVersion;
            ShadowApp.logger.success('設定を保存しました');
        },
        reset: () => {
            const apiVersion = document.getElementById('apiVersion');
            const proxyList = document.getElementById('proxyList');
            if (apiVersion) apiVersion.value = '9';
            if (proxyList) proxyList.value = '';
            ShadowApp.state.settings = {};
            localStorage.removeItem('shadowtools_settings');
            ShadowApp.logger.info('設定をリセットしました');
        },
        export: () => {
            if (!Object.keys(ShadowApp.state.settings).length) {
                ShadowApp.logger.error('エクスポートする設定がありません');
                return;
            }
            const blob = new Blob([JSON.stringify(ShadowApp.state.settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `settings_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            ShadowApp.logger.success('設定をエクスポートしました');
        }
    },
    init: () => {
        ShadowApp.logger.info('ShadowTools v2.0 initialized');
        const savedTokens = localStorage.getItem('shadowtools_tokens');
        if (savedTokens) {
            const textarea = document.getElementById('globalTokens');
            if (textarea) {
                textarea.value = savedTokens;
                ShadowApp.tokens.load();
            }
        }
        ShadowApp.settings.load();
        ShadowApp.navigation.init();
        setInterval(ShadowApp.stats.update, 1000);
        
        const tokenInput = document.getElementById('globalTokens');
        if (tokenInput) {
            tokenInput.addEventListener('input', ShadowApp.utils.debounce(ShadowApp.tokens.load, 500));
        }
    }
};

// Global functions
function importTokens() { ShadowApp.tokens.import(); }
function exportTokens() { ShadowApp.tokens.export(); }
function clearTokens() { ShadowApp.tokens.clear(); }
function validateTokens() { ShadowApp.tokens.validate(); }
function checkAllTokens() { ShadowApp.tokens.validate(); }
function loadAllTokens() {
    ShadowApp.tokens.load();
    ShadowApp.logger.info('全トークンを読み込みました');
}
function exportLogs() {
    const content = ShadowApp.state.logs.map(l => `[${l.time}] ${l.message}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}
function checkProxies() {
    ShadowApp.logger.info('プロキシチェック機能は未実装です');
}
function emergencyStop() {
    ShadowApp.state.shouldStop = true;
    ShadowApp.logger.warning('緊急停止信号を送信しました');
}
function saveSettings() { ShadowApp.settings.save(); }
function resetSettings() { ShadowApp.settings.reset(); }
function exportSettings() { ShadowApp.settings.export(); }
function clearLogs() {
    const systemLog = document.getElementById('systemLog');
    if (systemLog) {
        systemLog.innerHTML = '<div class="log-entry log-info"><span class="log-time">[--:--:--]</span> ログをクリアしました</div>';
    }
    ShadowApp.state.logs = [];
}
function showHelp() {
    alert('ShadowTools v2.0 Help:\n\n1. Enter your tokens in the Global Token Manager\n2. Select a tool from the sidebar\n3. Configure settings and run\n\nFor support, visit GitHub.');
}
function showAbout() {
    alert(`ShadowTools v2.0\n\nA powerful Discord automation toolkit\nVersion: ${ShadowApp.config.version}\nAPI: ${ShadowApp.config.apiVersion}\n\nMade with 💀 by Shadow Team`);
}

// Initialize
document.addEventListener('DOMContentLoaded', ShadowApp.init);
window.ShadowApp = ShadowApp;
