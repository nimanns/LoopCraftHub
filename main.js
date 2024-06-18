const url = "COLAB_ENDPOINT_URL_PLACEHOLDER";
let players = [];
let audioFile;
let audioName;
let audioData = [];
let id = 0;
let trackCount = 0;
const reverb = new Tone.Reverb(10).toDestination();

import {
  set,
  child,
  getDatabase,
  onValue,
  get,
  push,
  update,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

const firebaseConfig = {
  apiKey: "YOUR_API_KEY_PLACEHOLDER",
  authDomain: "YOUR_AUTH_DOMAIN_PLACEHOLDER",
  databaseURL: "YOUR_DATABASE_URL_PLACEHOLDER",
  projectId: "YOUR_PROJECT_ID_PLACEHOLDER",
  storageBucket: "YOUR_STORAGE_BUCKET_PLACEHOLDER",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID_PLACEHOLDER",
  appId: "YOUR_APP_ID_PLACEHOLDER",
  measurementId: "YOUR_MEASUREMENT_ID_PLACEHOLDER",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase(app);
const dbRef = ref(database);

const storage = getStorage();
const listRef = ref(storage);

listAll(listRef).then((res) => {
  trackCount = res.items.length;
  res.items.forEach((itemRef) => {
    getDownloadURL(itemRef).then((url) => {
      getURLAndAddTrack(url, false);
    });
  });
});

function audioBufferToWavBlob(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bitDepth = 16; // 16-bit audio
  const samples = audioBuffer.getChannelData(0); // Assuming mono audio

  const dataLength = samples.length * numberOfChannels * (bitDepth / 8);
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // Sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, numberOfChannels, true); // Number of channels
  view.setUint32(24, sampleRate, true); // Sample rate
  view.setUint32(28, sampleRate * numberOfChannels * (bitDepth / 8), true); // Byte rate
  view.setUint16(32, numberOfChannels * (bitDepth / 8), true); // Block align
  view.setUint16(34, bitDepth, true); // Bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, dataLength, true);

  // Write audio sample data
  for (let i = 0; i < samples.length; i++) {
    const offset = 44 + i * (bitDepth / 8);
    view.setInt16(offset, samples[i] * 0x7fff, true);
  }

  // Create a blob from the buffer
  const blob = new Blob([view], { type: "audio/wav" });
  return blob;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

function downsampleArray(inputArray, targetSize) {
  const factor = Math.ceil(inputArray.length / targetSize);
  const outputArray = [];

  for (let i = 0; i < targetSize; i++) {
    let start = i * factor;
    let end = (i + 1) * factor;
    if (end > inputArray.length) {
      end = inputArray.length;
    }

    // Calculate the average of the subarray
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += inputArray[j];
    }
    const average = sum / (end - start);

    outputArray.push(average);
  }

  return outputArray;
}

function constrain(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function reverseConstrain(value, min, max) {
  return max - (value - min);
}

function mapRange(value, fromMin, fromMax, toMin, toMax) {
  // Calculate the percentage of the value within the "from" range
  const percentage = (value - fromMin) / (fromMax - fromMin);

  // Map the percentage to the "to" range and return the result
  return toMin + percentage * (toMax - toMin);
}

function apiCallForPromptAudio(prompt) {
  const data = {
    input: {
      prompt,
    },
  };
  console.log(data);
  // Define the request headers
  const headers = {
    "Content-Type": "application/json",
  };

  // Make a POST request using the Fetch API
  fetch(url + "generate-audio", {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data),
  })
    .then((response) => {
      return response.json();
    })
    .then((result) => {
      const prompt = result.prompt;
      const audio = result.audio;
      console.log(`Prompt: ${prompt}`);
      const floatArray = audio[0][0];
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const sampleRate = 32000;
      const buffer = audioContext.createBuffer(
        1,
        floatArray.length,
        sampleRate
      );

      const channelData = buffer.getChannelData(0); // Get the channel data (mono in this example)

      for (let i = 0; i < floatArray.length; i++) {
        channelData[i] = floatArray[i];
      }

      // Create a blob from the WAV data
      const blob = audioBufferToWavBlob(buffer);

      const storageRef = ref(storage, username + "-" + id.toString() + ".wav");
      uploadBytes(storageRef, blob).then((snapshot) => {
        console.log(snapshot);
        getDownloadURL(snapshot.ref).then((url) => {
          getURLAndAddTrack(url);
          document.querySelector("#loading").style.display = "none";
          trackCount++;
        });
      });
    });
}

window.formSubmit = function (event) {
  //check to see which option is selected
  event.preventDefault();
  document.querySelector("#loading").style.display = "block";
  const selectedIndex = document.querySelector("select").selectedIndex;
  if (selectedIndex == 0) {
    prompt = document.querySelector("input#prompt").value;
    if (prompt === "") {
      alert("Please fill out the prompt field");
      return;
    }
    document.querySelector("input#prompt").value = "";
    apiCallForPromptAudio(prompt);
  } else {
    const audioInput = document.getElementById("audioInput");
    const audioFile = audioInput.files[0];
    audioName = audioFile.name;

    if (audioFile) {
      const formData = new FormData();
      formData.append("audio", audioFile);
      console.log(formData);
      fetch(url + "upload-audio", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          // Handle the response data here
          document.querySelector("#loading").style.display = "none";
          getURLAndAddTrack("/" + audioName);
          trackCount++;
        })
        .catch((error) => {
          console.error("Error:", error);
        });
    } else {
      console.log("No audio file selected.");
    }
  }
  closeModal();
  // duration = parseInt(document.querySelector("input#duration").value);
  // console.log(duration);
};

window.formSubmit2 = function (event) {
  event.preventDefault();
  /* const trackNum = parseInt(document.querySelector("input#track-num").value);
      if (isNaN(trackNum)) {
        alert("Please fill out the track number field");
        return;
      }

      if (trackNum >= trackCount) {
        alert("Track number is too high");
        return;
      } */
  document.querySelector("#loading").style.display = "block";
  // const audioBlob = audioBufferToWavBlob(players[trackNum].buffer);

  // const formData = new FormData();
  // formData.append("audio", audioBlob, "audio.wav");
  prompt = document.querySelector("input#prompt").value;
  const data2 = {
    input: {
      prompt,
    },
  };
  const headers = {
    "Content-Type": "application/json",
  };

  // Make a POST request using the Fetch API
  fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(data2),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .then((result) => {
      const prompt = result.prompt;
      const audio = result.audio;
      const floatArray = audio[0][0];
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const sampleRate = 32000;
      const buffer = audioContext.createBuffer(
        1,
        floatArray.length,
        sampleRate
      );

      const channelData = buffer.getChannelData(0); // Get the channel data (mono in this example)

      for (let i = 0; i < floatArray.length; i++) {
        channelData[i] = floatArray[i];
      }

      // Create a blob from the WAV data
      const blob = audioBufferToWavBlob(buffer);

      const storageRef = ref(storage, username + "-" + id.toString() + ".wav");
      uploadBytes(storageRef, blob).then((snapshot) => {
        getDownloadURL(snapshot.ref).then((url) => {
          document.querySelector("#loading").style.display = "none";
          getURLAndAddTrack(url);
          trackCount++;
        });
      });
    });

  closeModal();

  // document.querySelector("#initial-form").style.display = "flex";
  // document.querySelector("#regular-form").style.display = "none";
  // document.querySelector(".modal").style.display = "flex";
};

document.querySelector("div#add-track").addEventListener("click", () => {
  if (trackCount > 0) {
    openModal(1);
  } else {
    openModal(0);
  }
});

function openModal(modalNumber) {
  // Create modal container
  var modal = document.createElement("div");
  modal.className = "modal";

  // Create modal content
  // var modalContent = document.createElement("div");
  // modalContent.className = "modal-content";

  // Create close button
  var closeButton = document.createElement("span");
  closeButton.innerHTML = "&times;"; // '×' character for the close button
  closeButton.className = "close-btn";

  // Add click event to close the modal
  closeButton.onclick = function () {
    document.body.removeChild(modal);
  };

  // Append close button to modal content
  // modalContent.prepend(closeButton);

  // Add your content to the modal here
  // For example, you can add a message or form inputs
  let temp = document.getElementsByTagName("template")[modalNumber];
  let clon = temp.content.cloneNode(true);
  // Append modal content to modal container
  modal.appendChild(clon);

  // Append modal container to the document body
  document.body.appendChild(modal);

  // Display the modal
  modal.style.display = "flex";
}

function getURLAndAddTrack(url, play = true) {
  let outerDiv = document.createElement("div");
  outerDiv.classList.add("track-container");
  let div = document.createElement("div");
  //write the id on a paragraph tag and put it in the div
  let p = document.createElement("p");
  p.innerHTML = id;
  p.style.position = "absolute";
  p.style.top = "40px";
  p.style.left = "90px";
  p.style.zIndex = 22;
  p.style.fontSize = "2em";
  p.style.font = "bold";
  p.style.pointerEvents = "none";
  div.appendChild(p);
  //center the paragraph
  let innerDiv = document.createElement("div");
  innerDiv.classList.add("ball");
  div.classList.add("track");
  div.appendChild(innerDiv);
  outerDiv.appendChild(div);
  // div.style.left = `${Math.random() * 80}vw`;
  // div.style.top = `${Math.random() * 80}vh`;
  div.id = id;

  const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
  innerDiv.style.backgroundColor = color;
  document.querySelector("div#track-area").prepend(outerDiv);
  players[id] = new Tone.Player(url).toDestination();
  players[id].fadeIn = 0.9;
  players[id].fadeOut = 0.9;
  players[id].chain(reverb, Tone.Destination);
  //send the buffer as a blob to a server
  let idd = id;
  id++;
  Tone.loaded().then(() => {
    innerDiv.addEventListener("click", (el) => {
      if (el.target instanceof HTMLInputElement) return;
      if (players[idd]?.state === "started") {
        players[idd].stop();
        div.style.opacity = 0.1;
      } else {
        players[idd]?.start();
        div.style.opacity = 1;
      }
    });

    players[idd].loop = true;
    if (play) {
      players[idd].start();
    } else {
      div.style.opacity = 0.1;
    }
    // Access the sample values
    const audioBuffer = players[idd].buffer;

    const volumeCanvas = document.createElement("canvas");
    volumeCanvas.width = 300;
    volumeCanvas.height = 300;
    volumeCanvas.style.position = "absolute";
    volumeCanvas.style.top = "-50px";
    volumeCanvas.style.left = "-50px";
    div.appendChild(volumeCanvas);
    let actualVolume = 0;
    let volume = 2.2;
    const volumeCanvasRadius = 120;
    function drawKnob() {
      const ctx = volumeCanvas.getContext("2d");
      ctx.clearRect(0, 0, 300, 300);
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.strokeStyle = lightenHSLColor(color, 0.3);
      ctx.lineWidth = 15;
      ctx.arc(150, 150, volumeCanvasRadius, Math.PI / 1.2, 2.2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = "black";
      ctx.beginPath();
      ctx.lineWidth = 4;

      ctx.arc(150, 150, volumeCanvasRadius, Math.PI / 1.2, volume * Math.PI);

      ctx.stroke();
    }

    drawKnob();

    let mousemoveListener; // Declare a variable to hold the mousemove event listener function

    volumeCanvas.addEventListener("mousedown", (e) => {
      mousemoveListener = (e) => {
        volume = constrain(
          (reverseConstrain(e.offsetY, 0, 300) / 300) * 2.2,
          0.85,
          2.2
        );
        actualVolume = mapRange(volume, 0.85, 2.2, -20, 0);
        players[idd].volume.value = actualVolume;
        drawKnob();
      };

      volumeCanvas.addEventListener("mousemove", mousemoveListener);
    });

    // Remove the "mousemove" listener when the mouse is released
    volumeCanvas.addEventListener("mouseup", () => {
      volumeCanvas.removeEventListener("mousemove", mousemoveListener);
    });
    document.addEventListener("mouseup", () => {
      volumeCanvas.removeEventListener("mousemove", mousemoveListener);
    });

    // Access the sample data for a specific channel (e.g., channel 0 for left channel)
    const channelData = audioBuffer.getChannelData(0);
    audioData[idd] = downsampleArray(channelData, 200);
    const factor = Math.pow(10, 3 / 20);
    audioData[idd] = audioData[idd].map((sample) => sample * factor);
    // Get the canvas element and its context
    var canvas = document.createElement("canvas");
    //set hight and width of canvas
    canvas.width = 300;
    canvas.height = 300;
    //set absolute position
    // canvas.style.position = "absolute";
    canvas.style.top = "-50px";
    canvas.style.left = "-50px";
    canvas.style.zIndex = 21;
    //set pointer events
    canvas.style.pointerEvents = "none";
    //append canvas to div
    div.appendChild(canvas);
    var ctx = canvas.getContext("2d");

    // Circle properties
    var centerX = canvas.width / 2;
    var centerY = canvas.height / 2;
    var radius = 100;

    // Number of vertices (more vertices create a smoother circle)
    var numVertices = 200;
    // Animation duration for one full loop (in milliseconds)
    var loopDuration = 1000;

    // Calculate the time interval for each frame
    var interval = loopDuration / numVertices;

    // Function to draw a frame of the animation with noisy vertices
    let animationStartTime;

    let audioDuration = players[idd].buffer.duration;
    // Function to draw a frame of the animation with noisy vertices using audio data
    function drawFrame(timestamp) {
      if (players[idd].state === "stopped") {
        animationStartTime = timestamp;
        requestAnimationFrame(drawFrame);
        return;
      }

      // Calculate the angle increment for each vertex
      var angleIncrement = (2 * Math.PI) / numVertices;
      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Begin the path for the noisy circle
      ctx.beginPath();

      // Calculate the current progress (portion of the circle to be drawn)
      // var progress = currentFrame / numVertices;
      if (!animationStartTime) {
        animationStartTime = timestamp;
      }

      const progress =
        (timestamp - animationStartTime) / (audioDuration * 1000);

      const dataPointIndex = Math.floor(audioData[idd].length * progress);

      // Draw vertices up to the current progress with audio data and noise
      for (var i = 1; i <= dataPointIndex; i++) {
        var angle = -Math.PI / 2 + i * angleIncrement;
        var adjustedRadius = radius + audioData[idd][i] * 500;
        let x = centerX + adjustedRadius * Math.cos(angle);
        let y = centerY + adjustedRadius * Math.sin(angle);
        ctx.lineTo(x, y);
      }

      // Close the path to create the noisy circle
      ctx.stroke();
      currentFrame++;
      currentFrame = (currentFrame + 1) % numVertices;

      // Request the next frame if the progress is not complete
      if (progress < 1) {
        // setTimeout(drawFrame, interval);
        requestAnimationFrame(drawFrame);
      } else if (progress >= 1) {
        animationStartTime = null;
        requestAnimationFrame(drawFrame);
      }
    }

    var currentFrame = 0;

    // Start the animation
    requestAnimationFrame(drawFrame);
  });
}

function lightenHSLColor(inputColor, factor) {
  var hslRegex = /hsl\(([\d.]+), ([\d.]+)%, ([\d.]+)%\)/;
  var matches = inputColor.match(hslRegex);

  if (matches) {
    var hue = parseFloat(matches[1]);
    var saturation = parseFloat(matches[2]);
    var lightness = parseFloat(matches[3]);

    // Increase lightness by a factor (e.g., 0.7 makes it 30% lighter)
    lightness = Math.round(
      Math.min(100, lightness + (100 - lightness) * factor)
    );

    // Construct the new HSL color string
    var newColorString = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    return newColorString;
  } else {
    // If the input format is not recognized, return the original color
    return inputColor;
  }
}
async function downloadAndUpload(urll) {
  const fileUrl = urll;

  try {
    const fileBlob = await downloadFile(fileUrl);
    await uploadFile(fileBlob);
  } catch (error) {
    console.error(error);
  }
}

async function downloadFile(urll) {
  const response = await fetch(urll);

  if (!response.ok) {
    throw new Error(
      `Failed to download file from URL. Status: ${response.status}`
    );
  }

  return response.blob();
}
