/**
 * MCP OAuth 2.1 Authorization Endpoint
 *
 * GET /api/oauth/mcp/authorize
 *
 * Claude Code opens the user's browser to this URL.
 * We store the OAuth state (PKCE, redirect_uri) in a secure cookie,
 * then redirect to Firebase Auth (Google Sign-In).
 *
 * Query params (from Claude Code):
 *   - client_id
 *   - redirect_uri
 *   - response_type=code
 *   - code_challenge
 *   - code_challenge_method=S256
 *   - state
 *   - scope (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

const ALLOWED_CODE_CHALLENGE_METHODS = ["S256"];

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const responseType = url.searchParams.get("response_type");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const state = url.searchParams.get("state");
  const scope = url.searchParams.get("scope") || "read:tasks read:knowledge read:profile write:inbox write:knowledge";

  // Validate required parameters
  if (!clientId) {
    return errorResponse("invalid_request", "client_id is required");
  }
  if (!redirectUri) {
    return errorResponse("invalid_request", "redirect_uri is required");
  }
  if (responseType !== "code") {
    return errorResponse("unsupported_response_type", "Only response_type=code is supported");
  }
  if (!codeChallenge) {
    return errorResponse("invalid_request", "code_challenge is required (PKCE)");
  }
  if (!codeChallengeMethod || !ALLOWED_CODE_CHALLENGE_METHODS.includes(codeChallengeMethod)) {
    return errorResponse("invalid_request", "code_challenge_method must be S256");
  }

  // Generate a session nonce to link the Firebase callback back to this request
  const sessionNonce = randomBytes(32).toString("base64url");

  // Store OAuth state in a secure cookie (encrypted in production)
  const oauthState = JSON.stringify({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    state: state || "",
    scope,
    nonce: sessionNonce,
  });

  // Build the Firebase Auth sign-in URL
  // We redirect the user to our own callback page that handles Firebase auth
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || `${url.protocol}//${url.host}`;
  const callbackUrl = `${apiBaseUrl}/api/oauth/mcp/callback`;

  // Encode oauth state as a query param to the callback
  // In production, this should be stored server-side (e.g., Redis/DB) and only pass a session ID
  const encodedState = Buffer.from(oauthState).toString("base64url");

  // For Firebase Auth, we redirect to a simple HTML page that triggers Google Sign-In
  // and posts the result to our callback endpoint
  const html = buildSignInPage(callbackUrl, encodedState);

  const response = new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

  // Set the OAuth state in an httpOnly cookie as backup
  response.cookies.set("mcp_oauth_state", encodedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/api/oauth/mcp",
  });

  return response;
}

function errorResponse(error: string, description: string) {
  return NextResponse.json(
    { error, error_description: description },
    { status: 400 },
  );
}

/**
 * Build a simple HTML page that:
 * 1. Shows "Sign in with Google" to authorize Zentropy MCP access
 * 2. Uses Firebase Auth JS SDK for the sign-in flow
 * 3. Posts the Firebase ID token to our callback endpoint
 *
 * Security: All dynamic values are injected via a JSON data block and
 * read by JS at runtime, avoiding inline interpolation in HTML/JS context.
 */
function buildSignInPage(callbackUrl: string, encodedState: string): string {
  const firebaseConfig = process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    ? process.env.NEXT_PUBLIC_FIREBASE_CONFIG
    : JSON.stringify({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
      });

  // Inject all dynamic values as a single JSON blob in a <script type="application/json">.
  // This avoids XSS from string interpolation inside executable JS context.
  const pageData = JSON.stringify({
    callbackUrl,
    encodedState,
    firebaseConfig: JSON.parse(
      typeof firebaseConfig === "string" && firebaseConfig.startsWith("{")
        ? firebaseConfig
        : `{"apiKey":"","authDomain":"","projectId":""}`,
    ),
  });

  return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Zentropy — 授權 MCP 存取</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0a0a0a; color: #e0e0e0;
      display: flex; align-items: center; justify-content: center;
      min-height: 100vh;
    }
    .card {
      background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
      padding: 40px; max-width: 420px; width: 100%; text-align: center;
    }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #888; margin-bottom: 32px; font-size: 14px; }
    .scopes { text-align: left; margin: 20px 0; padding: 16px;
      background: #111; border-radius: 8px; font-size: 13px; }
    .scopes li { margin: 4px 0; list-style: none; }
    .scopes li::before { content: "\\2713 "; color: #4ade80; }
    button {
      background: #fff; color: #000; border: none; border-radius: 8px;
      padding: 12px 24px; font-size: 16px; cursor: pointer;
      width: 100%; font-weight: 600; margin-top: 16px;
    }
    button:hover { background: #e0e0e0; }
    button:disabled { background: #555; color: #999; cursor: wait; }
    .error { color: #ef4444; margin-top: 12px; font-size: 13px; }
    .spinner { display: none; margin: 20px auto; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Zentropy</h1>
    <p class="subtitle">授權外部 AI 工具存取你的 Zentropy 資料</p>
    <ul class="scopes">
      <li>讀取任務與專案</li>
      <li>讀取知識庫</li>
      <li>寫入想法到 Inbox</li>
      <li>寫入知識庫</li>
    </ul>
    <button id="signInBtn" onclick="startSignIn()">使用 Google 帳號登入並授權</button>
    <div id="spinner" class="spinner">處理中...</div>
    <p id="error" class="error"></p>
  </div>

  <script id="page-data" type="application/json">${escapeJsonForHtml(pageData)}</script>

  <script type="module">
    import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
    import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

    const pageData = JSON.parse(document.getElementById("page-data").textContent);
    const app = initializeApp(pageData.firebaseConfig);
    const auth = getAuth(app);

    window.startSignIn = async function() {
      const btn = document.getElementById("signInBtn");
      const spinner = document.getElementById("spinner");
      const errorEl = document.getElementById("error");

      btn.disabled = true;
      spinner.style.display = "block";
      errorEl.textContent = "";

      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();

        // POST the Firebase ID token to our callback endpoint
        const form = document.createElement("form");
        form.method = "POST";
        form.action = pageData.callbackUrl;

        const tokenInput = document.createElement("input");
        tokenInput.type = "hidden";
        tokenInput.name = "id_token";
        tokenInput.value = idToken;
        form.appendChild(tokenInput);

        const stateInput = document.createElement("input");
        stateInput.type = "hidden";
        stateInput.name = "oauth_state";
        stateInput.value = pageData.encodedState;
        form.appendChild(stateInput);

        document.body.appendChild(form);
        form.submit();
      } catch (err) {
        btn.disabled = false;
        spinner.style.display = "none";
        errorEl.textContent = "登入失敗: " + (err.message || "Unknown error");
        console.error("Sign-in error:", err);
      }
    };
  </script>
</body>
</html>`;
}

/**
 * Escape a JSON string for safe embedding inside a <script type="application/json"> tag.
 * The only dangerous sequence is `</script` which would terminate the tag early.
 */
function escapeJsonForHtml(json: string): string {
  return json.replace(/<\//g, "<\\/");
}
