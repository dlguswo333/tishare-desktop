type Props = {
  isThumbnailVisible: boolean;
  onThumbnailError: () => unknown;
  item: Item;
}

const Thumbnail = ({isThumbnailVisible, onThumbnailError, item}: Props) => {
  const itemTypeText = item.type === 'directory' ? '📁 ' : '📄 ';

  return <>
    {isThumbnailVisible && <img
      onError={onThumbnailError}
      src={'app:' + item.path.replace(/\\/g, '/')}
      loading='lazy'
      alt={itemTypeText}
    />}
    {!isThumbnailVisible && (item.type === 'directory' ? '📁 ' : '📄 ')}
  </>;
};

export default Thumbnail;
