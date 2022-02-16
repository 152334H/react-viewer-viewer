/* This is the page for a single image viewer sewssion.
*/

import * as React from 'react'
import {FC} from 'react'
// MUI imports
import {KeyboardReturn} from '@mui/icons-material';
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
//const logAndRet = v => {console.log(v); return v}

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
// TODO:why can't vim code fold this??
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
    imgs: any[]; // note: this is really Images, but due to our use of the .alt attribute as a shim...
    addedButtons: any[] // note: this is really ToolbarConfig[], but...
};
// the main component from react-viewer. default options written here
// TODO: button to hide the toolbar and etc
const ViewerButMoreSimple: FC<SimpleViewerProps> = ({setShow, setActiveIndex, activeIndex, imgs, addedButtons}) => (
  <Viewer visible={true} zoomSpeed={0.1}
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

const ViewerSession = ({goBack}: {goBack: ()=>void}) => {
  const [imgs,setImgs] = React.useState([])
  const [show,setShow] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)

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
      <div style={{float: 'right'}}>
        <IconButtonSimple icon={<KeyboardReturn/>}
          onClick={goBack}/>
      </div>
      <h1>test</h1>
      <h5>zoom level: {window.devicePixelRatio}</h5>
      <ViewerButtons setShow={setShow} imgs={imgs} updateImgs={updateImgs}/>
      {show && <ViewerButMoreSimple
        imgs={imgs}
        setShow={setShow}
        addedButtons={addedButtons}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
      />}
    </header>
  </div>)
}

export default ViewerSession;
