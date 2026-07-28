import { Room, RoomEvent } from "https://esm.sh/livekit-client";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";
let currentRoom = null;
let recognition = null; // 音声認識オブジェクト
let isTranscribing = false;

// 字幕を表示・消去するヘルパー関数
function displayCaption(participantSid, text) {
  const captionEl = document.getElementById(`caption-${participantSid}`);
  if (!captionEl) return;
  
  captionEl.textContent = text;
  captionEl.classList.add("active");

  // 一定時間（4秒）喋らなかったら字幕を消す
  clearTimeout(captionEl.timer);
  captionEl.timer = setTimeout(() => {
    captionEl.textContent = "";
    captionEl.classList.remove("active");
  }, 4000);
}

// 参加者が入室したときに「カードの枠」を作る関数
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

  // 【追加】字幕表示用のエリアを作成
  const caption = document.createElement("div");
  caption.className = "caption-box";
  caption.id = `caption-${participant.sid}`;
  card.appendChild(caption);

  container.appendChild(card);
}

// 参加者が退室したときにカードを消去する関数
function removeParticipantCard(participant) {
  if (!participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (card) card.remove();
}

// 映像や音声（トラック）が届いたときにカード内に追加する関数
function handleTrackAttach(track, participant) {
  if (!track || !participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (!card) return;
  if (document.getElementById(`track-${track.sid}`)) return;

  const el = track.attach();
  el.id = `track-${track.sid}`;
  card.appendChild(el);
}

// トラックが外れたときに画面から消す関数
function handleTrackDetach(track) {
  if (!track) return;
  const el = document.getElementById(`track-${track.sid}`);
  if (el) el.remove();
}

// 【追加】リアルタイム文字起こし（Web Speech API）の初期化
function setupSpeechRecognition(room) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("お使いのブラウザはリアルタイム文字起こしに対応していません。（Chrome推奨）");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }

    if (transcript.trim() && room) {
      // 1. 自分の画面に字幕を表示
      displayCaption(room.localParticipant.sid, transcript);

      // 2. LiveKitのデータチャネルを使って他の相手全員に字幕テキストを送信
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify({ type: "transcript", text: transcript }));
      room.localParticipant.publishData(payload, { reliable: true });
    }
  };

  recognition.onerror = (e) => console.warn("音声認識エラー:", e);
  
  // 勝手に停止したときに自動再開
  recognition.onend = () => {
    if (isTranscribing) {
      try { recognition.start(); } catch (e) {}
    }
  };
}

async function start() {
  const nameInput = document.getElementById("username-input");
  const baseName = nameInput.value.trim() || "User";
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
    
    // イベントリスナー設定
    room.on(RoomEvent.ParticipantConnected, (participant) => createParticipantCard(participant));
    room.on(RoomEvent.ParticipantDisconnected, (participant) => removeParticipantCard(participant));
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => handleTrackAttach(track, participant));
    room.on(RoomEvent.TrackUnsubscribed, (track) => handleTrackDetach(track));

    // 【追加】他の参加者から字幕データが届いた時の処理
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        if (data.type === "transcript" && participant) {
          displayCaption(participant.sid, data.text);
        }
      } catch (e) {
        console.error("データ受信エラー:", e);
      }
    });

    await room.connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    document.getElementById("setup-area").style.display = "none";
    document.getElementById("controls").style.display = "flex";

    // 自分のカードを作成
    createParticipantCard(room.localParticipant);

    // 他の参加者の再現
    room.remoteParticipants.forEach((participant) => {
      createParticipantCard(participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.track) handleTrackAttach(publication.track, participant);
      });
    });

    // カメラ・マイク有効化
    try {
      await room.localParticipant.setCameraEnabled(true);
      room.localParticipant.videoTrackPublications.forEach((publication) => {
        if (publication.videoTrack) handleTrackAttach(publication.videoTrack, room.localParticipant);
      });
    } catch (e) { console.warn("カメラがありません:", e); }

    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) { console.warn("マイクがありません:", e); }

    // 音声認識のセットアップ
    setupSpeechRecognition(room);

  } catch (err) {
    console.error(err);
    alert("接続に失敗しました: " + err.message);
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.textContent = "通話に参加";
    }
  }
}

document.getElementById("connect-btn")?.addEventListener("click", start);

// マイクのオンオフ
document.getElementById("toggle-mic-btn")?.addEventListener("click", async (e) => {
  if (!currentRoom) return;
  const enabled = currentRoom.localParticipant.isMicrophoneEnabled;
  await currentRoom.localParticipant.setMicrophoneEnabled(!enabled);
  e.target.textContent = !enabled ? "マイクをミュート" : "マイクのミュート解除";
  e.target.classList.toggle("active", enabled);
});

// カメラのオンオフ
document.getElementById("toggle-cam-btn")?.addEventListener("click", async (e) => {
  if (!currentRoom) return;
  const enabled = currentRoom.localParticipant.isCameraEnabled;
  await currentRoom.localParticipant.setCameraEnabled(!enabled);
  e.target.textContent = !enabled ? "カメラをオフ" : "カメラをオン";
  e.target.classList.toggle("active", enabled);

  currentRoom.localParticipant.videoTrackPublications.forEach((publication) => {
    if (!enabled && publication.videoTrack) {
      handleTrackAttach(publication.videoTrack, currentRoom.localParticipant);
    } else if (enabled && publication.videoTrack) {
      handleTrackDetach(publication.videoTrack);
    }
  });
});

// 【追加】字幕（文字起こし）のオンオフ
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
      console.error("音声認識の開始に失敗しました:", err);
    }
  }
});

// 退室処理
document.getElementById("leave-btn")?.addEventListener("click", () => {
  if (recognition && isTranscribing) {
    recognition.stop();
    isTranscribing = false;
  }
  if (currentRoom) {
    currentRoom.disconnect();
    currentRoom = null;
  }
  document.getElementById("videos").innerHTML = "";
  document.getElementById("controls").style.display = "none";
  document.getElementById("setup-area").style.display = "flex";
  
  const sttBtn = document.getElementById("toggle-stt-btn");
  if (sttBtn) {
    sttBtn.textContent = "字幕 ON";
    sttBtn.classList.remove("active");
  }

  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.textContent = "通話に参加";
  }
});
