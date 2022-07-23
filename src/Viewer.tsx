/* This is the page for a single image viewer sewssion.
*/

// react imports
import React, {FC} from 'react'
// MUI imports
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import InputBase from '@mui/material/InputBase';
// MUI Icons
import DeleteIcon from '@mui/icons-material/Delete';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn';
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
// imports developed / edited for project
import Viewer from 'react-viewer'
import {IconButtonSimple} from './UI'
import {ViewerButtons} from './ViewerButtons'
import {Images,FullImageState} from './ImageState'

interface ToolbarConfig { // private from react-viewer/ViewerProps
    key: string;
    actionType?: number;
    render?: React.ReactNode;
    onClick?: (activeIm?: FullImageState) => void;
}

//const logAndRet = (v:any) => {console.log(v); return v}

// additional toolbar buttons.
const IconLocal = ({type}: {type:string}) => { // cribbed from react-viewer/Icon.tsx
  const pfx = 'react-viewer-icon'
  const Comp = type === 'dupe' ? FileCopyIcon :
    type === 'trash' ? DeleteIcon :
    type === 'shiftimg_left' ? KeyboardArrowLeftIcon :
    type === 'shiftimg_right' ? KeyboardArrowRightIcon :
    () => <></>;
  return <i className={`${pfx} ${pfx}-${type}`}>
    <Comp fontSize="small" style={{
      position: 'relative', top: '4px'
    }}/>
  </i>
}

const swappedImgs = (i: number, j: number, imgs: Images) => {
  // ASSUMES:i !== j, i and j within imgs[]
  //if (j >= imgs.length || i >= imgs.length || j < 0 || i < 0) { return imgs; }
  let res = imgs.slice();
  [res[i], res[j]] = [res[j], res[i]];
  [res[j].alt,res[i].alt] = [j,i];
  return res;
}

type ButtonLambda = (dispatch: (cmd: ImagesStateCmd) => void) => ToolbarConfig[];
const makeButtons: ButtonLambda = (dispatch) => ([
  {
    key: "dupe",
    render: <IconLocal type="dupe"/>,
    onClick: () => {
      dispatch({type:'dupeActiveImage'});
    }
  },
  {
    key: "trash",
    render: <IconLocal type="trash"/>,
    onClick: (activeImage: FullImageState) => {
      dispatch({type:'deleteImageAt', val:activeImage.alt, dispatch});
    }
  },
  // TODO:shift_picture_* are visually bugged because imgs[] and ind do not update in sync for react-viewer. Upstream fix necessary.
  {
    key: "shiftimg_left",
    render: <IconLocal type="shiftimg_left"/>,
    onClick: (activeImage: FullImageState) => {
      const ind = activeImage.alt;
      if (ind > 0) {
        dispatch({type:'moveActiveImage',
                 val: ind-1});
      }
    }
  },
  {
    key: "shiftimg_right",
    render: <IconLocal type="shiftimg_right"/>,
    onClick: (activeImage: FullImageState) => {
      const ind = activeImage.alt;
      // will potentially cause errors
      dispatch({type: 'moveActiveImage',
               val:ind+1});
    }
  }
]);

//TODO: fix this by not using .alt as a silly knowledge backstore
type SimpleViewerProps = {
    setShow: (b: boolean) => void;
    setActiveIndex: (i:number) => void;
    state: {
      imgs: any[];
      activeIndex: number;
    };
    focused: boolean;
    addedButtons: any[];// note: this is really ToolbarConfig[], but...
    handleKeyPress: (e: any) => void;
    manualUpdate: number;
};
// the main component from react-viewer. default options written here
const ViewerButMoreSimple: FC<SimpleViewerProps> = ({setShow, setActiveIndex, addedButtons, state, focused, handleKeyPress, manualUpdate}) => {
  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    }
  }, [handleKeyPress]);
  return (<Viewer visible={true}
    noFooter={focused}
    noClose={focused}
    zoomSpeed={0.1}
    drag={true} 
    noResetZoomAfterChange={true}
    noLimitInitializationSize={true}
    maxScale={500}
    onClose={() => setShow(false)}
    images={state.imgs}
    customToolbar={(ls:any[]) => ls.concat(addedButtons)}
    onChange={(_:any,i:number) => setActiveIndex(i)}
    activeIndex={state.activeIndex}
    triggerUpdate={manualUpdate}
  />)
}

export interface ImagesState {
  show: boolean;
  imgs: Images;
  activeIndex: number;
};
export interface SessionState extends Omit<ImagesState, 'show'> {
  name: string;
  id?: string;
}

type ImagesStateCmd = {
  type: string;
  val?: any;
  dispatch?: (s: ImagesStateCmd) => void;
}


function insertImage(imgs: Images, im: FullImageState, i: number) {
  im.alt = i;
  const right = imgs.slice(i).map(
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
function sessReducer(s: ImagesState, a: ImagesStateCmd): ImagesState {
  switch (a.type) {
    case 'setShow':
      if (s.imgs.length === 0 && a.val) {
        window.alert("err: no images to show");
      }
      return {...s, show: a.val};
    case 'setIndex':
      if (a.val >= s.imgs.length || a.val < 0){
        window.alert("setIndex out of bounds");
      }
      return {...s, activeIndex: a.val};
    case 'dupeActiveImage': {
      const activeIndex = s.activeIndex+1;
      return {...s, activeIndex, imgs:
        insertImage(s.imgs, {...s.imgs[s.activeIndex]}, activeIndex)
      }
    }
    case 'deleteImageAt': {
      if (a.val >= s.imgs.length || a.val < 0){
        window.alert("deleteImageAt out of bounds");
      }
      // move activeIndex back if the last image is getting removed
      if (s.imgs.length!==1 && s.imgs.length-1===s.activeIndex) {
        a.dispatch({type: 'setIndex', val: s.activeIndex-1})
        // make sure deletion happens AFTER index change
        setTimeout(() => 
          a.dispatch({type: 'deleteImageAt', val: a.val})
        ,0);
        return s;
      }
      // hide viewer if there'll be nothing
      const show = s.show && s.imgs.length!==1;
      //
      const imgs = popImage(a.val, s.imgs);
      return {...s, show, imgs};
    }
    case 'moveActiveImage': {
      const target: number = a.val;
      if (target >= s.imgs.length || target < 0) {
        window.alert("moveActiveImage out of bounds. Ignoring update...");
        return s;
      }
      return {...s, imgs: swappedImgs(
          s.activeIndex, target, s.imgs
        ), activeIndex: target};
    }
    case 'setImgs': { // will autodisplay upon upload
      const imgs = a.val;
      let aI = s.activeIndex;
      if (aI >= imgs.length) {
        window.alert('setImgs: activeIndex out of bounds; shrinking');
        aI = imgs.length ? imgs.length-1 : 0;
        // Note: if the viewer is *visible* while this happens, an undefined access could still occur.
      }
      return {...s, imgs, activeIndex: aI, show: imgs.length !== 0};
    }
    default:
      return s;
  }
}

const ViewerSession = ({sess,goBack}: {
  sess: SessionState, goBack: (sess:SessionState)=>void
}) => {
  const [name, setName] = React.useState(sess.name);
  const [state, dispatch] = React.useReducer(sessReducer, {
    show: false, activeIndex: sess.activeIndex, imgs: sess.imgs
  });
  const [manualUpdate, setManualUpdate] = React.useState(0);
  if (state.show === false && manualUpdate !== 0) { setManualUpdate(0); }
  const [focused, setFocused] = React.useState(false);

  const updateImgs = (imgs:Images) => dispatch({type:'setImgs', val: imgs});
  const setShow = (b: boolean) => dispatch({type:'setShow', val:b});
  const setActiveIndex = (i: number) => dispatch({type:'setIndex', val:i});
  const addedButtons = makeButtons(dispatch);
  const handleKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // TODO: cribbing on addedButtons[] is really stupid
    if (['r','d','[',']','0','$'].includes(e.key)) {
      setManualUpdate(manualUpdate+1);
    }
    if (e.key === 'r') {
      addedButtons[0].onClick();
    } else if (e.key === 'd') {
      addedButtons[1].onClick(state.imgs[state.activeIndex]);
    } else if (e.key === '[') {
      addedButtons[2].onClick(state.imgs[state.activeIndex]);
    } else if (e.key === ']') {
      addedButtons[3].onClick(state.imgs[state.activeIndex]);
    } else if (e.key === '0') {
      setActiveIndex(0);
    } else if (e.key === '$') {
      setActiveIndex(state.imgs.length-1);
    }
  }, [addedButtons, state, manualUpdate]);

  return (<div className="App">
    <header className="App-header">
      <div style={{float:'right'}}>
        <IconButtonSimple icon={<DeleteIcon/>}
        onClick={()=>window.confirm(`Delete the "${name}" session?`)
          ? goBack({...sess, activeIndex: state.activeIndex, imgs: [], name})
          : 0}/>
        <IconButtonSimple icon={<KeyboardReturnIcon/>}
          onClick={()=>goBack({...sess, activeIndex: state.activeIndex, imgs: state.imgs, name})}/>
      </div>
      <div style={{clear:'both', float:'right'}}>
        <FormControlLabel label="Focused" control={
          <Switch checked={focused} disabled={state.imgs.length===0} onChange={() => {
            setActiveIndex(0);
            setFocused(!focused);
          }}/>
        }/>
      </div>
      <InputBase
        placeholder="Session name"
        value={name}
        onChange={(e:any) => setName(e.target.value)}
      />
      <h5>zoom level: {window.devicePixelRatio}</h5>
      <ViewerButtons setShow={setShow} name={name}
        imgs={state.imgs} updateImgs={updateImgs}
        setActiveIndex={setActiveIndex}
        setName={setName}
      />
      {state.show && <ViewerButMoreSimple
        state={state} focused={focused}
        setShow={setShow}
        addedButtons={addedButtons}
        setActiveIndex={setActiveIndex}
        handleKeyPress={handleKeyPress}
        manualUpdate={manualUpdate}
      />}
    </header>
  </div>)
}


export default ViewerSession;
