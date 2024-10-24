const assert = require('assert');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const Indexer = require('./Indexer');
const Server = require('./Server');
const Client = require('./Client');
const {MAX_NUM_JOBS} = require('../defs');
const {after, before} = require('mocha');

describe('Indexer', () => {
  const indexer = new Indexer(() => { }, () => { });
  const indices = [];
  it('Unique index', () => {
    for (let i = 0; i < MAX_NUM_JOBS; ++i) {
      const ind = indexer.getInd();
      assert.notStrictEqual(ind, -1);
      assert.strictEqual(indices.includes(ind), false);
      indices.push(ind);
    }
  });
  it('Return -1 if no rooms available', () => {
    assert.strictEqual(indexer.getInd(), -1);
  });
  it('Get valid indices after return', () => {
    assert.ok(indexer.returnInd(indices[0]));
    let ind = indexer.getInd();
    assert.notStrictEqual(ind, -1);
    assert.strictEqual(indices.includes(ind), false);
    indices.push(ind);
  });
  it('Return -1 if no rooms available again', () => {
    assert.ok(indexer.getInd() === -1);
  });
});

describe('Network', () => {
  const {getBroadcastIp, isLocalIp} = require('./Network');
  describe('Get Broadcast IP', () => {
    const ip = '192.168.0.1';
    it('Test 1', () => {
      const netmask = '255.255.255.0';
      const expected = '192.168.0.255';
      assert.strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 2', () => {
      const netmask = '255.255.0.0';
      const expected = '192.168.255.255';
      assert.strictEqual(getBroadcastIp(ip, netmask), expected);
    });
    it('Test 3', () => {
      const netmask = '255.255.255.128';
      const expected = '192.168.0.127';
      assert.strictEqual(getBroadcastIp(ip, netmask), expected);
    });
  });
  describe('Determine is IP local', () => {
    it('Test 1', () => {
      assert.strictEqual(isLocalIp('192.168.0.1'), true);
    });
    it('Test 2', () => {
      assert.strictEqual(isLocalIp('11.111.0.1'), false);
    });
    it('Test 3', () => {
      assert.strictEqual(isLocalIp('10.11.101.200'), true);
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
      assert.ok(server);
    });
    it('reject open if ID is empty', () => {
      assert.strictEqual(server.open(ip, netmask), false);
    });
    it('set ID', () => {
      server.setMyId(serverId);
      assert.strictEqual(server.myId, serverId);
    });
    it('open', () => {
      assert.strictEqual(server.open(ip, netmask), true);
    });
    it('close', () => {
      assert.strictEqual(server.close(), true);
    });
  });
  describe('Client', () => {
    /** @type {Object.<string, import('./Common').Item>} */
    let items = null;
    before(async () => {
      items = await createItems();
    });

    it('not null', () => {
      assert.ok(client);
    });
    it('reject initiating if ID is empty', async () => {
      assert.strictEqual(await client.sendRequest(items, ip, serverId), false);
    });
    it('set ID', () => {
      client.setMyId(clientId);
      assert.strictEqual(client.myId, clientId);
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

  items[n1] = {dir: 'ddd', path: path.join(__dirname, n1), type: 'file', size: n1size};
  const n1handle = await fs.open(items[n1].path, 'w');
  await n1handle.write(crypto.randomBytes(n1size));
  await n1handle.close();
  return items;
}

/**
 * @param {Object.<string, import('./Common').Item} items
 */
async function deleteItems (items) {
  for (let itemName in items) {
    await fs.rm(items[itemName].path, {force: true});
  }
}
