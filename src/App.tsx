/* Just a simple extension of react-viewer into a native app.
 * With a few added bells and whistles like:
 * - additional viewer features, like added toolbar buttons
 * - 'pickle'ing the state of the image viewer for future use
 * - saving and restoring the state of various image viewer sessions
 */

/* TODO:
   * fix res => res.blob() <-- chromium issue. Very unlikely to be resolved.
   * draggable preview of images (to reorganise)
   * Drag and drop for file upload? <-- heard that something different needs to be done to impl this in tauri
   * figure out how to accomodate for different zoom values across devices
*/

// react imports
import * as React from 'react';
// MUI imports
import {createTheme, ThemeProvider} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
// MUI Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
// other imports
import LF from 'localforage';
import {ToastContainer} from 'react-toastify';
// imports developed / edited for project
import ViewerSession,{SessionState} from './Viewer'
import {Images,ReducedImages,blobToText} from './ImageState'
import {IconButtonSimple,notifyPromise,UploadButton} from './UI'
import {saveObjAsJSON} from './ViewerButtons'

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

const SaveSessionsButton = ({sessions}: {
  sessions: SessionState[]
}) => (<IconButtonSimple icon={<DownloadIcon/>}
  onClick={() =>
    saveSessionSilent(sessions, 'B64')
      .then(savedSess => saveObjAsJSON(
        savedSess, `sessions-${Date.now()}`
      ))
  }
/>)

const LoadSessionsButton = ({setSessions}: {
  setSessions: (s: SessionState[]) => void
}) => (<UploadButton icon={<UploadIcon/>}
  onChange={(e) => {
    const f: File = e.target.files[0];
    blobToText(f).then((s: string) => {
      const sessions: StoredSession[] = JSON.parse(s);
      return loadSessionsSilent(sessions)
    }).then(setSessions)
  }} id="icon-button-load-all-sessions"
/>)

const sessionFromImages = (imgs: Images): SessionState => ({
  imgs, flattened: null, show: false,
  name: `session-${Date.now()}`, activeIndex: 0
});

const MainMenu = ({sessions,select,setSessions}: {
  sessions: SessionState[],
  setSessions: (ss: SessionState[]) => void,
  select: (i: null|number, rm?: boolean) => void
}) => (<>
  <LoadSessionsButton setSessions={setSessions}/>
  <SaveSessionsButton sessions={sessions}/>
  <IconButtonSimple icon={<AddIcon/>} onClick={() => select(null)}/>
  {sessions.length>0 && <div><List sx={{maxWidth: 400}}>
    {sessions.map((sess,i) =>
      <ListItem key={i} onClick={() => select(i)}
        secondaryAction={<IconButtonSimple
          icon={<DeleteIcon/>} onClick={(e) => {
            e.stopPropagation()
            select(i,true)
          }}
        />}
      >
        <ListItemButton>
          <ListItemText>{sess.name}</ListItemText>
        </ListItemButton>
    </ListItem>)}
  </List></div>}
</>)

const RealApp = () => {
  const [menu,setMenu] = React.useState('main');
  const [vind,setVind] = React.useState(null);
  const [sessions,setSessions] = React.useState<SessionState[]>([]);

  React.useEffect(() => {loadSessions().then(setSessions);}, []);

  const setSaveSessions = (sessions: SessionState[]) => {
    setSessions(sessions);
    saveSessions(sessions); // this will async
  }
  return (<> {menu === 'main' ?
    <MainMenu select={(i,rm=false) => {
      if (i === null) {
        i = sessions.length;
        // don't bother writing this blank session to localstorage
        setSessions(sessions.concat(sessionFromImages([])));
      }
      if (rm) {
        setSaveSessions(sessions
          .slice(0,i).concat(sessions.slice(i+1))
        );
      } else {
        setVind(i);
        setMenu('viewer');
      }
    }} sessions={sessions} setSessions={setSessions}/> :
    <ViewerSession sess={sessions[vind]}
      goBack={sess => {
        if (sess.imgs.length) {
          const newSessions = sessions.slice();
          newSessions[vind] = sess;
          setSaveSessions(newSessions);
          setMenu('main');
        } else {
          // we don't know whether this was a blank unsaved session,
          // or an older saved-but-now-deleted session,
          // so just push a db save
          setSaveSessions(sessions.slice(0,vind).concat(
            sessions.slice(vind+1)))
          setMenu('main');
        }
      }}
    />
  }</>);
}

const App = () => (<>
  <ThemeProvider theme={createTheme({
    palette: { mode : 'dark' }
  })}>
    <CssBaseline/>
    <RealApp/>
  </ThemeProvider>
  <ToastContainer position="top-right"
    autoClose={1000}
    hideProgressBar
    closeOnClick={true}
    draggable={false}
    pauseOnFocusLoss={false}
  />
</>)

export default App
