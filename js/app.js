import { connect } from "livekit-client";

const LIVEKIT_URL = "wss://YOUR-LIVEKIT-URL.livekit.cloud";

async function start() {
  const token = await fetch(`/token?identity=user-${Math.random()}`)
    .then(res => res.json())
    .then(data => data.token);

  const room = await connect(LIVEKIT_URL, token);

  // 自分の映像を publish
  await room.localParticipant.setCameraEnabled(true);
  await room.localParticipant.setMicrophoneEnabled(true);

  // 他の参加者の映像を受信
  room.on("trackSubscribed", (track, publication, participant) => {
    const el = track.attach();
    document.body.appendChild(el);
  });

  // 離脱したときの処理
  room.on("trackUnsubscribed", (track) => {
    track.detach().forEach(el => el.remove());
  });
}

start();
