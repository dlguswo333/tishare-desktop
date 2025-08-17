import {useState} from 'react';
import {printSize, WELL_KNOWN_IMAGE_EXTENSIONS} from '../../defs';
import useFormattedDate from '../hook/useFormattedDate';
import Thumbnail from './Thumbnail';
import {TiItemWithoutDir} from '../../types';

type Props = {
  checkAll: boolean;
  lastClick: string;
  setLastClick: Function;
  setChecked: Function;
  setItemDetail: Function;
  checked: Record<string, boolean>;
  items: object;
  item: TiItemWithoutDir;
}

const Item = ({item, items, checkAll, lastClick, setLastClick, checked, setChecked, setItemDetail}: Props) => {
  const [isThumbnailVisible, setIsThumbnailVisible] = useState(
    item.type !== 'directory' &&
    WELL_KNOWN_IMAGE_EXTENSIONS.some(ext => item.path.toLowerCase().endsWith(`.${ext}`))
  );
  const onThumbnailError = () => setIsThumbnailVisible(false);
  const formattedMtime = useFormattedDate(item.mtime);

  const onCheckboxClick: React.MouseEventHandler<HTMLInputElement> = (e) => {
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
    <button className='ItemThumbnailHolder' onClick={() => setItemDetail(item)}>
      <Thumbnail
        isThumbnailVisible={isThumbnailVisible}
        onThumbnailError={onThumbnailError}
        item={item}
      />
    </button>
    <div className='ItemInfo' title={item.name}>
      <div className='ItemName'>
        {item.name}
      </div>
      <div className='ItemProperty'>
        {(item.type === 'directory' ? item.size + ' items' : printSize(item.size))}
        {!!formattedMtime && ('｜' + formattedMtime)}
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
