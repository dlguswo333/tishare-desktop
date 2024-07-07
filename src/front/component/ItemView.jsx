import {useEffect, useMemo, useRef, useState} from 'react';
import ThemeButton from './ThemeButton';
import Item from './Item';
import '../style/ItemView.scss';

/**
 * @param {object} props
 * @param {object} props.items
 * @param {function} props.openFile
 * @param {function} props.openDirectory
 * @param {function} props.deleteChecked
 */
function ItemView ({items, openFile, openDirectory, deleteChecked}) {
  const [scrollable, setScrollable] = useState(false);
  const [checked, setChecked] = useState({});
  const [lastClick, setLastClick] = useState(null);
  const bodyRef = useRef(null);
  const numItems = useMemo(() => Object.keys(items).length, [items]);
  const numCheckedItems = useMemo(() => Object.keys(checked).length, [checked]);
  const isCheckAll = useMemo(
    () => numItems > 0 && numItems === numCheckedItems,
    [numCheckedItems, numItems]
  );
  const [checkAll, setCheckAll] = useState(isCheckAll);

  useEffect(() => {
    setCheckAll(isCheckAll);
  }, [isCheckAll]);

  useEffect(() => {
    if (bodyRef && bodyRef.current)
      if (bodyRef.current.scrollHeight > bodyRef.current.clientHeight)
        setScrollable(true);
      else
        setScrollable(false);
  }, [items]);

  return (
    <div className='ItemView'>
      <div className='ItemViewHead'>
        <div className='Buttons'>
          <ThemeButton onClick={openFile}>+ File</ThemeButton>
          <ThemeButton onClick={openDirectory}>+ Directory</ThemeButton>
          <ThemeButton onClick={() => {
            if (checkAll)
              deleteChecked(undefined);
            else
              deleteChecked(checked);
            setChecked({});
          }
          }>- Checked</ThemeButton>
        </div>
      </div>
      <div className='ItemViewBody'>
        <div className={'ItemElement Head' + (scrollable ? ' Scrollable' : '')}>
          <div className='ItemInfo'>
            Items
            {Object.keys(items).length > 0 &&
              <span>
                ({Object.keys(checked).length} / {Object.keys(items).length})
              </span>
            }
          </div>
          <div className='ItemCheck'>
            <input type='checkbox' checked={checkAll} disabled={numItems === 0}
              onChange={() => {
                const tmp = checkAll;
                if (tmp) {
                  setChecked({});
                }
                else {
                  const tmp = {};
                  for (let itemName in items) {
                    tmp[itemName] = true;
                  }
                  setChecked(tmp);
                }
                setCheckAll(!checkAll);
              }}
            />
          </div>
        </div>
        <div className='Body' ref={bodyRef}>
          {Object.values(items).map(item =>
            <Item
              key={item.name}
              item={item}
              items={items}
              checkAll={checkAll}
              lastClick={lastClick}
              setLastClick={setLastClick}
              checked={checked}
              setChecked={setChecked}
            />)}
        </div>
      </div>
    </div>
  );
}

export default ItemView;
