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

    // 他の参加者から字幕データ（publishData）が届いた時の処理
    room.on(RoomEvent.DataReceived, (payload, participant) => {
      if (!participant) return;
      try {
        const str = new TextDecoder().decode(payload);
        const data = JSON.parse(str);
        
        if (data.type === "transcript") {
          // 1. 前半コードの関数を使い、話した相手のカード内に字幕を表示
          displayCaption(participant.sid, data.text);

          // 2. 画面下部に共通の字幕エリアがあればそこも更新
          const captionText = document.getElementById("caption-text");
          if (captionText) {
            captionText.textContent = data.text;
          }

          // ★【ログ記録】相手の発言をダウンロード用履歴に自動保存
          if (data.text.trim() !== "") {
            const rawName = participant.identity || "Unknown";
            const displayName = rawName.split("#")[0]; // 名前の「#数字」をカット
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0]; // 時分秒 (例: 12:05:22)
            
            conversationLogs.push(`[${timeStr}] ${displayName}: ${data.text}`);
          }
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

// 字幕（文字起こし）のオンオフ
document.getElementById("toggle-stt-btn")?.addEventListener("click", (e) => {
  if (!recognition) return;

  if (isTranscribing) {
    recognition.stop();
    isTranscribing = false;
    e.target.textContent = "字幕 ON";
    e.target.classList.remove("active");
    
    // 自分の字幕表示を即座にクリア
    if (currentRoom) {
      const myCaption = document.getElementById(`caption-${currentRoom.localParticipant.sid}`);
      if (myCaption) myCaption.textContent = "";
    }
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

// ★【新機能】「ログを保存」ボタンのクリック処理
document.getElementById("save-log-btn")?.addEventListener("click", () => {
  if (conversationLogs.length === 0) {
    alert("保存する文字起こしログがまだありません。字幕をONにして会話をしてください。");
    return;
  }

  // ログの配列を改行で結合してテキストデータ化
  const logContent = conversationLogs.join("\n");
  const blob = new Blob([logContent], { type: "text/plain;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  
  // 日付付きのファイル名で保存できるようにする (例: meeting_log_2026-07-28.txt)
  const today = new Date().toISOString().split('T')[0];
  link.setAttribute("download", `meeting_log_${today}.txt`);
  
  document.body.appendChild(link);
  link.click();
  
  // 後片付け
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
  
  // ★退室時に会話ログをリセット
  conversationLogs = []; 
  
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
