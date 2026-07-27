import { Room, RoomEvent } from "https://esm.sh";

const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";

// 画面にカメラや音声のトラックを追加する共通関数
function handleTrackAttach(track) {
  // すでに同じトラックが画面に追加されていないかチェック（重複防止）
  if (document.getElementById(track.sid)) return;

  const el = track.attach();
  el.id = track.sid; // トラックのIDを要素に付与して管理
  document.getElementById("videos").appendChild(el);
}

async function start() {
  const connectBtn = document.getElementById("connect-btn");
  if (connectBtn) {
    connectBtn.disabled = true;
    connectBtn.textContent = "接続中...";
  }

  try {
    // 1. トークンの取得
    const token = await fetch(`/token?identity=user-${Math.floor(Math.random() * 10000)}`)
      .then(res => res.json())
      .then(data => data.token);

    // 2. Roomインスタンスを作成
    const room = new Room({ adaptiveStream: true, dynacast: true });
    
    // 3. 【新入室後に配信が始まった場合】の受信イベント（後から配信が開始された時用）
    room.on(RoomEvent.TrackSubscribed, (track) => {
      handleTrackAttach(track);
    });

    // 4. 他の人が離脱、またはカメラをオフにしたときの処理
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      const el = document.getElementById(track.sid);
      if (el) el.remove();
      track.detach().forEach(e => e.remove());
    });

    // 5. ルームへの接続を実行
    await room.connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    if (connectBtn) {
      connectBtn.textContent = "通話中";
    }

    // ★6. 【最重要：すでに部屋にいる人たち】の映像と音声を一斉に取得して表示する
    room.remoteParticipants.forEach((participant) => {
      participant.trackPublications.forEach((publication) => {
        // すでに配信中のトラックがあれば画面（またはスピーカー）に追加
        if (publication.track) {
          handleTrackAttach(publication.track);
        }
      });
    });

    // 7. 自分のカメラを有効化（デバイスがない場合はスキップ）
    try {
      await room.localParticipant.setCameraEnabled(true);
      
      // カメラがある場合のみ、自分の映像を画面に表示
      room.localParticipant.videoTrackPublications.forEach((publication) => {
        if (publication.videoTrack) {
          handleTrackAttach(publication.videoTrack);
        }
      });
    } catch (cameraErr) {
      console.warn("このデバイスにはカメラがないか、許可されていません:", cameraErr);
    }

    // 8. 自分のマイクを有効化（デバイスがない場合はスキップ）
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (micErr) {
      console.warn("このデバイスにはマイクがないか、許可されていません:", micErr);
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

// 「通話に参加」ボタンのクリックイベントに紐付ける
const connectBtn = document.getElementById("connect-btn");
if (connectBtn) {
  connectBtn.addEventListener("click", start);
}
