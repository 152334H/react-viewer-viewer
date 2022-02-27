/* This is the page for a single image viewer sewssion.
*/

import * as React from 'react'
import {FC} from 'react'
// MUI imports
import {KeyboardReturn} from '@mui/icons-material';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import InputBase from '@mui/material/InputBase';
// other imports
// imports developed / edited for project
import Viewer from 'react-viewer'

import {IconButtonSimple,notifyPromise,isTauri} from './UI'
import {ViewerButtons} from './ViewerButtons'

// TODO:move these types somewhere more sensible
import {Images,FullImageState} from './ViewerButtons'
import {flattenImages} from './ViewerButtons'

interface ToolbarConfig { // private from react-viewer/ViewerProps
    key: string;
    actionType?: number;
    render?: React.ReactNode;
    onClick?: (activeIm?: FullImageState) => void;
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

type ButtonLambda = (dispatch: (cmd: ImagesStateCmd) => void) => ToolbarConfig[];
const makeButtons: ButtonLambda = (dispatch) => ([
  {
    key: "dupe",
    render: <IconLocal type="a"/>,
    onClick: () => {
      dispatch({type:'dupeActiveImage'});
    }
  },
  {
    key: "trash",
    render: <IconLocal type="b"/>,
    onClick: (activeImage: FullImageState) => {
      if (activeImage.alt) {
        dispatch({type:'setIndex', val: activeImage.alt-1})
      }
      setTimeout(() => // stupid hack to get around react-viewer bug
        dispatch({type:'deleteImageAt', val:activeImage.alt})
      ,0);
    }
  },
  // TODO:shift_picture_* are visually bugged because imgs[] and ind do not update in sync for react-viewer. Upstream fix necessary.
  {
    key: "shift_picture_left",
    render: <IconLocal type="c"/>,
    onClick: (activeImage: FullImageState) => {
      const ind = activeImage.alt;
      if (ind > 0) {
        dispatch({type:'moveActiveImage',
                 val: ind-1});
      }
    }
  },
  {
    key: "shift_picture_right",
    render: <IconLocal type="d"/>,
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
export interface SessionState extends ImagesState {
  flattened: null|Images;
  name: string;
}

type ImagesStateCmd = {
  type: string;
  val?: any;
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
        // TODO:this will not actually work because of the same bug that affects shift_image_*. Upstream...
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
    show: sess.show, activeIndex: sess.activeIndex, imgs: sess.imgs
  });
  const [flattened, setFlattened] = React.useState<null|Images>(sess.flattened);
  const [focusLocked, setFocusLocked] = React.useState(sess.flattened === null && sess.imgs === []);
  const [manualUpdate, setManualUpdate] = React.useState(0);
  if (state.show === false && manualUpdate !== 0) { setManualUpdate(0); }
  const focused = flattened !== null;

  const updateImgs = focused ? (imgs:Images) => setFlattened(imgs)  // imgs.length should be immutable in this case.
    : (imgs:Images) => dispatch({type:'setImgs', val: imgs});
  const setShow = (b: boolean) => dispatch({type:'setShow', val:b});
  const setActiveIndex = (i: number) => dispatch({type:'setIndex', val:i});
  const addedButtons = makeButtons(dispatch);
  const makeFlattened = () => {
    const p = flattenImages(state.imgs).then((flattened: Images) => {
      setActiveIndex(0); // send viewer back to start of images
      setFlattened(flattened);
    }).catch(e => {
      window.alert(`something went wrong in tauri command "flatten_images": ${e}`);
      throw new Error('invoke error')
    });
    notifyPromise(p, 'Flattening images...');
    return p;
  }
  const handleKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (focused) { return; } // don't do anything in the focused state (imgs are flattened)
    // TODO: cribbing on addedButtons[] is really stupid
    if (['p','d','[',']','0','$'].includes(e.key)) {
      setManualUpdate(manualUpdate+1);
    }
    if (e.key === 'p') {
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
  }, [addedButtons, state, focused, manualUpdate]);

  return (<div className="App">
    <header className="App-header">
      <div style={{float:'right'}}>
        <IconButtonSimple icon={<KeyboardReturn/>}
        onClick={()=>goBack({...state, flattened, name})}/>
      </div>
      <div style={{clear: 'both', float:'right'}}>
        <FormControlLabel label="Focused" control={
          <Switch checked={focused} disabled={focusLocked || !isTauri()} onChange={(e) => {
            if (e.target.checked) {
              setFocusLocked(true)
              makeFlattened().then(() => setFocusLocked(false));
            } else { setFlattened(null); } // purge flattened images when changes are needed
          }}/>
        }/>
      </div>
      <InputBase
        placeholder="Session name"
        value={name}
        onChange={(e:any) => setName(e.target.value)}
      />
      <h5>zoom level: {window.devicePixelRatio}</h5>
      <ViewerButtons setShow={setShow} imgs={state.imgs} updateImgs={updateImgs}
        setFlattened={setFlattened} setActiveIndex={setActiveIndex}/>
      {state.show && <ViewerButMoreSimple
        state={(focused) ? {...state, imgs: flattened} : state} focused={focused}
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
