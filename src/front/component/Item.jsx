import {useState} from 'react';
import * as DEFS from '../../defs';

const {printSize} = DEFS.default;

/**
 * @param {object} props
 * @param {boolean} props.checkAll
 * @param {string} props.lastClick
 * @param {Function} props.setLastClick
 * @param {Function} props.setChecked
 * @param {Record<string, boolean>} props.checked
 * @param {object} props.items
 * @param {object} props.item
 * @param {string} props.item.name
 * @param {string} props.item.type
 * @param {string} props.item.path
 * @param {size} props.item.number
 */
const Item = ({item, items, checkAll, lastClick, setLastClick, checked, setChecked}) => {
  const [isThumbnailVisible, setIsThumbnailVisible] = useState(item.type !== 'directory');
  const onThumbnailError = () => setIsThumbnailVisible(false);

  /** @type React.MouseEventHandler<HTMLInputElement> */
  const onCheckboxClick = (e) => {
    setLastClick(item.name);
    if (e.shiftKey) {
      const itemKeys = Object.keys(items);
      const ind = itemKeys.indexOf(item.name);
      if (!lastClick) {
        return;
      }
      const lastInd = itemKeys.indexOf(lastClick);
      if (lastInd === -1) {
        setLastClick(null);
        return;
      }
      const newChecked = {...checked};
      if (ind < lastInd) {
        for (let i = ind; i !== lastInd; ++i) {
          if (itemKeys[i] in checked)
            delete newChecked[itemKeys[i]];
          else
            newChecked[itemKeys[i]] = true;
        }
      } else {
        for (let i = ind; i !== lastInd; --i) {
          if (itemKeys[i] in checked)
            delete newChecked[itemKeys[i]];
          else
            newChecked[itemKeys[i]] = true;
        }
      }
      setChecked(newChecked);
      return;
    }
    const newChecked = {...checked};
    if (item.name in checked)
      delete newChecked[item.name];
    else
      newChecked[item.name] = true;
    setChecked(newChecked);
  };

  return <div className='ItemElement' key={item.name}>
    <span className='ItemThumbnailHolder'>
      {isThumbnailVisible && <img
        onError={onThumbnailError}
        src={'app:' + item.path.replace(/\\/g, '/')}
        loading='lazy'
        alt={item.type === 'directory' ? '📁 ' : '📄 '}
      />}
      {!isThumbnailVisible && (item.type === 'directory' ? '📁 ' : '📄 ')}
    </span>
    <div className='ItemInfo' title={item.name}>
      <div className='ItemName'>
        {item.name}
      </div>
      <div className='ItemProperty'>
        {(item.type === 'directory' ? item.size + ' items' : printSize(item.size))}
      </div>
    </div>
    <div className='ItemCheck'>
      <input type='checkbox' checked={checkAll || item.name in checked}
        onClick={onCheckboxClick}
        onChange={() => { }}
      />
    </div>
  </div>;
};

export default Item;
