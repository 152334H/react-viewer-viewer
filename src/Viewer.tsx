/* This is the page for a single image viewer sewssion.
*/

import * as React from 'react'
import {FC} from 'react'
// MUI imports
import {KeyboardReturn} from '@mui/icons-material';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
// other imports
// imports developed / edited for project
import Viewer from 'react-viewer'

import {IconButtonSimple} from './UI'
import {ViewerButtons} from './ViewerButtons'

// TODO:move these types somewhere more sensible
import {Images,FullImageState} from './ViewerButtons'

interface ToolbarConfig { // private from react-viewer/ViewerProps
    key: string;
    actionType?: number;
    render?: React.ReactNode;
    onClick?: (activeIm: FullImageState) => void;
}
//const logAndRet = (v:any) => {console.log(v); return v}

// additional toolbar buttons.
// TODO: I haven't figured out how to make these display icons yet
const IconLocal = ({type}: {type:string}) => { // cribbed from react-viewer/Icon.tsx
  const prefixCls = 'react-viewer-icon'
  return <i className={`${prefixCls} ${prefixCls}-${type}`}></i>
}

const swappedImgs = (i: number, j: number, imgs: Images) => {
  // ASSUMES:i !== j, i and j within imgs[]
  //if (j >= imgs.length || i >= imgs.length || j < 0 || i < 0) { return imgs; }
  let res = imgs.slice();
  [res[i], res[j]] = [res[j], res[i]];
  [res[j].alt,res[i].alt] = [j,i];
  return res;
}

type ButtonLambda = (setImgs: (cb: (imgs:Images) => Images) => void, setActiveIndex: (i: number) => void) => ToolbarConfig[];
const makeButtons: ButtonLambda = (setImgs, setActiveIndex) => ([
  {
    key: "dupe",
    render: <IconLocal type="a"/>,
    onClick: activeImage => {
      setImgs(imgs => {
        let newImgs = imgs.slice(0, activeImage.alt);
        newImgs.push(activeImage);
        return newImgs.concat(imgs.slice(activeImage.alt)
          .map(i => ({...i,alt: i.alt+1})))
      })
      setActiveIndex(activeImage.alt+1)
    }
  },
  {
    key: "trash",
    render: <IconLocal type="b"/>,
    onClick: activeImage => {
      setActiveIndex(activeImage.alt ? activeImage.alt-1 : 0)
      setTimeout(() => setImgs(imgs => imgs
        .slice(0, activeImage.alt)
        .concat(imgs
          .slice(activeImage.alt+1)
          .map(i => ({...i,alt: i.alt-1}))
        )
      ), 0) // timeout forces sAI to run first. Needed to prevent oob index when .alt == imgs.length-1.
    }
  },
  {
    key: "shift_picture_left",
    render: <IconLocal type="c"/>,
    onClick: activeImage => {
      const ind = activeImage.alt;
      setImgs(imgs => {
        if (!ind) { return imgs; }
        setActiveIndex(ind-1); // TODO: race?
        return swappedImgs(ind, ind-1, imgs)
      });
    }
  },
  {
    key: "shift_picture_right",
    render: <IconLocal type="d"/>,
    onClick: activeImage => {
      const ind = activeImage.alt;
      setImgs(imgs => {
        if (ind+1 >= imgs.length) {return imgs}
        setActiveIndex(ind+1);
        return swappedImgs(ind, ind+1, imgs);
      });
    }
  }
]);

//TODO: fix this by not using .alt as a silly knowledge backstore
type SimpleViewerProps = {
    setShow: (b: boolean) => void;
    setActiveIndex: (i:number) => void;
    activeIndex: number;
    focused: boolean;
    imgs: any[]; // note: this is really Images, but due to our use of the .alt attribute as a shim...
    addedButtons: any[] // note: this is really ToolbarConfig[], but...
};
// the main component from react-viewer. default options written here
// TODO: fix bug where clicking on image previews in the footer will not save the state of the image the viewer is leaving. Also, check if the rotation bug still exists.
const ViewerButMoreSimple: FC<SimpleViewerProps> = ({setShow, setActiveIndex, activeIndex, focused, imgs, addedButtons}) => {
  return (<Viewer visible={true}
    noFooter={focused} noClose={focused}
    zoomSpeed={0.1}
    drag={true} 
    noResetZoomAfterChange={true}
    noLimitInitializationSize={true}
    maxScale={500}
    onClose={() => setShow(false)}
    images={imgs}
    customToolbar={ls => ls.concat(addedButtons)}
    onIndexChange={setActiveIndex}
    activeIndex={activeIndex}
  />)
}

type SessionState = {
  show: boolean;
  imgs: Images;
  activeIndex: number;
};
type SessionStateCmd = {
  type: string;
  val: any;
}


function insertImage(imgs: Images, im: FullImageState, i: number) {
  im.alt = i;
  const right = imgs.slice(i+1).map(
    im => ({...im, alt: im.alt+1})
  );
  return imgs.slice(0,i).concat(im,right);
}
function popImage(i: number, imgs: Images) {
  const right = imgs.slice(i+1).map(
    im => ({...im, alt: im.alt-1})
  );
  return imgs.slice(0,i).concat(right);
}
function sessReducer(s: SessionState, a: SessionStateCmd): SessionState {
  switch (a.type) {
    case 'setIndex':
      if (a.val >= s.imgs.length || a.val < 0){
        window.alert("setIndex out of bounds");
      }
      return {...s, activeIndex: a.val};
    case 'dupeActiveImage': {
      const activeIndex = s.activeIndex+1;
      return {...s, activeIndex, imgs:
        insertImage(s.imgs, s.imgs[s.activeIndex], activeIndex)
      }
    }
    case 'deleteActiveImage': {
      // s.imgs.length guaranteed to be > 0
      const activeIndex = s.activeIndex ? s.activeIndex-1 : 0;
      const show = s.show && (
        s.imgs.length===1 ? true : false
      ); // hide viewer if there'll be nothing
      //
      return {...s, activeIndex, show,
        imgs: popImage(s.activeIndex, s.imgs)
      };
    }
    default:
      return s;
  }
}

// TODO: button to hide the toolbar and etc
const ViewerSession = ({sess,goBack}: {sess: Images, goBack: (sess:Images)=>void}) => {
  const [imgs,setImgs] = React.useState(sess)
  const [show,setShow] = React.useState(false)
  const [focused,setFocused] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0)

  const [state, dispatch] = React.useReducer(sessReducer, {
    show, imgs, activeIndex
  });
  console.log('TODO:', state,dispatch);

  const updateImgs = (cb: (imgs:Images)=>Images) => {
    setImgs(imgs => cb(imgs));
    setShow(true);
  }
  const addedButtons = makeButtons(setImgs, setActiveIndex)

  if (imgs.length === 0 && show) {
    setShow(false); // this is when all images get deleted
  }

  // TODO: save state upon goBack()
  return (<div className="App">
    <header className="App-header">
      <div style={{float:'right'}}>
        <IconButtonSimple icon={<KeyboardReturn/>}
        onClick={()=>goBack(imgs)}/>
      </div>
      <div style={{clear: 'both', float:'right'}}>
        <FormControlLabel label="Focused" control={
          <Switch checked={focused} onChange={
            (e)=>setFocused(e.target.checked)
          }/>
        }/>
      </div>
      <h1>test</h1>
      <h5>zoom level: {window.devicePixelRatio}</h5>
      <ViewerButtons setShow={setShow} imgs={imgs} updateImgs={updateImgs}/>
      {show && <ViewerButMoreSimple
        imgs={imgs}
        setShow={setShow}
        focused={focused}
        addedButtons={addedButtons}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />}
    </header>
  </div>)
}

export default ViewerSession;
