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
   * implement remote storage (and make sure it's safe from sudden mass deletion!)
*/

// react imports
import * as React from 'react';
// MUI imports
import {createTheme, ThemeProvider} from '@mui/material/styles'
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import InputBase from '@mui/material/InputBase';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Modal from '@mui/material/Modal';
// MUI Icons
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import SettingsIcon from '@mui/icons-material/Settings';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
// other imports
import {ToastContainer} from 'react-toastify';
import AwesomeDebouncePromise from 'awesome-debounce-promise';
// imports developed / edited for project
import ViewerSession,{SessionState} from './Viewer'
import {blobToText} from './ImageState'
import {IconButtonSimple,UploadButton} from './UI'
import {listSessions, rmSession, getSession, setSession, SessionStub, dumpSessions, pushSessions} from './Api'

const SaveSessionsButton = () => (
  <IconButtonSimple icon={<DownloadIcon/>}
    onClick={dumpSessions}
/>)

const LoadSessionsButton = ({setSessions}: {
  setSessions: (s: SessionStub[]) => void
}) => (<UploadButton icon={<UploadIcon/>}
  onChange={(e) => {
    const f: File = e.target.files[0];
    blobToText(f).then((s: string) => {
      return pushSessions(JSON.parse(s));
    }).then(setSessions)
  }} id="icon-button-load-all-sessions"
/>)

const Settings = ({open,onClose,syncURL,setSyncURL}: {
  open: boolean,
  onClose: () => void,
  syncURL: string,
  setSyncURL: (s: string) => void,
}) => {
  const style = {
    position: 'absolute',
    top: '50%', left: '50%',
    transform: 'translate(-50%,-50%)',
    bgcolor: 'background.paper',
    border: '2px solid #fff',
    boxShadow: 24,
    p: 2,
    width: 350,
  }
  return (<Modal
    open={open}
    onClose={onClose}
    aria-labelledby="modal-settings"
    aria-describedby="modal-settings"
  >
    <Box sx={style}>
      Sync images to <span style={{color: 'grey'}}>(empty means no sync)</span>:<br></br>
      <InputBase placeholder="https://..." value={syncURL} fullWidth={true}
        onChange={(e:any) => setSyncURL(e.target.value)} sx={{
          borderLeft: '8px solid #111',
          borderBottom: '1px solid #555'
      }}/>
      {syncURL && (<>
        <IconButtonSimple icon={<CloudUploadIcon/>} onClick={() => {
          alert("TODO: implement this");
        }} title="push images to remote"/>
        <IconButtonSimple icon={<CloudDownloadIcon/>} onClick={() => {
          alert("TODO: implement this");
        }} title="pull images from remote"/>
      </>)}
    </Box>
  </Modal>)
}

const commitSyncURL = AwesomeDebouncePromise(
  (s: string) => localStorage.setItem('syncURL', s),
500); // this CANNOT be defined in MainMenu, because re-rendering will redefine the function && break debouncing
const MainMenu = ({sessions,select,setSessions}: {
  sessions: SessionStub[],
  setSessions: (ss: SessionStub[]) => void,
  select: (i: null|number, rm?: boolean) => void
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  const [syncURL,setSyncURL] = React.useState("");
  React.useEffect(() => setSyncURL(localStorage.getItem('syncURL')), []);
  const changeSyncURL = (s: string) => {
    setSyncURL(s);
    commitSyncURL(s);
  }
  return (<>
    <div style={{float:'right'}}>
      <IconButtonSimple icon={<SettingsIcon/>}
        onClick={()=>setShowSettings(true)} />
    </div>
    <Settings open={showSettings} onClose={() => setShowSettings(false)}
      syncURL={syncURL} setSyncURL={changeSyncURL} />
    <LoadSessionsButton setSessions={setSessions}/>
    <SaveSessionsButton/>
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
}

const RealApp = () => {
  type CurrentSession = null|{sess: SessionState, i: number};
  const [sessions,setSessions] = React.useState<SessionStub[]>([]);
  const [current,setCurrent] = React.useState<CurrentSession>(null);

  // TODO: stop using reload
  const reload = () => {listSessions().then(setSessions);}
  React.useEffect(reload, []);

  return (<> {current === null ?
    <MainMenu select={(i,rm=false) => {
      if (i === null) {
        i = sessions.length;
        /* don't bother writing this blank session to localstorage */
      }
      if (rm) {
        rmSession(i).then(reload);
      } else {
        getSession(i).then(sess => setCurrent({sess,i}));
      }
    }} sessions={sessions} setSessions={setSessions}/> :
    <ViewerSession sess={current.sess}
      goBack={sess => {
        if (sess.imgs.length) {
          setSession(current.i, sess).then(reload);
        } else {
          // we don't know whether this was a blank unsaved session,
          // or an older saved-but-now-deleted session,
          // so just push a db save
          rmSession(current.i).then(reload);
        }
        setCurrent(null);
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
