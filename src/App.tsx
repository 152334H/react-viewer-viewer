/* Just a simple extension of react-viewer into a native app.
 * With a few added bells and whistles like:
 * - additional toolbar buttons
 * - 'pickle'ing the state of the image viewer for future use
 */

/* TODO:
   * fix res => res.blob()
   * draggable preview of images (to reorganise)
   * Drag and drop for file upload?
   * instead of scattered zips and jsons, create an actual storage (and appropriate listing) for all of the viewerstates
   * Finally implement the no-toolbar mode we originally planned. Will be possible (not incredibly slow) since image flattening from tauri is possible.
   * fix typing
   * merge together relevant state variables into objects. https://reactjs.org/docs/hooks-reference.html use something that isn't useState
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

import ViewerSession from './Viewer'
import {Images} from './ViewerButtons'
import {IconButtonSimple,isTauri} from './UI'

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

function loadSession() {
  if (isTauri()) { window.alert("TODO") }
  else {
    const ls = localStorage.getItem('sessions')
    window.alert("TODO: figure out how to JSON a blob");
    return ls ? JSON.parse(ls) : [];
  }
}

function saveSession(sessions: Images[]) {
  if (isTauri()) { window.alert("TODO") }
  else {
    window.alert("TODO: figure out how to JSON a blob");
    const stored = JSON.stringify(sessions);
    localStorage.setItem('sessions',stored)
  }
}

//TODO:figure out the right type for sessions (maybe not pure Images[]?)
//we should at least add an editable title for sessions
//TODO:change sessions to use localstorage
const App = () => {
  const [menu,setMenu] = React.useState('main');
  const [vind,setVind] = React.useState(null);
  const [sessions,setSessions] = React.useState([]);

  React.useEffect(() => setSessions(loadSession()), []);

  const setSaveSessions = (cb: (sessions: Images[]) => Images[]) =>
    setSessions(sessions => {
      const res = cb(sessions);
      saveSession(res);
      return res;
  });

  return (<React.Fragment>
    <ThemeProvider theme={createTheme({
        palette: { mode : 'dark' }
    })}>
    <CssBaseline/>
    {menu === 'main' ?
      <MainMenu select={(i,rm=false) => {
        if (i === null) {
          i = sessions.length;
          // don't bother writing this blank session to localstorage
          setSessions(sessions.concat([[]]));
        }
        if (rm) {
          setSaveSessions(sessions => sessions
              .slice(0,i).concat(sessions.slice(i+1))
          );
        } else {
          setVind(i);
          setMenu('viewer');
        }
      }} sessions={sessions}/> :
      <ViewerSession sess={sessions[vind]}
      goBack={sess => setSaveSessions(sessions => {
          // sessions should be a clone here?
          sessions[vind] = sess; // or bugged
          setMenu('main');
          return sessions;
      })}/>
    }
    </ThemeProvider>
  </React.Fragment>)
}

export default App
