import os
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# 公式の正しいインポート方法
from livekit.api import AccessToken, VideoGrants

# Renderの環境変数（Environment Variables）から取得
API_KEY = os.environ.get("LIVEKIT_API_KEY")
API_SECRET = os.environ.get("LIVEKIT_API_SECRET")
ROOM_NAME = os.environ.get("LIVEKIT_ROOM_NAME", "team-room")

app = FastAPI()

# 静的ファイルの配信設定
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

@app.get("/token")
def get_token(identity: str):
    # 1. 環境変数が設定されているかチェック
    if not API_KEY or not API_SECRET:
        return {"error": "LIVEKIT_API_KEY または LIVEKIT_API_SECRET が設定されていません"}

    try:
        # 2. ビデオ参加用の権限（Grant）を作成
        grant = VideoGrants(room_join=True, room=ROOM_NAME)
        
        # 3. トークンを発行して署名
        token = AccessToken(API_KEY, API_SECRET)
        token.with_identity(identity)
        token.with_grants(grant)
        
        # 4. JavaScript側が読めるようにJSONを返す
        return {"token": token.to_jwt()}
        
    except Exception as e:
        return {"error": "トークン生成中にエラーが発生しました", "detail": str(e)}
