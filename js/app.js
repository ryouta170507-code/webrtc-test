import { Room, RoomEvent } from "https://esm.sh";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";

// 1. 参加者が入室したときに「カードの枠」だけを先に作る関数
function createParticipantCard(participant) {
  if (document.getElementById(`card-${participant.sid}`)) return;

  const container = document.getElementById("videos");

  // カード全体の枠
  const card = document.createElement("div");
  card.className = "participant-card";
  card.id = `card-${participant.sid}`;

  // アバター（カメラがないときのダミー）
  const avatar = document.createElement("div");
  avatar.className = "avatar-placeholder";
  // ユーザー名の最初の1文字をアイコンにする
  avatar.textContent = (participant.identity || "U").substring(0, 2).toUpperCase();
  card.appendChild(avatar);

  // 名前ラベル
  const label = document.createElement("div");
  label.className = "name-label";
  label.textContent = participant.identity;
  card.appendChild(label);

  container.appendChild(card);
}

// 2. 参加者が退室したときにカードを消去する関数
function removeParticipantCard(participant) {
  const card = document.getElementById(`card-${participant.sid}`);
  if (card) card.remove();
}

// 3. 映像や音声（トラック）が届いたときに、該当する参加者のカード内に追加する関数
function handleTrackAttach(track, participant) {
  const card = document.getElementById(`card-${participant.sid}`);
  if (!card) return;

  // すでに同じ映像要素が追加されている場合はスキップ
  if (document.getElementById(`track-${track.sid}`)) return;

  const el = track.attach();
  el.id = `track-${track.sid}`;
  
  // 音声トラックは見えないのでそのまま追加、ビデオならアバターの上に重ねる
  card.appendChild(el);
}

async function start() {
  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = "接続中...";
  }

  try {
    // トークンの取得
    const token = await fetch(`/token?identity=user-${Math.floor(Math.random() * 10000)}`)
      .then(res => res.json())
      .then(data => data.token);

    // Roomインスタンス作成
    const room = new Room({ adaptiveStream: true, dynacast: true });
    
    // 他の人が入室してきたら枠を作る
    room.on(RoomEvent.ParticipantConnected, (participant) => {
      createParticipantCard(participant);
    });

    // 他の人が退室したら枠を消す
    room.on(RoomEvent.ParticipantDisconnected, (participant) => {
      removeParticipantCard(participant);
    });

    // 映像・音声が流れてきたら、その人のカードに紐付ける
    room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      handleTrackAttach(track, participant);
    });

    // ルームへの接続
    await room.connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    if (connectBtn) {
      connectBtn.textContent = "通話中";
    }

    // 自分のカードを画面に作成
    createParticipantCard(room.localParticipant);

    // すでに部屋にいる他の人たちのカードを全員分作成して、映像があれば流す
    room.remoteParticipants.forEach((participant) => {
      createParticipantCard(participant);
      participant.trackPublications.forEach((publication) => {
        if (publication.track) {
          handleTrackAttach(publication.track, participant);
        }
      });
    });

    // 自分のカメラを有効化（デバイスがない場合はスキップ）
    try {
      await room.localParticipant.setCameraEnabled(true);
      room.localParticipant.videoTrackPublications.forEach((publication) => {
        if (publication.videoTrack) {
          handleTrackAttach(publication.videoTrack, room.localParticipant);
        }
      });
    } catch (cameraErr) {
      console.warn("カメラがありません:", cameraErr);
    }

    // 自分のマイクを有効化（デバイスがない場合はスキップ）
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (micErr) {
      console.warn("マイクがありません:", micErr);
    }

  } catch (err) {
    console.error(err);
    alert("接続に失敗しました: " + err.message);
    if (connectBtn) {
      connectBtn.disabled = false;
      connectBtn.textContent = "通話に参加";
    }
  }
}

const connectBtn = document.getElementById("connect-btn");
if (connectBtn) {
  connectBtn.addEventListener("click", start);
}
