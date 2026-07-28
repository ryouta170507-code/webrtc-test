* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background-color: #1a202c;
    color: #ffffff;
    height: 100vh;
    overflow: hidden;
}

/* 入室画面 */
.setup-container {
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 100%;
    max-width: 360px;
    margin: 100px auto;
    padding: 30px;
    background-color: #2d3748;
    border-radius: 12px;
    text-align: center;
}

#username-input {
    padding: 12px;
    font-size: 1rem;
    border: 1px solid #4a5568;
    border-radius: 6px;
    background-color: #1a202c;
    color: #fff;
}

/* 全体フレーム（100vhで画面いっぱいに表示） */
#call-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    width: 100vw;
}

/* 1. 上部：参加者一覧（横スクロール可能） */
.videos-row {
    display: flex;
    gap: 12px;
    padding: 12px;
    background-color: #111827;
    height: 160px;
    overflow-x: auto;
    flex-shrink: 0;
    border-bottom: 1px solid #374151;
}

.participant-card {
    background-color: #1f2937;
    border-radius: 8px;
    aspect-ratio: 4 / 3;
    height: 100%;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #374151;
}

.avatar-placeholder {
    width: 50px;
    height: 50px;
    background-color: #374151;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
    font-weight: bold;
}

.participant-card video {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover;
    position: absolute;
    top: 0;
    left: 0;
}

.name-label {
    position: absolute;
    bottom: 6px;
    left: 6px;
    background-color: rgba(0, 0, 0, 0.7);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.75rem;
    z-index: 2;
}

/* 2. 中央：文字起こし & AIまとめ */
#middle-content {
    display: flex;
    flex: 1;
    gap: 12px;
    padding: 12px;
    overflow: hidden;
}

.panel-box {
    flex: 1;
    background-color: #1f2937;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    border: 1px solid #374151;
    overflow: hidden;
}

.panel-header {
    background-color: #111827;
    padding: 10px 16px;
    font-weight: bold;
    font-size: 1rem;
    border-bottom: 1px solid #374151;
    color: #e5e7eb;
}

.panel-body {
    padding: 16px;
    flex: 1;
    overflow-y: auto;
    font-size: 0.95rem;
    line-height: 1.6;
}

/* 文字起こしログアイテム */
.log-item {
    margin-bottom: 10px;
    word-break: break-all;
}

.log-item .speaker {
    font-weight: bold;
    color: #60a5fa;
    margin-right: 6px;
}

.placeholder-text {
    color: #9ca3af;
    font-style: italic;
}

/* 3. 下部：コントロールバー */
#controls-bar {
    height: 64px;
    background-color: #111827;
    border-top: 1px solid #374151;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    flex-shrink: 0;
}

.controls-left, .controls-right {
    flex: 1;
    display: flex;
    align-items: center;
}

.controls-right {
    justify-content: flex-end;
}

.controls-center {
    display: flex;
    gap: 10px;
}

#timer {
    font-family: monospace;
    font-size: 0.95rem;
    background-color: #1f2937;
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid #374151;
}

/* ボタン装飾 */
.btn {
    color: white;
    border: none;
    padding: 8px 16px;
    font-size: 0.85rem;
    font-weight: bold;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.2s;
}

.btn:hover { opacity: 0.85; }

.control-btn { background-color: #374151; }
.control-btn.active { background-color: #dc2626; }

.ai-btn { background-color: #16a34a; } /* 緑色 */
.log-btn { background-color: #2563eb; } /* 青色 */
.leave-btn { background-color: #dc2626; } /* 赤色 */
