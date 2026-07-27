import { Room, RoomEvent } from "https://esm.sh/livekit-client";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";
let currentRoom = null;

// 参加者の表示名を取得する共通関数
function getParticipantDisplayName(participant) {
  // 1. もし通話中に変更された名前（attributes）があればそれを最優先する
  if (participant.attributes && participant.attributes.displayName) {
    return participant.attributes.displayName;
  }
  // 2. なければ、入室時のidentityから「#数字」をカットした名前を使う
  const rawName = participant.identity || "Unknown";
  return rawName.split("#")[0]; // ★ここを修正しました
}

// 参加者のカード枠にある名前ラベルとアバターを更新する関数
function updateParticipantLabels(participant) {
  const card = document.getElementById(`card-${participant.sid}`);
  if (!card) return;

  const displayName = getParticipantDisplayName(participant);

  // アバターの文字を更新（安全に最初の2文字を切り出す）
  const avatar = card.querySelector(".avatar-placeholder");
  if (avatar) {
    avatar.textContent = String(displayName).substring(0, 2).toUpperCase();
  }

  // 名前ラベルの文字を更新
  const label = card.querySelector(".name-label");
  if (label) {
    label.textContent = displayName;
  }
}

// 参加者が入室したときに枠を作る関数
function createParticipantCard(participant) {
  if (!participant || document.getElementById(`card-${participant.sid}`)) return;

  const container = document.getElementById("videos");
  if (!container) return;

  const card = document.createElement("div");
  card.className = "participant-card";
  card.id = `card-${participant.sid}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar-placeholder";
  card.appendChild(avatar);

  const label = document.createElement("div");
  label.className = "name-label";
  card.appendChild(label);

  container.appendChild(card);

  // 初回の名前セット
  updateParticipantLabels(participant);
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

async function start() {
  const nameInput = document.getElementById("username-input");
  const baseName = nameInput.value.trim() || "User";

  // 同じ名前でも統合されないよう、裏側で「#ランダムな4桁の数字」を付与
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

    // 誰かが名前を変えた（属性が変更された）ら画面の表示を更新する
    room.on(RoomEvent.ParticipantAttributesChanged, (changedAttributes, participant) => {
      if (participant) {
        updateParticipantLabels(participant);
      }
    });

    await room.connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    document.getElementById("setup-area").style.display = "none";
    document.getElementById("controls").style.display = "flex";

    // 通話中名前入力欄の初期値をセット
    const newNameInput = document.getElementById("new-username-input");
    if (newNameInput) newNameInput.value = baseName;

    createParticipantCard(room.localParticipant);

    room.remoteParticipants.forEach((participant) => {
      createParticipantCard(participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.track) handleTrackAttach(publication.track, participant);
      });
    });

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

document.getElementById("connect-btn")?.addEventListener("click", start);

// 名前変更ボタンのクリック処理
document.getElementById("update-name-btn")?.addEventListener("click", async () => {
  if (!currentRoom) return;
  const newNameInput = document.getElementById("new-username-input");
  const newName = newNameInput.value.trim();
  if (!newName) return alert("名前を入力してください");

  try {
    // 自分の属性（attributes）に新しい名前をセットして全員に同期する
    await currentRoom.localParticipant.setAttributes({ displayName: newName });
    // 自分自身の画面のラベルも更新
    updateParticipantLabels(currentRoom.localParticipant);
  } catch (err) {
    console.error("名前の変更に失敗しました:", err);
  }
});

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

// 退室処理
document.getElementById("leave-btn")?.addEventListener("click", () => {
  if (currentRoom) {
    currentRoom.disconnect();
    currentRoom = null;
  }
  document.getElementById("videos").innerHTML = "";
  document.getElementById("controls").style.display = "none";
  document.getElementById("setup-area").style.display = "flex";
  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = false;
    connectBtn.textContent = "通話に参加";
  }
});
