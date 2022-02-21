/* Just a simple extension of react-viewer into a native app.
 * With a few added bells and whistles like:
 * - additional toolbar buttons
 * - 'pickle'ing the state of the image viewer for future use
 */

/* TODO:
   * fix res => res.blob()
   * draggable preview of images (to reorganise)
   * Drag and drop for file upload?
   * Finally implement the no-toolbar mode we originally planned. Will be possible (not incredibly slow) since image flattening from tauri is possible.
   * fix typing
   * figure out how to accomodate for different zoom values across devices
*/

import * as React from 'react';

import {createTheme, ThemeProvider} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemButton from '@mui/material/ListItemButton';
import Add from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

import LF from 'localforage';
import {ToastContainer} from 'react-toastify';

import ViewerSession from './Viewer'
import {Images,compressImgs,uncompressImgs,ReducedImages} from './ViewerButtons'
import {IconButtonSimple,notifyPromise} from './UI'

const MainMenu = ({sessions,select}: {
  sessions: Images[],
  select: (i: null|number, rm?: boolean) => void
}) => (<>
  <IconButtonSimple icon={<Add/>} onClick={() => select(null)}/>
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
          <ListItemText>{i}</ListItemText>
        </ListItemButton>
    </ListItem>)}
  </List></div>}
</>)

async function loadSessionsSilent() {
  let compSessions: ReducedImages[] = await LF.getItem('sessions');
  if (compSessions === null) return [];
  let sessions = await Promise.all(compSessions.map(async (sess) => {
    return await uncompressImgs(sess, false);
  }));
  return sessions;
}

function loadSessions() {
  const p = loadSessionsSilent();
  notifyPromise(p, 'loading saved sessions...');
  return p
}

function saveSessions(sessions: Images[]) {
  const p = Promise.all(
    sessions.map(s => compressImgs(s,false))
  ).then(sessions => LF.setItem('sessions', sessions));
  notifyPromise(p, 'saving sessions...');
  return p
}

//TODO:figure out the right type for sessions (maybe not pure Images[]?)
//we should at least add an editable title for sessions
//TODO:change sessions to use localstorage
const RealApp = () => {
  const [menu,setMenu] = React.useState('main');
  const [vind,setVind] = React.useState(null);
  const [sessions,setSessions] = React.useState([]);

  React.useEffect(() => {loadSessions().then(setSessions);}, []);

  const setSaveSessions = (sessions: Images[]) => {
    setSessions(sessions);
    saveSessions(sessions); // this will async
  }
  return (<> {menu === 'main' ?
    <MainMenu select={(i,rm=false) => {
      if (i === null) {
        i = sessions.length;
        // don't bother writing this blank session to localstorage
        setSessions(sessions.concat([[]]));
      }
      if (rm) {
        setSaveSessions(sessions
          .slice(0,i).concat(sessions.slice(i+1))
        );
      } else {
        setVind(i);
        setMenu('viewer');
      }
    }} sessions={sessions}/> :
    <ViewerSession sess={sessions[vind]}
      goBack={sess => {
        const newSessions = sessions.slice();
        newSessions[vind] = sess;
        setSaveSessions(newSessions);
        setMenu('main');
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
    closeOnClick={false}
    draggable={false}
    pauseOnFocusLoss={false}
  />
</>)

export default App
