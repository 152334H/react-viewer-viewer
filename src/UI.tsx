/* Button skeletons, toast notifications, and misc funcs like isTauri */

// react imports
import React, {ReactElement} from 'react'
// MUI imports
import CircularProgress from '@mui/material/CircularProgress';
import {green,red} from '@mui/material/colors';
import IconButton from '@mui/material/Button';
import Input from '@mui/material/Input';
import Box from '@mui/material/Box';
// other imports
import {toast} from 'react-toastify';

export const isTauri = () => (
  '__TAURI__' in window
) // TODO: find the correct way to check for Tauri

export const IconButtonSimple = ({icon, onClick=()=>{}, title=""}: {
  icon: ReactElement,
  onClick?: (e:any)=>void,
  title?: string,
}) => (
  <IconButton color="primary" component="span" onClick={onClick} title={title}>
    {icon}
  </IconButton>
)

export const UploadButton = ({id, icon, onChange}:
  {id:string,icon:ReactElement,onChange:(e:any)=>void}) => (
  <label htmlFor={id}>
    <Input type='file'
      id={id} style={{display: "none"}}
      inputProps={{ multiple: true }}
      onChange={onChange} value=''/>
    <IconButtonSimple icon={icon}/>
  </label>
) // value='' allows the input to accept the same file twice in a row

export const LoadingButton = ({icon, onClick}:
  {icon: ReactElement, onClick: () => Promise<void>}
  ) => {
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(null);

  const buttonSx = {
    ...(success!==null && ( success ? {
      bgcolor: green[500],
      '&:hover': { bgcolor: green[700], },
    } : {
      bgcolor: red[500],
      '&:hover': { bgcolor: red[700], },
    })),
  };

  const handleButtonClick = () => {
    if (!loading) {
      setSuccess(null); setLoading(true);
      onClick().then(() => setSuccess(true)
      ).catch(() => setSuccess(false)
      ).finally(() => setLoading(false));
    }
  };
  // have no idea how this works, copied from MUI examples
  return (<Box sx={{ display: 'flex', alignItems: 'center' }}>
    <Box sx={{ m: 1, position: 'relative' }}>
      <IconButton sx={buttonSx} variant="contained" disabled={loading} onClick={handleButtonClick}>
        {icon}
      </IconButton>
      {loading && (
        <CircularProgress
          size={24}
          sx={{
            color: green[500],
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-12px',
            marginLeft: '-12px',
          }}
        />
      )}
    </Box>
  </Box>);
}

export const notifyPromise = (p: Promise<any>, msg: string) => toast.promise(p, {
  pending: msg,
  success: 'Done!',
  error: "Something went wrong"
});
