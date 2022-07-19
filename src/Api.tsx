import LF from 'localforage';
import {blobToOURL, blobToText, Images, ReducedImages} from './ImageState';
import {notifyPromise} from './UI';
import {SessionState} from './Viewer'
import {saveObjAsJSON} from './ViewerButtons';
import axios, {AxiosInstance} from 'axios'

class SessionAPI {
  sessions: SessionState[];
  api?: AxiosInstance;

  constructor(remote?: {url: string, pw: string}) {
    return (async (): Promise<SessionAPI> => {
      if (remote) {
        const res = await axios
          .post(`${remote.url}/login`, {
            password: remote.pw
          });
        const {token} = res.data
        if (!token) throw Error("Could not login")
        //
        this.api = axios.create({
          baseURL: remote.url,
          headers: {
            'Authorization': `bearer ${token}`
          },
          timeout: 1000,
        });
        this.api.interceptors.response.use(res => {
          console.log(`got response ${res}`)
          return res;
        }, err => {
          console.log('API ERROR HAPPENED')
          console.log(err);
          debugger;
          return Promise.reject(err);
        });
        this.sessions = await this.api.get('/sessions')
      } else {
        this.sessions = await loadSessions();
      }
      return this
    })() as unknown as SessionAPI;
  }
  // these functions return promises that can be either awaited or ignored.
  append(sess: SessionState) {
    this.sessions.push(sess);
    if (this.api) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  remove(i: number) {
    this.sessions.splice(i,1)
    if (this.api) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  edit(i: number, sess: SessionState) {
    this.sessions[i] = sess;
    if (this.api) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  async export() {
    const savedSess = await saveSessionSilent(this.sessions, 'B64');
    return saveObjAsJSON(
      savedSess, `sessions-${Date.now()}`
    );
  }
  // can be double-awaited to wait for saving
  async import(f: File) {
    const stored: StoredSession[] = JSON
      .parse(await blobToText(f));
    this.sessions = await loadSessionsSilent(stored)
    //
    if (this.api) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  // end weird functions
  async upload_image(f: File) {
    if (this.api) throw Error("TODO")
    return blobToOURL(f)
  }
}

interface StoredSession extends Omit<SessionState,'imgs'> {
  imgs_r: ReducedImages;
}

async function loadSessionsSilent(compSessions: StoredSession[]) {
  if (compSessions === null) return [];
  const sessions = await Promise.all(compSessions.map(async (sess) => {
    const imgs = await ReducedImages.fromObj(sess.imgs_r).intoImgs();
    const {imgs_r, ...rest} = sess;
    return {...rest, imgs};
  }));
  return sessions;
}

function loadSessions() {
  const p = LF.getItem('sessions').then(loadSessionsSilent);
  notifyPromise(p, 'loading saved sessions...');
  return p
}

async function saveSessionSilent(sessions: SessionState[], type: 'Blob' | 'B64') {
  const meth = (r: ReducedImages) => (
    type === 'Blob' ? r.intoBlobs() :
                      r.intoB64()
  );
  const reduce = (imgs: Images) => meth(new ReducedImages(imgs))
  return await Promise.all(sessions.map(async s => {
    const {imgs, ...rest} = s;
    return {
      ...rest, imgs_r: await reduce(imgs),
    }
  }));
}


function saveSessions(sessions: SessionState[]) {
  const p = saveSessionSilent(sessions, "Blob")
    .then(res => LF.setItem('sessions', res));
  notifyPromise(p, 'saving sessions...');
  return p
}

export {SessionAPI, StoredSession}
