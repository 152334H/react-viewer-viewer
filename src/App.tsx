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
import {Images} from './ImageState'
import {IconButtonSimple,UploadButton} from './UI'
import {SessionAPI} from './Api';

/*
const SaveSessionsButton = ({sessions}: {
  sessions: SessionState[]
}) => (<IconButtonSimple icon={<DownloadIcon/>}
  onClick={() => {
    alert("TODO: implement this")
    /*
    saveSessionSilent(sessions, 'B64')
      .then(savedSess => saveObjAsJSON(
        savedSess, `sessions-${Date.now()}`
      ))
     * /
    }
  }
/>)

const LoadSessionsButton = ({setSessions}: {
  setSessions: (s: SessionState[]) => void
}) => (<UploadButton icon={<UploadIcon/>}
  onChange={(e) => {
    alert("TODO: implement this"); /*
    const f: File = e.target.files[0];
    blobToText(f).then((s: string) => {
      const sessions: StoredSession[] = JSON.parse(s);
      return loadSessionsSilent(sessions)
    }).then(setSessions)
    * /
  }} id="icon-button-load-all-sessions"
/>)
*/

//TODO: get rid of flattened and show
const sessionFromImages = (imgs: Images): SessionState => ({
  imgs, flattened: null, show: false,
  name: `session-${Date.now()}`, activeIndex: 0
});

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
const MainMenu = ({sessions,create,select,remove}: {
  sessions: SessionState[],
  create: () => void,
  select: (i: number) => void,
  remove: (i: number) => void,
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
    {/* TODO: figure out what to do with these 
    <LoadSessionsButton setSessions={setSessions}/>
    <SaveSessionsButton sessions={sessions}/>
      */}
    <IconButtonSimple icon={<AddIcon/>} onClick={create}/>
    {sessions.length>0 && <div><List sx={{maxWidth: 400}}>
      {sessions.map((sess,i) =>
      <ListItem key={i} onClick={() => select(i)}
        secondaryAction={<IconButtonSimple
          icon={<DeleteIcon/>} onClick={(e) => {
            e.stopPropagation()
            remove(i)
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

const RealApp = ({api}: {
  api: SessionAPI,
}) => {
  const [{vind,sessions}, setSess] = React.useState({vind: null, sessions: api.sessions})
  const setVind = (vind: number) => setSess({sessions, vind})
  const setSessions = (sessions: SessionState[]) => setSess({vind, sessions})
 
  return (<> {vind === null ?
    <MainMenu create={() => {
        api.append(sessionFromImages([]));
        setVind(api.sessions.length-1)
    }} select={(i) => {
        setVind(i);
    }} remove={(i) => {
        api.remove(i);
        setSessions(api.sessions.slice())
    }}
    sessions={sessions}/> :
    <ViewerSession sess={api.sessions[vind]}
      goBack={sess => {
        if (sess.imgs.length) {
          api.edit(vind, sess);
        } else { // this is a deletion
          api.remove(vind);
        }
        setSess({sessions: api.sessions.slice(),
                  vind: null})
      }}
    />
  }</>);
}

const Prelude = () => {
  const [api, setAPI] = React.useState(undefined);

  React.useEffect(() => {
    (async () => {
      const api = await (new SessionAPI() as unknown as Promise<SessionAPI>);
      setAPI(api);
    })();
  }, []);

  if (api) return <RealApp api={api}/>
  return <p>loading...</p>
}

const App = () => (<>
  <ThemeProvider theme={createTheme({
    palette: { mode : 'dark' }
  })}>
    <CssBaseline/>
    <Prelude/>
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
