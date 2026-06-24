import os
import sys
import pkgutil
import importlib
import importlib.util
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Load secrets from environment
API_KEY = os.environ.get("APISBA8ZqwtvMy5")
API_SECRET = os.environ.get("ThsA0eBIX1277b3KSbH3xGyEgtfkZkxyzdJmV3QjeeVC")
ROOM_NAME = os.environ.get("LIVEKIT_ROOM_NAME", "team-room")

app = FastAPI()

# --- Debug endpoints (temporary) ---
@app.get("/debug")
def debug():
    installed = sorted([m.name for m in pkgutil.iter_modules()])
    spec_livekit_api = importlib.util.find_spec("livekit_api")
    spec_livekit = importlib.util.find_spec("livekit")
    return {
        "python_version": sys.version,
        "sys_path_sample": sys.path[:6],
        "livekit_api_spec": None if spec_livekit_api is None else {"name": spec_livekit_api.name, "origin": getattr(spec_livekit_api, "origin", None)},
        "livekit_spec": None if spec_livekit is None else {"name": spec_livekit.name, "origin": getattr(spec_livekit, "origin", None)},
        "installed_sample": installed[:80]
    }

@app.get("/debug4")
def debug4():
    spec = importlib.util.find_spec("livekit")
    if spec is None:
        return {"error": "livekit spec not found"}
    locations = list(spec.submodule_search_locations) if spec.submodule_search_locations else None
    samples = {}
    if locations:
        for loc in locations:
            try:
                samples[loc] = sorted(os.listdir(loc))
            except Exception as e:
                samples[loc] = f"error listing: {e}"
    import_results = {}
    for candidate in ("livekit", "livekit.access", "livekit.tokens", "livekit.api", "livekit.auth"):
        try:
            m = __import__(candidate, fromlist=["*"])
            import_results[candidate] = {
                "imported": True,
                "file": getattr(m, "__file__", None),
                "attrs_sample": sorted([a for a in dir(m) if not a.startswith("_")])[:200]
            }
        except Exception as e:
            import_results[candidate] = {"imported": False, "error": str(e)}
    return {"python": sys.version, "locations": locations, "samples": samples, "import_results": import_results}

# --- Static files and index ---
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
def read_index():
    return FileResponse("index.html")

# --- Helper: dynamic resolver for AccessToken and Grant class ---
def resolve_livekit_classes():
    """
    Return (AccessTokenClass, GrantClass) or raise ImportError with helpful message.
    This tries common locations and falls back to scanning modules for names ending with 'Grant'.
    """
    # Try direct livekit.api import first
    try:
        api_mod = importlib.import_module("livekit.api")
    except Exception:
        api_mod = None

    # AccessToken
    AccessToken = None
    if api_mod and hasattr(api_mod, "AccessToken"):
        AccessToken = getattr(api_mod, "AccessToken")
    else:
        # try top-level livekit
        try:
            top = importlib.import_module("livekit")
            if hasattr(top, "AccessToken"):
                AccessToken = getattr(top, "AccessToken")
        except Exception:
            pass

    if AccessToken is None:
        raise ImportError("AccessToken not found in livekit package. Check installation.")

    # VideoGrant or any *Grant
    VideoGrant = None
    # 1) direct attributes on api_mod
    if api_mod:
        for name in dir(api_mod):
            if name.lower().endswith("grant"):
                VideoGrant = getattr(api_mod, name)
                break
    # 2) common submodules under livekit.api
    if VideoGrant is None:
        for sub in ("grants", "tokens", "access", "api", "auth"):
            try:
                submod = importlib.import_module(f"livekit.api.{sub}")
                for name in dir(submod):
                    if name.lower().endswith("grant"):
                        VideoGrant = getattr(submod, name)
                        break
                if VideoGrant:
                    break
            except Exception:
                pass
    # 3) top-level submodules
    if VideoGrant is None:
        try:
            top = importlib.import_module("livekit")
            for sub in ("grants", "tokens", "access", "api", "auth"):
                try:
                    submod = importlib.import_module(f"livekit.{sub}")
                    for name in dir(submod):
                        if name.lower().endswith("grant"):
                            VideoGrant = getattr(submod, name)
                            break
                    if VideoGrant:
                        break
                except Exception:
                    pass
        except Exception:
            pass

    if VideoGrant is None:
        raise ImportError("VideoGrant (or any *Grant class) not found in livekit package. Run debug endpoints and share output.")

    return AccessToken, VideoGrant

# --- Token endpoint ---
@app.get("/token")
def get_token(identity: str):
    # Validate secrets
    if not API_KEY or not API_SECRET:
        return {"error": "LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set in environment"}

    try:
        AccessToken, VideoGrant = resolve_livekit_classes()
    except Exception as e:
        return {"error": "cannot import AccessToken/VideoGrant", "detail": str(e)}

    grant = VideoGrant(room_join=True, room=ROOM_NAME)
    token = AccessToken(API_KEY, API_SECRET)
    token.identity = identity
    token.add_grant(grant)
    return {"token": token.to_jwt()}
