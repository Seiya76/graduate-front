/**
 * チャットアプリケーション用ユーティリティ関数
 * 共通で使用される機能を提供
 */

// アプリケーションの設定
const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    TOAST_DURATION: 3000, // 3秒
    TYPING_TIMEOUT: 3000, // 3秒
    MAX_MESSAGE_LENGTH: 1000,
    ROOM_NAME_MAX_LENGTH: 50
};

// DOM要素の取得
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// 要素の表示/非表示
const show = (element) => {
    if (typeof element === 'string') {
        element = $(element);
    }
    if (element) {
        element.style.display = 'block';
    }
};

const hide = (element) => {
    if (typeof element === 'string') {
        element = $(element);
    }
    if (element) {
        element.style.display = 'none';
    }
};

const toggle = (element) => {
    if (typeof element === 'string') {
        element = $(element);
    }
    if (element) {
        element.style.display = element.style.display === 'none' ? 'block' : 'none';
    }
};

// ローディング表示
const showLoading = () => {
    show('#loading');
};

const hideLoading = () => {
    hide('#loading');
};

// トースト通知
const showToast = (message, type = 'info', duration = CONFIG.TOAST_DURATION) => {
    const container = $('#toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = getToastIcon(type);
    
    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button class="toast-close">&times;</button>
    `;

    // 閉じるボタンのイベント
    toast.querySelector('.toast-close').addEventListener('click', () => {
        removeToast(toast);
    });

    container.appendChild(toast);

    // 自動削除
    setTimeout(() => {
        removeToast(toast);
    }, duration);
};

const getToastIcon = (type) => {
    switch (type) {
        case 'success': return '✅';
        case 'error': return '❌';
        case 'warning': return '⚠️';
        default: return 'ℹ️';
    }
};

const removeToast = (toast) => {
    if (toast && toast.parentNode) {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
};

// HTML文字列のエスケープ
const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
};

// 日付フォーマット
const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        // 24時間以内は時間のみ表示
        return date.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (diffInHours < 24 * 7) {
        // 1週間以内は曜日と時間
        return date.toLocaleDateString('ja-JP', {
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        // それ以上は日付
        return date.toLocaleDateString('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};

// ファイルサイズの人間読み可能な形式への変換
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ファイルタイプの判定
const isImageFile = (file) => {
    return CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type);
};

const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase();
    
    switch (ext) {
        case 'pdf': return '📄';
        case 'doc':
        case 'docx': return '📝';
        case 'xls':
        case 'xlsx': return '📊';
        case 'ppt':
        case 'pptx': return '📈';
        case 'zip':
        case 'rar': return '📦';
        case 'mp3':
        case 'wav': return '🎵';
        case 'mp4':
        case 'avi': return '🎬';
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'gif': return '🖼️';
        default: return '📎';
    }
};

// ファイル検証
const validateFile = (file) => {
    if (!file) {
        return { valid: false, error: 'ファイルが選択されていません' };
    }
    
    if (file.size > CONFIG.MAX_FILE_SIZE) {
        return { 
            valid: false, 
            error: `ファイルサイズが大きすぎます（最大: ${formatFileSize(CONFIG.MAX_FILE_SIZE)}）` 
        };
    }
    
    return { valid: true };
};

// 画像のプレビューURL生成
const createImagePreview = (file) => {
    return new Promise((resolve, reject) => {
        if (!isImageFile(file)) {
            reject(new Error('対応していない画像形式です'));
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
        reader.readAsDataURL(file);
    });
};

// UUIDの生成（簡易版）
const generateId = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

// デバウンス関数
const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// スロットル関数
const throttle = (func, limit) => {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// 文字列の切り捨て
const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
};

// メール形式の検証
const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// パスワード強度の検証
const validatePassword = (password) => {
    const minLength = 8;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const errors = [];
    
    if (password.length < minLength) {
        errors.push(`パスワードは${minLength}文字以上である必要があります`);
    }
    if (!hasUpperCase) {
        errors.push('大文字を含める必要があります');
    }
    if (!hasLowerCase) {
        errors.push('小文字を含める必要があります');
    }
    if (!hasNumbers) {
        errors.push('数字を含める必要があります');
    }
    
    return {
        valid: errors.length === 0,
        errors: errors,
        strength: calculatePasswordStrength(password)
    };
};

const calculatePasswordStrength = (password) => {
    let score = 0;
    
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
};

// ローカルストレージのヘルパー関数
const storage = {
    get: (key) => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error('Storage get error:', error);
            return null;
        }
    },
    
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    },
    
    remove: (key) => {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    },
    
    clear: () => {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }
};

// エラーハンドリング
const handleError = (error, context = '') => {
    console.error(`Error in ${context}:`, error);
    
    let message = 'エラーが発生しました';
    
    if (error.message) {
        message = error.message;
    } else if (typeof error === 'string') {
        message = error;
    }
    
    showToast(message, 'error');
};

// API呼び出しの共通処理
const apiCall = async (url, options = {}) => {
    try {
        showLoading();
        
        const response = await fetch(url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        handleError(error, 'API Call');
        throw error;
    } finally {
        hideLoading();
    }
};

// イベントエミッター（簡易版）
class EventEmitter {
    constructor() {
        this.events = {};
    }
    
    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }
    
    off(event, callback) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Event callback error:', error);
                }
            });
        }
    }
}

// アプリケーション全体で使用するイベントエミッター
const appEvents = new EventEmitter();

// エクスポート（グローバルに公開）
window.Utils = {
    CONFIG,
    $,
    $$,
    show,
    hide,
    toggle,
    showLoading,
    hideLoading,
    showToast,
    escapeHtml,
    formatTime,
    formatFileSize,
    isImageFile,
    getFileIcon,
    validateFile,
    createImagePreview,
    generateId,
    debounce,
    throttle,
    truncateText,
    isValidEmail,
    validatePassword,
    storage,
    handleError,
    apiCall,
    EventEmitter,
    appEvents
};