import {ReactNode} from 'react';
import '../style/Blind.scss';

type Props = {
  children?: ReactNode;
}

function Blind ({children}: Props) {
  return (
    <div className='Blind'>
      {children}
    </div>
  );
}

export default Blind;
