const App = {
    tokens: [],
    
    init() {
        this.loadTokens();
        this.startUptime();
        
        // Auto-save tokens
        document.getElementById('globalTokens').addEventListener('input', () => {
            this.debounce(this.saveTokens.bind(this), 500)();
        });
    },
    
    debounce(fn, wait) {
        let timeout;
        return () => {
            clearTimeout(timeout);
            timeout = setTimeout(fn, wait);
        };
    },
    
    loadTokens() {
        const saved = localStorage.getItem('tokens');
        const textarea = document.getElementById('globalTokens');
        if (saved && textarea) {
            textarea.value = saved;
            this.updateTokenCount();
        }
    },
    
    saveTokens() {
        const textarea = document.getElementById('globalTokens');
        if (textarea) {
            localStorage.setItem('tokens', textarea.value);
            this.updateTokenCount();
        }
    },
    
    updateTokenCount() {
        const textarea = document.getElementById('globalTokens');
        const count = textarea ? textarea.value.split('\n').filter(l => l.trim()).length : 0;
        document.getElementById('tokenCount').textContent = count;
        document.getElementById('tokenStatus').textContent = `${count} 個のトークン`;
        this.tokens = count;
    },
    
    importTokens() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                document.getElementById('globalTokens').value = event.target.result;
                this.saveTokens();
                this.showToast('トークンを読み込みました');
            };
            reader.readAsText(file);
        };
        input.click();
    },
    
    exportTokens() {
        const textarea = document.getElementById('globalTokens');
        if (!textarea || !textarea.value.trim()) {
            this.showToast('エクスポートするトークンがありません', 'error');
            return;
        }
        const blob = new Blob([textarea.value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tokens_${new Date().toISOString().slice(0, 10)}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('トークンを保存しました');
    },
    
    clearTokens() {
        if (!confirm('すべてのトークンを削除しますか？')) return;
        document.getElementById('globalTokens').value = '';
        localStorage.removeItem('tokens');
        this.updateTokenCount();
        this.showToast('トークンを削除しました');
    },
    
    async validateTokens() {
        const textarea = document.getElementById('globalTokens');
        if (!textarea || !textarea.value.trim()) {
            this.showToast('トークンを入力してください', 'error');
            return;
        }
        
        const lines = textarea.value.split('\n').filter(l => l.trim());
        let valid = 0, invalid = 0;
        
        this.showToast('検証を開始しました...');
        
        for (const line of lines) {
            const token = line.includes(':') ? line.split(':').pop() : line;
            try {
                const res = await fetch('https://discord.com/api/v9/users/@me', {
                    headers: { 'Authorization': token.trim() }
                });
                if (res.ok) valid++;
                else invalid++;
            } catch {
                invalid++;
            }
            await new Promise(r => setTimeout(r, 300));
        }
        
        this.showToast(`検証完了: 有効 ${valid} / 無効 ${invalid}`);
    },
    
    startUptime() {
        let seconds = 0;
        setInterval(() => {
            seconds++;
            const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
            const secs = (seconds % 60).toString().padStart(2, '0');
            document.getElementById('uptime').textContent = `${mins}:${secs}`;
        }, 1000);
    },
    
    showToast(msg, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMsg = document.getElementById('toastMsg');
        const icon = toast.querySelector('i');
        
        toastMsg.textContent = msg;
        icon.className = type === 'error' ? 'fas fa-exclamation-circle' : 'fas fa-check-circle';
        icon.style.color = type === 'error' ? 'var(--danger)' : 'var(--success)';
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }
};

// Tab switching
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabName).classList.add('active');
    event.target.closest('.nav-item').classList.add('active');
}

// Global functions
const importTokens = () => App.importTokens();
const exportTokens = () => App.exportTokens();
const clearTokens = () => App.clearTokens();
const validateTokens = () => App.validateTokens();

// Init
document.addEventListener('DOMContentContentLoaded', () => App.init());