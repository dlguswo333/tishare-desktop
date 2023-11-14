import {useState, useCallback} from 'react';

const useItems = () => {
  const [items, setItems] = useState({});

  const deleteChecked = useCallback(
    /**
     * @param {Object.<string, boolean>|undefined} checked
     */
    (checked) => {
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
