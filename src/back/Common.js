const path = require('path');
const fs = require('fs').promises;
/** Header must not and cannot exceed this length. @type {number} */
const MAX_HEADER_LEN = 10000;
const HEADER_END = '\n\n';
/**
 * @typedef {{dir:string; path:string; name: string; type:string; size:number;}} Item
 * @typedef {{app: string; version: string; class: string; id: string; numItems: number;}} SendRequestHeader
 * @typedef {{app: string; version: string; class: string; id: string;}} RecvRequestHeader
 */

/**
 * split and separate a header from buf and return the header as string and sliced buf.
 * Return undefined if HEADER_END is not found.
 * @param {Buffer} buf
 * @returns {{header:string, buf:Buffer}|undefined}
 */
function splitHeader (buf) {
  const endInd = buf.indexOf(HEADER_END, 0, 'utf-8');
  if (endInd >= 0) {
    const header = buf.toString('utf8', 0, endInd);
    return {header: header, buf: buf.subarray(endInd + 2)};
  }
  return undefined;
}

/**
 * Normalize tree structure items into serialized item array.
 * Before calling the function, be sure that this.itemArray is an empty array.
 * @param {Object.<string, Item>} items
 */
async function createItemArray (items) {
  let ret = [];
  await createItemArrayIntoParam(items, ret);
  return ret;
}

/**
 * @param {Object.<string, Item>} items
 * @param {any[]} ret
 */
async function createItemArrayIntoParam (items, ret) {
  for (const itemName in items) {
    const item = items[itemName];
    if (item.type === 'directory') {
      ret.push(createDirectoryHeader(item.path, item.name, item.dir));
      /** @type {Object.<string, Item>} */
      const tmp = {};
      for (const subItemName of (await fs.readdir(item.path))) {
        const subItemPath = path.join(item.path, subItemName);
        const subItemStat = (await fs.stat(subItemPath));
        const subItemType = (subItemStat.isDirectory() ? 'directory' : 'file');
        const subItemSize = (subItemType === 'file' ? subItemStat.size : 0);
        tmp[subItemName] = {path: path.join(item.path, subItemName), name: subItemName, dir: path.join(item.dir, itemName), type: subItemType, size: subItemSize};
      }
      await createItemArrayIntoParam(tmp, ret);
    }
    else {
      ret.push(createFileHeader(item.path, itemName, item.dir, item.size));
    }
  }
}

/**
 * @param {string} path Path of the item.
 * @param {string} name Name of the item.
 * @param {string} dir Directory of the item.
 * @param {number} size Size of the item.
 * @returns {Item}
 */
function createFileHeader (path, name, dir, size) {
  const header = {path: path, name: name, dir: dir.split('\\').join('/'), type: 'file', size: size};
  return header;
}

/**
 * @param {string} path Path of the item.
 * @param {string} name name of the item.
 * @param {string} dir Directory of the item.
 * @returns {{name:string, type: string}}
 */
function createDirectoryHeader (path, name, dir) {
  const header = {path: path, name: name, dir: dir.split('\\').join('/'), type: 'directory'};
  return header;
}

module.exports = {MAX_HEADER_LEN, HEADER_END, createItemArray, splitHeader};
