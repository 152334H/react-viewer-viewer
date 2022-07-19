import LF from 'localforage';
import {blobToOURL, Images, ReducedImages} from './ImageState';
import {notifyPromise} from './UI';
import {SessionState} from './Viewer'


class SessionAPI {
  sessions: SessionState[];
  url: string;
  /*
  auth: string;
   */

  constructor(url?: string) {
    return (async (): Promise<SessionAPI> => {
      if (url) throw Error("TODO")
      this.sessions = await loadSessions();
      return this
    })() as unknown as SessionAPI;
  }
  // these functions return promises that can be either awaited or ignored.
  append(sess: SessionState) {
    this.sessions.push(sess);
    if (this.url) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  remove(i: number) {
    this.sessions.splice(i,1)
    if (this.url) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  edit(i: number, sess: SessionState) {
    this.sessions[i] = sess;
    if (this.url) throw Error("TODO")
    else {
      return saveSessions(this.sessions);
    }
  }
  // end weird functions
  async upload_image(f: File) {
    if (this.url) throw Error("TODO")
    return blobToOURL(f)
  }
}

interface StoredSession extends Omit<SessionState,'imgs' | 'flattened'> {
  imgs_r: ReducedImages;
  flattened_r: ReducedImages | null;
}

async function loadSessionsSilent(compSessions: StoredSession[]) {
  if (compSessions === null) return [];
  const sessions = await Promise.all(compSessions.map(async (sess) => {
    const imgs = await ReducedImages.fromObj(sess.imgs_r).intoImgs();
    const flattened = sess.flattened_r ? await ReducedImages.fromObj(sess.flattened_r).intoImgs() : null;
    const {imgs_r, flattened_r, ...rest} = sess;
    return {...rest, imgs, flattened};
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
    const {imgs, flattened, ...rest} = s;
    return {
      ...rest, imgs_r: await reduce(imgs),
      flattened_r: flattened ? await reduce(flattened) : null
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
