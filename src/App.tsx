/* Just a simple extension of react-viewer into a native app.
 * With a few added bells and whistles like:
 * - additional toolbar buttons
 * - 'pickle'ing the state of the image viewer for future use
 */

/* TODO:
   * fix res => res.blob()
   * draggable preview of images (to reorganise)
   * Drag and drop for file upload?
   * instead of scattered zips and jsons, how about we create an actual directory (and appropriate listing) for all of the viewerstates? This also implies making a new app menu
   * Finally implement the no-toolbar mode we originally planned. Will be possible (not incredibly slow) since image flattening from tauri is possible.
   * add typing
*/

import * as React from 'react';

import {createTheme, ThemeProvider} from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline';
import Add from '@mui/icons-material/Add';

import ViewerSession from './Viewer'
import {IconButtonSimple,isTauri} from './UI'

const MainMenu = ({setMenu}: {setMenu: (_:string) => void}) => (<>
  <IconButtonSimple icon={<Add/>} onClick={() => setMenu('viewer')}/>
  {isTauri() && <div>
    <h1> todo </h1>
  </div>}
</>)

const App = () => {
  let [menu,setMenu] = React.useState('main');
  return (<React.Fragment>
    <ThemeProvider theme={createTheme({
        palette: { mode : 'dark' }
    })}>
    <CssBaseline/>
    {menu === 'main' ?
      <MainMenu setMenu={setMenu}/> :
      <ViewerSession goBack={() => setMenu('main')}/>}
    </ThemeProvider>
  </React.Fragment>)
}

export default App
