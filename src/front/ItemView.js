import React from 'react';
import './style/ItemView.scss';
/**
 * @param {object} props
 * @param {object} props.items
 * @param {function} props.openFile
 * @param {function} props.openDirectory
 */
function ItemView({ items, openFile, openDirectory }) {
  return (
    <div className='ItemView'>
      <div className='ItemViewHead'>
        <div className='Buttons'>
          <button onClick={openFile}>Open File</button>
          <button onClick={openDirectory}>Open Directory</button>
        </div>
      </div>
    </div>
  )
}

export default ItemView;