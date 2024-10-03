/** Header must not and cannot exceed this length. @type {number} */
const path = require('path');
const fs = require('fs').promises;
const MAX_HEADER_LEN = 10000;
const HEADER_END = '\n\n';
/**
 * @typedef {{dir:string, path:string, type:string, size:number}} Item
 */

/**
 * split and separate a header from buf and return the header as string and sliced buf.
 * Return undefined if HEADER_END is not found.
 * @param {Buffer} buf
 * @returns {{header:String, buf:Buffer}|undefined}
 */
function splitHeader (buf) {
  const endInd = buf.indexOf(HEADER_END, 0, 'utf-8');
  if (endInd >= 0) {
    const header = buf.toString('utf8', 0, endInd);
    return {header: header, buf: buf.slice(endInd + 2)};
  }
  return undefined;
}

/**
 * Normalize tree structure items into serialized item array.
 * Before calling the function, be sure that this._itemArray is an empty array.
 * @param {Object.<string, Item>} items
 */
async function createItemArray (items) {
  let ret = [];
  await _createItemArray(items, ret);
  return ret;
}

/**
 * @param {Object.<string, Item>} items
 * @param {any[]} ret
 */
async function _createItemArray (items, ret) {
  for (let itemName in items) {
    const item = items[itemName];
    if (item.type === 'directory') {
      ret.push(_createDirectoryHeader(item.path, item.name, item.dir));
      const tmp = {};
      for (const subItemName of (await fs.readdir(item.path))) {
        const subItemPath = path.join(item.path, subItemName);
        const subItemStat = (await fs.stat(subItemPath));
        const subItemType = (subItemStat.isDirectory() ? 'directory' : 'file');
        const subItemSize = (subItemType === 'file' ? subItemStat.size : 0);
        tmp[subItemName] = {path: path.join(item.path, subItemName), name: subItemName, dir: path.join(item.dir, itemName), type: subItemType, size: subItemSize};
      }
      await _createItemArray(tmp, ret);
    }
    else {
      ret.push(_createFileHeader(item.path, itemName, item.dir, item.size));
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
function _createFileHeader (path, name, dir, size) {
  const header = {path: path, name: name, dir: dir.split('\\').join('/'), type: 'file', size: size};
  return header;
}

/**
 * @param {string} path Path of the item.
 * @param {string} name name of the item.
 * @param {string} dir Directory of the item.
 * @returns {{name:string, type: string}}
 */
function _createDirectoryHeader (path, name, dir) {
  const header = {path: path, name: name, dir: dir.split('\\').join('/'), type: 'directory'};
  return header;
}

module.exports = {MAX_HEADER_LEN, HEADER_END, createItemArray, splitHeader};
