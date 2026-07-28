import { Room, RoomEvent } from "https://esm.sh/livekit-client";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";
let currentRoom = null;
let recognition = null;
let isTranscribing = false;
let conversationLogs = [];
let timerInterval = null;
let secondsElapsed = 0;
let currentFacingMode = "user"; // 'user' = インカメラ, 'environment' = アウトカメラ

// タイマー開始
function startTimer() {
  secondsElapsed = 0;
  const timerEl = document.getElementById("timer");
  
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsElapsed++;
    const hrs = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const mins = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const secs = String(secondsElapsed % 60).padStart(2, '0');
    if (timerEl) {
      timerEl.textContent = `経過時間 ${hrs}:${mins}:${secs}`;
    }
  }, 1000);
}

// タイマー停止
function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  const timerEl = document.getElementById("timer");
  if (timerEl) timerEl.textContent = "経過時間 00:00:00";
}

// 文字起こしログ追加
function appendTranscriptLog(speaker, text) {
  const listEl = document.getElementById("transcript-list");
  if (!listEl || !text.trim()) return;

  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const item = document.createElement("div");
  item.className = "log-item";
  item.innerHTML = `<span class="speaker">${speaker}:</span> ${text}`;
  
  listEl.appendChild(item);
  listEl.scrollTop = listEl.scrollHeight;

  conversationLogs.push(`[${timeStr}] ${speaker}: ${text}`);
}

// 参加者カード作成
function createParticipantCard(participant) {
  if (!participant || document.getElementById(`card-${participant.sid}`)) return;

  const container = document.getElementById("videos");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "participant-card";
  card.id = `card-${participant.sid}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar-placeholder";
  
  const rawName = participant.identity || "Unknown";
  const displayName = rawName.split("#")[0];
  
  avatar.textContent = String(displayName).substring(0, 2).toUpperCase();
  card.appendChild(avatar);

  const label = document.createElement("div");
  label.className = "name-label";
  label.textContent = displayName;
  card.appendChild(label);

  // ★ 自分以外の参加者カードにミュートボタンを追加
  if (!participant.isLocal) {
    const muteBtn = document.createElement("button");
    muteBtn.className = "participant-mute-btn";
    muteBtn.innerHTML = "🔊";
    muteBtn.title = "相手の声をミュート";

    muteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      participant.isAudioMutedByMe = !participant.isAudioMutedByMe;

      // 音声要素のミュート切替
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          const el = document.getElementById(`track-${pub.track.sid}`);
          if (el) {
            el.muted = participant.isAudioMutedByMe;
          }
        }
      });

      muteBtn.innerHTML = participant.isAudioMutedByMe ? "🔇" : "🔊";
      muteBtn.classList.toggle("muted", participant.isAudioMutedByMe);
    });

    card.appendChild(muteBtn);
  }

  container.appendChild(card);
}

function removeParticipantCard(participant) {
  if (!participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (card) card.remove();
}

function handleTrackAttach(track, participant) {
  if (!track || !participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (!card) return;
  if (document.getElementById(`track-${track.sid}`)) return;

  const el = track.attach();
  el.id = `track-${track.sid}`;

  // 相手の音声を自分がミュート状態に設定していれば適用
  if (track.kind === "audio" && participant.isAudioMutedByMe) {
    el.muted = true;
  }

  card.appendChild(el);
}

function handleTrackDetach(track) {
  if (!track) return;
  const el = document.getElementById(`track-${track.sid}`);
  if (el) el.remove();
}

// 音声認識セットアップ
function setupSpeechRecognition(room) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.warn("このブラウザは音声認識非対応です。");
    const sttBtn = document.getElementById("toggle-stt-btn");
    if (sttBtn) {
      sttBtn.textContent = "字幕非対応";
      sttBtn.disabled = true;
    }
    return;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          
          if (transcript && room) {
            const rawName = room.localParticipant.identity || "Me";
            const displayName = rawName.split("#")[0];

            appendTranscriptLog(displayName, transcript);

            const encoder = new TextEncoder();
            const payload = encoder.encode(JSON.stringify({ type: "transcript", text: transcript }));
            room.localParticipant.publishData(payload, { reliable: true });
          }
        }
      }
    };

    recognition.onerror = (e) => console.warn("音声認識エラー:", e.error);
    
    recognition.onend = () => {
      if (isTranscribing) {
        try { recognition.start(); } catch (e) {}
      }
    };

  } catch (err) {
    console.error("SpeechRecognition初期化エラー:", err);
  }
}

async function start() {
  const nameInput = document.getElementById("username-input");
  const baseName = nameInput ? nameInput.value.trim() || "User" : "User";
  const uniqueIdentity = `${baseName}#${Math.floor(1000 + Math.random() * 9000)}`;

  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = "接続中...";
  }

  try {
    const token = await fetch(`/token?identity=${encodeURIComponent(uniqueIdentity)}`)
      .then(res => res.json())
      .then(data => data.token);

    const room = new Room({ adaptiveStream: true, dynacast: true });
    currentRoom = room;
    
    room.on(RoomEvent.ParticipantConnected, (p) => createParticipantCard(p));
    room.on(RoomEvent.ParticipantDisconnected, (p) => removeParticipantCard(p));
    room.on(RoomEvent.TrackSubscribed, (track, pub, p) => handleTrackAttach(track, p));
    room.on(RoomEvent.TrackUnsubscribed, (track) => handleTrackDetach(track));

    room.on(RoomEvent.DataReceived, (payload, participant) => {
      if (!participant) return;
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        
        if (data.type === "transcript" && data.text.trim() !== "") {
          const rawName = participant.identity || "Unknown";
          const displayName = rawName.split("#")[0];
          appendTranscriptLog(displayName, data.text);
        }
      } catch (e) {
        console.error("データ受信エラー:", e);
      }
    });

    await room.connect(LIVEKIT_URL, token);

    const setupArea = document.getElementById("setup-area");
    if (setupArea) setupArea.style.display = "none";

    const callContainer = document.getElementById("call-container");
    if (callContainer) callContainer.style.display = "flex";

    startTimer();

    createParticipantCard(room.localParticipant);

    room.remoteParticipants.forEach((participant) => {
      createParticipantCard(participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.track) handleTrackAttach(publication.track, participant);
      });
    });

    try {
      await room.localParticipant.setCameraEnabled(true, { facingMode: currentFacingMode });
      room.localParticipant.videoTrackPublications.forEach((pub) => {
        if (pub.videoTrack) handleTrackAttach(pub.videoTrack, room.localParticipant);
      });
    } catch (e) { console.warn("カメラなし:", e); }

    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) { console.warn("マイクなし:", e); }

    setupSpeechRecognition(room);

  } catch (err) {
    alert("接続に失敗しました: " + err.message);
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.textContent = "通話に参加";
    }
  }
}

document.getElementById("connect-btn")?.addEventListener("click", start);

// マイクON/OFF
document.getElementById("toggle-mic-btn")?.addEventListener("click", async (e) => {
  if (!currentRoom) return;
  const enabled = currentRoom.localParticipant.isMicrophoneEnabled;
  await currentRoom.localParticipant.setMicrophoneEnabled(!enabled);
  e.target.textContent = !enabled ? "マイク" : "マイク(オフ)";
  e.target.classList.toggle("active", enabled);
});

// カメラON/OFF
document.getElementById("toggle-cam-btn")?.addEventListener("click", async (e) => {
  if (!currentRoom) return;
  const enabled = currentRoom.localParticipant.isCameraEnabled;
  await currentRoom.localParticipant.setCameraEnabled(!enabled, { facingMode: currentFacingMode });
  e.target.textContent = !enabled ? "カメラ" : "カメラ(オフ)";
  e.target.classList.toggle("active", enabled);
});

// ★ インカメラ / アウトカメラ切り替えボタンの動作
document.getElementById("switch-cam-btn")?.addEventListener("click", async () => {
  if (!currentRoom) return;
  if (!currentRoom.localParticipant.isCameraEnabled) {
    alert("カメラがオフになっています。先にカメラをONにしてください。");
    return;
  }

  // カメラ向きの反転 (user ⇔ environment)
  currentFacingMode = (currentFacingMode === "user") ? "environment" : "user";

  try {
    // カメラの再接続
    await currentRoom.localParticipant.setCameraEnabled(false);
    await currentRoom.localParticipant.setCameraEnabled(true, { facingMode: currentFacingMode });
    
    // 自身のビデオ要素をアタッチし直す
    currentRoom.localParticipant.videoTrackPublications.forEach((pub) => {
      if (pub.videoTrack) handleTrackAttach(pub.videoTrack, currentRoom.localParticipant);
    });
  } catch (e) {
    console.error("カメラ切替エラー:", e);
    alert("カメラの切り替えに失敗しました。端末にアウトカメラがない可能性があります。");
  }
});

// 字幕（文字起こし）ON/OFF
document.getElementById("toggle-stt-btn")?.addEventListener("click", (e) => {
  if (!recognition) return;

  if (isTranscribing) {
    recognition.stop();
    isTranscribing = false;
    e.target.textContent = "字幕 ON";
    e.target.classList.remove("active");
  } else {
    try {
      recognition.start();
      isTranscribing = true;
      e.target.textContent = "字幕 OFF";
      e.target.classList.add("active");
    } catch (err) {
      console.error("音声認識エラー:", err);
    }
  }
});

// AIまとめ
document.getElementById("ai-summary-btn")?.addEventListener("click", () => {
  const summaryBox = document.getElementById("summary-content");
  if (!summaryBox) return;

  if (conversationLogs.length === 0) {
    alert("要約するための会話データがまだありません。字幕をONにして会話してください。");
    return;
  }

  if (window.innerWidth <= 768 && tabSummaryBtn) {
    tabSummaryBtn.click();
  }

  summaryBox.innerHTML = "<p><i>AIが会話要約を生成中...</i></p>";

  setTimeout(() => {
    summaryBox.innerHTML = `
      <h4>【自動生成された要約】</h4>
      <ul>
        <li><b>進行状況:</b> 通話が順調に行われています。</li>
        <li><b>発言件数:</b> 計 ${conversationLogs.length} 件の発言を記録しました。</li>
      </ul>
    `;
  }, 1000);
});

// ログ保存
document.getElementById("save-log-btn")?.addEventListener("click", () => {
  if (conversationLogs.length === 0) {
    alert("保存する会話ログがありません。");
    return;
  }

  const blob = new Blob([conversationLogs.join("\n")], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `meeting_log_${new Date().toISOString().split('T')[0]}.txt`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

// 退室（終了）処理
document.getElementById("leave-btn")?.addEventListener("click", () => {
  if (recognition && isTranscribing) {
    recognition.stop();
    isTranscribing = false;
  }
  if (currentRoom) {
    currentRoom.disconnect();
    currentRoom = null;
  }
  
  stopTimer();
  conversationLogs = [];
  
  const videos = document.getElementById("videos");
  if (videos) videos.innerHTML = "";

  const list = document.getElementById("transcript-list");
  if (list) list.innerHTML = "";

  const summary = document.getElementById("summary-content");
  if (summary) summary.innerHTML = '<p class="placeholder-text">「AIまとめ」ボタンを押すと、ここまでの会話の要約が表示されます。</p>';

  const callContainer = document.getElementById("call-container");
  if (callContainer) callContainer.style.display = "none";

  const setupArea = document.getElementById("setup-area");
  if (setupArea) setupArea.style.display = "flex";

  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.textContent = "通話に参加";
  }
});

// スマホ用タブ切替処理
const tabTranscriptBtn = document.getElementById("tab-transcript-btn");
const tabSummaryBtn = document.getElementById("tab-summary-btn");
const transcriptPanel = document.getElementById("transcript-panel");
const summaryPanel = document.getElementById("summary-panel");

if (tabTranscriptBtn && tabSummaryBtn && transcriptPanel && summaryPanel) {
  tabTranscriptBtn.addEventListener("click", () => {
    tabTranscriptBtn.classList.add("active");
    tabSummaryBtn.classList.remove("active");
    transcriptPanel.classList.add("active-tab");
    summaryPanel.classList.remove("active-tab");
  });

  tabSummaryBtn.addEventListener("click", () => {
    tabSummaryBtn.classList.add("active");
    tabTranscriptBtn.classList.remove("active");
    summaryPanel.classList.add("active-tab");
    transcriptPanel.classList.remove("active-tab");
  });
}
