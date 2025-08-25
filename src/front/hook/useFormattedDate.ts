import {useMemo} from 'react';

/**
 * Format `Date` object into fancy string.
 * 06-16-2024 pm 6:55
 */
const useFormattedDate = (date: undefined | Date) => {
  return useMemo(() => {
    if (!date) {
      return '';
    }
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const amOrPm = date.getHours() >= 12 ? 'pm' : 'am';
    const hour = (date.getHours() % 12) + (date.getHours() % 12 === 0 ? 12 : 0);
    const minute = date.getMinutes();

    /** Pad `value` of `number` type with zeros and return the string. */
    const padStartZero = (value: number, maxLength: number) => {
      return value.toString().padStart(maxLength, '0');
    };

    const formattedDate =
      `${padStartZero(month, 2)}-${padStartZero(day, 2)}-${year} ${amOrPm} ${hour}:${padStartZero(minute, 2)}`;
    return formattedDate;
  }, [date]);
};

export default useFormattedDate;
