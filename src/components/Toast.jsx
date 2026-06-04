import { useUI } from '../context/UIContext';

export default function Toast() {
  const { toastMsg } = useUI();
  return <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>;
}
