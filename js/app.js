import { Room, RoomEvent } from "https://esm.sh/livekit-client";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";
let currentRoom = null;

// 1. 参加者が入室したときに「カードの枠」だけを先に作る関数
function createParticipantCard(participant) {
  if (!participant || document.getElementById(`card-${participant.sid}`)) return;

  const container = document.getElementById("videos");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "participant-card";
  card.id = `card-${participant.sid}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar-placeholder";
  
  const nameStr = participant.identity ? String(participant.identity) : "U";
  avatar.textContent = nameStr.substring(0, 2).toUpperCase();
  card.appendChild(avatar);

  const label = document.createElement("div");
  label.className = "name-label";
  label.textContent = participant.identity || "Unknown";
  card.appendChild(label);

  container.appendChild(card);
}

// 2. 参加者が退室したときにカードを消去する関数
function removeParticipantCard(participant) {
  if (!participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (card) card.remove();
}

// 3. 映像や音声（トラック）が届いたときにカード内に追加する関数
function handleTrackAttach(track, participant) {
  if (!track || !participant) return;
  const card = document.getElementById(`card-${participant.sid}`);
  if (!card) return;
  if (document.getElementById(`track-${track.sid}`)) return;

  const el = track.attach();
  el.id = `track-${track.sid}`;
  card.appendChild(el);
}

// 4. カメラがオフになったり、トラックが外れたときに画面から消す関数
function handleTrackDetach(track) {
  if (!track) return;
  const el = document.getElementById(`track-${track.sid}`);
  if (el) el.remove();
}

async function start() {
  const nameInput = document.getElementById("username-input");
  // 名前が未入力の場合はランダムな名前を生成
  const identity = nameInput.value.trim() || `user-${Math.floor(Math.random() * 10000)}`;

  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = "接続中...";
  }

  try {
    // 1. 入力された名前(identity)を渡してトークンを取得
    const token = await fetch(`/token?identity=${encodeURIComponent(identity)}`)
      .then(res => res.json())
      .then(data => data.token);

    // 2. Roomインスタンス作成
    const room = new Room({ adaptiveStream: true, dynacast: true });
    currentRoom = room;
    
    // イベントリスナー設定
    room.on(RoomEvent.ParticipantConnected, (participant) => createParticipantCard(participant));
    room.on(RoomEvent.ParticipantDisconnected, (participant) => removeParticipantCard(participant));
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => handleTrackAttach(track, participant));
    room.on(RoomEvent.TrackUnsubscribed, (track) => handleTrackDetach(track));

    // ルームへの接続
    await room.connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    // 画面表示の切り替え（入力エリアを隠し、操作ボタンを表示）
    document.getElementById("setup-area").style.display = "none";
    document.getElementById("controls").style.display = "flex";

    // 自分のカードを作成
    createParticipantCard(room.localParticipant);

    // すでに部屋にいる他の人たちのカードと映像を再現
    room.remoteParticipants.forEach((participant) => {
      createParticipantCard(participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.track) handleTrackAttach(publication.track, participant);
      });
    });

    // 自分のカメラ・マイクの初期有効化（デバイスがなければスキップ）
    try {
      await room.localParticipant.setCameraEnabled(true);
      room.localParticipant.videoTrackPublications.forEach((publication) => {
        if (publication.videoTrack) handleTrackAttach(publication.videoTrack, room.localParticipant);
      });
    } catch (e) { console.warn("カメラがありません:", e); }

    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (e) { console.warn("マイクがありません:", e); }

  } catch (err) {
    console.error(err);
    alert("接続に失敗しました: " + err.message);
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.textContent = "通話に参加";
    }
  }
}

// ボタン操作のイベント登録
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

  // 自分のカメラ要素の表示・非表示を即座に連動
  room.localParticipant.videoTrackPublications.forEach((publication) => {
    if (!enabled && publication.videoTrack) {
      handleTrackAttach(publication.videoTrack, currentRoom.localParticipant);
    } else if (enabled && publication.videoTrack) {
      handleTrackDetach(publication.videoTrack);
    }
  });
});

// 退室処理
document.getElementById("leave-btn")?.addEventListener("click", () => {
  if (currentRoom) {
    currentRoom.disconnect();
    currentRoom = null;
  }
  // 画面を初期状態に戻す
  document.getElementById("videos").innerHTML = "";
  document.getElementById("controls").style.display = "none";
  document.getElementById("setup-area").style.display = "flex";
  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.textContent = "通話に参加";
  }
});
