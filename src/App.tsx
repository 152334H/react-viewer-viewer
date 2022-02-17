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
import Add from '@mui/icons-material/Add';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import ViewerSession from './Viewer'
import {Images} from './ViewerButtons'
import {IconButtonSimple,isTauri} from './UI'

const MainMenu = ({sessions,select}: {
  sessions: Images[],
  select: (i: null|number) => void
}) => (<>
  <IconButtonSimple icon={<Add/>} onClick={() => select(null)}/>
  {sessions.length>0 && <div><List>
    {sessions.map((sess,i) => <ListItem key={i}
        onClick={() => select(i)}>
      <ListItemText>{i}</ListItemText>
    </ListItem>)}
  </List></div>}
</>)

//TODO:figure out the right type for sessions (maybe not pure Images[]?)
//TODO:change sessions to use localstorage
const App = () => {
  let [menu,setMenu] = React.useState('main');
  let [vind,setVind] = React.useState(null);
  let [sessions,setSessions] = React.useState([]);
  return (<React.Fragment>
    <ThemeProvider theme={createTheme({
        palette: { mode : 'dark' }
    })}>
    <CssBaseline/>
    {menu === 'main' ?
      <MainMenu select={i => {
        if (i === null) {
          i = sessions.length;
          // [[]] is disturbing
          setSessions(sessions.concat([[]]));
        }
        setVind(i);
        setMenu('viewer')
      }} sessions={sessions}/> :
      <ViewerSession sess={sessions[vind]}
      goBack={sess => setSessions(sessions => {
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
