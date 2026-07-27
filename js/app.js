// js/app.js の先頭をこれに
import { connect } from "https://esm.sh/livekit-client";


const LIVEKIT_URL = "wss://webrtc-wtj5ox8r.livekit.cloud";

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

    // 2. ルームへの接続
    const room = await connect(LIVEKIT_URL, token);
    console.log("ルームに接続しました:", room.name);

    // 3. 自分のカメラとマイクを有効化
    await room.localParticipant.setCameraEnabled(true);
    await room.localParticipant.setMicrophoneEnabled(true);

    // 4. 自分の映像を画面に表示
    room.localParticipant.videoTrackPublications.forEach((publication) => {
      if (publication.track) {
        const el = publication.track.attach();
        document.getElementById("videos").appendChild(el);
      }
    });

    room.localParticipant.on("trackPublished", (publication) => {
      if (publication.kind === "video" && publication.track) {
        const el = publication.track.attach();
        document.getElementById("videos").appendChild(el);
      }
    });

    // 5. 他の参加者の映像・音声を受信して表示
    room.on("trackSubscribed", (track, publication, participant) => {
      const el = track.attach();
      document.getElementById("videos").appendChild(el);
    });

    // 6. 離脱したときの処理
    room.on("trackUnsubscribed", (track) => {
      track.detach().forEach(el => el.remove());
    });

    if (connectBtn) {
      connectBtn.textContent = "通話中";
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
