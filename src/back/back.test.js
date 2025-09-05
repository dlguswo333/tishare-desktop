import {notStrictEqual, strictEqual, ok} from 'assert';
import fs from 'fs/promises';
import path from 'path';
import {randomBytes} from 'crypto';
import Indexer from './Indexer.js';
import Server from './Server.js';
import Client from './Client.js';
import {MAX_NUM_JOBS} from '../defs.js';
import {getBroadcastIp, isLocalIp} from './Network.js';
import {after, before} from 'mocha';

describe('Indexer', () => {
  const indexer = new Indexer(() => { }, () => { });
  const indices = [];
  it('Unique index', () => {
    for (let i = 0; i < MAX_NUM_JOBS; ++i) {
      const ind = indexer.getInd();
      notStrictEqual(ind, -1);
      strictEqual(indices.includes(ind), false);
      indices.push(ind);
    }
  });
  it('Return -1 if no rooms available', () => {
    strictEqual(indexer.getInd(), -1);
  });
  it('Get valid indices after return', () => {
    ok(indexer.returnInd(indices[0]));
    let ind = indexer.getInd();
    notStrictEqual(ind, -1);
    strictEqual(indices.includes(ind), false);
    indices.push(ind);
  });
  it('Return -1 if no rooms available again', () => {
    ok(indexer.getInd() === -1);
  });
});

describe('Network', () => {
  describe('Get Broadcast IP', () => {
    const ip = '192.168.0.1';
    it('Test 1', () => {
      const netmask = '255.255.255.0';
      const expected = '192.168.0.255';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 2', () => {
      const netmask = '255.255.0.0';
      const expected = '192.168.255.255';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 3', () => {
      const netmask = '255.255.255.128';
      const expected = '192.168.0.127';
      strictEqual(getBroadcastIp(ip, netmask), expected);
    });
  });
  describe('Determine is IP local', () => {
    it('Test 1', () => {
      strictEqual(isLocalIp('192.168.0.1'), true);
    });
    it('Test 2', () => {
      strictEqual(isLocalIp('11.111.0.1'), false);
    });
    it('Test 3', () => {
      strictEqual(isLocalIp('10.11.101.200'), true);
    });
  });
});

describe('Server and client', () => {
  const indexer = new Indexer(() => { });
  const server = new Server(indexer);
  const client = new Client(indexer);
  const ip = '127.0.0.1';
  const netmask = '255.0.0.0';
  const serverId = 'server';
  const clientId = 'client';
  describe('Server', () => {
    it('not null', () => {
      ok(server);
    });
    it('reject open if ID is empty', () => {
      strictEqual(server.open(ip, netmask), false);
    });
    it('set ID', () => {
      server.setMyId(serverId);
      strictEqual(server.myId, serverId);
    });
    it('open', () => {
      strictEqual(server.open(ip, netmask), true);
    });
    it('close', () => {
      strictEqual(server.close(), true);
    });
  });
  describe('Client', () => {
    /** @type {Object.<string, import('../types').TiItem>} */
    let items = null;
    before(async () => {
      items = await createItems();
    });

    it('not null', () => {
      ok(client);
    });
    it('reject initiating if ID is empty', async () => {
      strictEqual(await client.sendRequest(items, ip, serverId), false);
    });
    it('set ID', () => {
      client.setMyId(clientId);
      strictEqual(client.myId, clientId);
    });

    after(async () => {
      await deleteItems(items);
    });
  });
});

async function createItems () {
  const items = {};
  const n1 = 'file1';
  const n1size = 100;

  items[n1] = {dir: 'ddd', path: path.join(import.meta.dirname, n1), type: 'file', size: n1size};
  const n1handle = await fs.open(items[n1].path, 'w');
  await n1handle.write(randomBytes(n1size));
  await n1handle.close();
  return items;
}

/**
 * @param {Object.<string, import('./common.js').TiBackItem} items
 */
async function deleteItems (items) {
  for (let itemName in items) {
    await fs.rm(items[itemName].path, {force: true});
  }
}
