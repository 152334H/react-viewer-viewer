import LF from 'localforage';
import {blobToOURL, blobToText, Images, ReducedImages, URLToBlob} from './ImageState';
import {notifyPromise} from './UI';
import {SessionState} from './Viewer'
import {saveObjAsJSON} from './ViewerButtons';
import axios, {AxiosInstance} from 'axios'

function checkForID(s: SessionState) {
  if (typeof s.id === 'undefined')
    throw Error(`.id not found in ${s}!`)
}
class SessionAPI {
  sessions: SessionState[];
  api?: AxiosInstance;

  constructor(remote?: {url: string, pw: string}) {
    const p = (async (): Promise<SessionAPI> => {
      if (remote) {
        const res = await axios
          .post(`${remote.url}/login`, {
            password: remote.pw
          }, {withCredentials: true});
        const {token} = res.data
        if (!token) throw Error("Could not login")
        //
        this.api = axios.create({
          baseURL: remote.url,
          headers: {
            'Authorization': `bearer ${token}`
          },
          timeout: 1000,
          validateStatus: (stat: number) =>
            (200 <= stat && stat < 300) || (stat === 409),
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
        this.sessions = (await this.api.get('/sessions')).data
      } else {
        this.sessions = await LF.getItem('sessions').then(loadSessionsSilent);
      }
      return this
    })();
    notifyPromise(p, 'loading saved sessions...');
    return p as unknown as SessionAPI; // dumb hack for typescript
  }
  upload_image(f: File) {
    if (this.api) throw Error("TODO")
    return blobToOURL(f)
  }
  async upload_OURL(url: string) {
    const b = await URLToBlob(url);
    const formData = new FormData();
    const name = `a.${b.type.split('/').pop()}`;
    formData.append('img', b, name)
    const res = await this.api.post('/images/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    })
    return res.data.url
  }
  async fixSrcs(sess: SessionState) {
    const srcs: any = {};
    for (const im of sess.imgs) { // intentionally do this sequentially
      if (im.src.slice(0,5) === 'blob:') {
        srcs[im.src] = srcs[im.src] ?? await this.upload_OURL(im.src)
        im.src = srcs[im.src];
      }
    }
    return sess;
  }
  // these functions return promises that can be either awaited or ignored.
  append(sess: SessionState) {
    const p = this.append_(sess)
    notifyPromise(p, 'creating session...');
    return p;
  }
  async append_(sess: SessionState) {
    this.sessions.push(sess);
    if (this.api) {
      const res = await this.api.post<{id: string;}>('/sessions', sess);
      sess.id = res.data.id;
      return console.log(this.sessions);
    } else {
      return saveSessionsSilent(this.sessions);
    }
  }
  remove(i: number) {
    const p = this.remove_(i)
    notifyPromise(p, 'deleting session...');
    return p;
  }
  remove_(i: number) {
    const removed = this.sessions[i];
    this.sessions.splice(i,1);
    if (this.api) {
      checkForID(removed);
      return this.api.delete(`/sessions/${removed.id}`);
    } else {
      return saveSessionsSilent(this.sessions);
    }
  }
  edit(i: number, sess: SessionState) {
    const p = this.edit_(i, sess);
    notifyPromise(p, 'pushing session...');
    return p;
  }
  async edit_(i: number, sess: SessionState) {
    this.sessions[i] = sess;
    if (this.api) {
      checkForID(sess);
      await this.fixSrcs(sess); // this SHOULD mutate this.sessions[i]
      return await this.api.put(`/sessions/${sess.id}`, sess); // dangerous, because this promise could take a long while to finish actually
    } else {
      return await saveSessionsSilent(this.sessions);
    }
  }
  async export() {
    const savedSess = await saveSessionSilentGeneric(this.sessions, 'B64');
    return saveObjAsJSON(
      savedSess, `sessions-${Date.now()}`
    );
  }
  // can be double-awaited to wait for saving
  async import(f: File) {
    const stored: StoredSession[] = JSON
      .parse(await blobToText(f));
    const sessions = await loadSessionsSilent(stored)
    //
    if (this.api) {
      await this.api.delete('/sessions/', { data: {
        confirm: 'YES I AM REALLY DELETING EVERYTHING'
      }});
      for (const sess of sessions) {
        await this.fixSrcs(sess)
        await this.append(sess)
      }
    }
    else {
      return await saveSessionsSilent(this.sessions);
    }
  }
  // end weird functions
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

async function saveSessionSilentGeneric(sessions: SessionState[], type: 'Blob' | 'B64') {
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

async function saveSessionsSilent(sessions: SessionState[]) {
  const res = await saveSessionSilentGeneric(sessions, "Blob");
  return await LF.setItem('sessions', res);
}

export {SessionAPI, StoredSession}

