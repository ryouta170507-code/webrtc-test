// ===============================
// 1. グローバル変数
// ===============================
const ws = new WebSocket("ws://127.0.0.1:8000/ws/signal");
let peerConnection = null;
let localStream = null;

// WebRTC の ICE サーバー設定（次はネット上でできるか確認)
const config = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" }
    ]
  };
  


// ===============================
// 2. ページ読み込み時：マイク＆カメラ起動
// ===============================
window.onload = async () => {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });

        // 自分の映像を表示
        document.getElementById("localVideo").srcObject = localStream;

        document.getElementById("status").innerText =
            "マイク準備完了！相手の接続を待っています...";
    } catch (err) {
        console.error("マイク/カメラの取得に失敗", err);
        document.getElementById("status").innerText =
            "エラー： マイク・カメラの使用を許可してください。";
    }
};


// ===============================
// 3. WebSocket 接続完了 → ボタンを有効化
// ===============================
ws.onopen = () => {
    document.getElementById("startButton").disabled = false;
};


// ===============================
// 4. シグナリングメッセージ受信
// ===============================
ws.onmessage = async (event) => {
    if (!event.data) return;

    const message = JSON.parse(event.data);
    console.log("受信したシグナリング:", message);

    if (!peerConnection) {
        setupPeerConnection();
    }

    // --- SDP（名刺）を受信した場合 ---
    if (message.sdp) {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(message.sdp)
        );

        if (message.sdp.type === "offer") {
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ sdp: peerConnection.localDescription }));
        }
    }

    // --- ICE candidate（住所）を受信した場合 ---
    else if (message.candidate) {
        await peerConnection.addIceCandidate(
            new RTCIceCandidate(message.candidate)
        );
    }
};


// ===============================
// 5. PeerConnection のセットアップ
// ===============================
function setupPeerConnection() {
    peerConnection = new RTCPeerConnection(config);

    // 自分の音声・映像を WebRTC に追加
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    // ICE candidate を相手へ送信
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    document.getElementById("status").innerText =
        "🎉 通話中！お互いの声が聞こえる状態です";

    // 相手の映像・音声を受信
    peerConnection.ontrack = (event) => {
        console.log("相手のトラックを受信:", event.streams[0]);

        // 相手の映像
        document.getElementById("remoteVideo").srcObject = event.streams[0];

        // 相手の音声
        document.getElementById("remoteAudio").srcObject = event.streams[0];
    };
}


// ===============================
// 6. 発信ボタンを押したとき
// ===============================
async function startCall() {
    document.getElementById("status").innerText = "発信中...";

    setupPeerConnection();

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    ws.send(JSON.stringify({ sdp: peerConnection.localDescription }));
}
