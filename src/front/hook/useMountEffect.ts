import {useEffect} from 'react';
/**
 * Run the provided callback only once
 * in the component's lifecycle.
 */
// eslint-disable-next-line react-hooks/exhaustive-deps
const useMountEffect = (cb: () => void) => useEffect(cb, []);

export default useMountEffect;
