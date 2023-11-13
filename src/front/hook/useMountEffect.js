import { useEffect } from 'react';
/**
 * Run the provided callback only once
 * in the component's lifecycle.
 * @param {() => void} cb
 */
const useMountEffect = (cb) => useEffect(cb, []);

export default useMountEffect;
