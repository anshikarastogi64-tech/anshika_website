Imou Cloud SDK Integration Guide
Objective
Integrate a live camera view from an Imou device into the web application using the Imou Open Platform API. This bypasses local network restrictions (RTSP/Port Forwarding) by using Imou's Cloud-to-Web HLS/FLV streaming.

1. Prerequisites & Credentials
Before running the code, ensure the following credentials from the Imou Open Platform are available:

AppID: YOUR_APP_ID

AppSecret: YOUR_APP_SECRET

Device Serial Number (SN): YOUR_CAMERA_SN

Device Safety Code: YOUR_DEVICE_PASSWORD (Found on the camera sticker)

2. Backend Implementation (Node.js/Express)
The backend must handle authentication to keep the AppSecret private.

Step A: Get Access Token
Create a service to fetch the accessToken from Imou.

Endpoint: https://openapi.lechange.cn/openapi/accessToken

Method: POST

Body (JSON): ```json
{
"params": { "appId": "YOUR_APP_ID", "appSecret": "YOUR_APP_SECRET" },
"id": "1",
"system": { "ver": "1.1", "appId": "YOUR_APP_ID", "time": 1545123456, "nonce": "random_string", "sign": "md5_signature" }
}


Step B: Get Live Stream URL
Once authenticated, fetch the HLS or FLV stream URL for the specific device SN.

API Method: getLiveStreamInfo

Parameter: deviceId (The Serial Number)

3. Frontend Implementation (Web SDK)
Use the Imou H5 Player SDK to render the video.

Step A: Include SDK
Add the Imou Player script to the HTML:

HTML
<script src="https://open.imoulife.com/static/sdk/imouplayer.js"></script>
Step B: Initialize Player
Create a container and initialize the player using the token and URL from the backend.

JavaScript
const player = new ImouPlayer({
  id: 'player-container', // ID of the div
  url: 'STREAM_URL_FROM_BACKEND',
  token: 'ACCESS_TOKEN_FROM_BACKEND',
  devicePassword: 'YOUR_DEVICE_SAFETY_CODE', 
  width: 800,
  height: 450,
  autoplay: true
});

5. Security Notes
Token Caching: Do not request a new accessToken on every page load. Store it in memory or a database and refresh it only when it expires (usually every 24 hours).

CORS: Ensure your backend allows requests from your website domain.

Safety Code: The device safety code is required for decryption. For a production app, handle this via a secure user input field or encrypted environment variable.