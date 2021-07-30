import React, { useEffect, useRef, useState } from 'react';
import ThemeButton from './ThemeButton';
import { printSize } from '../defs';
import './style/ItemView.scss';
/**
 * @param {object} props
 * @param {object} props.items
 * @param {function} props.openFile
 * @param {function} props.openDirectory
 * @param {function} props.deleteChecked
 */
function ItemView({ items, openFile, openDirectory, deleteChecked }) {
  const [checkAll, setCheckAll] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const [checked, setChecked] = useState({});
  const [lastClick, setLastClick] = useState(null);
  const bodyRef = useRef(null);

  const showItems = () => {
    const ret = [];
    for (let itemName in items) {
      const item = items[itemName];
      ret.push(
        <div className='ItemElement' key={itemName}>
          <div className='ItemInfo' title={itemName}>
            <div className='ItemName'>
              {(item.type === 'directory' ? '📁 ' : '📄 ') + itemName}
            </div>
            <div className='ItemProperty'>
              {(item.type === 'directory' ? item.size + ' items' : printSize(item.size))}
            </div>
          </div>
          <div className='ItemCheck'>
            <input type='checkbox' checked={checkAll || itemName in checked}
              onClick={(e) => {
                setLastClick(itemName);
                if (e.shiftKey) {
                  const keys = Object.keys(items);
                  let thisInd = keys.indexOf(itemName);
                  if (lastClick) {
                    let lastInd = keys.indexOf(lastClick);
                    if (lastInd === -1) {
                      setLastClick(null);
                      return;
                    }
                    if (thisInd < lastInd) {
                      const tmp = { ...checked };
                      for (let ind = thisInd; ind !== lastInd; ++ind) {
                        if (keys[ind] in checked)
                          delete tmp[keys[ind]];
                        else
                          tmp[keys[ind]] = true;
                      }
                      setChecked(tmp);
                    }
                    else {
                      const tmp = { ...checked };
                      for (let ind = thisInd; ind !== lastInd; --ind) {
                        if (keys[ind] in checked)
                          delete tmp[keys[ind]];
                        else
                          tmp[keys[ind]] = true;
                      }
                      setChecked(tmp);
                    }
                  }
                  return;
                }
                const tmp = { ...checked };
                if (itemName in checked) {
                  delete tmp[itemName];
                }
                else
                  tmp[itemName] = true;
                setChecked(tmp);
              }}
              onChange={() => { }}
            />
          </div>
        </div>
      )
    }
    return ret;
  }

  useEffect(() => {
    if (Object.keys(items).length > 0 && Object.keys(items).length === Object.keys(checked).length) {
      setCheckAll(true);
    }
    else
      setCheckAll(false);
  }, [items, checked]);

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
          <ThemeButton onClick={openFile} value='+ File' />
          <ThemeButton onClick={openDirectory} value='+ Directory' />
          <ThemeButton onClick={() => {
            if (checkAll)
              deleteChecked(undefined);
            else
              deleteChecked(checked);
            setChecked({});
          }
          } value='- Checked' />
        </div>
      </div>
      <div className='ItemViewBody'>
        <div className={'ItemElement Head' + (scrollable ? ' Scrollable' : '')}>
          <div className='ItemInfo'>
            Items
          </div>
          <div className='ItemCheck'>
            <input type='checkbox' checked={checkAll}
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
          {showItems()}
        </div>
      </div>
    </div>
  )
}

export default ItemView;