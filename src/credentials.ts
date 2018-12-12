/*!
 * Copyright 2017 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Agent} from 'http';
import {
  Credential, CertCredential,
  RefreshTokenCredential, ApplicationDefaultCredential,
} from './auth/credential';


let globalAppDefaultCred: ApplicationDefaultCredential;
const globalCertCreds: { [key: string]: CertCredential } = {};
const globalRefreshTokenCreds: { [key: string]: RefreshTokenCredential } = {};

export function cert(serviceAccountPathOrObject: string | object, httpAgent?: Agent): Credential {
  const stringifiedServiceAccount = JSON.stringify(serviceAccountPathOrObject);
  if (!(stringifiedServiceAccount in globalCertCreds)) {
    globalCertCreds[stringifiedServiceAccount] = new CertCredential(serviceAccountPathOrObject, httpAgent);
  }
  return globalCertCreds[stringifiedServiceAccount];
}

export function refreshToken(refreshTokenPathOrObject: string | object, httpAgent?: Agent): Credential {
  const stringifiedRefreshToken = JSON.stringify(refreshTokenPathOrObject);
  if (!(stringifiedRefreshToken in globalRefreshTokenCreds)) {
    globalRefreshTokenCreds[stringifiedRefreshToken] = new RefreshTokenCredential(
      refreshTokenPathOrObject, httpAgent);
  }
  return globalRefreshTokenCreds[stringifiedRefreshToken];
}

export function applicationDefault(httpAgent?: Agent): Credential {
  if (typeof globalAppDefaultCred === 'undefined') {
    globalAppDefaultCred = new ApplicationDefaultCredential(httpAgent);
  }
  return globalAppDefaultCred;
}
