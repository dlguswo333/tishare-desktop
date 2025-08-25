import {useState, useCallback} from 'react';
import {TiItem} from '../../types';

const useItems = () => {
  const [items, setItems] = useState<Record<string, TiItem>>({});

  const deleteChecked = useCallback(
    (checked: undefined | Record<string, boolean>) => {
      const ret = {...items};
      if (checked === undefined) {
        setItems({});
      }
      else {
        for (const itemName in checked) {
          delete ret[itemName];
        }
        setItems(ret);
      }
    }, [items, setItems]);

  return {
    items,
    setItems,
    deleteChecked,
  };
};

export default useItems;
