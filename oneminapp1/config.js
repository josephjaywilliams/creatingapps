// Paste the Apps Script web app URL here (ends in /exec). See backend/README.md.
// While it's empty, the page shows the app but the sign-up form says "opening soon".
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxF2p7_pjmWqdMVQBcVJqdPP_Gt8juOQSxPg7KC51T3LMYQBtJw_r_y2uXhAsNY5n6b/exec";

// Send an action to the backend. Apps Script doesn't answer CORS requests, so this is
// fire-and-forget: text/plain keeps it a "simple" request and no-cors skips reading the reply.
function post(payload) {
  return fetch(BACKEND_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
}
