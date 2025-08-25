import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import ThemeButton from './ThemeButton';
import Item from './Item';
import '../style/ItemView.scss';
import {TiItem, TiItemWithoutDir} from '../../types';

type Props = {
  items: Record<string, TiItem>;
  openFile: () => unknown;
  openDirectory: () => unknown;
  deleteChecked: (_: undefined | Record<string, boolean>) => unknown;
  setItemDetail: (_: null | TiItemWithoutDir) => unknown;
}

function ItemView ({items, openFile, openDirectory, deleteChecked, setItemDetail}: Props) {
  const [scrollable, setScrollable] = useState(false);
  const [checked, setChecked] = useState({});
  const [lastClick, setLastClick] = useState<null | string>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const numItems = useMemo(() => Object.keys(items).length, [items]);
  const numCheckedItems = useMemo(() => Object.keys(checked).length, [checked]);
  const isCheckAll = useMemo(
    () => numItems > 0 && numItems === numCheckedItems,
    [numCheckedItems, numItems]
  );
  const [checkAll, setCheckAll] = useState(isCheckAll);

  const deleteCheckedItems = useCallback(() => {
    if (checkAll)
      deleteChecked(undefined);
    else
      deleteChecked(checked);
    setChecked({});
  }, [checkAll, checked, deleteChecked]);

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
          <ThemeButton onClick={deleteCheckedItems} disabled={numCheckedItems === 0}>- Checked</ThemeButton>
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
                  const tmp: Record<string, boolean> = {};
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
              setItemDetail={setItemDetail}
            />)}
        </div>
      </div>
    </div>
  );
}

export default ItemView;
