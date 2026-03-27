import {RefObject, useEffect, useState} from 'react';

const callbackMap: Map<Element, (value: boolean) => unknown> = new Map();

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const callback = callbackMap.get(entry.target);
    if (callback) {
      callback(entry.isIntersecting);
    }
  }
});

const useIsIntersecting = (elementRef: RefObject<HTMLDivElement | null>) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    callbackMap.set(element, setIsIntersecting);
    observer.observe(element);

    return () => {
      callbackMap.delete(element);
      observer.unobserve(element);
    };
  }, [elementRef]);

  return isIntersecting;
};

export default useIsIntersecting;
