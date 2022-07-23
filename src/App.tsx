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
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
// other imports
import {ToastContainer} from 'react-toastify';
// imports developed / edited for project
import ViewerSession,{SessionState} from './Viewer'
import {Images} from './ImageState'
import {IconButtonSimple,UploadButton} from './UI'
import {SessionAPI} from './Api';
import {IconButton, InputAdornment, TextField} from '@mui/material';
import {Visibility, VisibilityOff} from '@mui/icons-material';

const SaveSessionsButton = ({save}: {
  save: () => void,
}) => (<IconButtonSimple icon={<DownloadIcon/>}
  onClick={() => {
    save()
  }}
/>)

const LoadSessionsButton = ({load}: {
  load: (f: File) => void,
}) => (<UploadButton icon={<UploadIcon/>}
  onChange={(e) => {
    const f: File = e.target.files[0];
    load(f);
  }} id="icon-button-load-all-sessions"
/>)

const sessionFromImages = (imgs: Images): SessionState => ({
  imgs, name: `session-${Date.now()}`, activeIndex: 0
});

const Settings = ({open,onClose}: {
  open: boolean,
  onClose: () => void,
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
      There's nothing here right now...
    </Box>
  </Modal>)
}

const MainMenu = ({sessions,logout,create,select,remove,load,save}: {
  sessions: SessionState[],
  logout: () => void,
  create: () => void,
  select: (i: number) => void,
  remove: (i: number) => void,
  load: (f: File)  => void,
  save: () => void,
}) => {
  const [showSettings, setShowSettings] = React.useState(false);
  return (<>
    <div style={{float:'right'}}>
      <IconButtonSimple icon={<SettingsIcon/>}
        onClick={()=>setShowSettings(true)} />
      <IconButtonSimple icon={<LogoutIcon/>}
        onClick={logout} />
    </div>
    <Settings open={showSettings} onClose={() => setShowSettings(false)} />
    <LoadSessionsButton load={load}/>
    <SaveSessionsButton save={save}/>
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

const RealApp = ({api,logout}: {
  api: SessionAPI,
  logout: () => void,
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
    }} load={(f: File) => {
        if (window.confirm("WARNING: YOU ARE ABOUT TO DELETE EVERYTHING\nCLOSE THE PAGE IF THIS IS UNDESIRED")) {
          api.import(f).then(
            () => setSessions(api.sessions.slice())
          )
        } else throw Error("stopped that")
    }} save={() => api.export()} logout={logout}
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

const Login = ({initialURL,login}: {
  initialURL: string,
  login: (url: string, pw: string) => void,
}) => {
  const [showPW, setShowPW] = React.useState(false)
  const [badURL, setBadURL] = React.useState(false)

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
  return <Box sx={style}>
    <form onSubmit={e => {
      e.preventDefault();
      const f = e.target as any;
      login(f.url.value, f.password.value)
    }}>
      Sync images to <span style={{color: 'grey'}}>(empty means no sync)</span>:<p></p>
      <TextField placeholder="https://.../api"
        label="URL" color="secondary" focused
        fullWidth={true} name="url" error={badURL}
        helperText={badURL ? 'Invalid API URL' : undefined}
        type='url' defaultValue={initialURL}
        onChange={e => {
          const url = e.target.value;
          setBadURL(!(url === '' || /^https?:\/\/.*\/api$/.test(url)))
        }}
      />
      <p></p>
      <TextField placeholder="hunter2" type={
          showPW ? 'text' : 'password'
        } label="password" color="primary" focused
        fullWidth={true} name="password"
        InputProps={{
          endAdornment: <InputAdornment position="end">
            <IconButton color="primary"
              component="span" onClick={() =>
                setShowPW(!showPW)
            }>
            { showPW ? <Visibility/> : <VisibilityOff/> }
            </IconButton>
          </InputAdornment>
        }}
      />
      <IconButton color="primary" type="submit">
        <LoginIcon/>
      </IconButton>
    </form>
  </Box>
}

const Prelude = () => {
  const [api, setAPI] = React.useState(undefined);
  const [cachedURL, setCachedURL] = React.useState(null);
  const [err, setErr] = React.useState(undefined);
  React.useEffect(() => setCachedURL(
    localStorage.getItem('syncURL') || ""
  ), []);

  return cachedURL === null ? <>loading...</> :
    api ? <RealApp api={api} logout={() => setAPI(undefined)}/> : <>
      <Login initialURL={cachedURL} login={
        (url,pw) => {
          localStorage.setItem('syncURL', url);
          (async () => {
            const d = url ? {url,pw} : undefined;
            const p = new SessionAPI(d) as unknown;
            setAPI(await p as Promise<SessionAPI>);
          })().then(() => setErr(undefined))
          .catch(setErr); // TODO: prettify
      }}/>
      {err ? <p>{`${err}`}</p> : <></>}
    </>
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
