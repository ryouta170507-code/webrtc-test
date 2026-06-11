from fastapi import FastAPI, WebSocket, WebSocketDisconnect

app = FastAPI()

connected_clients: list[WebSocket] = []

@app.websocket("/ws/signal")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.append(websocket)
    print(f"【ログ】新しいクライアントが接続しました。現在の接続数: {len(connected_clients)}")

    # 1. ここから try がスタート（スペース4つ）
    try:
        # 2. try の中はスペース8つ
        while True:
            # 3. while の中はスペース12個
            data = await websocket.receive_text()
            print(f"【ログ】受信したデータ: {data}")

            for client in connected_clients:
                if client != websocket:
                    await client.send_text(data)
            
    # 4. except は try と同じ縦のライン（スペース4つ）に合わせる！
    except WebSocketDisconnect:
        # 5. except の中はスペース8つ
        connected_clients.remove(websocket)
        print(f"【ログ】クライアントが切断しました。現在の接続数: {len(connected_clients)}")