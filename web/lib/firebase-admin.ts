import * as admin from 'firebase-admin';

let authInstance: admin.auth.Auth;

function initializeAdmin() {
  if (authInstance) {
    return authInstance;
  }

  let serviceAccount: any;

  // 優先從 FIREBASE_ADMIN_KEY 讀取完整的 JSON（Cloud Run 部署方式）
  if (process.env.FIREBASE_ADMIN_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
    } catch (error) {
      console.error('Failed to parse FIREBASE_ADMIN_KEY:', error);
      throw new Error('Invalid FIREBASE_ADMIN_KEY environment variable');
    }
  }
  // 否則從個別環境變數讀取（本地開發方式）
  else {
    serviceAccount = {
      type: process.env.FIREBASE_ADMIN_TYPE,
      project_id: process.env.FIREBASE_ADMIN_PROJECT_ID,
      private_key_id: process.env.FIREBASE_ADMIN_PRIVATE_KEY_ID,
      private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      client_id: process.env.FIREBASE_ADMIN_CLIENT_ID,
      auth_uri: process.env.FIREBASE_ADMIN_AUTH_URI,
      token_uri: process.env.FIREBASE_ADMIN_TOKEN_URI,
      auth_provider_x509_cert_url: process.env.FIREBASE_ADMIN_AUTH_PROVIDER_X509_CERT_URL,
      client_x509_cert_url: process.env.FIREBASE_ADMIN_CLIENT_X509_CERT_URL,
    };
  }

  // 初始化 Firebase Admin SDK（避免重複初始化）
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  authInstance = admin.auth();
  return authInstance;
}

export function getAuth() {
  return initializeAdmin();
}
