//@ts-check

import {useState} from 'react';
import {printSize, WELL_KNOWN_IMAGE_EXTENSIONS} from '../../defs';
import useFormattedDate from '../hook/useFormattedDate';
import '../style/ItemDetail.scss';

/**
 * @param {object} props
 * @param {Function} props.setItemDetail
 * @param {object} props.item
 * @param {string} props.item.name
 * @param {string} props.item.type
 * @param {string} props.item.path
 * @param {Date | undefined} props.item.mtime
 * @param {number} props.item.size
 */
const ItemDetail = ({item, setItemDetail}) => {
  const [isThumbnailVisible, setIsThumbnailVisible] = useState(
    item.type !== 'directory' &&
    WELL_KNOWN_IMAGE_EXTENSIONS.some(ext => item.path.toLowerCase().endsWith(`.${ext}`))
  );
  const onThumbnailError = () => setIsThumbnailVisible(false);
  const formattedMtime = useFormattedDate(item.mtime);
  const itemTypeText = item.type === 'directory' ? '📁 ' : '📄 ';
  const itemSizeText = item.type === 'directory' ? item.size + ' items' : printSize(item.size);

  return <div className='ItemDetail'>
    <span className='ItemThumbnailHolder'>
      {/* [TODO] Extract as Thumbnail component */}
      {isThumbnailVisible && <img
        onError={onThumbnailError}
        src={'app:' + item.path.replace(/\\/g, '/')}
        loading='lazy'
        alt={itemTypeText}
      />}
    </span>
    <span className='ItemInfo'>
      <div className='Buttons'>
        <button onClick={() => setItemDetail(null)}>
          X
        </button>
      </div>
      <div className='ItemProperty'>
        <h3 className='ItemName'>
          {item.name}
        </h3>
        <div>
          {item.path}
        </div>
        <div>
          {itemTypeText} {itemSizeText}
        </div>
        <div>
          {!!formattedMtime && formattedMtime}
        </div>
      </div>
    </span>
  </div>;
};

export default ItemDetail;
