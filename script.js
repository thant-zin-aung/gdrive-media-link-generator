// IMPORTANT: Replace 'YOUR_GOOGLE_CLIENT_ID' with your actual Client ID from Google Cloud Console.
// Go to Google Cloud Console -> APIs & Services -> Credentials
// Create an OAuth 2.0 Client ID (Web application)
// Add "http://localhost:8000" (or your actual domain) to Authorized JavaScript origins
// Add "http://localhost:8000" (or your actual domain) to Authorized redirect URIs
const CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
const SCOPES = "https://www.googleapis.com/auth/drive.readonly";

// Get references to HTML elements
const authStatusMessage = document.getElementById("auth-status-message");
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const pickBtn = document.getElementById("pick-file-btn");
const videoPlayer = document.getElementById("video-player");
const videoList = document.getElementById("video-list");
const listLoadingMessage = document.getElementById("list-loading-message");
const playerStatus = document.getElementById("player-status");
const appContent = document.getElementById("app-content");

let tokenClient; // Global variable for GIS client

/**
 * Callback function for when the Google API client library (gapi) is loaded.
 */
function gapiLoaded() {
  gapi.load("client", async () => {
    try {
      await gapi.client.init({
        // API Key is not strictly needed for OAuth authenticated calls,
        // but can be included for general project identification/quota tracking if desired.
        // apiKey: "YOUR_API_KEY", // Uncomment and replace if you have one and want to use it
        discoveryDocs: [
          "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest",
        ],
      });
      authStatusMessage.textContent = "Google API client loaded.";
      // Show login button if GIS is also loaded
      if (
        window.google &&
        window.google.accounts &&
        window.google.accounts.oauth2
      ) {
        loginBtn.classList.remove("hidden");
        appContent.classList.remove("hidden");
      }
    } catch (error) {
      console.error("Error initializing GAPI client:", error);
      authStatusMessage.textContent =
        "Error initializing Google API client. Check console for details.";
    }
  });
}

/**
 * Callback function for when the Google Identity Services (GIS) library is loaded.
 */
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id:
      "151654195519-5nk70he7vaf2rts1aru9l0rjf7qhuicq.apps.googleusercontent.com",
    scope: SCOPES,
    callback: (response) => {
      // This callback is executed after the user grants/denies access.
      if (response.error) {
        console.error("Authorization failed:", response.error);
        authStatusMessage.textContent =
          "Authorization failed. Please try again.";
        loginBtn.classList.remove("hidden");
        logoutBtn.classList.add("hidden");
        pickBtn.disabled = true;
        return;
      }
      gapi.client.setToken(response); // Set the obtained access token for gapi client
      authStatusMessage.textContent = "Signed in successfully.";
      loginBtn.classList.add("hidden");
      logoutBtn.classList.remove("hidden");
      pickBtn.disabled = false; // Enable pick button after successful login
      listFiles(); // Automatically list files after sign-in
    },
  });
  authStatusMessage.textContent = "Google Identity Services loaded.";
  // Show login button if GAPI is also loaded
  if (gapi && gapi.client) {
    loginBtn.classList.remove("hidden");
    appContent.classList.remove("hidden");
  }
}

/**
 * Handles the login button click. Requests an access token.
 */
loginBtn.onclick = () => {
  if (tokenClient) {
    tokenClient.requestAccessToken();
  } else {
    authStatusMessage.textContent =
      "Google Identity Services not fully loaded yet. Please wait.";
  }
};

/**
 * Handles the logout button click. Revokes the access token.
 */
logoutBtn.onclick = () => {
  const token = gapi.client.getToken();
  if (token !== null) {
    google.accounts.oauth2.revoke(token.access_token, () => {
      gapi.client.setToken(null); // Clear the token from gapi client
      authStatusMessage.textContent = "Signed out.";
      loginBtn.classList.remove("hidden");
      logoutBtn.classList.add("hidden");
      pickBtn.disabled = true;
      videoList.innerHTML =
        '<p class="text-gray-500 text-center" id="list-loading-message">Click "List My Videos" to load.</p>';
      videoPlayer.src = ""; // Clear video player
      playerStatus.textContent = "No video selected.";
    });
  }
};

/**
 * Handles the pick file button click. Lists video files from Google Drive.
 */
pickBtn.onclick = async () => {
  listLoadingMessage.textContent = "Loading videos...";
  videoList.innerHTML = ""; // Clear previous list items
  try {
    const res = await gapi.client.drive.files.list({
      q: "mimeType contains 'video/' and trashed = false", // Filter for video files not in trash
      fields: "files(id, name, mimeType)", // Request necessary fields
      pageSize: 20, // Limit to 20 files for demonstration
    });

    const files = res.result.files;
    if (!files || files.length === 0) {
      listLoadingMessage.textContent = "No video files found in your Drive.";
      return;
    }

    listLoadingMessage.classList.add("hidden"); // Hide loading message once files are loaded

    files.forEach((file) => {
      const item = document.createElement("div");
      item.className = "video-item";
      item.innerHTML = `
                        <span>${file.name}</span>
                        <button class="btn btn-primary text-sm px-3 py-1 ml-2" data-file-id="${file.id}" data-file-name="${file.name}">Play</button>
                    `;
      item.querySelector("button").onclick = (event) =>
        playVideo(event.target.dataset.fileId, event.target.dataset.fileName);
      videoList.appendChild(item);
    });
  } catch (error) {
    console.error("Error listing files:", error);
    listLoadingMessage.textContent =
      "Error loading videos. Check console for details.";
  }
};

/**
 * Plays the selected video from Google Drive.
 * Fetches the video content as a Blob and creates an object URL.
 * @param {string} fileId The ID of the Google Drive file.
 * @param {string} fileName The name of the video file.
 */
async function playVideo(fileId, fileName) {
  playerStatus.textContent = `Loading "${fileName}"...`;
  videoPlayer.src = ""; // Clear current video source
  videoPlayer.load(); // Load empty to stop previous playback
  videoPlayer.classList.add("hidden"); // Hide player during loading

  try {
    // Show a simple loading spinner/message
    playerStatus.innerHTML = `<div class="loading-spinner"></div> Loading "${fileName}"...`;

    // Fetch the file content using the Drive API with alt=media
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: "media", // This parameter is crucial for getting the file content
    });

    // The response.body is a Blob by default when alt='media' is used with gapi.client
    // Create an object URL from the Blob
    const blob = new Blob([response.body], {
      type: response.headers["Content-Type"] || "video/mp4",
    });
    const videoUrl = URL.createObjectURL(blob);

    videoPlayer.src = videoUrl;
    videoPlayer.classList.remove("hidden"); // Show player
    videoPlayer.play();
    playerStatus.textContent = `Now playing: "${fileName}"`;

    // Revoke the Blob URL when the video is paused or ends to free up memory
    videoPlayer.onpause = () => {
      console.log("Video paused, revoking object URL.");
      URL.revokeObjectURL(videoUrl);
    };
    videoPlayer.onended = () => {
      console.log("Video ended, revoking object URL.");
      URL.revokeObjectURL(videoUrl);
    };
  } catch (error) {
    console.error("Error playing video:", error);
    playerStatus.textContent = `Error playing "${fileName}". Make sure it's a valid video format or you have permission.`;
    videoPlayer.classList.add("hidden"); // Keep player hidden on error
  }
}
