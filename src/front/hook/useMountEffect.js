import {useEffect} from 'react';
/**
 * Run the provided callback only once
 * in the component's lifecycle.
 * @param {() => void} cb
 */
// eslint-disable-next-line react-hooks/exhaustive-deps
const useMountEffect = (cb) => useEffect(cb, []);

export default useMountEffect;
