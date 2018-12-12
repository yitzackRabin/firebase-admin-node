import { getApp, FirebaseApp } from "../firebase-app";
import { Auth } from "./auth";
import { UserRecord } from './user-record';

export function auth(app?: FirebaseApp): Auth {
  if (typeof app === 'undefined') {
    app = getApp();
  }
  return app.getService('auth', () => {
    return new Auth(app);
  });
}

export {Auth, UserRecord};
