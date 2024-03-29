﻿# LoopCraftHub

This is a web application that allows users to generate audio loops using text prompts or by uploading audio files. The loops can be arranged on a grid, played, manipulated and downloaded.

**Main Functions:**

- **Generate audio from text prompt**
  - Sends prompt to backend API which returns generated audio
  - Audio is converted to a WAV blob and uploaded to Firebase Storage

- **Upload audio file**
  - Allows user to select an audio file which is uploaded to the backend
  - Backend saves the file and returns the file path
  - A track element is created from the audio file URL

- **Create track element**
  - Generates div with audio player, canvas for visualizations, and controls
  - Audio is played through Tone.js player with effects added
  - Canvas visualizes audio buffer and animates along with playback

- **Manipulate tracks**
  - Volume, play/pause controls for each track
  - Tracks can be repositioned by dragging
  - More tracks can be added through prompts or uploads

- **Save/load from Firebase**
  - User sessions are stored on Firebase realtime database
  - Tracks are uploaded to Firebase storage
  - Sessions are loaded by retrieving storage download URLs

**Main Components:**
- **Index HTML page**
  - Holds UI elements like forms, track grid
  - Templates for prompt and upload modals

- **Tone.js**
  - Web Audio library that handles sound playback
  - Effects like reverb can be added

- **Firebase**
  - Stores user sessions data like track positions
  - Audio files are stored on Firebase Storage

- **Canvas visualizations**
  - Each track has a canvas that visualizes the audio
  - Animates along with the audio playback

**The code handles the following:**
- UI interactions
- Audio playback
- Visualizations
- Firebase integration to allow users to create, manipulate, and save audio loops.


# Backend With Google Colab

A backend with the musicgen model is required for this service to work, I will post the colab code in this repo once I implement the full functionality.
