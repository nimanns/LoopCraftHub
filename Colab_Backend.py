from audiocraft.models import musicgen
from audiocraft.utils.notebook import display_audio
import torch
import torchaudio
import locale
from fastapi import Request, FastAPI, UploadFile, Form, File
from pyngrok import ngrok
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import nest_asyncio
import uvicorn
from io import BytesIO
import base64

#Load the model
model = musicgen.MusicGen.get_pretrained('facebook/musicgen-melody')
model.set_generation_params(duration=15)
waveform = None
seed_type = None

app = FastAPI()

origins = [
    "http://localhost",
    "http://localhost:8080",
    "http://127.0.0.1:8000",

]

app.add_middleware(
  CORSMiddleware,
  allow_origins=origins,
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]
)


@app.post('/generate-audio')
async def generate_audio(request: Request):
  try:
    data = await request.json()
    promptFromClient = data["input"]["prompt"]
    model.set_generation_params(duration=15)
    audio = model.generate([promptFromClient])

    global waveform
    waveform = audio

    global seed_type
    seed_type = 0

    numpy_array = audio.detach().cpu().numpy()
    python_list = numpy_array.tolist()

    d = {
      "prompt": promptFromClient,
      "audio": python_list,
    }

    json_compatible_item_data = jsonable_encoder(d)
    return JSONResponse(content=json_compatible_item_data)

  except Exception as e:
    return {"error": str(e)}


@app.post("/upload-audio-base64")
async def upload_audio_base64(encoded_audio: str):
    try:
        # Decode base64 string to bytes
        audio_bytes = base64.b64decode(encoded_audio)

        # Load audio into torchaudio
        buffer = BytesIO(audio_bytes)
        global waveform
        waveform, sample_rate = torchaudio.load(buffer)

        # Process the waveform as needed
        # ...

        return JSONResponse(content={"message": "Audio file processed successfully"}, status_code=200)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@app.post('/upload-audio')
async def upload_audio(audio: UploadFile):
    try:
        audio_data = await audio.read()

        # Load the audio using Torchaudio
        global waveform
        waveform = torchaudio.load(BytesIO(audio_data))
        model.set_generation_params(duration=int(len(waveform[0][1])/waveform[1]))
        global seed_type
        seed_type = 1
        # Perform audio processing or analysis here if needed

        # For this example, let's just return a summary of the audio
        audio_summary = {
            "sample_rate": waveform[1],
            # "num_channels": waveform.shape[0],
            # "num_frames": waveform.shape[1],
            "duration": int(len(waveform[0][1])/waveform[1]),
        }

        return audio_summary
    except Exception as e:
        return {'error': str(e)}

@app.post("/")
async def get_body(request: Request):
  data = await request.json()
  promptFromClient = data["input"]["prompt"]
  print(promptFromClient)

  audio = None
  if seed_type == 0:
    audio = model.generate_with_chroma([promptFromClient], waveform[0].expand(1, -1, -1), 32000)
  elif seed_type == 1:
    audio = model.generate_with_chroma([promptFromClient], waveform[0].expand(1, -1, -1), waveform[1])
  numpy_array = audio.detach().cpu().numpy()
  python_list = numpy_array.tolist()

  python_list
  d = {
    "prompt": promptFromClient,
    "audio": python_list,
  }
  json_compatible_item_data = jsonable_encoder(d)
  return JSONResponse(content=json_compatible_item_data)

ngrok.set_auth_token("AUTH_TOKEN")
ngrok_tunnel = ngrok.connect(8000, "http", domain="DOMAIN")

print('Public URL', ngrok_tunnel.public_url)

nest_asyncio.apply()
uvicorn.run(app, port=8000)
