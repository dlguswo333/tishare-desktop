/** Header must not and cannot exceed this length. @type {number} */
const MAX_HEADER_LEN = 10000;
const HEADER_END = '\n\n';
/**
 * @typedef {{dir:string, path:string, type:string, size:number, items:Object.<string, item>}} item
 */

/**
 * split and separate a header from buf and return the header as string and sliced buf.
 * Return undefined if HEADER_END is not found.
 * @param {Buffer} buf 
 * @returns {{header:String, buf:Buffer}|undefined}
 */
function splitHeader(buf) {
  const endInd = buf.indexOf(HEADER_END, 0, 'utf-8');
  if (endInd >= 0) {
    const header = buf.toString('utf8', 0, endInd);
    return { header: header, buf: buf.slice(endInd + 2) };
  };
  return undefined;
}

/**
 * Normalize tree structure items into serialized item array.
 * Before calling the function, be sure that this._itemArray is an empty array.
 * @param {Object.<string, item>} items
 */
function createItemArray(items) {
  let ret = [];
  _createItemArray(items, ret);
  return ret;
}

/**
 * @param {Object.<string, item>} items
 * @param {any[]} ret
 */
function _createItemArray(items, ret) {
  for (let itemName in items) {
    if (items[itemName].type === 'directory') {
      ret.push(_createDirectoryHeader(items[itemName].path, items[itemName].name, items[itemName].dir));
      _createItemArray(items[itemName].items, ret);
    }
    else {
      ret.push(_createFileHeader(items[itemName].path, items[itemName].name, items[itemName].dir, items[itemName].size));
    }
  }
}

/**
 * @param {string} path Path of the item.
 * @param {string} name Name of the item.
 * @param {string} dir Directory of the item.
 * @param {number} size Size of the item.
 * @returns {{name:string, type: string, size: number}} 
 */
function _createFileHeader(path, name, dir, size) {
  const header = { path: path, name: name, dir: dir.split('\\').join('/'), type: 'file', size: size }
  return header;
}

/**
 * @param {string} path Path of the item.
 * @param {string} name name of the item.
 * @param {string} dir Directory of the item.
 * @returns {{name:string, type: string}} 
 */
function _createDirectoryHeader(path, name, dir) {
  const header = { path: path, name: name, dir: dir.split('\\').join('/'), type: 'directory' }
  return header;
}

module.exports = { MAX_HEADER_LEN, HEADER_END, createItemArray, splitHeader };