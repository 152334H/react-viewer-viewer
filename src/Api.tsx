/* Stub to mock up API design until I actually implement it
*/

import LF from 'localforage';
import {Images, ReducedImages} from './ImageState';
import {notifyPromise} from './UI'
import {SessionState} from './Viewer'
import {saveObjAsJSON} from './ViewerButtons'

interface StoredSession extends Omit<SessionState,'imgs' | 'flattened'> {
  imgs_r: ReducedImages;
  flattened_r: ReducedImages | null;
}
interface SessionStub {
  i: number,
  name: string
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

//
// fake API
//
const sessionFromImages = (imgs: Images): SessionState => ({
  imgs, flattened: null, show: false,
  name: `session-${Date.now()}`, activeIndex: 0
});
let _sessions: SessionState[] = [];
const listSessions = async () => {
  if (!_sessions.length) _sessions = await loadSessions();
  return _sessions.map((sess,i) => ({
    name: sess.name, i
  }));
}
const rmSession = async (i: number) => {
  if (i < _sessions.length) {
    _sessions = _sessions.slice(0,i).concat(_sessions.slice(i+1));
    await saveSessions(_sessions);
  }
}
const getSession = async (i: number) => {
  return i < _sessions.length ? _sessions[i] : sessionFromImages([]);
}
const setSession = async (i: number, sess: SessionState) => {
  if (i === _sessions.length) _sessions.push(sess);
  else _sessions[i] = sess;
  saveSessions(_sessions);
}
const dumpSessions = async () => {
  saveSessionSilent(_sessions, 'B64')
  .then(savedSess => saveObjAsJSON(
    savedSess, `sessions-${Date.now()}`
  ))
}
const pushSessions = async (stored: StoredSession[]) => {
  _sessions = await loadSessionsSilent(stored);
  return await listSessions();
}

export {listSessions, rmSession, getSession, setSession, SessionStub, dumpSessions, pushSessions};
