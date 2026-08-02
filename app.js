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
      document.getElementById('activeTokens').textContent = ShadowApp.state.tokens.length;
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
            ShadowApp.logger.success(`有効: ${user.username}
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
      
      ShadowApp.logger.info(`検証完了: ${valid}有効, ${invalid}無効`);
    },

    clear: () => {
      document.getElementById('globalTokens').value = '';
      ShadowApp.state.tokens = [];
      ShadowApp.tokens.updateCount();
      localStorage.removeItem('shadowtools_tokens');
      ShadowApp.logger.info('トークンをクリアしました');
    },

    export: () => {
      if (!ShadowApp.state.tokens.length) {
        ShadowApp.logger.error('エクスポートするトークンがありません');
        return;
      }
      
      const content = ShadowApp.state.tokens.map(t => t.token).join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tokens_${new Date().toISOString().slice(0,10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      ShadowApp.logger.success('トークンをエクスポートしました');
    },

    import: () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.txt';
      input.onchange = async (e) => {
        const file = e.target.files[0];
        const text = await file.text();
        document.getElementById('globalTokens').value = text;
        ShadowApp.tokens.load();
      };
      input.click();
    }
  },

  settings: {
    load: () => {
      const saved = localStorage.getItem('shadowtools_settings');
      if (saved) {
        ShadowApp.state.settings = JSON.parse(saved);
        
        document.getElementById('defaultDelay').value = ShadowApp.state.settings.delay || 1000;
        document.getElementById('defaultThreads').value = ShadowApp.state.settings.threads || 5;
        document.getElementById('maskTokens').checked = ShadowApp.state.settings.maskTokens !== false;
      }
    },

    save: () => {
      ShadowApp.state.settings = {
        delay: parseInt(document.getElementById('defaultDelay').value) || 1000,
        threads: parseInt(document.getElementById('defaultThreads').value) || 5,
        maskTokens: document.getElementById('maskTokens').checked,
        logRetention: parseInt(document.getElementById('logRetention').value) || 7
      };
      
      localStorage.setItem('shadowtools_settings', JSON.stringify(ShadowApp.state.settings));
      ShadowApp.logger.success('設定を保存しました');
    },

    reset: () => {
      localStorage.removeItem('shadowtools_settings');
      ShadowApp.logger.info('設定をリセットしました');
      location.reload();
    },

    export: () => {
      const blob = new Blob([JSON.stringify(ShadowApp.state.settings, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shadowtools_settings.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  },

  navigation: {
    init: () => {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });

      document.querySelectorAll('.header-nav a').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const target = link.getAttribute('href').slice(1);
          ShadowApp.navigation.showSection(target);
          
          document.querySelectorAll('.header-nav a').forEach(l => l.classList.remove('active'));
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

  console: {
    toggle: () => {
      const console = document.getElementById('floatingConsole');
      console.style.display = console.style.display === 'none' ? 'block' : 'none';
    },

    minimize: () => {
      document.getElementById('floatingConsole').classList.toggle('minimized');
    },

    maximize: () => {
      document.getElementById('floatingConsole').classList.toggle('maximized');
    },

    clear: () => {
      document.getElementById('systemLog').innerHTML = '';
      ShadowApp.state.logs = [];
    },

    close: () => {
      document.getElementById('floatingConsole').style.display = 'none';
    },

    executeCommand: () => {
      const input = document.getElementById('consoleCommand');
      const command = input.value.trim();
      
      if (!command) return;
      
      ShadowApp.logger.info(`> ${command}`);
      
      const parts = command.split(' ');
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);
      
      switch(cmd) {
        case 'help':
          ShadowApp.logger.info('Available commands: help, clear, tokens, status, stop');
          break;
        case 'clear':
          ShadowApp.console.clear();
          break;
        case 'tokens':
          ShadowApp.logger.info(`Loaded tokens: ${ShadowApp.state.tokens.length}`);
          break;
        case 'status':
          ShadowApp.logger.info(`Uptime: ${ShadowApp.utils.formatTime(Math.floor((Date.now() - ShadowApp.state.startTime) / 1000))}`);
          break;
        case 'stop':
          ShadowApp.state.shouldStop = true;
          ShadowApp.logger.warning('Stop signal sent');
          break;
        default:
          ShadowApp.logger.error(`Unknown command: ${cmd}`);
      }
      
      input.value = '';
    }
  },

  stats: {
    update: () => {
      const elapsed = Math.floor((Date.now() - ShadowApp.state.startTime) / 1000);
      document.getElementById('uptime').textContent = ShadowApp.utils.formatTime(elapsed);
      
      document.getElementById('requestsSent').textContent = ShadowApp.state.stats.requests;
    },

    incrementRequests: () => {
      ShadowApp.state.stats.requests++;
      document.getElementById('requestsSent').textContent = ShadowApp.state.stats.requests;
    }
  },

  init: () => {
    ShadowApp.logger.info('ShadowTools v2.0 initialized');
    
    const savedTokens = localStorage.getItem('shadowtools_tokens');
    if (savedTokens) {
      document.getElementById('globalTokens').value = savedTokens;
      ShadowApp.tokens.load();
    }
    
    ShadowApp.settings.load();
    ShadowApp.navigation.init();
    
    setInterval(ShadowApp.stats.update, 1000);
    
    const tokenInput = document.getElementById('globalTokens');
    if (tokenInput) {
      tokenInput.addEventListener('input', ShadowApp.utils.debounce(ShadowApp.tokens.load, 500));
    }
    
    const consoleInput = document.getElementById('consoleCommand');
    if (consoleInput) {
      consoleInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') ShadowApp.console.executeCommand();
      });
    }
  }
};

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
  a.download = `logs_${new Date().toISOString().slice(0,10)}.txt`;
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

function toggleConsole() { ShadowApp.console.toggle(); }
function minimizeConsole() { ShadowApp.console.minimize(); }
function maximizeConsole() { ShadowApp.console.maximize(); }
function clearConsole() { ShadowApp.console.clear(); }
function closeConsole() { ShadowApp.console.close(); }
function executeCommand() { ShadowApp.console.executeCommand(); }
function handleCommand(e) { if (e.key === 'Enter') executeCommand(); }

function showHelp() {
  alert('ShadowTools v2.0 Help:\n\n1. Enter your tokens in the Global Token Manager\n2. Select a tool from the sidebar\n3. Configure settings and run\n\nFor support, visit GitHub.');
}

function showAbout() {
  alert(`ShadowTools v2.0\n\nA powerful Discord automation toolkit\nVersion: ${ShadowApp.config.version}\nAPI: ${ShadowApp.config.apiVersion}\n\nMade with 💀 by Shadow Team`);
}

document.addEventListener('DOMContentLoaded', ShadowApp.init);

window.ShadowApp = ShadowApp;
