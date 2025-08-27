//@ts-check

import {useState} from 'react';
import {printSize, WELL_KNOWN_IMAGE_EXTENSIONS} from '../../defs';
import useFormattedDate from '../hook/useFormattedDate';
import '../style/ItemDetail.scss';
import Thumbnail from './Thumbnail';
import {TiItemWithoutDir} from '../../types';

type Props = {
  setItemDetail: (_: null | TiItemWithoutDir) => unknown;
  item: TiItemWithoutDir;
};

const ItemDetail = ({item, setItemDetail}: Props) => {
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
      <Thumbnail
        isThumbnailVisible={isThumbnailVisible}
        onThumbnailError={onThumbnailError}
        item={item}
      />
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
